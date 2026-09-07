"""
resume_matcher.py — Phase 2: Semantic Resume Matching
======================================================
Provides two deterministic scoring layers that run BEFORE Gemini is called,
so that the ATS score is reproducible and not subject to LLM hallucination.

Layer 1 — Keyword Matching (weight: 20 %)
    Extract candidate-skills tokens from the Job Description (JD) via a
    lightweight token-frequency heuristic, then check which appear in the
    resume text after Porter stemming (catches morphological variants like
    "containerized"/"containerization", "deployed"/"deployment").
    Returns keyword_match_pct (0.0–100.0).

    NOTE: Weight is intentionally low (0.2) because the extractor uses stemmed
    token matching, which is good but still misses paraphrased concepts. The
    semantic layer is more reliable for cross-vocabulary alignment.

Layer 2 — Semantic Similarity (weight: 80 %)
    Chunk JD and resume into overlapping windows, embed each chunk with the
    all-MiniLM-L6-v2 model loaded at startup, then compute the mean pairwise
    cosine similarity between JD chunks and resume chunks.
    Returns semantic_match_pct (0.0–100.0).

    Scaling constants (empirically validated on all-MiniLM-L6-v2):
    - MIN_THRESHOLD = 0.40  — raw cosine below this → weak/irrelevant match,
      capped at max 20% contribution.
    - MAX_EXPECTED_SIMILARITY = 0.70  — empirical ceiling for two differently-
      worded but semantically equivalent natural-text paragraphs. Two identical
      documents score 1.0, but distinct vocabulary describing the same concepts
      peaks at ~0.65–0.70. Scaling against 1.0 systematically underscores
      strong candidates. Scaling against 0.70 maps a genuine strong match to
      ~75–100%.

Final Score:
    ats_score = round(0.2 * keyword_match_pct + 0.8 * semantic_match_pct)

The module is intentionally side-effect-free: the embedding model is
injected as a parameter so the caller (main.py) controls lifecycle.
"""

import re
import logging
from typing import List, Tuple

import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

# NLTK Porter stemmer for morphological variant matching in Layer 1
import nltk
from nltk.stem import PorterStemmer

nltk.download("punkt", quiet=True)
nltk.download("punkt_tab", quiet=True)

_stemmer = PorterStemmer()

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Empirical scaling constants for all-MiniLM-L6-v2 (Layer 2)
# ---------------------------------------------------------------------------

# Cosine similarity below this threshold indicates weak/irrelevant alignment.
# Resumes that score below MIN_THRESHOLD are capped at max 20% semantic contribution.
# Validated: retail resume vs backend JD → raw cosine 0.33 (well below threshold).
_MIN_THRESHOLD = 0.40

# Empirical ceiling: two differently-worded but semantically equivalent paragraphs
# peak at ~0.65–0.70 with all-MiniLM-L6-v2. Using 1.0 as ceiling would halve
# effective range and systematically underscore strong candidates.
# Validated: senior backend engineer resume vs backend JD → raw cosine 0.6277.
# Scores above 0.70 are treated as near-perfect matches and clamped to 100%.
_MAX_EXPECTED_SIMILARITY = 0.70

# ---------------------------------------------------------------------------
# Stopwords — minimal set focused on removing non-skill tokens from JD
# ---------------------------------------------------------------------------
_STOPWORDS = frozenset(
    [
        "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
        "of", "with", "as", "by", "from", "is", "are", "was", "were", "be",
        "been", "have", "has", "had", "do", "does", "did", "will", "would",
        "could", "should", "may", "might", "shall", "can", "must", "we",
        "you", "he", "she", "it", "they", "our", "your", "their", "its",
        "this", "that", "these", "those", "not", "no", "nor", "so", "yet",
        "both", "either", "neither", "more", "most", "such", "than", "if",
        "then", "about", "above", "after", "before", "between", "during",
        "into", "through", "under", "up", "down", "over", "out", "off",
        "across", "along", "among", "around", "behind", "within", "without",
        "per", "vs", "etc", "eg", "ie", "including", "also",
        "work", "role", "position", "job", "candidate", "experience",
        "looking", "seeking", "required", "requirements", "preferred",
        "minimum", "years", "year", "team", "ability", "skills", "skill",
        "knowledge", "strong", "good", "excellent", "proficient", "familiar",
        "understanding", "demonstrated", "proven", "able",
        "responsible", "responsibilities", "well", "using", "use", "used",
    ]
)


# ---------------------------------------------------------------------------
# Layer 1 — Keyword Extraction + Stemmed Match
# ---------------------------------------------------------------------------

def _stem(token: str) -> str:
    """Return the Porter-stemmed form of a token."""
    return _stemmer.stem(token)


def _extract_jd_keywords(jd_text: str, max_keywords: int = 60) -> List[str]:
    """
    Extract candidate skill/technology tokens from JD text.

    Strategy:
    - Split into clauses by punctuation/newlines to avoid crossing clause
      boundaries when forming bigrams.
    - Tokenise, preserving hyphens/slashes inside tech names (ci/cd, c++).
    - Remove stopwords and pure digits.
    - Form bigrams strictly within each clause.
    - Deduplicate and return up to `max_keywords` by descending frequency.

    Note: Keywords are returned in original (unstemmed) form so the UI shows
    readable names. Stemming is applied in compute_keyword_match() at match time.
    """
    text = jd_text.lower()
    clauses = re.split(r"[,.;:\n\(\)\[\]/]+", text)

    unigrams = []
    bigrams = []

    for clause in clauses:
        raw_tokens = re.findall(r"[a-z0-9][a-z0-9+#.\-]*[a-z0-9+#]|[a-z0-9]{2,}", clause)
        valid_words = [
            t for t in raw_tokens
            if len(t) >= 2 and t not in _STOPWORDS and not t.isdigit()
        ]
        unigrams.extend(valid_words)

        # Bigrams within clause only
        for i in range(len(valid_words) - 1):
            w1, w2 = valid_words[i], valid_words[i + 1]
            bigrams.append(f"{w1} {w2}")

    all_tokens = unigrams + bigrams

    # Count frequencies and deduplicate
    freq: dict = {}
    for tok in all_tokens:
        freq[tok] = freq.get(tok, 0) + 1

    sorted_tokens = sorted(freq.keys(), key=lambda k: freq[k], reverse=True)
    return sorted_tokens[:max_keywords]


def _build_resume_stem_set(resume_text: str) -> set:
    """
    Tokenise resume text and return a set of stemmed tokens for O(1) lookup.
    Handles multi-word unigrams: for each stemmed token, also add it to the set.
    """
    tokens = re.findall(r"[a-z0-9][a-z0-9+#.\-]*[a-z0-9+#]|[a-z0-9]{2,}", resume_text.lower())
    return {_stem(t) for t in tokens}


def compute_keyword_match(resume_text: str, jd_text: str) -> Tuple[float, List[str], List[str]]:
    """
    Compute Layer 1 keyword-match score using Porter stemming.

    For each JD keyword, all component tokens are stemmed and checked against
    the stemmed resume token set. This handles morphological variants:
      - "containerization" → stem "contain"  matches  "containerized" → stem "contain"
      - "deployment"       → stem "deploy"   matches  "deployed"       → stem "deploy"
      - "scalable"         → stem "scalabl"  matches  "scalability"    → stem "scalabl"
      - "distributed"      → stem "distribut" matches "distribute"     → stem "distribut"

    The original unstemmed keyword strings are preserved in matched/missing lists
    so the UI shows readable terms, not truncated stems.

    Returns:
        keyword_match_pct: float 0–100 (percentage of JD keywords found in resume).
        matched_keywords:  list of original JD keywords present in resume.
        missing_keywords:  list of original JD keywords absent from resume.
    """
    keywords = _extract_jd_keywords(jd_text)
    if not keywords:
        logger.warning("Layer 1: No keywords extracted from JD — defaulting to 0.")
        return 0.0, [], []

    resume_stem_set = _build_resume_stem_set(resume_text)
    matched = []
    missing = []

    for kw in keywords:
        # Stem all component tokens of the keyword (handles both unigrams and bigrams)
        kw_tokens = re.findall(r"[a-z0-9]+", kw)
        kw_stems = [_stem(t) for t in kw_tokens]

        # A keyword is considered matched if ALL its stemmed tokens appear in
        # the resume's stemmed token set (order-independent — good for bigrams)
        if all(s in resume_stem_set for s in kw_stems):
            matched.append(kw)
        else:
            missing.append(kw)

    pct = (len(matched) / len(keywords)) * 100.0
    logger.info(
        f"Layer 1 keyword match (stemmed): {len(matched)}/{len(keywords)} keywords found → {pct:.1f}%"
    )
    return pct, matched, missing


# ---------------------------------------------------------------------------
# Layer 2 — Semantic Similarity via Sentence Embeddings
# ---------------------------------------------------------------------------

def _chunk_text(text: str, chunk_size: int = 200, overlap: int = 50) -> List[str]:
    """
    Split text into overlapping word-count windows.
    Ensures even short texts return at least one chunk.
    """
    words = text.split()
    if len(words) <= chunk_size:
        return [text]

    chunks = []
    start = 0
    while start < len(words):
        end = min(start + chunk_size, len(words))
        chunks.append(" ".join(words[start:end]))
        if end == len(words):
            break
        start += chunk_size - overlap
    return chunks


def compute_semantic_similarity(
    resume_text: str,
    jd_text: str,
    embedding_model,
    sections: dict = None,
) -> float:
    """
    Compute Layer 2 semantic similarity score.

    Chunks both texts, embeds each chunk with the injected SentenceTransformer,
    then computes mean of the *row-wise max* cosine similarities between every
    JD chunk and all resume chunks (each JD chunk gets matched to its best
    resume chunk — robust against order differences).

    Scaling uses empirically validated constants for all-MiniLM-L6-v2:

    MIN_THRESHOLD = 0.40:
        Raw cosine below this → weak/irrelevant alignment. Score is capped at
        max 20 (weak signal region), preventing irrelevant resumes from getting
        inflated scores due to shared generic language.

    MAX_EXPECTED_SIMILARITY = 0.70:
        Empirical ceiling for two differently-worded but semantically equivalent
        natural-text paragraphs with all-MiniLM-L6-v2. Using 1.0 as ceiling
        would map a raw cosine of 0.63 (excellent match) to only 38/100 —
        systematically underscoring strong candidates. Scaling against 0.70
        correctly maps the same score to ~76/100. Scores above 0.70 (near-
        identical texts) are clamped to 100.

    Returns:
        semantic_match_pct: float 0–100.
    """
    jd_chunks = _chunk_text(jd_text)

    if sections:
        resume_chunks = []
        chunk_weights = []
        weights_map = {
            "experience": 1.0,
            "projects": 1.0,
            "skills": 0.9,
            "summary": 0.8,
            "education": 0.7,
            "other": 0.6
        }
        for sec_name, sec_text in sections.items():
            if not sec_text.strip():
                continue
            sec_chunks = _chunk_text(sec_text)
            weight = weights_map.get(sec_name, 0.6)
            resume_chunks.extend(sec_chunks)
            chunk_weights.extend([weight] * len(sec_chunks))
    else:
        resume_chunks = _chunk_text(resume_text)
        chunk_weights = [1.0] * len(resume_chunks)

    logger.info(
        f"Layer 2 semantic: encoding {len(jd_chunks)} JD chunk(s) "
        f"and {len(resume_chunks)} resume chunk(s)."
    )

    # Encode — convert_to_numpy=True is more efficient for sklearn
    jd_embeddings = embedding_model.encode(jd_chunks, convert_to_numpy=True)
    resume_embeddings = embedding_model.encode(resume_chunks, convert_to_numpy=True)

    # (num_jd_chunks, num_resume_chunks) similarity matrix
    sim_matrix = cosine_similarity(jd_embeddings, resume_embeddings)

    # Apply section weights to the similarity matrix
    weights_array = np.array(chunk_weights)
    weighted_sim_matrix = sim_matrix * weights_array

    # Best-match per JD chunk → mean across all JD chunks
    best_per_jd = weighted_sim_matrix.max(axis=1)  # shape: (num_jd_chunks,)
    raw_similarity = float(np.mean(best_per_jd))

    logger.info(f"Layer 2 raw cosine similarity: {raw_similarity:.4f}")

    # Map raw cosine to 0–100 using empirical bounds
    if raw_similarity < _MIN_THRESHOLD:
        # Weak alignment region: raw < 0.40
        # Scale 0→_MIN_THRESHOLD linearly to 0→20 (capped weak contribution)
        pct = (raw_similarity / _MIN_THRESHOLD) * 20.0
    else:
        # Strong alignment region: raw >= 0.40
        # Scale _MIN_THRESHOLD→_MAX_EXPECTED_SIMILARITY linearly to 0→100
        # Clamp: anything at or above _MAX_EXPECTED_SIMILARITY scores 100
        pct = (raw_similarity - _MIN_THRESHOLD) / (_MAX_EXPECTED_SIMILARITY - _MIN_THRESHOLD) * 100.0
        pct = min(pct, 100.0)  # scores above 0.70 → perfect match, cap at 100

    pct = max(0.0, pct)
    logger.info(f"Layer 2 semantic match score: {pct:.1f}%")
    return pct


# ---------------------------------------------------------------------------
# Combined ATS Score
# ---------------------------------------------------------------------------

def compute_ats_score(keyword_pct: float, semantic_pct: float) -> int:
    """
    Combine Layer 1 and Layer 2 into the final ATS score.

    Formula: ats_score = round(0.2 * keyword_pct + 0.8 * semantic_pct)

    Weight rationale:
    - Keyword layer weight is low (0.2) because it uses stemmed token matching,
      which cannot detect paraphrased concepts or synonyms. A strong candidate
      who describes Docker experience without using the exact JD term
      "containerization" would be penalised without a lower keyword weight.
    - Semantic layer dominates (0.8) because all-MiniLM-L6-v2 embedding
      similarity captures meaning across vocabulary differences, making it
      a more reliable signal for genuine role fit.
    """
    score = round(0.2 * keyword_pct + 0.8 * semantic_pct)
    return max(0, min(100, int(score)))

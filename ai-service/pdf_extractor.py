"""
Structure-aware PDF text extraction using pymupdf (fitz).
Preserves section headers and bullet structure for better semantic chunking.
Also provides word-level coordinate extraction for highlight overlays.
"""
import re
import logging
from typing import List, Dict, Any, Tuple

import pymupdf

logger = logging.getLogger(__name__)

def extract_resume_sections(pdf_bytes: bytes) -> dict:
    """
    Extract resume text with section awareness.
    Returns:
    {
      "full_text": str,           # complete text for keyword matching
      "sections": {               # structured sections for semantic chunking
        "skills": str,
        "experience": str,
        "projects": str,
        "education": str,
        "summary": str,
        "other": str
      }
    }
    """
    try:
        doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    except Exception as e:
        print(f"Error opening PDF with pymupdf: {e}")
        return {"full_text": "", "sections": {}}

    sections = {
        "skills": "",
        "experience": "",
        "projects": "",
        "education": "",
        "summary": "",
        "other": ""
    }
    
    full_text_parts = []
    
    section_keywords = {
        "skills": ["SKILLS", "TECHNICAL SKILLS", "CORE COMPETENCIES"],
        "experience": ["EXPERIENCE", "WORK EXPERIENCE", "EMPLOYMENT HISTORY", "PROFESSIONAL EXPERIENCE"],
        "projects": ["PROJECTS", "PERSONAL PROJECTS", "ACADEMIC PROJECTS"],
        "education": ["EDUCATION", "ACADEMIC BACKGROUND", "CERTIFICATIONS"],
        "summary": ["SUMMARY", "OBJECTIVE", "PROFESSIONAL SUMMARY", "ABOUT ME"]
    }
    
    current_section = "other"
    
    for page in doc:
        blocks = page.get_text("blocks")
        # Blocks are usually sorted, but sorting by y0 then x0 ensures reading order
        blocks.sort(key=lambda b: (b[1], b[0]))
        
        for b in blocks:
            # Block type 0 is text
            if b[6] != 0:
                continue
                
            text = b[4].strip()
            if not text:
                continue
                
            full_text_parts.append(text)
            
            # Simple heuristic: check if the first line matches a known section keyword (case-insensitive)
            text_upper = text.upper()
            lines = [l.strip() for l in text_upper.split('\n') if l.strip()]
            first_line = lines[0] if lines else ""
            
            is_header = False
            # Clean first line (remove trailing colons etc)
            clean_first = first_line.rstrip(':').strip()
            
            if len(clean_first.split()) <= 4:
                for sec_name, keywords in section_keywords.items():
                    if any(kw == clean_first for kw in keywords):
                        current_section = sec_name
                        is_header = True
                        break
            
            if is_header:
                original_lines = b[4].strip().split('\n')
                rest = "\n".join(original_lines[1:]).strip()
                if rest:
                    sections[current_section] += rest + "\n\n"
            else:
                sections[current_section] += text + "\n\n"
                
    doc.close()
    
    return {
        "full_text": "\n\n".join(full_text_parts),
        "sections": {k: v.strip() for k, v in sections.items() if v.strip()}
    }


# ---------------------------------------------------------------------------
# Word-level coordinate extraction for highlight overlays
# ---------------------------------------------------------------------------

def extract_word_coordinates(pdf_bytes: bytes) -> Dict[str, Any]:
    """
    Extract every word from the PDF with its exact bounding box.
    
    Uses pymupdf's page.get_text("words") which returns tuples of:
        (x0, y0, x1, y1, word, block_no, line_no, word_no)
    
    Coordinate system: origin is TOP-LEFT of each page.
    Units are PDF points (1 point = 1/72 inch).
    
    Returns:
    {
        "words": [
            {"page": 0, "text": "Java", "rect": [x0, y0, x1, y1],
             "block_no": 0, "line_no": 0, "word_no": 0},
            ...
        ],
        "page_dimensions": [
            {"width": 612.0, "height": 792.0},  # page 0
            ...
        ]
    }
    """
    try:
        doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    except Exception as e:
        logger.error(f"Error opening PDF for word extraction: {e}")
        return {"words": [], "page_dimensions": []}

    all_words = []
    page_dims = []

    for page_idx, page in enumerate(doc):
        rect = page.rect
        page_dims.append({
            "width": round(rect.width, 2),
            "height": round(rect.height, 2),
        })

        words = page.get_text("words")
        for w in words:
            # w = (x0, y0, x1, y1, word, block_no, line_no, word_no)
            all_words.append({
                "page": page_idx,
                "text": w[4],
                "rect": [round(w[0], 2), round(w[1], 2), round(w[2], 2), round(w[3], 2)],
                "block_no": w[5],
                "line_no": w[6],
                "word_no": w[7],
            })

    doc.close()
    return {"words": all_words, "page_dimensions": page_dims}


def _normalize_for_match(text: str) -> str:
    """Normalize text for fuzzy matching: lowercase, strip punctuation edges."""
    return re.sub(r'^[^\w]+|[^\w]+$', '', text.lower())


def build_highlight_map(
    word_data: Dict[str, Any],
    matched_keywords: List[str],
    missing_keywords: List[str],
    strengths: List[str] = None,
    weaknesses: List[str] = None,
    suggestions: List[str] = None,
) -> List[Dict[str, Any]]:
    """
    Match ATS-identified keywords, strengths, suggestions, and weaknesses
    against extracted word coordinates.
    
    Returns a list of highlight rects:
    [
        {
            "page": 0,
            "text": "Java",
            "rect": [x0, y0, x1, y1],       # PDF points, top-left origin
            "type": "matched_keyword"         # "matched_keyword" (green), "suggestion" (yellow), or "missing_keyword" (red)
        },
        ...
    ]
    """
    words = word_data.get("words", [])
    if not words:
        return []

    highlights = []
    seen_positions = set()  # avoid duplicate highlights at same position

    def _find_single_word(keyword_text: str, highlight_type: str):
        """Find all word boxes matching a single token."""
        norm_kw = _normalize_for_match(keyword_text)
        if not norm_kw or len(norm_kw) < 2:
            return
        for w in words:
            norm_w = _normalize_for_match(w["text"])
            if norm_w == norm_kw:
                pos_key = (w["page"], tuple(w["rect"]))
                if pos_key not in seen_positions:
                    seen_positions.add(pos_key)
                    clean_text = w["text"].strip(",.;:!?()[]{}'\"") or w["text"]
                    highlights.append({
                        "page": w["page"],
                        "text": clean_text,
                        "rect": w["rect"],
                        "type": highlight_type,
                    })

    def _find_multi_word(keyword_text: str, highlight_type: str):
        """Find consecutive word sequences matching a multi-word phrase."""
        tokens = keyword_text.lower().split()
        n = len(tokens)
        if n < 2:
            return

        for i in range(len(words) - n + 1):
            # All words must be on the same page
            if any(words[i + j]["page"] != words[i]["page"] for j in range(n)):
                continue
            # All words must be on the same line (same block + line)
            if any(
                words[i + j]["block_no"] != words[i]["block_no"] or
                words[i + j]["line_no"] != words[i]["line_no"]
                for j in range(n)
            ):
                continue

            # Check text match
            matched = True
            for j in range(n):
                norm_w = _normalize_for_match(words[i + j]["text"])
                if norm_w != tokens[j]:
                    matched = False
                    break

            if matched:
                # Merge bounding boxes: union of all word rects
                x0 = min(words[i + j]["rect"][0] for j in range(n))
                y0 = min(words[i + j]["rect"][1] for j in range(n))
                x1 = max(words[i + j]["rect"][2] for j in range(n))
                y1 = max(words[i + j]["rect"][3] for j in range(n))
                merged_text = " ".join(
                    words[i + j]["text"].strip(",.;:!?()[]{}'\"") or words[i + j]["text"]
                    for j in range(n)
                )
                pos_key = (words[i]["page"], (x0, y0, x1, y1))
                if pos_key not in seen_positions:
                    seen_positions.add(pos_key)
                    highlights.append({
                        "page": words[i]["page"],
                        "text": merged_text,
                        "rect": [round(x0, 2), round(y0, 2), round(x1, 2), round(y1, 2)],
                        "type": highlight_type,
                    })

    # 1. Process matched keywords (Green)
    for kw in matched_keywords:
        kw_stripped = kw.strip()
        if not kw_stripped:
            continue
        tokens = kw_stripped.split()
        if len(tokens) == 1:
            _find_single_word(kw_stripped, "matched_keyword")
        else:
            _find_multi_word(kw_stripped, "matched_keyword")

    # 2. Process strengths (Green) - match specific technical phrases from strengths
    if strengths:
        for st in strengths:
            # Extract significant 1-3 word phrases from strength statements
            cleaned = re.sub(r'[^\w\s-]', '', st)
            for phrase in re.findall(r'\b[A-Z][a-zA-Z0-9+#.-]+(?:\s+[A-Za-z0-9+#.-]+){0,2}\b', cleaned):
                p_str = phrase.strip()
                if len(p_str) > 3 and p_str.lower() not in {"experience", "strong", "proficient", "demonstrated"}:
                    tokens = p_str.split()
                    if len(tokens) == 1:
                        _find_single_word(p_str, "matched_keyword")
                    else:
                        _find_multi_word(p_str, "matched_keyword")

    # 3. Process suggestions & unquantified bullet points (Yellow)
    if suggestions:
        for sg in suggestions:
            cleaned = re.sub(r'[^\w\s-]', '', sg)
            for phrase in re.findall(r'\b[a-zA-Z0-9+#.-]+(?:\s+[a-zA-Z0-9+#.-]+){1,2}\b', cleaned):
                p_str = phrase.strip()
                if len(p_str) > 5 and any(w in p_str.lower() for w in ["metric", "quantif", "percent", "scale", "impact", "rate"]):
                    _find_multi_word(p_str, "suggestion")

    # Detect bullet lines in word_data that lack quantifiable metrics (numbers/%)
    # Group words by (page, block_no, line_no)
    line_groups = {}
    for w in words:
        k = (w["page"], w["block_no"], w["line_no"])
        if k not in line_groups:
            line_groups[k] = []
        line_groups[k].append(w)

    for (pg, blk, ln), line_words in line_groups.items():
        if len(line_words) >= 4:
            line_text = " ".join(w["text"] for w in line_words)
            first_word = line_words[0]["text"].strip()
            is_bullet = first_word in {"•", "-", "*", "–"} or bool(re.match(r'^[A-Z][a-z]+ed\b', first_word))
            has_numbers = bool(re.search(r'\b\d+(\.\d+)?%?\b|\$\d+', line_text))
            if is_bullet and not has_numbers and len(line_text) > 30:
                # Highlight the first 2-3 words (the action phrase) in yellow
                sub_words = line_words[:min(3, len(line_words))]
                x0 = min(w["rect"][0] for w in sub_words)
                y0 = min(w["rect"][1] for w in sub_words)
                x1 = max(w["rect"][2] for w in sub_words)
                y1 = max(w["rect"][3] for w in sub_words)
                action_text = " ".join(w["text"] for w in sub_words)
                pos_key = (pg, (x0, y0, x1, y1))
                if pos_key not in seen_positions:
                    seen_positions.add(pos_key)
                    highlights.append({
                        "page": pg,
                        "text": f"{action_text} (Quantify with metrics)",
                        "rect": [round(x0, 2), round(y0, 2), round(x1, 2), round(y1, 2)],
                        "type": "suggestion",
                    })

    # 4. Process missing keywords & weaknesses (Red)
    for kw in missing_keywords:
        kw_stripped = kw.strip()
        if not kw_stripped:
            continue
        tokens = kw_stripped.split()
        if len(tokens) == 1:
            _find_single_word(kw_stripped, "missing_keyword")
        else:
            _find_multi_word(kw_stripped, "missing_keyword")

    if weaknesses:
        for wk in weaknesses:
            cleaned = re.sub(r'[^\w\s-]', '', wk)
            for phrase in re.findall(r'\b[A-Z][a-zA-Z0-9+#.-]+(?:\s+[A-Za-z0-9+#.-]+){0,2}\b', cleaned):
                p_str = phrase.strip()
                if len(p_str) > 3 and p_str.lower() not in {"lack", "missing", "limited", "needs", "weakness"}:
                    tokens = p_str.split()
                    if len(tokens) == 1:
                        _find_single_word(p_str, "missing_keyword")
                    else:
                        _find_multi_word(p_str, "missing_keyword")

    logger.info(f"Highlight map built: {len(highlights)} highlight(s) mapped to coordinates.")
    return highlights

"""
InterviewIQ AI - AI Runtime Microservice
=========================================
FastAPI microservice that orchestrates all AI processing via a hybrid pipeline:
- Groq Whisper Large v3 for speech-to-text transcription.
- Groq Qwen 3.8 27B (qwen/qwen3.8-27b) for interview evaluation reasoning.
- Groq Qwen 3.8 27B (qwen/qwen3.8-27b) for question generation.
- Resume analysis: gemini-3.8-flash (primary) with automatic fallback to
  gemini-3-flash-preview on quota/rate-limit or service-unavailable errors (narrative-only, score from matcher).
- SentenceTransformer (all-MiniLM-L6-v2) for local semantic resume matching.
Handles resume analysis and interview answer evaluation.
"""

import os
import json
import logging
import asyncio
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai.errors import APIError
from groq import Groq

from schemas.resume import ResumeAnalysisResponse
from schemas.interview import InterviewEvaluationResponse, CodeEvaluationRequest
from resume_matcher import compute_keyword_match, compute_semantic_similarity, compute_ats_score
from pdf_extractor import extract_resume_sections, extract_word_coordinates, build_highlight_map

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ==================== AI Client Initialization ====================

gemini_client = None
groq_client = None
embedding_model = None  # Phase 2: Lazy-loaded on first resume analysis request to conserve RAM

def get_embedding_model():
    """
    Lazy-load SentenceTransformer on first demand to prevent OOM errors on 512MB RAM cloud tiers.
    Configures single-thread CPU execution to minimize thread memory overhead.
    """
    global embedding_model
    if embedding_model is None:
        logger.info("Lazy-loading SentenceTransformer (all-MiniLM-L6-v2) on demand...")
        try:
            import torch
            torch.set_num_threads(1)
        except Exception:
            pass
        from sentence_transformers import SentenceTransformer
        embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
        logger.info("SentenceTransformer loaded successfully.")
    return embedding_model

def get_gemini_client():
    """Retrieve or lazily initialize the Gemini client."""
    global gemini_client
    if gemini_client is None:
        key = os.getenv("GEMINI_API_KEY")
        if key:
            gemini_client = genai.Client(api_key=key.strip())
    if gemini_client is None:
        raise HTTPException(
            status_code=500,
            detail="GEMINI_API_KEY environment variable is not configured on the AI microservice. Please set it in Render dashboard.",
        )
    return gemini_client

def get_groq_client():
    """Retrieve or lazily initialize the Groq client."""
    global groq_client
    if groq_client is None:
        key = os.getenv("GROQ_API_KEY")
        if key:
            groq_client = Groq(api_key=key.strip())
    if groq_client is None:
        raise HTTPException(
            status_code=500,
            detail="GROQ_API_KEY environment variable is not configured on the AI microservice. Please set it in Render dashboard.",
        )
    return groq_client

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize Gemini and Groq clients on startup without blocking on heavy ML models."""
    global gemini_client, groq_client

    gemini_api_key = os.getenv("GEMINI_API_KEY")
    if gemini_api_key:
        try:
            gemini_client = genai.Client(api_key=gemini_api_key.strip())
            logger.info("Gemini AI client initialized successfully.")
        except Exception as e:
            logger.error(f"Failed to initialize Gemini AI client: {e}")
    else:
        logger.warning("GEMINI_API_KEY environment variable is not set. Requests requiring Gemini will return 500.")

    groq_api_key = os.getenv("GROQ_API_KEY")
    if groq_api_key:
        try:
            groq_client = Groq(api_key=groq_api_key.strip())
            logger.info("Groq AI client initialized successfully.")
        except Exception as e:
            logger.error(f"Failed to initialize Groq AI client: {e}")
    else:
        logger.warning("GROQ_API_KEY environment variable is not set. Requests requiring Groq will return 500.")

    yield
    logger.info("AI Microservice shutting down.")

# ==================== FastAPI Application ====================

app = FastAPI(
    title="InterviewIQ AI Microservice",
    description="AI orchestration layer for resume analysis and interview evaluation powered by Groq Whisper and Gemini.",
    version="1.1.0",
    lifespan=lifespan,
)

cors_origins_env = os.getenv(
    "CORS_ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:3000,http://localhost:8080,http://127.0.0.1:5173,http://127.0.0.1:3000",
)
allowed_origins_list = [origin.strip() for origin in cors_origins_env.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== Health Check ====================

@app.get("/health", tags=["System"])
async def health_check():
    """Health check endpoint to verify the microservice is running."""
    return {
        "status": "healthy",
        "service": "InterviewIQ AI Microservice",
        "version": app.version,
        "gemini_configured": gemini_client is not None,
        "groq_configured": groq_client is not None,
    }


# ==================== Resume Analysis Endpoint ====================

@app.post("/api/v1/ai/analyze-resume", response_model=ResumeAnalysisResponse, tags=["Resume Analysis"])
async def analyze_resume(
    job_description: str = Form(...),
    resume_file: UploadFile = File(None),
    resume_text: str = Form(None)
):
    """
    Analyze a resume against a job description using a 3-layer pipeline (Phase 2).

    Layer 1 — Keyword Matching (deterministic, weight 40 %):
        Extracts skill/tech tokens from the JD and checks literal presence in resume.
    Layer 2 — Semantic Similarity (deterministic, weight 60 %):
        Embeds JD and resume chunks with all-MiniLM-L6-v2, computes cosine similarity.
    Layer 3 — Gemini Narrative (generative, score is READ-ONLY):
        Receives the pre-computed score and structured match data; writes strengths,
        weaknesses, suggestions, and interview questions. Does NOT recompute the score.

    Returns ATS score, missing keywords, strengths, weaknesses, suggestions, and 5
    role-specific interview questions.
    """
    logger.info("Received resume analysis request (Phase 2 — 3-layer pipeline).")
    
    # Phase 7: Extract text from PDF if file is provided, else use resume_text
    sections = {}
    pdf_bytes = None  # retain for coordinate extraction
    is_pdf = resume_file is not None
    if resume_file:
        logger.info("Extracting resume text from PDF bytes via pymupdf.")
        pdf_bytes = await resume_file.read()
        extraction_result = extract_resume_sections(pdf_bytes)
        active_resume_text = extraction_result.get("full_text", "")
        sections = extraction_result.get("sections", {})
        if sections:
            logger.info(f"PDF sections detected: {list(sections.keys())}")
    else:
        active_resume_text = resume_text or ""

    if not active_resume_text.strip():
        raise HTTPException(status_code=400, detail="Could not extract readable text from resume.")

    # ---- Layer 1: Keyword Matching ----
    keyword_pct, matched_keywords, missing_keywords = compute_keyword_match(
        resume_text=active_resume_text,
        jd_text=job_description,
    )

    # ---- Layer 2: Semantic Similarity ----
    model = get_embedding_model()

    semantic_pct = compute_semantic_similarity(
        resume_text=active_resume_text,
        jd_text=job_description,
        embedding_model=model,
        sections=sections,
    )

    # ---- Combined ATS Score (formula: 0.4 * keyword + 0.6 * semantic) ----
    ats_score = compute_ats_score(keyword_pct, semantic_pct)
    logger.info(
        f"ATS score computed: {ats_score} "
        f"(keyword={keyword_pct:.1f}%, semantic={semantic_pct:.1f}%)"
    )

    # ---- Coordinate-based highlight extraction (PDF only) ----
    word_data = {}
    page_dimensions = []
    if is_pdf and pdf_bytes:
        try:
            word_data = extract_word_coordinates(pdf_bytes)
            page_dimensions = word_data.get("page_dimensions", [])
        except Exception as e:
            logger.warning(f"Word coordinate extraction failed (non-fatal): {e}")
            word_data = {}
            page_dimensions = []

    # ---- Layer 3: Gemini Narrative (narrative only — score is locked) ----
    # Provide Gemini the pre-computed score and match context so it can write
    # coherent narrative without recalculating numbers.
    gemini_system_prompt = """You are an expert career coach and technical recruiter.
You will be given a candidate's resume, a target job description, and a pre-computed
ATS compatibility score that has already been calculated algorithmically.

Your ONLY tasks are:
1. List the candidate's concrete strengths relative to the job description (3–6 bullet points).
2. List the candidate's genuine gaps or weaknesses relative to the job description (2–5 bullet points).
3. Provide specific, actionable resume improvement suggestions (3–6 bullet points).
4. Generate exactly 5 role-specific interview questions (mix of technical and behavioral)
   based on the job description and resume content. Do NOT repeat generic questions.

CRITICAL CONSTRAINT:
- Do NOT modify, recalculate, or echo back the ATS score — it is already computed.
- Do NOT include a score field in your response.

You MUST respond with ONLY a valid JSON object in exactly this format, with no additional text:
{
    "strengths": ["strength1", "strength2", ...],
    "weaknesses": ["weakness1", "weakness2", ...],
    "suggestions": ["suggestion1", "suggestion2", ...],
    "generatedQuestions": ["question1", "question2", "question3", "question4", "question5"]
}"""

    # Build match context to help Gemini write relevant narrative
    matched_sample = ", ".join(matched_keywords[:20]) if matched_keywords else "none identified"
    missing_sample = ", ".join(missing_keywords[:20]) if missing_keywords else "none"

    gemini_user_prompt = f"""PRE-COMPUTED MATCH CONTEXT (do NOT recompute score):
- ATS Score: {ats_score}/100 (algorithmically determined — treat as read-only)
- Keyword match rate: {keyword_pct:.0f}% ({len(matched_keywords)} of {len(matched_keywords) + len(missing_keywords)} JD keywords found in resume)
- Semantic similarity: {semantic_pct:.0f}% (embedding-based)
- JD keywords FOUND in resume (matched): {matched_sample}
- JD keywords MISSING from resume: {missing_sample}

RESUME TEXT:
{active_resume_text}

JOB DESCRIPTION:
{job_description}"""

    # ---- Gemini call with two-tier fallback ----
    # Primary: gemini-3.8-flash (explicitly pinned, not an alias)
    # Fallback: gemini-3-flash-preview (same provider, on 429 quota/rate-limit or 503 unavailable)
    gemini_contents = [
        {"role": "user", "parts": [{"text": gemini_system_prompt + "\n\n" + gemini_user_prompt}]}
    ]

    raw_text = ""
    served_by = "gemini-3.8-flash"
    try:
        response = gemini_client.models.generate_content(
            model="gemini-3.8-flash",
            contents=gemini_contents,
        )
    except APIError as e:
        if e.code in (429, 503):
            logger.warning(
                f"gemini-3.8-flash unavailable (HTTP {e.code}) — "
                f"falling back to gemini-3-flash-preview"
            )
            served_by = "gemini-3-flash-preview"
            try:
                response = gemini_client.models.generate_content(
                    model="gemini-3-flash-preview",
                    contents=gemini_contents,
                )
            except Exception as fallback_err:
                logger.error(f"Gemini fallback (gemini-3-flash-preview) also failed: {fallback_err}")
                raise HTTPException(status_code=502, detail=f"AI processing failed: {str(fallback_err)}")
        else:
            # Non-transient API error (auth, bad request, internal server error, etc.) — fail immediately
            logger.error(f"Gemini API error (code={e.code}): {e}")
            raise HTTPException(status_code=502, detail=f"AI processing failed: {str(e)}")
    except Exception as e:
        logger.error(f"Gemini narrative API call failed: {e}")
        raise HTTPException(status_code=502, detail=f"AI processing failed: {str(e)}")

    try:
        raw_text = response.text.strip()
        if raw_text.startswith("```json"):
            raw_text = raw_text[7:]
        if raw_text.startswith("```"):
            raw_text = raw_text[3:]
        if raw_text.endswith("```"):
            raw_text = raw_text[:-3]
        raw_text = raw_text.strip()

        result = json.loads(raw_text)
        logger.info(f"Gemini narrative generation completed (served by {served_by}). Assembling final response.")

        # Build comprehensive highlight map with matched keywords, strengths, suggestions, and weaknesses
        highlights = []
        if is_pdf and word_data:
            try:
                highlights = build_highlight_map(
                    word_data=word_data,
                    matched_keywords=matched_keywords,
                    missing_keywords=missing_keywords,
                    strengths=result.get("strengths", []),
                    weaknesses=result.get("weaknesses", []),
                    suggestions=result.get("suggestions", []),
                )
            except Exception as e:
                logger.warning(f"Highlight map construction failed (non-fatal): {e}")
                highlights = []

        return ResumeAnalysisResponse(
            ats_score=ats_score,  # always use the deterministic score, never Gemini's
            missing_keywords=missing_keywords[:20],  # top 20 missing JD keywords
            matched_keywords=matched_keywords[:30],  # matched JD keywords found in resume
            resume_text=active_resume_text,
            sections=sections,
            strengths=result.get("strengths", []),
            weaknesses=result.get("weaknesses", []),
            suggestions=result.get("suggestions", []),
            generated_questions=result.get("generatedQuestions", [])[:5],
            highlights=highlights,
            page_dimensions=page_dimensions,
        )

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse Gemini narrative response as JSON (served by {served_by}): {e}")
        logger.error(f"Raw response: {raw_text}")
        raise HTTPException(status_code=502, detail="AI service returned an invalid response format.")


# ==================== Question Planning Helpers (Coding & SQL Balance) ====================

def is_coding_question_text(q_text: str) -> bool:
    """Check if an interview question requires hands-on coding or SQL implementation."""
    if not q_text:
        return False
    coding_indicators = [
        "write a function", "write code", "write a program", "write a sql",
        "write a query", "implement a function", "implement an algorithm",
        "implement a method", "write an algorithm", "code a", "write a script",
        "in the code editor", "sql query", "write a solution",
        "implement a class", "write the logic", "create a function", "create a query",
        "write an sql", "select query", "write a leetcode", "write a method",
        "write an implementation", "code answer", "sql statement"
    ]
    q_lower = q_text.lower()
    return any(indicator in q_lower for indicator in coding_indicators)


def build_next_question_guidance(job_description: str, history_list: list, current_question: str) -> str:
    """
    Build structured prompt guidance ensuring that in a 5-question interview session,
    at least 2 questions require practical hands-on coding or SQL implementation.
    """
    current_q_num = len(history_list) + 1  # 1-indexed (e.g. Q1, Q2, Q3, Q4)
    next_q_num = current_q_num + 1         # The question being generated (e.g. Q2, Q3, Q4, Q5)

    all_past_questions = list(history_list) + [current_question]
    coding_questions_asked = sum(1 for q in all_past_questions if is_coding_question_text(str(q)))
    remaining_slots = 5 - current_q_num  # slots left including next_q_num
    needed_coding = max(0, 2 - coding_questions_asked)

    # Force coding question on Question 2 and Question 4 by default,
    # or whenever needed to hit the target of at least 2 coding questions out of 5.
    must_be_coding = (next_q_num in [2, 4]) or (needed_coding >= remaining_slots)

    # Detect if role emphasizes SQL/Databases/Data Analysis
    jd_lower = job_description.lower()
    has_sql_or_data = any(k in jd_lower for k in [
        "sql", "database", "data analyst", "data engineer", "bi ", "data science",
        "postgres", "mysql", "queries", "analytics", "etl", "warehouse", "relational"
    ])

    if must_be_coding:
        if has_sql_or_data:
            role_guidance = (
                "Since this role involves data/databases/SQL, you are strongly encouraged to ask a practical "
                "SQL query problem (e.g., 'Write a SQL query using JOINs, window functions, or GROUP BY to find...'), "
                "or a data manipulation coding problem in Python/JavaScript."
            )
        else:
            role_guidance = (
                "Ask a practical coding or algorithm problem in Python, JavaScript, Java, C++, or SQL appropriate for the role "
                "(e.g., 'In the code editor, write a function that...', 'Implement an algorithm to...')."
            )

        return f"""CRITICAL REQUIREMENT FOR QUESTION {next_q_num} of 5 (MANDATORY HANDS-ON CODING OR SQL CHALLENGE):
The next question MUST be a practical CODING or SQL problem where the candidate writes actual code or a SQL query in the coding platform.
{role_guidance}
- Instruct the candidate explicitly to write their solution in the code editor (e.g., 'In the code editor, please write a function to...' or 'Write a SQL query that retrieves...').
- Provide clear problem requirements, expected input/output or table schema context.
- DO NOT ask a purely theoretical, conceptual, or verbal question for Question {next_q_num}. The candidate MUST be asked to produce code or SQL."""
    else:
        return f"""GUIDANCE FOR QUESTION {next_q_num} of 5:
Generate an insightful technical, architectural, system design, or debugging question that progressively challenges the candidate based on their previous answers and the job description."""


def load_audio_array(audio_bytes: bytes):
    """
    Decodes arbitrary audio bytes (WebM, Opus, MP4, AAC, WAV, OGG) into a 1D float32 numpy array
    at 16,000 Hz mono for vocal prosody analysis.
    Uses soundfile directly if already WAV/FLAC, or converts via ffmpeg if available.
    """
    import io
    import soundfile as sf
    import subprocess
    import tempfile
    import os
    import numpy as np

    # 1. Fast path: try soundfile directly (works if input is uncompressed WAV/FLAC/OGG)
    try:
        y, sr = sf.read(io.BytesIO(audio_bytes), dtype="float32")
        if y.ndim > 1:
            y = y.mean(axis=1)
        return y, sr
    except Exception:
        pass

    # 2. In-memory pipe conversion via ffmpeg
    try:
        cmd = [
            "ffmpeg",
            "-hide_banner",
            "-loglevel", "error",
            "-y",
            "-i", "pipe:0",
            "-vn",
            "-acodec", "pcm_s16le",
            "-ac", "1",
            "-ar", "16000",
            "-f", "wav",
            "pipe:1"
        ]
        proc = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        wav_data, err = proc.communicate(input=audio_bytes, timeout=10)
        if proc.returncode == 0 and wav_data:
            y, sr = sf.read(io.BytesIO(wav_data), dtype="float32")
            if y.ndim > 1:
                y = y.mean(axis=1)
            return y, sr
        elif err:
            logger.debug(f"ffmpeg pipe conversion stderr: {err.decode(errors='ignore')}")
    except Exception as pipe_err:
        logger.debug(f"ffmpeg pipe conversion failed: {pipe_err}")

    # 3. Disk-based fallback with NamedTemporaryFile (for formats/containers requiring seekable input)
    temp_in = None
    temp_out = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as f_in:
            f_in.write(audio_bytes)
            temp_in = f_in.name

        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f_out:
            temp_out = f_out.name

        cmd = [
            "ffmpeg",
            "-hide_banner",
            "-loglevel", "error",
            "-y",
            "-i", temp_in,
            "-vn",
            "-acodec", "pcm_s16le",
            "-ac", "1",
            "-ar", "16000",
            temp_out
        ]
        res = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, timeout=10)
        if res.returncode == 0 and os.path.exists(temp_out) and os.path.getsize(temp_out) > 0:
            y, sr = sf.read(temp_out, dtype="float32")
            if y.ndim > 1:
                y = y.mean(axis=1)
            return y, sr
        elif res.stderr:
            logger.debug(f"ffmpeg disk conversion stderr: {res.stderr.decode(errors='ignore')}")
    except Exception as disk_err:
        logger.debug(f"ffmpeg disk conversion failed: {disk_err}")
    finally:
        if temp_in and os.path.exists(temp_in):
            try: os.remove(temp_in)
            except Exception: pass
        if temp_out and os.path.exists(temp_out):
            try: os.remove(temp_out)
            except Exception: pass

    raise ValueError("Could not decode audio into PCM format using soundfile or ffmpeg.")


# ==================== Interview Answer Evaluation Endpoint ====================

@app.post("/api/v1/ai/evaluate-answer", response_model=InterviewEvaluationResponse, tags=["Interview Evaluation"])
async def evaluate_answer(
    file: UploadFile = File(..., description="Audio file (WebM/WAV) of the candidate's spoken answer"),
    question_text: str = Form(..., description="The interview question that was asked"),
    job_description: str = Form(..., description="The target job description for context"),
    question_history: str = Form(default="[]", description="JSON array of previous questions in this session"),
    duration_seconds: str = Form(default=None, description="Client-measured recording duration in seconds (fallback for speaking pace)"),
):
    """
    Evaluate a candidate's spoken interview answer using a hybrid AI pipeline:
    Step 1 — Groq Whisper Large v3 transcribes audio to text (verbose_json for duration).
    Step 2 — Compute speaking pace from transcript word count and audio duration.
    Step 3 — Groq evaluates the transcript and generates the next question (text-only).
    Returns transcript, 8 evaluation metrics, and the next interview question.
    """
    logger.info(f"Received answer evaluation request. Question: {question_text[:80]}...")

    audio_bytes = await file.read()
    mime_type = file.content_type or "audio/webm"
    if mime_type.startswith("video/"):
        logger.info(f"Mapping video mime type {mime_type} to audio equivalent for audio-only evaluation.")
        mime_type = mime_type.replace("video/", "audio/", 1)
    logger.info(f"Audio file received: {file.filename}, size: {len(audio_bytes)} bytes, type: {mime_type}")

    try:
        await file.close()
    except Exception:
        pass

    # ---- Step A: Groq Whisper Transcription (verbose_json for duration metadata) ----
    logger.info("Sending audio to Groq Whisper for transcription (verbose_json).")

    # Determine file extension from mime type for the Groq upload tuple
    mime_to_ext = {
        "audio/webm": "audio.webm",
        "audio/wav": "audio.wav",
        "audio/wave": "audio.wav",
        "audio/mpeg": "audio.mp3",
        "audio/mp4": "audio.mp4",
        "audio/ogg": "audio.ogg",
        "audio/flac": "audio.flac",
    }
    upload_filename = mime_to_ext.get(mime_type, file.filename or "audio.webm")

    groq_duration = None
    try:
        transcription_response = groq_client.audio.transcriptions.create(
            file=(upload_filename, audio_bytes),
            model="whisper-large-v3",
            response_format="verbose_json",
        )
        # verbose_json returns an object with .text and .duration attributes
        transcript = (transcription_response.text or "").strip()
        groq_duration = getattr(transcription_response, "duration", None)
        logger.info(f"Groq transcription completed (length: {len(transcript)} chars, duration: {groq_duration}s).")
    except Exception as e:
        logger.error(f"Groq Whisper transcription failed: {e}")
        raise HTTPException(status_code=502, detail=f"Speech-to-text processing failed: {str(e)}")

    # ---- Step B: Speaking Pace Calculation ----
    # Fallback order for audio duration (documented per Phase 3 decision):
    #   1. Groq verbose_json duration field (most accurate, from audio analysis)
    #   2. Frontend-provided duration_seconds (client-side recording timer)
    #   3. None → speakingPace set to null (no estimation, no fabrication)
    audio_duration_sec = None
    if groq_duration is not None and float(groq_duration) > 0:
        audio_duration_sec = float(groq_duration)
        logger.info(f"Using Groq-reported audio duration: {audio_duration_sec:.1f}s")
    elif duration_seconds is not None:
        try:
            parsed_duration = float(duration_seconds)
            if parsed_duration > 0:
                audio_duration_sec = parsed_duration
                logger.info(f"Using frontend-provided recording duration: {audio_duration_sec:.1f}s")
        except (ValueError, TypeError):
            logger.warning(f"Invalid duration_seconds value received: {duration_seconds}")

    speaking_pace_score = None
    word_count = len(transcript.split()) if transcript else 0

    if audio_duration_sec is not None and audio_duration_sec > 0 and word_count > 0:
        wpm = word_count / (audio_duration_sec / 60.0)
        # Speaking pace heuristic (WPM → 0-100 score):
        #   120-160 WPM = ideal conversational range → score 85-100
        #   100-120 or 160-180 WPM = acceptable, slightly off-pace → score 60-84
        #   <100 WPM (too slow) or >180 WPM (too fast) → score 20-59
        #   Edge: extremely slow (<60 WPM) or fast (>220 WPM) → score 10-19
        if 120 <= wpm <= 160:
            # Ideal range: linear interpolation 85-100
            speaking_pace_score = int(85 + (wpm - 120) / (160 - 120) * 15)
        elif 100 <= wpm < 120:
            # Slightly slow: linear interpolation 60-84
            speaking_pace_score = int(60 + (wpm - 100) / (120 - 100) * 24)
        elif 160 < wpm <= 180:
            # Slightly fast: linear interpolation 84-60
            speaking_pace_score = int(84 - (wpm - 160) / (180 - 160) * 24)
        elif 60 <= wpm < 100:
            # Too slow: linear interpolation 20-59
            speaking_pace_score = int(20 + (wpm - 60) / (100 - 60) * 39)
        elif 180 < wpm <= 220:
            # Too fast: linear interpolation 59-20
            speaking_pace_score = int(59 - (wpm - 180) / (220 - 180) * 39)
        elif wpm < 60:
            speaking_pace_score = max(10, int(wpm / 60 * 20))
        else:  # wpm > 220
            speaking_pace_score = max(10, int(59 - (wpm - 220) / 80 * 49))

        speaking_pace_score = max(0, min(100, speaking_pace_score))
        logger.info(f"Speaking pace computed: {word_count} words / {audio_duration_sec:.1f}s = {wpm:.0f} WPM → score {speaking_pace_score}")
    else:
        logger.info(f"Speaking pace: insufficient data (words={word_count}, duration={audio_duration_sec}). Setting to null.")

    # ---- Step B2: Vocal Prosody Analysis (librosa) ----
    prosody_confidence_score = None
    try:
        import librosa
        import numpy as np

        logger.info("Starting prosody analysis via librosa.")
        y, sr = load_audio_array(audio_bytes)

        if not np.isfinite(y).all():
            y = np.nan_to_num(y)

        if len(y) < sr * 0.5:
            logger.info("Audio duration too short for prosody analysis (<0.5s).")
        else:
            # 1. Pitch variance (optimized librosa.pyin)
            # Focus on a representative slice (up to 20s) and resample to 11025 Hz.
            # Human speech F0 lies strictly between C2 (~65 Hz) and 400 Hz (avoids soprano C7 2093 Hz).
            # This accelerates pyin from ~45-60s down to ~1.2s while preserving full vocal nuance.
            y_pitch_slice = y[:int(sr * 20)]
            sr_pitch = 11025
            if sr != sr_pitch:
                y_pitch = librosa.resample(y_pitch_slice, orig_sr=sr, target_sr=sr_pitch)
            else:
                y_pitch = y_pitch_slice

            f0, voiced_flag, voiced_probs = librosa.pyin(
                y_pitch,
                fmin=librosa.note_to_hz('C2'),
                fmax=400,
                sr=sr_pitch,
                hop_length=512
            )
            valid_f0 = f0[voiced_flag] if f0 is not None and voiced_flag is not None else []
            pitch_score = 0
            if len(valid_f0) > 0:
                pitch_std = np.std(valid_f0)
                pitch_score = min(25, int((pitch_std / 50.0) * 25))

            # 2. Pause frequency (librosa.effects.split)
            # Count silence gaps longer than 0.3s. Many long pauses (0pts), few (25pts).
            non_mute_intervals = librosa.effects.split(y, top_db=30)
            long_pauses = 0
            for i in range(1, len(non_mute_intervals)):
                gap_samples = non_mute_intervals[i][0] - non_mute_intervals[i-1][1]
                if gap_samples / sr > 0.3:
                    long_pauses += 1
            
            pause_score = max(0, 25 - (long_pauses * 5))

            # 3. Speaking rate variability (5s windows)
            # Rate variance proxy using onset strength. Erratic (0pts), steady (25pts).
            onset_env = librosa.onset.onset_strength(y=y, sr=sr)
            frames_per_5s = int((5.0 * sr) / 512)
            rate_score = 15 # default
            if len(onset_env) > frames_per_5s and frames_per_5s > 0:
                windows = [onset_env[i:i+frames_per_5s] for i in range(0, len(onset_env), frames_per_5s)]
                rates = [np.sum(w) for w in windows]
                if np.mean(rates) > 0:
                    cv = np.std(rates) / np.mean(rates)
                    rate_score = max(0, min(25, int(25 - (cv * 50))))

            # 4. Energy consistency (RMS energy variance)
            # Very high variance = unsteady delivery.
            rms = librosa.feature.rms(y=y)[0]
            energy_score = 15 # default
            if np.mean(rms) > 0:
                rms_cv = np.std(rms) / np.mean(rms)
                energy_score = max(0, min(25, int(25 - (rms_cv * 25))))

            prosody_confidence_score = pitch_score + pause_score + rate_score + energy_score
            logger.info(f"Prosody confidence score: {prosody_confidence_score} (pitch={pitch_score}, pause={pause_score}, rate={rate_score}, energy={energy_score})")

    except Exception as e:
        logger.warning(f"Librosa prosody analysis failed: {e}")
        prosody_confidence_score = None

    # ---- Step C: Groq Reasoning (text-only) ----
    try:
        history_list = json.loads(question_history)
    except json.JSONDecodeError:
        history_list = []

    history_context = ""
    if history_list:
        history_context = "Previous questions asked in this session:\n"
        for i, q in enumerate(history_list, 1):
            history_context += f"{i}. {q}\n"
        history_context += "\n"

    next_q_guidance = build_next_question_guidance(job_description, history_list, question_text)

    evaluation_prompt = f"""You are an expert technical interviewer and career coach evaluating a candidate's interview answer.

CONTEXT:
Job Description: {job_description}

{history_context}Current Question: {question_text}

Candidate's Answer (transcribed from audio):
{transcript}

You must:
1. Evaluate the answer on four metrics (each scored 0-100):
   - Technical Score: How technically correct, thorough, and well-structured is the answer? Consider both factual accuracy AND organization/logical flow of the response.
   - Communication Score: How clearly and articulately did the candidate communicate their ideas?
   - Professionalism: How professional is the tone, language, and demeanor reflected in the answer?
   - Confidence: How confident does the candidate sound? Consider hedging language, filler words, and assertiveness of statements.
2. Provide constructive feedback highlighting what was good and what could be improved.
3. {next_q_guidance}
The next question should NOT repeat any previous questions.

You MUST respond with ONLY a valid JSON object in exactly this format, with no additional text:
{{
    "evaluationMetrics": {{
        "technicalScore": <integer 0-100>,
        "communicationScore": <integer 0-100>,
        "professionalism": <integer 0-100>,
        "confidence": <integer 0-100>,
        "constructiveFeedback": "<detailed feedback paragraph>"
    }},
    "nextQuestion": "<the next interview question>"
}}"""

    logger.info("Sending transcript to Groq for evaluation (extended metrics).")

    raw_text = ""
    max_retries = 1
    for attempt in range(max_retries + 1):
        try:
            response = groq_client.chat.completions.create(
                model="qwen/qwen3.8-27b",
                messages=[{"role": "user", "content": evaluation_prompt}],
                temperature=0.2,
                max_tokens=800,
                reasoning_effort="none",
            )

            raw_text = response.choices[0].message.content.strip()
            
            if "</think>" in raw_text:
                raw_text = raw_text.split("</think>")[-1].strip()
            if raw_text.startswith("```json"):
                raw_text = raw_text[7:]
            if raw_text.startswith("```"):
                raw_text = raw_text[3:]
            if raw_text.endswith("```"):
                raw_text = raw_text[:-3]
            raw_text = raw_text.strip()

            result = json.loads(raw_text)
            metrics = result.get("evaluationMetrics", {})

            # ---- Step D: Composite Confidence ----
            llm_confidence = metrics.get('confidence', 0)
            if prosody_confidence_score is not None:
                # Weight prosody slightly lower since it's a proxy, not ground truth
                composite_confidence = round(0.6 * llm_confidence + 0.4 * prosody_confidence_score)
                logger.info(f"Composite confidence computed: {composite_confidence} (LLM={llm_confidence}, Prosody={prosody_confidence_score})")
            else:
                composite_confidence = llm_confidence
                logger.info(f"Composite confidence computed: {composite_confidence} (LLM only)")

            logger.info(
                f"Groq evaluation completed. "
                f"Technical: {metrics.get('technicalScore', 'N/A')}, "
                f"Communication: {metrics.get('communicationScore', 'N/A')}, "
                f"Professionalism: {metrics.get('professionalism', 'N/A')}, "
                f"Confidence: {composite_confidence}"
            )

            return InterviewEvaluationResponse(
                transcript=transcript,
                evaluation_metrics={
                    "technicalScore": metrics.get("technicalScore", 0),
                    "communicationScore": metrics.get("communicationScore", 0),
                    "professionalism": metrics.get("professionalism", 0),
                    "confidence": composite_confidence,
                    "constructiveFeedback": metrics.get("constructiveFeedback", ""),
                    "speakingPace": speaking_pace_score,
                    # Phase 4 placeholders — awaiting MediaPipe camera data from frontend
                    "interviewPresence": None,
                    "eyeContact": None,
                    "bodyLanguage": None,
                },
                next_question=result.get("nextQuestion", ""),
            )

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Groq evaluation response as JSON: {e}")
            logger.error(f"Raw response: {raw_text}")
            raise HTTPException(status_code=502, detail="AI service returned an invalid response format.")
        except Exception as e:
            if attempt < max_retries:
                logger.warning(f"Groq evaluation API call failed (attempt {attempt+1}): {e}. Retrying in 2 seconds...")
                await asyncio.sleep(2)
            else:
                logger.error(f"Groq evaluation API call failed permanently: {e}")
                raise HTTPException(status_code=502, detail=f"AI evaluation processing failed via Groq: {str(e)}")


# ==================== Code Answer Evaluation Endpoint ====================

@app.post("/api/v1/ai/evaluate-code-answer", response_model=InterviewEvaluationResponse, tags=["Interview Evaluation"])
async def evaluate_code_answer(request: CodeEvaluationRequest):
    """
    Evaluate a candidate's code/logic answer (no audio processing).
    Skips Whisper transcription, speaking pace, and prosody analysis.
    Uses the submitted code directly for Groq LLM evaluation with a
    code-specific prompt focusing on correctness, syntax, complexity,
    and readability.
    """
    logger.info(f"Evaluating code answer (language: {request.code_language}). Question: {request.question_text[:80]}...")

    # Build question history context
    try:
        history_list = json.loads(request.question_history)
    except json.JSONDecodeError:
        history_list = []

    history_context = ""
    if history_list:
        history_context = "Previous questions asked in this session:\n"
        for i, q in enumerate(history_list, 1):
            history_context += f"{i}. {q}\n"
        history_context += "\n"

    next_q_guidance = build_next_question_guidance(request.job_description, history_list, request.question_text)

    # Code-specific evaluation prompt
    code_evaluation_prompt = f"""You are an expert technical interviewer evaluating a candidate's code/logic answer to an interview question.

CONTEXT:
Job Description: {request.job_description}

{history_context}Current Question: {request.question_text}

Candidate's Code Answer (language: {request.code_language}):
```{request.code_language}
{request.code_answer}
```

You must evaluate the code answer on these criteria:
1. **Technical Score** (0-100): Evaluate correctness of logic relative to the question asked, syntax validity for {request.code_language}, time/space complexity awareness (if relevant), and whether the solution actually solves the problem.
2. **Communication Score** (0-100): Evaluate code readability, naming conventions, structure, proper indentation, use of comments, and how clearly the code communicates the candidate's intent.
3. **Professionalism** (0-100): If the candidate included inline comments, docstrings, or explanatory notes, evaluate their professional quality. If there are no comments or explanations beyond the code itself, set this to null.
4. **Confidence** (0-100): If the candidate's comments or code structure show decisiveness and clear problem-solving direction, evaluate confidence. If there is genuinely nothing to infer from (pure code, no comments), set this to null.
5. **Constructive Feedback**: Provide specific, actionable code feedback. Reference actual lines or patterns in the code. Suggest concrete improvements (e.g., "consider an O(n) approach instead of O(n²) here", "extract this repeated logic into a helper function").
6. **Next Question**:
{next_q_guidance}
The next question should NOT repeat any previous questions.

You MUST respond with ONLY a valid JSON object in exactly this format, with no additional text:
{{
    "evaluationMetrics": {{
        "technicalScore": <integer 0-100>,
        "communicationScore": <integer 0-100>,
        "professionalism": <integer 0-100 or null>,
        "confidence": <integer 0-100 or null>,
        "constructiveFeedback": "<detailed code-specific feedback paragraph>"
    }},
    "nextQuestion": "<the next interview question>"
}}"""

    logger.info("Sending code answer to Groq for evaluation (code-specific prompt).")

    raw_text = ""
    max_retries = 1
    for attempt in range(max_retries + 1):
        try:
            response = groq_client.chat.completions.create(
                model="qwen/qwen3.8-27b",
                messages=[{"role": "user", "content": code_evaluation_prompt}],
                temperature=0.2,
                max_tokens=800,
                reasoning_effort="none",
            )

            raw_text = response.choices[0].message.content.strip()

            if "</think>" in raw_text:
                raw_text = raw_text.split("</think>")[-1].strip()
            if raw_text.startswith("```json"):
                raw_text = raw_text[7:]
            if raw_text.startswith("```"):
                raw_text = raw_text[3:]
            if raw_text.endswith("```"):
                raw_text = raw_text[:-3]
            raw_text = raw_text.strip()

            result = json.loads(raw_text)
            metrics = result.get("evaluationMetrics", {})

            logger.info(
                f"Groq code evaluation completed. "
                f"Technical: {metrics.get('technicalScore', 'N/A')}, "
                f"Communication: {metrics.get('communicationScore', 'N/A')}, "
                f"Professionalism: {metrics.get('professionalism', 'N/A')}, "
                f"Confidence: {metrics.get('confidence', 'N/A')}"
            )

            return InterviewEvaluationResponse(
                transcript=request.code_answer,
                evaluation_metrics={
                    "technicalScore": metrics.get("technicalScore", 0),
                    "communicationScore": metrics.get("communicationScore", 0),
                    "professionalism": metrics.get("professionalism"),
                    "confidence": metrics.get("confidence"),
                    "constructiveFeedback": metrics.get("constructiveFeedback", ""),
                    "speakingPace": None,
                    "interviewPresence": None,
                    "eyeContact": None,
                    "bodyLanguage": None,
                },
                next_question=result.get("nextQuestion", ""),
            )

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Groq code evaluation response as JSON: {e}")
            logger.error(f"Raw response: {raw_text}")
            raise HTTPException(status_code=502, detail="AI service returned an invalid response format.")
        except Exception as e:
            if attempt < max_retries:
                logger.warning(f"Groq code evaluation API call failed (attempt {attempt+1}): {e}. Retrying in 2 seconds...")
                await asyncio.sleep(2)
            else:
                logger.error(f"Groq code evaluation API call failed permanently: {e}")
                raise HTTPException(status_code=502, detail=f"AI code evaluation processing failed via Groq: {str(e)}")


# ==================== Generate First Question Endpoint ====================

@app.post("/api/v1/ai/generate-question", tags=["Interview Evaluation"])
async def generate_first_question(
    job_description: str = Form(..., description="The target job description"),
):
    """
    Generate the first interview question for a new session based on the job description.
    Uses Groq's qwen/qwen3.8-27b model.
    """
    logger.info("Generating first interview question via Groq (Qwen).")
    prompt = f"""You are an expert interviewer conducting a 5-question technical interview for the following role:

{job_description}

GUIDELINES:
- This is Question 1 of 5.
- Generate a strong, role-relevant introductory technical or foundational domain question to open the interview.
- Note: Subsequent questions in this session (such as Questions 2 and 4) will specifically test practical hands-on coding and SQL problem solving.

Respond with ONLY a valid JSON object in this format:
{{
    "question": "<the interview question>"
}}"""

    try:
        response = groq_client.chat.completions.create(
            model="qwen/qwen3.8-27b",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=256,
            reasoning_effort="none",
        )

        raw_text = response.choices[0].message.content.strip()
        if "</think>" in raw_text:
            raw_text = raw_text.split("</think>")[-1].strip()
        if raw_text.startswith("```json"):
            raw_text = raw_text[7:]
        if raw_text.startswith("```"):
            raw_text = raw_text[3:]
        if raw_text.endswith("```"):
            raw_text = raw_text[:-3]
        raw_text = raw_text.strip()

        result = json.loads(raw_text)
        return {"question": result.get("question", "")}

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse Groq response as JSON: {e}")
        logger.error(f"Raw response: {raw_text}")
        raise HTTPException(status_code=502, detail="AI service returned an invalid response format.")
    except Exception as e:
        logger.error(f"Groq API call failed: {e}")
        raise HTTPException(status_code=502, detail=f"AI question generation failed via Groq: {str(e)}")


# ==================== Entry Point ====================

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)

"""
InterviewIQ AI - AI Runtime Microservice
=========================================
FastAPI microservice that orchestrates all AI processing via a hybrid pipeline:
- Groq Whisper Large v3 for speech-to-text transcription.
- Groq Qwen 3.6 27B (qwen/qwen3.6-27b) for interview evaluation reasoning.
- Groq Qwen 3.6 27B (qwen/qwen3.6-27b) for question generation.
- Google Gemini for resume narrative analysis (narrative-only, score from matcher).
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
from groq import Groq
from sentence_transformers import SentenceTransformer

from schemas.resume import ResumeAnalysisResponse
from schemas.interview import InterviewEvaluationResponse
from resume_matcher import compute_keyword_match, compute_semantic_similarity, compute_ats_score
from pdf_extractor import extract_resume_sections

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ==================== AI Client Initialization ====================

gemini_client = None
groq_client = None
embedding_model = None  # Phase 2: all-MiniLM-L6-v2, loaded once at startup

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize Gemini, Groq clients, and the local embedding model on startup."""
    global gemini_client, groq_client, embedding_model

    gemini_api_key = os.getenv("GEMINI_API_KEY")
    if not gemini_api_key:
        logger.error("GEMINI_API_KEY environment variable is not set.")
        raise RuntimeError("GEMINI_API_KEY is required.")
    gemini_client = genai.Client(api_key=gemini_api_key)
    logger.info("Gemini AI client initialized successfully.")

    groq_api_key = os.getenv("GROQ_API_KEY")
    if not groq_api_key:
        logger.error("GROQ_API_KEY environment variable is not set.")
        raise RuntimeError("GROQ_API_KEY is required.")
    groq_client = Groq(api_key=groq_api_key)
    logger.info("Groq AI client initialized successfully.")

    # Phase 2: Load sentence-transformer locally (downloads ~90 MB on first run).
    # Subsequent runs use the HuggingFace cache — no network required.
    logger.info("Loading SentenceTransformer (all-MiniLM-L6-v2) — may download on first run…")
    embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
    logger.info("SentenceTransformer loaded successfully.")

    yield
    logger.info("AI Microservice shutting down.")

# ==================== FastAPI Application ====================

app = FastAPI(
    title="InterviewIQ AI Microservice",
    description="AI orchestration layer for resume analysis and interview evaluation powered by Groq Whisper and Gemini.",
    version="1.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:8080"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== Health Check ====================

@app.get("/health", tags=["System"])
async def health_check():
    """Health check endpoint to verify the microservice is running."""
    return {"status": "healthy", "service": "InterviewIQ AI Microservice", "version": app.version}


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
    semantic_pct = compute_semantic_similarity(
        resume_text=active_resume_text,
        jd_text=job_description,
        embedding_model=embedding_model,
        sections=sections,
    )

    # ---- Combined ATS Score (formula: 0.4 * keyword + 0.6 * semantic) ----
    ats_score = compute_ats_score(keyword_pct, semantic_pct)
    logger.info(
        f"ATS score computed: {ats_score} "
        f"(keyword={keyword_pct:.1f}%, semantic={semantic_pct:.1f}%)"
    )

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

    raw_text = ""
    try:
        response = gemini_client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                {"role": "user", "parts": [{"text": gemini_system_prompt + "\n\n" + gemini_user_prompt}]}
            ],
        )

        raw_text = response.text.strip()
        if raw_text.startswith("```json"):
            raw_text = raw_text[7:]
        if raw_text.startswith("```"):
            raw_text = raw_text[3:]
        if raw_text.endswith("```"):
            raw_text = raw_text[:-3]
        raw_text = raw_text.strip()

        result = json.loads(raw_text)
        logger.info("Gemini narrative generation completed. Assembling final response.")

        return ResumeAnalysisResponse(
            ats_score=ats_score,  # always use the deterministic score, never Gemini's
            missing_keywords=missing_keywords[:20],  # top 20 missing JD keywords
            strengths=result.get("strengths", []),
            weaknesses=result.get("weaknesses", []),
            suggestions=result.get("suggestions", []),
            generated_questions=result.get("generatedQuestions", [])[:5],
        )

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse Gemini narrative response as JSON: {e}")
        logger.error(f"Raw response: {raw_text}")
        raise HTTPException(status_code=502, detail="AI service returned an invalid response format.")
    except Exception as e:
        logger.error(f"Gemini narrative API call failed: {e}")
        raise HTTPException(status_code=502, detail=f"AI processing failed: {str(e)}")


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
        import io
        import numpy as np

        logger.info("Starting prosody analysis via librosa.")
        y, sr = librosa.load(io.BytesIO(audio_bytes), sr=None)

        # 1. Pitch variance (librosa.pyin)
        # 0 = monotone (0pts), high = expressive (25pts)
        f0, voiced_flag, voiced_probs = librosa.pyin(y, fmin=librosa.note_to_hz('C2'), fmax=librosa.note_to_hz('C7'))
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
3. Generate the next interview question that logically follows this answer and the job description. The question should NOT repeat any previous questions. It should progressively challenge the candidate.

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
                model="qwen/qwen3.6-27b",
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


# ==================== Generate First Question Endpoint ====================

@app.post("/api/v1/ai/generate-question", tags=["Interview Evaluation"])
async def generate_first_question(
    job_description: str = Form(..., description="The target job description"),
):
    """
    Generate the first interview question for a new session based on the job description.
    Uses Groq's qwen/qwen3.6-27b model.
    """
    logger.info("Generating first interview question via Groq (Qwen).")

    prompt = f"""You are an expert technical interviewer.
Based on the following job description, generate a single, high-quality opening interview question.
The question should be a mix of technical and behavioral, appropriate for the role described.
It should be challenging yet approachable for a candidate with intermediate experience.

Job Description:
{job_description}

Respond with ONLY a valid JSON object in this format:
{{
    "question": "<the interview question>"
}}"""

    try:
        response = groq_client.chat.completions.create(
            model="qwen/qwen3.6-27b",
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

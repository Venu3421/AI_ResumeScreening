"""
InterviewIQ AI - AI Runtime Microservice
=========================================
FastAPI microservice that orchestrates all AI processing via Google Gemini 1.5 Flash.
Handles resume analysis and multimodal interview answer evaluation.
"""

import os
import json
import logging
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google import genai

from schemas.resume import ResumeAnalysisRequest, ResumeAnalysisResponse
from schemas.interview import InterviewEvaluationResponse

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ==================== Gemini Client Initialization ====================

gemini_client = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize Gemini client on startup."""
    global gemini_client
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        logger.error("GEMINI_API_KEY environment variable is not set.")
        raise RuntimeError("GEMINI_API_KEY is required.")
    gemini_client = genai.Client(api_key=api_key)
    logger.info("Gemini AI client initialized successfully.")
    yield
    logger.info("AI Microservice shutting down.")

# ==================== FastAPI Application ====================

app = FastAPI(
    title="InterviewIQ AI Microservice",
    description="AI orchestration layer for resume analysis and interview evaluation powered by Gemini 1.5 Flash.",
    version="1.0.0",
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
    return {"status": "healthy", "service": "InterviewIQ AI Microservice", "version": "1.0.0"}


# ==================== Resume Analysis Endpoint ====================

@app.post("/api/v1/ai/analyze-resume", response_model=ResumeAnalysisResponse, tags=["Resume Analysis"])
async def analyze_resume(request: ResumeAnalysisRequest):
    """
    Analyze a resume against a job description using Gemini 1.5 Flash.
    Returns ATS score, missing keywords, generated questions, strengths, and weaknesses.
    """
    logger.info("Received resume analysis request.")

    system_prompt = """You are an expert ATS (Applicant Tracking System) analyzer and career coach.
You will be given a candidate's resume text and a target job description.

Your task is to:
1. Calculate an ATS compatibility score (0-100) based on keyword matching, skill alignment, and experience relevance.
2. Identify missing keywords that appear in the job description but not in the resume.
3. List the candidate's strengths relative to the job description.
4. List the candidate's weaknesses or gaps relative to the job description.
5. Provide actionable improvement suggestions.
6. Generate exactly 5 role-specific interview questions (mix of technical and behavioral) based on the job description and resume content.

You MUST respond with ONLY a valid JSON object in exactly this format, with no additional text:
{
    "atsScore": <integer 0-100>,
    "missingKeywords": ["keyword1", "keyword2", ...],
    "strengths": ["strength1", "strength2", ...],
    "weaknesses": ["weakness1", "weakness2", ...],
    "suggestions": ["suggestion1", "suggestion2", ...],
    "generatedQuestions": ["question1", "question2", "question3", "question4", "question5"]
}"""

    user_prompt = f"""RESUME TEXT:
{request.resume_text}

JOB DESCRIPTION:
{request.job_description}"""

    try:
        response = gemini_client.models.generate_content(
            model="gemini-3.5-flash",
            contents=[
                {"role": "user", "parts": [{"text": system_prompt + "\n\n" + user_prompt}]}
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
        logger.info(f"Resume analysis completed. ATS Score: {result.get('atsScore', 'N/A')}")

        return ResumeAnalysisResponse(
            ats_score=result.get("atsScore", 0),
            missing_keywords=result.get("missingKeywords", []),
            strengths=result.get("strengths", []),
            weaknesses=result.get("weaknesses", []),
            suggestions=result.get("suggestions", []),
            generated_questions=result.get("generatedQuestions", []),
        )

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse Gemini response as JSON: {e}")
        logger.error(f"Raw response: {raw_text}")
        raise HTTPException(status_code=502, detail="AI service returned an invalid response format.")
    except Exception as e:
        logger.error(f"Gemini API call failed: {e}")
        raise HTTPException(status_code=502, detail=f"AI processing failed: {str(e)}")


# ==================== Interview Answer Evaluation Endpoint ====================

@app.post("/api/v1/ai/evaluate-answer", response_model=InterviewEvaluationResponse, tags=["Interview Evaluation"])
async def evaluate_answer(
    file: UploadFile = File(..., description="Audio file (WebM/WAV) of the candidate's spoken answer"),
    question_text: str = Form(..., description="The interview question that was asked"),
    job_description: str = Form(..., description="The target job description for context"),
    question_history: str = Form(default="[]", description="JSON array of previous questions in this session"),
):
    """
    Evaluate a candidate's spoken interview answer using Gemini 1.5 Flash multimodal processing.
    Sends the raw audio directly to Gemini for transcription and evaluation, bypassing intermediate STT.
    Returns transcript, evaluation metrics, and the next interview question.
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

    evaluation_prompt = f"""You are an expert technical interviewer and career coach evaluating a candidate's spoken answer.

CONTEXT:
Job Description: {job_description}

{history_context}Current Question: {question_text}

The candidate has provided an audio recording of their answer. You must:
1. Transcribe the audio answer accurately.
2. Evaluate the answer on three metrics (each scored 0-100):
   - Technical Accuracy: How technically correct and thorough is the answer?
   - Communication Clarity: How clearly and articulately did the candidate communicate?
   - Structural Logic: How well-organized and logically structured is the response?
3. Provide constructive feedback highlighting what was good and what could be improved.
4. Generate the next interview question that logically follows this answer and the job description. The question should NOT repeat any previous questions. It should progressively challenge the candidate.

You MUST respond with ONLY a valid JSON object in exactly this format, with no additional text:
{{
    "transcript": "<full transcription of the spoken answer>",
    "evaluationMetrics": {{
        "technicalAccuracy": <integer 0-100>,
        "communicationClarity": <integer 0-100>,
        "structuralLogic": <integer 0-100>,
        "constructiveFeedback": "<detailed feedback paragraph>"
    }},
    "nextQuestion": "<the next interview question>"
}}"""

    try:
        response = gemini_client.models.generate_content(
            model="gemini-3.5-flash",
            contents=[
                {
                    "role": "user",
                    "parts": [
                        {"text": evaluation_prompt},
                        {
                            "inline_data": {
                                "mime_type": mime_type,
                                "data": __import__("base64").b64encode(audio_bytes).decode("utf-8"),
                            }
                        },
                    ],
                }
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
        metrics = result.get("evaluationMetrics", {})
        logger.info(f"Answer evaluation completed. Technical: {metrics.get('technicalAccuracy', 'N/A')}")

        return InterviewEvaluationResponse(
            transcript=result.get("transcript", ""),
            evaluation_metrics={
                "technicalAccuracy": metrics.get("technicalAccuracy", 0),
                "communicationClarity": metrics.get("communicationClarity", 0),
                "structuralLogic": metrics.get("structuralLogic", 0),
                "constructiveFeedback": metrics.get("constructiveFeedback", ""),
            },
            next_question=result.get("nextQuestion", ""),
        )

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse Gemini response as JSON: {e}")
        raise HTTPException(status_code=502, detail="AI service returned an invalid response format.")
    except Exception as e:
        logger.error(f"Gemini API call failed: {e}")
        raise HTTPException(status_code=502, detail=f"AI processing failed: {str(e)}")


# ==================== Generate First Question Endpoint ====================

@app.post("/api/v1/ai/generate-question", tags=["Interview Evaluation"])
async def generate_first_question(
    job_description: str = Form(..., description="The target job description"),
):
    """
    Generate the first interview question for a new session based on the job description.
    """
    logger.info("Generating first interview question.")

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
        response = gemini_client.models.generate_content(
            model="gemini-3.5-flash",
            contents=[{"role": "user", "parts": [{"text": prompt}]}],
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
        return {"question": result.get("question", "")}

    except Exception as e:
        logger.error(f"Failed to generate question: {e}")
        raise HTTPException(status_code=502, detail=f"AI processing failed: {str(e)}")


# ==================== Entry Point ====================

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)

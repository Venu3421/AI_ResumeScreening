"""
Pydantic models for interview evaluation request and response payloads.
Enforces strict validation on all incoming and outgoing data.
"""

# pyrefly: ignore [missing-import]
from pydantic import BaseModel, Field
from typing import Dict, Optional


class EvaluationMetrics(BaseModel):
    """
    Extended evaluation metrics for an interview answer (Phase 3).

    Gemini-derived (from transcript):
      - technicalScore, communicationScore, professionalism, confidence, constructiveFeedback
    Computed in ai-service:
      - speakingPace (from word count / audio duration)
    Awaiting Phase 4 (MediaPipe camera data):
      - interviewPresence, eyeContact, bodyLanguage
    """
    technicalScore: int = Field(
        ...,
        ge=0,
        le=100,
        description="Technical correctness, thoroughness, and structural logic score (0-100).",
    )
    communicationScore: int = Field(
        ...,
        ge=0,
        le=100,
        description="Clarity and articulation score (0-100).",
    )
    professionalism: int = Field(
        ...,
        ge=0,
        le=100,
        description="Tone and professionalism inferred from transcript content (0-100).",
    )
    confidence: int = Field(
        ...,
        ge=0,
        le=100,
        description="Confidence inferred from phrasing, hedging, and filler words (0-100).",
    )
    constructiveFeedback: str = Field(
        ...,
        description="Detailed constructive feedback on the answer.",
    )
    speakingPace: Optional[int] = Field(
        default=None,
        ge=0,
        le=100,
        description="Speaking pace score (0-100) derived from words-per-minute. Null if audio duration unavailable.",
    )
    # Phase 4 placeholders — will be populated from client-side MediaPipe data
    interviewPresence: Optional[int] = Field(
        default=None,
        ge=0,
        le=100,
        description="Interview presence score from camera analysis. Null until Phase 4.",
    )
    eyeContact: Optional[int] = Field(
        default=None,
        ge=0,
        le=100,
        description="Eye contact score from camera analysis. Null until Phase 4.",
    )
    bodyLanguage: Optional[int] = Field(
        default=None,
        ge=0,
        le=100,
        description="Body language score from camera analysis. Null until Phase 4.",
    )


class InterviewEvaluationResponse(BaseModel):
    """Response payload containing the full evaluation of an interview answer."""
    transcript: str = Field(
        ...,
        description="Full transcription of the candidate's spoken answer.",
    )
    evaluation_metrics: Dict[str, object] = Field(
        ...,
        description="Evaluation scores and feedback for the answer.",
    )
    next_question: str = Field(
        ...,
        description="The next interview question to ask the candidate.",
    )

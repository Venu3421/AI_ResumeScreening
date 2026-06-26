"""
Pydantic models for interview evaluation request and response payloads.
Enforces strict validation on all incoming and outgoing data.
"""

from pydantic import BaseModel, Field
from typing import Dict


class EvaluationMetrics(BaseModel):
    """Individual scoring metrics for an interview answer evaluation."""
    technicalAccuracy: int = Field(
        ...,
        ge=0,
        le=100,
        description="Technical correctness and thoroughness score (0-100).",
    )
    communicationClarity: int = Field(
        ...,
        ge=0,
        le=100,
        description="Clarity and articulation score (0-100).",
    )
    structuralLogic: int = Field(
        ...,
        ge=0,
        le=100,
        description="Organization and logical structure score (0-100).",
    )
    constructiveFeedback: str = Field(
        ...,
        description="Detailed constructive feedback on the answer.",
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

"""
Pydantic models for resume analysis request and response payloads.
Enforces strict validation on all incoming and outgoing data.
"""

from pydantic import BaseModel, Field
from typing import List


class ResumeAnalysisRequest(BaseModel):
    """Request payload for the resume analysis endpoint."""
    resume_text: str = Field(
        ...,
        min_length=50,
        description="Extracted text content from the candidate's PDF resume.",
    )
    job_description: str = Field(
        ...,
        min_length=20,
        description="The target job description to match the resume against.",
    )


class ResumeAnalysisResponse(BaseModel):
    """Response payload containing the full ATS analysis results."""
    ats_score: int = Field(
        ...,
        ge=0,
        le=100,
        description="ATS compatibility score from 0 to 100.",
    )
    missing_keywords: List[str] = Field(
        default_factory=list,
        description="Keywords present in the JD but missing from the resume.",
    )
    strengths: List[str] = Field(
        default_factory=list,
        description="Candidate strengths relative to the job description.",
    )
    weaknesses: List[str] = Field(
        default_factory=list,
        description="Candidate gaps or weaknesses relative to the job description.",
    )
    suggestions: List[str] = Field(
        default_factory=list,
        description="Actionable improvement suggestions for the resume.",
    )
    generated_questions: List[str] = Field(
        default_factory=list,
        description="Five role-specific interview questions generated from resume and JD.",
    )

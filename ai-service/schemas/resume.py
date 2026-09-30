"""
Pydantic models for resume analysis request and response payloads.
Enforces strict validation on all incoming and outgoing data.
"""

# pyrefly: ignore [missing-import]
from pydantic import BaseModel, Field
from typing import List, Optional


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


class HighlightRect(BaseModel):
    """A single highlight region on a PDF page."""
    page: int = Field(
        ...,
        ge=0,
        description="Zero-indexed page number in the PDF.",
    )
    text: str = Field(
        ...,
        description="The matched text content.",
    )
    rect: List[float] = Field(
        ...,
        min_length=4,
        max_length=4,
        description="Bounding box [x0, y0, x1, y1] in PDF points (top-left origin).",
    )
    type: str = Field(
        ...,
        description="Highlight category: 'matched_keyword' or 'missing_keyword'.",
    )


class PageDimension(BaseModel):
    """Width and height of a single PDF page in points."""
    width: float = Field(..., description="Page width in PDF points.")
    height: float = Field(..., description="Page height in PDF points.")


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
    matched_keywords: List[str] = Field(
        default_factory=list,
        description="Keywords present in both the JD and the candidate resume.",
    )
    resume_text: str = Field(
        default="",
        description="Full extracted text of the candidate resume.",
    )
    sections: dict = Field(
        default_factory=dict,
        description="Structured sections extracted from the candidate resume.",
    )
    highlights: List[HighlightRect] = Field(
        default_factory=list,
        description="Coordinate-based highlight regions for matched/missing keywords on the PDF.",
    )
    page_dimensions: List[PageDimension] = Field(
        default_factory=list,
        description="Dimensions (width, height) of each page in PDF points.",
    )


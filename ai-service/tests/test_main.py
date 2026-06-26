# pyrefly: ignore [missing-import]
import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch
import os

# Set dummy key for testing
os.environ["GEMINI_API_KEY"] = "mock_key"

from main import app

client = TestClient(app)

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

@patch("main.gemini_client")
def test_analyze_resume_success(mock_gemini):
    mock_response = MagicMock()
    mock_response.text = """
    {
        "atsScore": 90,
        "missingKeywords": ["Docker", "Kubernetes"],
        "strengths": ["Strong Python background"],
        "weaknesses": ["Lack of cloud experience"],
        "suggestions": ["Add cloud projects"],
        "generatedQuestions": ["Q1", "Q2", "Q3", "Q4", "Q5"]
    }
    """
    mock_gemini.models.generate_content.return_value = mock_response

    payload = {
        "resume_text": "This is a candidate resume text that is long enough to pass validation rules. " * 3,
        "job_description": "This is a target job description for a Python developer position."
    }

    response = client.post("/api/v1/ai/analyze-resume", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["ats_score"] == 90
    assert "Docker" in data["missing_keywords"]
    assert len(data["generated_questions"]) == 5

@patch("main.gemini_client")
def test_generate_first_question_success(mock_gemini):
    mock_response = MagicMock()
    mock_response.text = """
    {
        "question": "Tell me about your Python experience."
    }
    """
    mock_gemini.models.generate_content.return_value = mock_response

    response = client.post(
        "/api/v1/ai/generate-question",
        data={"job_description": "We need a Python developer who knows FastAPI."}
    )
    assert response.status_code == 200
    assert response.json()["question"] == "Tell me about your Python experience."

@patch("main.gemini_client")
def test_evaluate_answer_success(mock_gemini):
    mock_response = MagicMock()
    mock_response.text = """
    {
        "transcript": "I have used Python for web development.",
        "evaluationMetrics": {
            "technicalAccuracy": 85,
            "communicationClarity": 90,
            "structuralLogic": 80,
            "constructiveFeedback": "Excellent answer."
        },
        "nextQuestion": "Explain decorators in Python."
    }
    """
    mock_gemini.models.generate_content.return_value = mock_response

    files = {
        "file": ("answer.webm", b"mock audio content", "audio/webm")
    }
    data = {
        "question_text": "Tell me about your Python experience.",
        "job_description": "Python Developer",
        "question_history": "[]"
    }

    response = client.post("/api/v1/ai/evaluate-answer", data=data, files=files)
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["transcript"] == "I have used Python for web development."
    assert res_data["evaluation_metrics"]["technicalAccuracy"] == 85

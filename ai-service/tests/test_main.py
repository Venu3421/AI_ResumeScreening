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

@patch("main.groq_client")
def test_generate_first_question_success(mock_groq):
    mock_message = MagicMock()
    mock_message.content = """
    {
        "question": "Tell me about your Python experience."
    }
    """
    mock_choice = MagicMock()
    mock_choice.message = mock_message
    mock_response = MagicMock()
    mock_response.choices = [mock_choice]
    mock_groq.chat.completions.create.return_value = mock_response

    response = client.post(
        "/api/v1/ai/generate-question",
        data={"job_description": "We need a Python developer who knows FastAPI."}
    )
    assert response.status_code == 200
    assert response.json()["question"] == "Tell me about your Python experience."

@patch("main.groq_client")
def test_evaluate_answer_success(mock_groq):
    # Mock Whisper transcription response
    mock_transcription = MagicMock()
    mock_transcription.text = "I have used Python for web development."
    mock_transcription.duration = 15.0
    mock_groq.audio.transcriptions.create.return_value = mock_transcription

    # Mock Llama evaluation response
    mock_message = MagicMock()
    mock_message.content = """
    {
        "evaluationMetrics": {
            "technicalScore": 85,
            "communicationScore": 90,
            "professionalism": 95,
            "confidence": 80,
            "constructiveFeedback": "Excellent answer."
        },
        "nextQuestion": "Explain decorators in Python."
    }
    """
    mock_choice = MagicMock()
    mock_choice.message = mock_message
    mock_response = MagicMock()
    mock_response.choices = [mock_choice]
    mock_groq.chat.completions.create.return_value = mock_response

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
    assert res_data["evaluation_metrics"]["technicalScore"] == 85
    assert res_data["evaluation_metrics"]["communicationScore"] == 90
    assert res_data["evaluation_metrics"]["professionalism"] == 95
    assert res_data["evaluation_metrics"]["confidence"] == 80
    assert res_data["evaluation_metrics"]["constructiveFeedback"] == "Excellent answer."

    # Verify that groq was called with correct file filename and arguments
    mock_groq.audio.transcriptions.create.assert_called_once_with(
        file=("audio.webm", b"mock audio content"),
        model="whisper-large-v3",
        response_format="verbose_json"
    )


@patch("main.groq_client")
def test_evaluate_answer_video_webm_mapping(mock_groq):
    # Mock Whisper transcription response
    mock_transcription = MagicMock()
    mock_transcription.text = "I designed a high-throughput microservice architecture."
    mock_transcription.duration = 20.0
    mock_groq.audio.transcriptions.create.return_value = mock_transcription

    # Mock Llama evaluation response
    mock_message = MagicMock()
    mock_message.content = """
    {
        "evaluationMetrics": {
            "technicalScore": 90,
            "communicationScore": 95,
            "professionalism": 90,
            "confidence": 85,
            "constructiveFeedback": "Very detailed."
        },
        "nextQuestion": "Tell me about load balancing."
    }
    """
    mock_choice = MagicMock()
    mock_choice.message = mock_message
    mock_response = MagicMock()
    mock_response.choices = [mock_choice]
    mock_groq.chat.completions.create.return_value = mock_response

    # Upload with video/webm mime type
    files = {
        "file": ("answer.webm", b"mock audio content", "video/webm")
    }
    data = {
        "question_text": "Can you walk me through a system you designed?",
        "job_description": "System Architect",
        "question_history": "[]"
    }

    response = client.post("/api/v1/ai/evaluate-answer", data=data, files=files)
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["transcript"] == "I designed a high-throughput microservice architecture."
    assert res_data["evaluation_metrics"]["technicalScore"] == 90
    
    # Verify that groq was called with mapped mime type (video/webm mapped to audio/webm -> ext audio.webm)
    mock_groq.audio.transcriptions.create.assert_called_once_with(
        file=("audio.webm", b"mock audio content"),
        model="whisper-large-v3",
        response_format="verbose_json"
    )


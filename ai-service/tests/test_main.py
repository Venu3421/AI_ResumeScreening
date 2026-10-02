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

@patch("main.embedding_model")
@patch("main.gemini_client")
def test_analyze_resume_success(mock_gemini, mock_embedding):
    import numpy as np
    mock_embedding.encode.return_value = np.ones((1, 384))
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

    response = client.post("/api/v1/ai/analyze-resume", data=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["ats_score"] == 80
    assert "python" in data["missing_keywords"]
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


@patch("main.groq_client")
def test_evaluate_code_answer_success(mock_groq):
    mock_message = MagicMock()
    mock_message.content = """
    {
        "evaluationMetrics": {
            "technicalScore": 88,
            "communicationScore": 92,
            "professionalism": null,
            "confidence": null,
            "constructiveFeedback": "Clean O(n) solution using hash map."
        },
        "nextQuestion": "How would you optimize space complexity?"
    }
    """
    mock_choice = MagicMock()
    mock_choice.message = mock_message
    mock_response = MagicMock()
    mock_response.choices = [mock_choice]
    mock_groq.chat.completions.create.return_value = mock_response

    payload = {
        "code_answer": "function twoSum(nums, target) { const map = new Map(); for (let i = 0; i < nums.length; i++) { const comp = target - nums[i]; if (map.has(comp)) return [map.get(comp), i]; map.set(nums[i], i); } return []; }",
        "code_language": "javascript",
        "question_text": "Write a function to solve Two Sum.",
        "job_description": "Frontend/Fullstack Engineer",
        "question_history": "[]"
    }

    response = client.post("/api/v1/ai/evaluate-code-answer", json=payload)
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["transcript"] == payload["code_answer"]
    assert res_data["evaluation_metrics"]["technicalScore"] == 88
    assert res_data["evaluation_metrics"]["speakingPace"] is None
    assert res_data["evaluation_metrics"]["interviewPresence"] is None
    assert res_data["next_question"] == "How would you optimize space complexity?"


def test_is_coding_question_text():
    from main import is_coding_question_text
    assert is_coding_question_text("In the code editor, please write a function to reverse a string.") is True
    assert is_coding_question_text("Write a SQL query to find top 5 customers by revenue.") is True
    assert is_coding_question_text("Implement an algorithm for binary search.") is True
    assert is_coding_question_text("Can you explain how the virtual DOM works in React?") is False
    assert is_coding_question_text("Tell me about a challenging project you worked on.") is False


def test_build_next_question_guidance_ensures_2_coding_questions():
    from main import build_next_question_guidance
    jd_swe = "Fullstack Engineer with Python and React"
    jd_data = "Data Analyst with PostgreSQL and SQL reporting"

    # Q1 just answered -> next is Q2 -> MUST be coding challenge
    g2 = build_next_question_guidance(jd_swe, [], "What is React state?")
    assert "MANDATORY HANDS-ON CODING OR SQL CHALLENGE" in g2
    assert "QUESTION 2 of 5" in g2

    # Q2 just answered (coding) -> next is Q3 -> conceptual
    g3 = build_next_question_guidance(jd_swe, ["What is React state?"], "Write a function to flatten an array.")
    assert "QUESTION 3 of 5" in g3
    assert "MANDATORY" not in g3

    # Q3 just answered -> next is Q4 -> MUST be coding challenge
    g4 = build_next_question_guidance(jd_data, ["Intro question", "Write a query"], "Explain indexing")
    assert "MANDATORY HANDS-ON CODING OR SQL CHALLENGE" in g4
    assert "QUESTION 4 of 5" in g4
    assert "SQL" in g4


@patch("main.groq_client")
def test_evaluate_sql_code_answer(mock_groq):
    mock_message = MagicMock()
    mock_message.content = """
    {
        "evaluationMetrics": {
            "technicalScore": 95,
            "communicationScore": 90,
            "professionalism": 90,
            "confidence": 85,
            "constructiveFeedback": "Excellent SQL query using window function DENSE_RANK()."
        },
        "nextQuestion": "How would you optimize this query for a billion rows?"
    }
    """
    mock_choice = MagicMock()
    mock_choice.message = mock_message
    mock_response = MagicMock()
    mock_response.choices = [mock_choice]
    mock_groq.chat.completions.create.return_value = mock_response

    payload = {
        "code_answer": "SELECT employee_id, salary, DENSE_RANK() OVER (ORDER BY salary DESC) as rank FROM employees WHERE rank = 2;",
        "code_language": "sql",
        "question_text": "Write a SQL query to find the second highest salary from employees table.",
        "job_description": "Data Analyst with SQL and PostgreSQL",
        "question_history": "[\"Explain database normalization\"]"
    }

    response = client.post("/api/v1/ai/evaluate-code-answer", json=payload)
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["transcript"] == payload["code_answer"]
    assert res_data["evaluation_metrics"]["technicalScore"] == 95
    assert "DENSE_RANK" in res_data["evaluation_metrics"]["constructiveFeedback"]


def _make_genai_error(err_cls, status_code, message):
    import requests
    mock_http_resp = MagicMock(spec=requests.Response)
    mock_http_resp.status_code = status_code
    mock_http_resp.json.return_value = {"error": {"code": status_code, "message": message}}
    return err_cls(status_code, mock_http_resp)


@patch("main.embedding_model")
@patch("main.gemini_client")
def test_analyze_resume_gemini_503_triggers_fallback_success(mock_gemini, mock_embedding):
    import numpy as np
    from google.genai.errors import ServerError
    mock_embedding.encode.return_value = np.ones((1, 384))

    err503 = _make_genai_error(ServerError, 503, "This model is currently experiencing high demand...")

    fallback_response = MagicMock()
    fallback_response.text = """
    {
        "atsScore": 85,
        "missingKeywords": ["Docker"],
        "strengths": ["Strong Python"],
        "weaknesses": ["None"],
        "suggestions": ["Deploy to production"],
        "generatedQuestions": ["Q1", "Q2", "Q3", "Q4", "Q5"]
    }
    """
    mock_gemini.models.generate_content.side_effect = [err503, fallback_response]

    payload = {
        "resume_text": "This is a candidate resume text that is long enough to pass validation rules. " * 3,
        "job_description": "This is a target job description for a Python developer position."
    }

    response = client.post("/api/v1/ai/analyze-resume", data=payload)
    assert response.status_code == 200
    assert mock_gemini.models.generate_content.call_count == 2
    assert mock_gemini.models.generate_content.call_args_list[0].kwargs["model"] == "gemini-3.8-flash"
    assert mock_gemini.models.generate_content.call_args_list[1].kwargs["model"] == "gemini-3-flash-preview"


@patch("main.embedding_model")
@patch("main.gemini_client")
def test_analyze_resume_gemini_429_triggers_fallback_success(mock_gemini, mock_embedding):
    import numpy as np
    from google.genai.errors import ClientError
    mock_embedding.encode.return_value = np.ones((1, 384))

    err429 = _make_genai_error(ClientError, 429, "Resource has been exhausted (quota exceeded)")

    fallback_response = MagicMock()
    fallback_response.text = """
    {
        "atsScore": 85,
        "missingKeywords": ["Docker"],
        "strengths": ["Strong Python"],
        "weaknesses": ["None"],
        "suggestions": ["Deploy to production"],
        "generatedQuestions": ["Q1", "Q2", "Q3", "Q4", "Q5"]
    }
    """
    mock_gemini.models.generate_content.side_effect = [err429, fallback_response]

    payload = {
        "resume_text": "This is a candidate resume text that is long enough to pass validation rules. " * 3,
        "job_description": "This is a target job description for a Python developer position."
    }

    response = client.post("/api/v1/ai/analyze-resume", data=payload)
    assert response.status_code == 200
    assert mock_gemini.models.generate_content.call_count == 2
    assert mock_gemini.models.generate_content.call_args_list[0].kwargs["model"] == "gemini-3.8-flash"
    assert mock_gemini.models.generate_content.call_args_list[1].kwargs["model"] == "gemini-3-flash-preview"


@patch("main.embedding_model")
@patch("main.gemini_client")
def test_analyze_resume_gemini_400_fails_immediately_without_fallback(mock_gemini, mock_embedding):
    import numpy as np
    from google.genai.errors import ClientError
    mock_embedding.encode.return_value = np.ones((1, 384))

    err400 = _make_genai_error(ClientError, 400, "Invalid argument: Bad request")
    mock_gemini.models.generate_content.side_effect = err400

    payload = {
        "resume_text": "This is a candidate resume text that is long enough to pass validation rules. " * 3,
        "job_description": "This is a target job description for a Python developer position."
    }

    response = client.post("/api/v1/ai/analyze-resume", data=payload)
    assert response.status_code == 502
    assert "AI processing failed" in response.json()["detail"]
    assert mock_gemini.models.generate_content.call_count == 1
    assert mock_gemini.models.generate_content.call_args_list[0].kwargs["model"] == "gemini-3.8-flash"


@patch("main.embedding_model")
@patch("main.gemini_client")
def test_analyze_resume_gemini_401_fails_immediately_without_fallback(mock_gemini, mock_embedding):
    import numpy as np
    from google.genai.errors import ClientError
    mock_embedding.encode.return_value = np.ones((1, 384))

    err401 = _make_genai_error(ClientError, 401, "API key not valid")
    mock_gemini.models.generate_content.side_effect = err401

    payload = {
        "resume_text": "This is a candidate resume text that is long enough to pass validation rules. " * 3,
        "job_description": "This is a target job description for a Python developer position."
    }

    response = client.post("/api/v1/ai/analyze-resume", data=payload)
    assert response.status_code == 502
    assert "AI processing failed" in response.json()["detail"]
    assert mock_gemini.models.generate_content.call_count == 1


def test_pdf_extractor_word_coordinates_and_multiword_matching():
    """Verify PyMuPDF word extraction and bounding box coordinate matching."""
    import pymupdf
    from pdf_extractor import extract_word_coordinates, build_highlight_map

    doc = pymupdf.open()
    page = doc.new_page(width=612, height=792)
    page.insert_text(pymupdf.Point(72, 100), "Senior Full Stack Engineer with Java, React and Spring Boot.")
    page.insert_text(pymupdf.Point(72, 150), "Experience designing microservices using Java and Docker.")
    pdf_bytes = doc.tobytes()
    doc.close()

    word_data = extract_word_coordinates(pdf_bytes)
    assert len(word_data["words"]) > 10
    assert len(word_data["page_dimensions"]) == 1
    assert word_data["page_dimensions"][0]["width"] == 612.0
    assert word_data["page_dimensions"][0]["height"] == 792.0

    matched = ["Java", "Spring Boot", "Docker"]
    missing = ["Kubernetes"]
    highlights = build_highlight_map(word_data, matched, missing)

    # 2 Java matches, 1 Spring Boot match, 1 Docker match
    java_hl = [h for h in highlights if h["text"] == "Java"]
    assert len(java_hl) == 2
    for h in java_hl:
        assert h["type"] == "matched_keyword"
        assert len(h["rect"]) == 4
        assert h["rect"][2] > h["rect"][0]  # width > 0
        assert h["rect"][3] > h["rect"][1]  # height > 0

    sb_hl = [h for h in highlights if h["text"] == "Spring Boot"]
    assert len(sb_hl) == 1
    assert sb_hl[0]["rect"][2] > sb_hl[0]["rect"][0]

    docker_hl = [h for h in highlights if h["text"] == "Docker"]
    assert len(docker_hl) == 1

    # Kubernetes is missing and NOT in document -> 0 highlights
    k8s_hl = [h for h in highlights if "Kubernetes" in h["text"]]
    assert len(k8s_hl) == 0


@patch("main.embedding_model")
@patch("main.gemini_client")
def test_analyze_resume_with_pdf_file_returns_coordinates(mock_gemini, mock_embedding):
    """Verify multipart PDF upload to /analyze-resume returns highlights & page dimensions."""
    import numpy as np
    import pymupdf
    import io

    mock_embedding.encode.return_value = np.ones((1, 384))
    mock_response = MagicMock()
    mock_response.text = """
    {
        "atsScore": 85,
        "missingKeywords": ["Kubernetes"],
        "strengths": ["Strong Java & Spring Boot background"],
        "weaknesses": ["Missing Kubernetes"],
        "suggestions": ["Add cloud deployments"],
        "generatedQuestions": ["Q1", "Q2", "Q3", "Q4", "Q5"]
    }
    """
    mock_gemini.models.generate_content.return_value = mock_response

    doc = pymupdf.open()
    page = doc.new_page(width=612, height=792)
    page.insert_text(pymupdf.Point(72, 100), "Professional Software Engineer. SKILLS: Java, Spring Boot, React, Docker.")
    page.insert_text(pymupdf.Point(72, 200), "EXPERIENCE: Developed REST APIs in Java and Spring Boot for 4 years.")
    pdf_bytes = doc.tobytes()
    doc.close()

    files = {
        "resume_file": ("test_resume.pdf", io.BytesIO(pdf_bytes), "application/pdf")
    }
    data = {
        "job_description": "Looking for a backend developer skilled in Java, Spring Boot, React, and Kubernetes."
    }

    response = client.post("/api/v1/ai/analyze-resume", data=data, files=files)
    assert response.status_code == 200
    res_data = response.json()

    assert "highlights" in res_data
    assert "page_dimensions" in res_data
    assert len(res_data["page_dimensions"]) == 1
    assert res_data["page_dimensions"][0]["width"] == 612.0

    # Highlights should be populated with real bounding boxes
    assert len(res_data["highlights"]) > 0
    first_hl = res_data["highlights"][0]
    assert "page" in first_hl
    assert "text" in first_hl
    assert "rect" in first_hl
    assert "type" in first_hl
    assert len(first_hl["rect"]) == 4


@patch("main.embedding_model")
@patch("main.gemini_client")
def test_analyze_resume_text_only_returns_empty_highlights(mock_gemini, mock_embedding):
    """Verify plain text upload returns empty highlights and dimensions gracefully."""
    import numpy as np

    mock_embedding.encode.return_value = np.ones((1, 384))
    mock_response = MagicMock()
    mock_response.text = """
    {
        "atsScore": 75,
        "missingKeywords": ["AWS"],
        "strengths": ["Good programming fundamentals"],
        "weaknesses": ["Cloud experience needed"],
        "suggestions": ["Certify in AWS"],
        "generatedQuestions": ["Q1", "Q2", "Q3", "Q4", "Q5"]
    }
    """
    mock_gemini.models.generate_content.return_value = mock_response

    payload = {
        "resume_text": "Candidate with extensive background in Python and PostgreSQL database architecture. " * 3,
        "job_description": "Hiring senior Python developer with PostgreSQL and AWS expertise."
    }

    response = client.post("/api/v1/ai/analyze-resume", data=payload)
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["highlights"] == []
    assert res_data["page_dimensions"] == []


def test_load_audio_array_with_wav_bytes():
    """Verify load_audio_array successfully parses raw WAV audio into float32 array."""
    import io
    import soundfile as sf
    import numpy as np
    from main import load_audio_array

    sr = 16000
    t = np.linspace(0, 1, sr)
    data = (np.sin(2 * np.pi * 440 * t) * 0.5).astype(np.float32)
    buf = io.BytesIO()
    sf.write(buf, data, sr, format="WAV")
    wav_bytes = buf.getvalue()

    y, out_sr = load_audio_array(wav_bytes)
    assert len(y) == sr
    assert out_sr == sr
    assert y.dtype == np.float32


def test_load_audio_array_invalid_bytes_raises_value_error():
    """Verify load_audio_array raises ValueError gracefully on corrupt/unrecognized bytes."""
    import pytest
    from main import load_audio_array

    with pytest.raises(ValueError, match="Could not decode audio"):
        load_audio_array(b"random non-audio bytes 12345")







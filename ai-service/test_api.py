import io
import wave
import requests
import fitz # pymupdf
import json

# 1. Create a dummy WAV file
wav_bytes = io.BytesIO()
with wave.open(wav_bytes, 'wb') as f:
    f.setnchannels(1)
    f.setsampwidth(2)
    f.setframerate(44100)
    # Write 1 sec of silence
    f.writeframes(b'\x00\x00' * 44100)

wav_bytes.seek(0)
audio_data = wav_bytes.read()

# 2. Test /api/v1/ai/evaluate-answer
print("Testing /api/v1/ai/evaluate-answer ...")
try:
    res = requests.post(
        "http://127.0.0.1:8000/api/v1/ai/evaluate-answer",
        data={
            "question_text": "What is Python?",
            "job_description": "Software Engineer",
            "question_history": "[]"
        },
        files={"file": ("test.wav", audio_data, "audio/wav")}
    )
    print("Evaluate Answer Status:", res.status_code)
    if res.status_code == 200:
        data = res.json()
        print("Composite confidence:", data.get("evaluationMetrics", {}).get("confidence"))
    else:
        print(res.text)
except Exception as e:
    print("Error calling evaluate-answer:", e)

# 3. Create a dummy PDF with sections
pdf = fitz.open()
page = pdf.new_page()
page.insert_text((50, 50), "SKILLS\nPython\nJava\n\nEXPERIENCE\nSoftware Engineer")
pdf_bytes = pdf.write()
pdf.close()

# 4. Test /api/v1/ai/analyze-resume with PDF
print("Testing /api/v1/ai/analyze-resume with PDF...")
try:
    res = requests.post(
        "http://127.0.0.1:8000/api/v1/ai/analyze-resume",
        data={"job_description": "We need a Python and Java dev."},
        files={"resume_file": ("test.pdf", pdf_bytes, "application/pdf")}
    )
    print("Analyze Resume Status:", res.status_code)
except Exception as e:
    print("Error calling analyze-resume:", e)

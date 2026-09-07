import json
import time
import requests

JD = """We are looking for a backend engineer with experience in cloud-native application development. Requirements: backend services development using modern frameworks, containerization and orchestration knowledge, experience with cloud deployment and infrastructure, familiarity with CI/CD workflows, ability to design scalable distributed systems, database management experience."""

RESUME_1 = """Senior Software Engineer with 4 years of experience building and maintaining REST APIs using FastAPI and Flask. Designed and deployed containerized microservices using Docker and Kubernetes on AWS EC2 and ECS. Implemented CI/CD pipelines via GitHub Actions. Led backend architecture decisions for a SaaS platform serving 50,000 users. Proficient in Python, PostgreSQL, Redis, and message queues (RabbitMQ). Strong understanding of system design, scalability, and cloud infrastructure."""

RESUME_2 = """Experienced retail associate with 3 years in customer service and sales. Proficient in Microsoft Word, Excel, and PowerPoint. Managed inventory and handled cash register operations. Strong communication skills and ability to work in a team environment. Completed online course in basic digital marketing."""

def test_endpoint(url="http://localhost:8000/api/v1/ai/analyze-resume"):
    print("=== TESTING ENDPOINT ===")
    
    print("\n--- Test Case 1 (Strong Semantic Match) ---")
    payload1 = {
        "resume_text": RESUME_1,
        "job_description": JD
    }
    t0 = time.time()
    try:
        r1 = requests.post(url, json=payload1)
        print(f"Status Code: {r1.status_code} (took {time.time()-t0:.2f}s)")
        if r1.status_code == 200:
            data1 = r1.json()
            print(json.dumps(data1, indent=2))
        else:
            print(r1.text)
    except Exception as e:
        print(f"Request 1 failed: {e}")

    print("\n--- Test Case 2 (Weak / Irrelevant Resume) ---")
    payload2 = {
        "resume_text": RESUME_2,
        "job_description": JD
    }
    t0 = time.time()
    try:
        r2 = requests.post(url, json=payload2)
        print(f"Status Code: {r2.status_code} (took {time.time()-t0:.2f}s)")
        if r2.status_code == 200:
            data2 = r2.json()
            print(json.dumps(data2, indent=2))
        else:
            print(r2.text)
    except Exception as e:
        print(f"Request 2 failed: {e}")

if __name__ == "__main__":
    test_endpoint()

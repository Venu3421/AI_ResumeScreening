### 1. Database Schema (PostgreSQL Model)

```
                       +-------------------+
                       |       USERS       |
                       +-------------------+
                       | PK | id           |
                       |    | name         |
                       |    | email        |
                       |    | password_hash|
                       |    | created_at   |
                       +---------+---------+
                                 |
                                 | 1:1
                                 ▼
                       +-------------------+
                       |      RESUMES      |
                       +-------------------+
                       | PK | id           |
                       | FK | user_id      |
                       |    | raw_text     |
                       |    | ats_score    |
                       |    | feedback_json|
                       |    | updated_at   |
                       +-------------------+
                                 |
                                 | 1:M
                                 ▼
                       +-------------------+
                       | INTERVIEW_SESSIONS|
                       +-------------------+
                       | PK | id           |
                       | FK | user_id      |
                       |    | job_desc     |
                       |    | status       |
                       |    | overall_score|
                       |    | created_at   |
                       +---------+---------+
                                 |
                                 | 1:M
                                 ▼
                       +-------------------+
                       | QUESTION_ANS_LOGS |
                       +-------------------+
                       | PK | id           |
                       | FK | session_id   |
                       |    | question_text|
                       |    | transcript   |
                       |    | metrics_json |
                       +-------------------+
```

#### `users` Table
```sql
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

#### `resumes` Table
```sql
CREATE TABLE resumes (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    raw_text TEXT NOT NULL,
    ats_score INT NOT NULL,
    feedback_json JSONB NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

#### `interview_sessions` Table
```sql
CREATE TABLE interview_sessions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_description TEXT NOT NULL,
    status VARCHAR(50) NOT NULL, -- CREATED, ACTIVE, COMPLETED
    overall_score INT DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

#### `question_answer_logs` Table
```sql
CREATE TABLE question_answer_logs (
    id BIGSERIAL PRIMARY KEY,
    session_id BIGINT NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    transcript TEXT,
    metrics_json JSONB, -- Stores technicalScore, communicationScore, professionalism, confidence, speakingPace, interviewPresence, eyeContact, bodyLanguage, facialComposure, constructiveFeedback
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

---

### 2. Core API Contract Interface Specifications

#### Authentication API
*   **Route:** `POST /api/v1/auth/register`
*   **Request Payload Structure:**
```json
{
  "name": "Paka Venu Yadav",
  "email": "venu.yadav@example.com",
  "password": "SecurePassword123"
}
```
*   **Response Payload Structure (201 Created):**
```json
{
  "status": "success",
  "message": "User registered successfully."
}
```

*   **Route:** `POST /api/v1/auth/login`
*   **Request Payload Structure:**
```json
{
  "email": "venu.yadav@example.com",
  "password": "SecurePassword123"
}
```
*   **Response Payload Structure (200 OK):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "type": "Bearer",
  "expiresIn": 86400
}
```

#### Resume Processing API
*   **Route:** `POST /api/v1/resumes/upload`
*   **Headers:** `Authorization: Bearer <token>`
*   **Request Payload Structure:** `multipart/form-data` (Key: `file` Binary PDF, Key: `jobDescription` String)
*   **Response Payload Structure (200 OK):**
```json
{
  "resumeId": 45,
  "atsScore": 82,
  "missingKeywords": ["Kafka", "Kubernetes", "GraphQL"],
  "matchedKeywords": ["Java", "Spring Boot", "PostgreSQL", "Docker", "REST APIs"],
  "resumeText": "Experienced Backend Engineer with 4 years...",
  "strengths": [
    "Strong demonstrated proficiency in core Java concurrency and Spring Boot services.",
    "Comprehensive database design and query optimization experience."
  ],
  "weaknesses": [
    "Limited mention of distributed streaming platforms like Apache Kafka."
  ],
  "suggestions": [
    "Highlight specific metrics around throughput improvements achieved using connection pooling."
  ],
  "generatedQuestions": [
    "Explain how you design a resilient retry mechanism in a Spring Boot microservice.",
    "How would you optimize slow PostgreSQL queries with composite indexes?"
  ],
  "highlights": [
    {
      "text": "Java",
      "type": "matched_keyword",
      "page": 0,
      "rect": [72.0, 142.5, 98.2, 154.0]
    }
  ],
  "pageDimensions": [
    { "width": 612.0, "height": 792.0 }
  ],
  "hasPdf": true
}
```

#### Multi-Modal & Code Interview API
*   **Route:** `POST /api/v1/interview/start`
*   **Headers:** `Authorization: Bearer <token>`
*   **Request Payload Structure:**
```json
{
  "jobDescription": "Looking for a backend engineer specialized in Java, Spring Boot, and PostgreSQL."
}
```
*   **Response Payload Structure (201 Created):**
```json
{
  "sessionId": 812,
  "status": "ACTIVE",
  "firstQuestion": "Can you explain how the Spring IoC container manages bean lifecycles, and how you would prevent circular dependencies?"
}
```

*   **Route:** `POST /api/v1/interview/submit-answer`
*   **Headers:** `Authorization: Bearer <token>`
*   **Request Payload Structure (Voice Mode):** `multipart/form-data`
  * `sessionId`: Long
  * `questionText`: String
  * `file`: Binary Audio (WebM/WAV)
  * `durationSeconds`: Integer (optional)
  * `interviewPresence`: Integer 0-100 (optional, MediaPipe)
  * `eyeContact`: Integer 0-100 (optional, MediaPipe)
  * `bodyLanguage`: Integer 0-100 (optional, MediaPipe)
  * `facialComposure`: Integer 0-100 (optional, MediaPipe)
*   **Request Payload Structure (Code Mode):** `multipart/form-data`
  * `sessionId`: Long
  * `questionText`: String
  * `codeAnswer`: String (Candidate source code or SQL)
  * `codeLanguage`: String (`javascript`, `python`, `java`, `cpp`, `sql`, `pseudocode`)
*   **Response Payload Structure (200 OK):**
```json
{
  "logId": 4912,
  "transcript": "public class LRUCache {\n    private final int capacity;\n    ...",
  "evaluationMetrics": {
    "technicalScore": 88,
    "communicationScore": 92,
    "professionalism": 90,
    "confidence": 85,
    "speakingPace": 135,
    "interviewPresence": 94,
    "eyeContact": 88,
    "bodyLanguage": 91,
    "facialComposure": null,
    "constructiveFeedback": "The explanation cleanly covered architectural definitions. To improve, explicitly consider time complexity tradeoffs."
  },
  "nextQuestion": "Explain how database indexing strategies alter query optimization paths within a PostgreSQL engine."
}
```

#### Dynamic Dashboard Stats API
*   **Route:** `GET /api/v1/interview/stats`
*   **Headers:** `Authorization: Bearer <token>`
*   **Response Payload Structure (200 OK):**
```json
{
  "latestAtsScore": 84,
  "avgTechnicalScore": 82,
  "avgCommunicationScore": 79,
  "avgConfidence": 85,
  "avgSpeakingPace": 142,
  "trend": [
    { "date": "2026-09-24", "overallScore": 74 },
    { "date": "2026-09-28", "overallScore": 82 },
    { "date": "2026-09-30", "overallScore": 86 }
  ]
}
```

---

### 3. AI Microservice Internal Contracts (`http://localhost:8000`)

#### Code Evaluation (`POST /api/v1/ai/evaluate-code-answer`)
```json
{
  "code_answer": "function twoSum(nums, target) { ... }",
  "code_language": "javascript",
  "question_text": "Write a function to solve Two Sum in O(n) time.",
  "job_description": "Full-stack developer with React and Node.js...",
  "question_history": "[\"Explain event loops.\"]"
}
```

#### Health Status (`GET /health`)
```json
{
  "status": "healthy",
  "service": "interviewiq-ai-service",
  "version": "1.2.0",
  "models": {
    "gemini": "gemini-3.8-flash (fallback: gemini-3-flash-preview)",
    "whisper": "whisper-large-v3",
    "groq_eval": "qwen/qwen3.8-27b",
    "embeddings": "all-MiniLM-L6-v2"
  }
}
```

---

# you asked

message time: 2026-06-25 11:30:48

Okay and a document for my team mates so they can instruct their agents with the same plan

---

# gemini response

Here is a master alignment document you can drop straight into your team’s Discord, WhatsApp, or shared workspace. 

When your team is aiming for roles at enterprise companies like ServiceNow, Target, or TCS, demonstrating this kind of modern, multimodal AI integration is a massive advantage. But because you are building this in just 4 days, keeping everyone’s AI agents strictly aligned on the same architecture is critical. If one teammate's agent hallucinates a different database schema, the whole pipeline breaks.

Share this with your team so everyone is operating from the exact same baseline.

***
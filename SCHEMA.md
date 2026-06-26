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
    metrics_json JSONB, -- Stores Technical Accuracy, Communication Clarity, Structural Logic, Corrections
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
*   **Request Payload Structure:** `multipart/form-data` (Key: `file` Binary, Key: `jobDescription` String)
*   **Response Payload Structure (200 OK):**
```json
{
  "resumeId": 45,
  "atsScore": 78,
  "missingKeywords": ["Microservices", "Kafka", "Distributed Systems"],
  "generatedQuestions": [
    "Explain how you design a resilient retry mechanism in a Spring Boot microservice.",
    "Describe a scenario where you would choose an SVM algorithm over a Random Forest classifier."
  ]
}
```

#### Multi-Modal Interview API
*   **Route:** `POST /api/v1/interview/start`
*   **Headers:** `Authorization: Bearer <token>`
*   **Request Payload Structure:**
```json
{
  "jobDescription": "Looking for an intermediate backend engineer specialized in Java, Spring Boot, and PostgreSQL."
}
```
*   **Response Payload Structure (201 Created):**
```json
{
  "sessionId": 812,
  "status": "ACTIVE",
  "firstQuestion": "Can you explain the structural architectural differences between an abstract class and an interface in Java, and when to use each?"
}
```

*   **Route:** `POST /api/v1/interview/submit-answer`
*   **Headers:** `Authorization: Bearer <token>`
*   **Request Payload Structure:** `multipart/form-data` (Key: `sessionId` Long, Key: `questionText` String, Key: `file` Binary Audio WebM/WAV)
*   **Response Payload Structure (200 OK):**
```json
{
  "logId": 4912,
  "transcript": "In Java, an abstract class allows you to create blueprints with partial state implementations, whereas interfaces enforce absolute decoupling...",
  "evaluationMetrics": {
    "technicalAccuracy": 88,
    "communicationClarity": 92,
    "structuralLogic": 85,
    "constructiveFeedback": "The explanation cleanly covered architectural definitions. To improve, explicitly highlight the memory allocation differences when scaling instances."
  },
  "nextQuestion": "Explain how database indexing strategies alter query optimization paths within a PostgreSQL engine."
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
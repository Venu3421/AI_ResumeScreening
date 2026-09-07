# 🚀 InterviewIQ AI — AI-Powered Resume Screening & Multimodal Mock Interview Coach

> **A modern, candidate-centric career preparation platform designed to help job seekers evaluate their resume ATS compatibility, practice adaptive mock interviews, and receive real-time multimodal feedback on technical reasoning, communication clarity, vocal prosody, and eye contact.**

---

## 📌 Project Overview & Purpose

Unlike corporate applicant tracking systems that filter out candidates for recruiters, **InterviewIQ AI is built strictly for the candidate**. It serves as an intelligent, automated personal career mentor that empowers candidates to:
1. **Optimize Their Resumes:** Receive deterministic ATS compatibility scores against specific job descriptions using hybrid keyword extraction and local semantic embeddings (`all-MiniLM-L6-v2`), accompanied by narrative advice from Google Gemini.
2. **Master Technical & Behavioral Interviews:** Practice realistic, question-by-question spoken mock interviews tailored to their resume and target role.
3. **Multimodal Coaching:**
   - **Edge Computer Vision:** Tracks gaze stability and eye contact in real time on the browser via **Google MediaPipe WebAssembly**.
   - **Acoustic Vocal Prosody:** Analyzes speech rhythm, pause frequencies, pitch modulation, and vocal energy using **Librosa**.
   - **Speech Recognition:** Transcribes candidate audio with sub-second latency via **Groq Whisper Large v3**.
   - **Cognitive Evaluation:** Provides technical accuracy breakdown, communication suggestions, and model answers using state-of-the-art LLMs.

---

## 🏛️ System Architecture

The application adopts a **decoupled, polyglot 3-tier microservice architecture** with an edge-compute frontend, transactional backend orchestrator, and an AI processing engine.

```
                     ┌──────────────────────────────────────────────────┐
                     │          Tier 1: Frontend Client (React 19)      │
                     │  - MediaRecorder API (Web Audio capture)         │
                     │  - Google MediaPipe Face Landmarker (WASM/WebGL) │
                     │  - TailwindCSS v4 + Vite + Axios                 │
                     └───────────────────────┬──────────────────────────┘
                                             │ HTTPS / REST (JWT Auth)
                                             ▼
                     ┌──────────────────────────────────────────────────┐
                     │       Tier 2: Backend Server (Spring Boot 3.3)   │
                     │  - Spring Security 6 (Stateless JWT)             │
                     │  - Spring Data JPA + Hibernate                   │
                     │  - Apache Tika 2.9.1 (Document Text Parsing)     │
                     │  - Transaction Management & Session State        │
                     └───────────────┬───────────────────┬──────────────┘
                                     │ JDBC              │ HTTP / Multipart
                                     ▼                   ▼
     ┌──────────────────────────────────────┐     ┌──────────────────────────────────────┐
     │          PostgreSQL Database         │     │     Tier 3: AI Microservice Engine   │
     │  - Supabase / Local PostgreSQL       │     │     (Python 3.10+ & FastAPI)         │
     │  - Users, Resumes, Sessions, QA Logs │     │  - Groq Whisper Large v3 (STT)       │
     └──────────────────────────────────────┘     │  - Librosa (Prosody / Pitch / Pauses)│
                                                  │  - SentenceTransformer (Embeddings)  │
                                                  │  - Groq LLM (Interview Reasoning)    │
                                                  │  - Google Gemini 1.5/2.5/3.5 (ATS)   │
                                                  └──────────────────────────────────────┘
```

---

## ✨ Key Features

| Feature | Description | Powered By |
| :--- | :--- | :--- |
| **Hybrid ATS Resume Scoring** | Computes deterministic keyword overlap + local dense vector cosine similarity (60/40 weighting) to prevent LLM hallucinations. | Apache Tika, `SentenceTransformer`, Gemini |
| **Edge-Vision Eye-Contact Coach** | Measures face mesh landmarks at 3.3 FPS locally in the browser. Zero video streaming to servers ensures maximum privacy and zero network latency. | Google MediaPipe Tasks Vision (WASM) |
| **Vocal Prosody Analysis** | Measures vocal confidence, pitch variance (`pyin`), silence/pause frequency (`effects.split`), speaking tempo (onset strength), and RMS energy. | `librosa 0.10.2` & `soundfile` |
| **Ultra-Fast Speech Transcription** | Transcribes spoken answers from WebM/WAV audio with near-instantaneous turnaround. | Groq Cloud LPU (`whisper-large-v3`) |
| **Cognitive Scoring & Model Answers** | Breaks down each response into technical accuracy, communication clarity, structural logic, and suggested corrections. | Groq LLM (`qwen/qwen3.6-27b` / `llama-3.3-70b`) |
| **Adaptive Question Generator** | Generates customized interview questions targeted specifically to the candidate's resume skills and target job description. | Groq LLM Engine |
| **Performance Analytics & History** | Visual dashboard tracking score trajectories, strengths, weakness areas, and past interview logs. | React, TailwindCSS, Chart.js / SVG |

---

## 🛠️ Technology Stack Breakdown

### Frontend (Client Layer)
- **Framework:** React 19 (`react`, `react-dom`) initialized via Vite
- **Styling:** TailwindCSS v4 with custom dark mode glassmorphism UI
- **Routing & State:** React Router DOM v7, React Context for JWT auth
- **Icons & Visuals:** `lucide-react`, Canvas API for eye-contact tracking visualization
- **Edge Vision AI:** `@mediapipe/tasks-vision` (WebAssembly & WebGL)
- **Audio Capture:** HTML5 MediaStreams & MediaRecorder API

### Backend (Orchestration & Business Logic)
- **Framework:** Spring Boot 3.3.3 (Java 17)
- **Security:** Spring Security 6 with stateless JWT authentication & Google OAuth2 client
- **Persistence:** Spring Data JPA / Hibernate ORM
- **Document Processing:** Apache Tika 2.9.1 (`tika-core` & `tika-parsers-standard-package`)
- **HTTP Client:** Spring Web (`RestTemplate` / `WebClient`) for microservice dispatch
- **Database:** PostgreSQL 15+ (local or Supabase cloud)

### AI Microservice Engine
- **Framework:** FastAPI with ASGI server (Uvicorn)
- **Audio Processing:** `librosa 0.10.2`, `soundfile`, `numpy`
- **Embeddings:** `sentence-transformers` (`all-MiniLM-L6-v2`)
- **External AI Providers:**
  - **Groq Cloud:** `whisper-large-v3` (STT), `qwen/qwen3.6-27b` / `llama-3.3-70b-versatile` (Reasoning)
  - **Google Cloud:** `google-genai` SDK (Gemini Flash)
- **Data Validation:** Pydantic v2 schemas

---

## 🗄️ Database Schema

The relational schema is configured in PostgreSQL with cascade deletions:

```sql
-- 1. Candidate User Account
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Resume Entity & ATS Screening Output
CREATE TABLE resumes (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    raw_text TEXT NOT NULL,
    ats_score INT NOT NULL,
    feedback_json JSONB NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Mock Interview Session
CREATE TABLE interview_sessions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_description TEXT NOT NULL,
    status VARCHAR(50) NOT NULL, -- CREATED, ACTIVE, COMPLETED, ABORTED
    overall_score INT DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Question & Answer Turn Evaluation Logs
CREATE TABLE question_answer_logs (
    id BIGSERIAL PRIMARY KEY,
    session_id BIGINT NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    transcript TEXT,
    metrics_json JSONB, -- Stores technical score, communication, prosody, gaze
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🔌 API Reference

### Backend Application Server (`http://localhost:8080`)

#### Authentication (`/api/auth`)
- `POST /api/auth/register` — Register a new candidate account.
- `POST /api/auth/login` — Authenticate candidate and receive JWT token.
- `POST /api/auth/oauth/google` — Exchange Google ID token for JWT session.

#### Resume Screening (`/api/resumes`)
- `POST /api/resumes/upload` — Multipart PDF upload; extracts text via Apache Tika and calls AI engine for ATS rating.
- `GET /api/resumes/my-resumes` — Retrieve authenticated user's analyzed resume & recommendations.

#### Mock Interviews (`/api/interviews`)
- `POST /api/interviews/sessions` — Initialize a new interview session for a given job role and description.
- `POST /api/interviews/sessions/{id}/evaluate` — Submit answer audio file + edge metrics (WPM, eye contact); returns transcript, prosody, and scoring.
- `POST /api/interviews/sessions/{id}/complete` — Finalize session and calculate aggregate performance scorecard.
- `GET /api/interviews/sessions/{id}` — Retrieve full interview session details with all question logs.
- `GET /api/interviews/sessions` — List user's historical interview sessions.

### AI Microservice Engine (`http://localhost:8000`)
- `POST /ai/screen-resume` — Computes keyword overlap, vector semantic similarity, and Gemini narrative feedback.
- `POST /ai/evaluate-answer` — Runs Groq Whisper STT, Librosa acoustic prosody analysis, and LLM answer grading.
- `POST /ai/generate-questions` — Generates adaptive technical & behavioral questions based on resume and job specs.
- `GET /health` — Service health check and model loading status.

---

## 📊 UML Design & Architecture Presentation Deliverables

Full, interactive software engineering UML presentations have been generated and packaged in both **Mermaid** and **PlantUML**:

| Deliverable | Description | Link |
| :--- | :--- | :--- |
| **Interactive PlantUML Presentation** | Complete browser slide deck with embedded PlantUML vector diagrams, architecture breakdowns, and viva defense scripts. | [docs/presentation.html](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/docs/presentation.html) |
| **Interactive Mermaid Presentation** | Live Mermaid JS slide deck with interactive diagram zooming, full viva defense guide, and copyable Mermaid source. | [docs/mermaid_presentation.html](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/docs/mermaid_presentation.html) |
| **Master UML Design Document** | Markdown document containing all 9 UML diagrams (Class, Use Case, Sequence, Activity, Object, State, Collaboration, Component, Deployment). | [docs/UML_DESIGN_PRESENTATION.md](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/docs/UML_DESIGN_PRESENTATION.md) |
| **LLM Diagram Prompt Context** | Ready-to-use prompt package for regenerating or customizing the 9 UML diagrams via any external LLM (ChatGPT, Claude, Gemini). | [docs/LLM_DIAGRAM_PROMPT_CONTEXT.md](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/docs/LLM_DIAGRAM_PROMPT_CONTEXT.md) |
| **Raw PlantUML Sources & SVGs** | Raw `.puml` files and high-resolution generated `.svg` assets for each diagram. | [`docs/plantuml/`](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/docs/plantuml/) |

---

## ⚡ Step-by-Step Local Setup Guide

### Pre-requisites
Make sure you have installed:
- **Java Development Kit (JDK 17+)**
- **Node.js (v18+) & npm (v9+)**
- **Python (v3.10+)**
- **PostgreSQL (v14+)**

---

### 1. Database Setup
Create the PostgreSQL database:
```sql
CREATE DATABASE interview_db;
```

---

### 2. Backend Server (Spring Boot)
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Configure your `src/main/resources/application.properties` (or export environment variables):
   ```properties
   server.port=8080
   spring.datasource.url=jdbc:postgresql://localhost:5432/interview_db
   spring.datasource.username=postgres
   spring.datasource.password=your_password
   spring.jpa.hibernate.ddl-auto=update

   jwt.secret=your_64_character_minimum_super_secret_jwt_hmac_sha_key_here
   jwt.expiration=86400000
   ai.service.url=http://localhost:8000
   ```
3. Run the Spring Boot application:
   ```bash
   ./mvnw spring-boot:run
   ```
   *The server will start on `http://localhost:8080`.*

---

### 3. AI Microservice Engine (FastAPI)
1. Navigate to the AI service directory:
   ```bash
   cd ai-service
   ```
2. Create a virtual environment and activate it:
   ```bash
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On Linux/macOS:
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Create a `.env` file in `/ai-service`:
   ```env
   PORT=8000
   GEMINI_API_KEY=your_google_ai_studio_api_key
   GROQ_API_KEY=your_groq_cloud_api_key
   ```
5. Run the FastAPI microservice:
   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8000 --reload
   ```
   *The AI microservice will start on `http://localhost:8000` (Swagger UI at `/docs`).*

---

### 4. Frontend Client (React)
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install Node dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in `/frontend`:
   ```env
   VITE_API_BASE_URL=http://localhost:8080
   VITE_GOOGLE_CLIENT_ID=your_optional_google_client_id
   ```
4. Launch the Vite development server:
   ```bash
   npm run dev
   ```
   *The frontend will be accessible at `http://localhost:5173`.*

---

## ⚙️ Environment Variables Reference

| Component | Variable Name | Required | Description |
| :--- | :--- | :--- | :--- |
| **Backend** | `SPRING_DATASOURCE_URL` | Yes | PostgreSQL connection URL |
| **Backend** | `SPRING_DATASOURCE_USERNAME` | Yes | Database username |
| **Backend** | `SPRING_DATASOURCE_PASSWORD` | Yes | Database password |
| **Backend** | `JWT_SECRET` | Yes | 256-bit secret key for signing JWT tokens |
| **Backend** | `AI_SERVICE_URL` | No | Defaults to `http://localhost:8000` |
| **Backend** | `GOOGLE_OAUTH_CLIENT_ID` | Optional | Google OAuth client ID |
| **Backend** | `GOOGLE_OAUTH_CLIENT_SECRET`| Optional | Google OAuth client secret |
| **AI Service** | `GEMINI_API_KEY` | Yes | Google AI Studio API key |
| **AI Service** | `GROQ_API_KEY` | Yes | Groq Cloud API key (for Whisper & LLM inference) |
| **AI Service** | `PORT` | No | Defaults to `8000` |
| **Frontend** | `VITE_API_BASE_URL` | Yes | Spring Boot API URL (e.g. `http://localhost:8080`) |
| **Frontend** | `VITE_GOOGLE_CLIENT_ID` | Optional | Google OAuth client ID |

---

## 🧪 Testing & Verification

- **Backend Unit & Integration Tests:**
  ```bash
  cd backend
  ./mvnw test
  ```
- **AI Microservice Verification:**
  ```bash
  cd ai-service
  python test_api.py
  python test_phase2_cases.py
  ```

---

## 🛡️ Security & Privacy Architecture

- **Zero Video Streaming:** Candidate camera feeds are analyzed in real time on the client CPU/GPU using WebAssembly. Video never leaves the user's browser.
- **Stateless Tokens:** All protected REST endpoints require standard `Bearer <token>` HTTP headers verified cryptographically via HMAC-SHA256.
- **Sanitized Uploads:** File uploads are strictly validated by size and MIME type, preventing malicious code injection.
- **Environment Isolation:** Secrets are isolated via `.env` and `application.properties` environment variable substitutions.

---

## 👥 Contributors & Academic Context

- **Author / Developer:** Paka Venu Yadav ([@Venu3421](https://github.com/Venu3421))
- **Project Domain:** AI-Powered EdTech & Automated Interview Preparation
- **Architecture Model:** Decoupled 3-Tier Microservices with Multimodal AI Integration

---
*Built with ❤️ for aspiring engineers preparing for their dream roles.*

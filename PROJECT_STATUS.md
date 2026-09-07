# InterviewIQ AI — Codebase Audit & Project Status Report

**Report Date:** September 4, 2026  
**Repository:** `InterviewIQ AI — Resume Screening & Mock Interview System`  
**Monorepo Root:** `d:/AI Resume Screening and Mock Interview System`  
**Purpose:** Comprehensive architectural and operational status report for incoming engineers and AI agents to resume development without confusion.

---

## Executive Summary

The project is a decoupled three-tier monorepo consisting of:
1. **AI Microservice (`/ai-service`)**: Python 3.10+ / FastAPI service executing a hybrid AI pipeline: Groq Whisper Large v3 (speech-to-text), Groq Llama 3.3 70B Versatile (evaluation reasoning & question generation), and Google Gemini (narrative resume analysis).
2. **Backend Application Server (`/backend`)**: Java 17 / Spring Boot 3.3.5 / Spring Security JWT with PostgreSQL (hosted on Supabase or local instance) and Apache Tika (PDF extraction).
3. **Frontend Client (`/frontend`)**: React 19 / Vite 8.1 / TailwindCSS 4 with client-side camera-based coaching powered by `@mediapipe/tasks-vision` (Face Landmarker).

The system has progressed through Phases 1–6: the hybrid Groq/Gemini pipeline is fully functional, an extended 8-metric evaluation model has replaced the legacy 4-metric schema with automatic backward compatibility, and client-side face landmarking coaching runs at ~3.3 fps in the browser. The immediate next planned milestone is **Phase 2: Semantic Resume Screening** (sentence-embeddings via `all-MiniLM-L6-v2`).

---

## 1. Architecture Audit (Actual Code State)

### 1.1 AI Runtime Microservice (`ai-service/`)

* **File:** [`ai-service/main.py`](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/ai-service/main.py) (439 lines)
* **Framework:** FastAPI `0.115.0`, Uvicorn `0.30.6`
* **Lifespan Manager:** Lines 37–58 (`@asynccontextmanager async def lifespan`) initializes `gemini_client` via `genai.Client(api_key=...)` and `groq_client` via `Groq(api_key=...)`. Both keys are validated on startup.
* **CORS:** Lines 68–74 (`allow_origins=["http://localhost:3000", "http://localhost:8080"]`). Note: OpenRouter has been completely removed from the code.

#### Hybrid AI Pipeline Breakdown

| Endpoint | HTTP Method | Primary AI Model / Provider | Processing Mode | Description & Output Schema |
| :--- | :--- | :--- | :--- | :--- |
| `/health` | `GET` | None | Synchronous | Service health check returning `{"status": "healthy", "service": "...", "version": "1.1.0"}`. |
| `/api/v1/ai/analyze-resume` | `POST` | **Google Gemini** (`gemini-3.5-flash` via `google-genai` SDK) | Text-to-Text Generative JSON | Takes `ResumeAnalysisRequest` (`resume_text`, `job_description`). Calculates narrative ATS score (0–100), extracts keyword gaps, strengths, weaknesses, rewrite suggestions, and generates 5 interview questions. Returns `ResumeAnalysisResponse`. |
| `/api/v1/ai/evaluate-answer` | `POST` | **Groq Whisper** (`whisper-large-v3`) + **Groq Qwen** (`qwen/qwen3.6-27b`) | Multi-step Hybrid Pipeline | **Step A:** Groq Whisper transcribes audio (`verbose_json` for STT & audio duration).<br>**Step B:** Python calculates speaking pace score (words per minute heuristic with 3-tier fallback).<br>**Step C:** Groq Qwen evaluates transcript against job context with 1 automatic retry on failure, scoring `technicalScore`, `communicationScore`, `professionalism`, `confidence`, and generating `constructiveFeedback` + `nextQuestion`. Returns `InterviewEvaluationResponse`. |
| `/api/v1/ai/generate-question` | `POST` | **Groq Qwen** (`qwen/qwen3.6-27b`) | Text-to-Text Generative JSON | Generates opening interview question based on job description. Returns `{"question": "..."}`. |

#### Dependencies Listed in `ai-service/requirements.txt`
* `fastapi==0.115.0`
* `uvicorn[standard]==0.30.6`
* `google-genai==1.0.0`
* `pydantic==2.9.2`
* `python-multipart==0.0.12`
* `python-dotenv==1.0.1`
* `groq==0.25.0`

#### Pydantic Schemas (`ai-service/schemas/`)

* **[`ai-service/schemas/resume.py`](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/ai-service/schemas/resume.py):**
  * `ResumeAnalysisRequest`:
    * `resume_text`: `str` (min length 50)
    * `job_description`: `str` (min length 20)
  * `ResumeAnalysisResponse`:
    * `ats_score`: `int` (0–100)
    * `missing_keywords`: `List[str]`
    * `strengths`: `List[str]`
    * `weaknesses`: `List[str]`
    * `suggestions`: `List[str]`
    * `generated_questions`: `List[str]` (exactly 5 questions)

* **[`ai-service/schemas/interview.py`](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/ai-service/schemas/interview.py):**
  * `EvaluationMetrics`:
    * `technicalScore`: `int` (0–100)
    * `communicationScore`: `int` (0–100)
    * `professionalism`: `int` (0–100)
    * `confidence`: `int` (0–100)
    * `constructiveFeedback`: `str`
    * `speakingPace`: `Optional[int]` (0–100, nullable)
    * `interviewPresence`: `Optional[int]` (0–100, nullable, populated by frontend camera)
    * `eyeContact`: `Optional[int]` (0–100, nullable, populated by frontend camera)
    * `bodyLanguage`: `Optional[int]` (0–100, nullable, populated by frontend camera)
  * `InterviewEvaluationResponse`:
    * `transcript`: `str`
    * `evaluation_metrics`: `Dict[str, object]`
    * `next_question`: `str`

---

### 1.2 Backend Application Server (`backend/`)

* **Base Package:** `com.project.system`
* **Java Version:** 17
* **Spring Boot:** 3.3.5
* **Key Libraries:** `jjwt-api:0.12.5`, `tika-core:2.9.1` & `tika-parsers-standard-package:2.9.1`, `google-api-client:2.2.0`, `postgresql:runtime`, `lombok:1.18.46`.

#### Controllers (`backend/src/main/java/com/project/system/controller/`)
1. **[`AuthController.java`](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/backend/src/main/java/com/project/system/controller/AuthController.java)** (`/api/v1/auth`):
   * `POST /register`: Accepts `RegisterRequest`, calls `authService.register()`, returns `ApiResponse` (201 Created).
   * `POST /login`: Accepts `LoginRequest`, calls `authService.login()`, returns `AuthResponse` (200 OK).
   * `POST /google`: Accepts `GoogleLoginRequest`, calls `authService.googleLogin()`, returns `AuthResponse` (200 OK).
2. **[`ResumeController.java`](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/backend/src/main/java/com/project/system/controller/ResumeController.java)** (`/api/v1/resumes`):
   * `POST /upload`: Multipart (`file`, `jobDescription`), calls `resumeService.uploadAndAnalyze()`, returns `ResumeUploadResponse`.
   * `GET`: Calls `resumeService.getResume()`, returns `ResumeUploadResponse` or 204 No Content.
3. **[`InterviewController.java`](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/backend/src/main/java/com/project/system/controller/InterviewController.java)** (`/api/v1/interview`):
   * `POST /start`: Accepts `InterviewStartRequest`, calls `interviewService.startSession()`, returns `InterviewStartResponse` (201 Created).
   * `POST /submit-answer`: Multipart parameters:
     * `sessionId`: `Long`
     * `questionText`: `String`
     * `file`: `MultipartFile` (WebM/WAV audio)
     * `durationSeconds`: `Integer` (nullable, client-measured recording duration)
     * `interviewPresence`: `Integer` (nullable, client MediaPipe score)
     * `eyeContact`: `Integer` (nullable, client MediaPipe score)
     * `bodyLanguage`: `Integer` (nullable, client MediaPipe score)
     * Returns `SubmitAnswerResponse`.
   * `GET /sessions`: Calls `interviewService.getSessionHistory()`, returns `List<SessionHistoryResponse>`.
   * `GET /sessions/{id}`: Calls `interviewService.getSessionDetail()`, returns `SessionDetailResponse`.

#### Services (`backend/src/main/java/com/project/system/service/`)
1. **[`AuthService.java`](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/backend/src/main/java/com/project/system/service/AuthService.java)**:
   * Handles BCrypt password hashing, user registration, local JWT generation.
   * Google OAuth verification using Google API client library `GoogleIdTokenVerifier` against `google.oauth.client-id`. Automatically provisions users on first Google login.
2. **[`CustomUserDetailsService.java`](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/backend/src/main/java/com/project/system/service/CustomUserDetailsService.java)**:
   * Loads user by username (email) for Spring Security `AuthenticationManager`.
3. **[`ResumeService.java`](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/backend/src/main/java/com/project/system/service/ResumeService.java)**:
   * Uses Apache Tika (`tika.parseToString(file.getInputStream())`) for text extraction from PDF.
   * Dispatches JSON payload to `ai-service` endpoint `${ai.service.url}/api/v1/ai/analyze-resume`.
   * Serializes feedback into `feedback_json` (`missingKeywords`, `strengths`, `weaknesses`, `suggestions`, `generatedQuestions`) and saves to `resumes` table.
4. **[`InterviewService.java`](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/backend/src/main/java/com/project/system/service/InterviewService.java)**:
   * `startSession`: Dispatches to `ai-service` `/api/v1/ai/generate-question` to create opening question; creates `InterviewSession` with status `"ACTIVE"`, inserts initial `QuestionAnswerLog`.
   * `submitAnswer`: Validates session ownership and active status; gathers transcript history; forwards audio + metadata (`duration_seconds`) to `ai-service` `/api/v1/ai/evaluate-answer`.
   * Merges frontend camera metrics (`interviewPresence`, `eyeContact`, `bodyLanguage`) into the metric map before persisting to `question_answer_logs.metrics_json`.
   * Manages session progression (up to 5 questions); when question 5 is evaluated, marks session `"COMPLETED"` and computes `overallScore` as the average of `technicalScore` and `communicationScore` across all answers.
   * `translateLegacyMetrics`: Translates pre-Phase-3 rows (`technicalAccuracy`, `communicationClarity`, `structuralLogic`) on the fly when reading session logs.

#### Entities (`backend/src/main/java/com/project/system/entity/`)
* **`User`**: Table `users`
* **`Resume`**: Table `resumes` (OneToOne with `User`)
* **`InterviewSession`**: Table `interview_sessions` (ManyToOne with `User`)
* **`QuestionAnswerLog`**: Table `question_answer_logs` (ManyToOne with `InterviewSession`)

#### DTOs (`backend/src/main/java/com/project/system/dto/`)
* `ApiResponse`: `status`, `message`
* `AuthResponse`: `token`, `type` ("Bearer"), `expiresIn` (86400), `user` (`UserDto`)
* `EvaluationMetricsDto`: `technicalScore`, `communicationScore`, `professionalism`, `confidence`, `constructiveFeedback`, `speakingPace`, `interviewPresence`, `eyeContact`, `bodyLanguage`
* `GoogleLoginRequest`: `credential`
* `InterviewStartRequest`: `jobDescription`
* `InterviewStartResponse`: `sessionId`, `status`, `firstQuestion`
* `LoginRequest`: `email`, `password`
* `QuestionAnswerLogDto`: `id`, `questionText`, `transcript`, `evaluationMetrics` (`EvaluationMetricsDto`), `createdAt`
* `RegisterRequest`: `name`, `email`, `password`
* `ResumeUploadResponse`: `resumeId`, `atsScore`, `missingKeywords`, `strengths`, `weaknesses`, `suggestions`, `generatedQuestions`
* `SessionDetailResponse`: `id`, `jobDescription`, `status`, `overallScore`, `createdAt`, `logs` (`List<QuestionAnswerLogDto>`)
* `SessionHistoryResponse`: `id`, `jobDescription`, `status`, `overallScore`, `createdAt`
* `SubmitAnswerResponse`: `logId`, `transcript`, `evaluationMetrics` (`EvaluationMetricsDto`), `nextQuestion`
* `UserDto`: `id`, `name`, `email`

---

### 1.3 Frontend Client (`frontend/`)

* **Framework & Build:** React `19.2.7`, Vite `8.1.0`, `@vitejs/plugin-react` `6.0.2`
* **Styling:** TailwindCSS `4.3.1` (`@tailwindcss/vite`)
* **Vite Server Port:** Configured explicitly to `3000` in [`frontend/vite.config.js`](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/frontend/vite.config.js#L12-L14).

#### Notable Dependencies (`frontend/package.json`)
* `@mediapipe/tasks-vision: ^0.10.18` (WebAssembly & GPU delegate client-side vision model for face landmarking)
* `@react-oauth/google: ^0.13.5` (Google Sign-In components)
* `axios: ^1.18.1` (REST client)
* `jwt-decode: ^4.0.0` (Client-side JWT parser)
* `react-router-dom: ^7.18.0` (Client-side routing)
* `chart.js: ^4.5.1` & `react-chartjs-2: ^5.3.1` (Data visualization)

#### Pages (`frontend/src/pages/`)
1. **[`DashboardPage.jsx`](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/frontend/src/pages/DashboardPage.jsx)**: Command center showing readiness score circle, recent interview sessions, and quick actions to Resume Analyzer and Mock Interview Arena.
2. **[`InterviewArenaPage.jsx`](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/frontend/src/pages/InterviewArenaPage.jsx)**: Multi-modal interview simulation arena. Supports 5 sequential questions, microphone recording with HTML5 `MediaRecorder`, animated audio visualizer, picture-in-picture webcam preview, real-time coaching tip pill, and an extended 8-metric sidebar.
3. **[`HistoryPage.jsx`](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/frontend/src/pages/HistoryPage.jsx)**: Session history list and detailed review view displaying transcripts, constructive feedback, and the full 8 metrics.
4. **[`ResumeAnalyzerPage.jsx`](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/frontend/src/pages/ResumeAnalyzerPage.jsx)**: Drag-and-drop PDF resume upload with target job description textarea, ATS score dial, keyword gap badges, and AI recommendations.
5. **[`LoginPage.jsx`](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/frontend/src/pages/LoginPage.jsx)** & **[`RegisterPage.jsx`](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/frontend/src/pages/RegisterPage.jsx)**: Split-screen auth pages supporting local credentials and Google OAuth.

#### Components, Context, and Utilities (`frontend/src/`)
* **[`Navbar.jsx`](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/frontend/src/components/Navbar.jsx)**: Top navigation bar with active route indicators and user logout.
* **[`ProtectedRoute.jsx`](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/frontend/src/components/ProtectedRoute.jsx)**: Route wrapper enforcing authentication.
* **[`AuthContext.jsx`](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/frontend/src/context/AuthContext.jsx)**: Provides user state, login, register, Google auth, and logout.
* **[`services/api.js`](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/frontend/src/services/api.js)**: Axios instance with `VITE_API_BASE_URL` fallback, automatic JWT injection via interceptors, and 401 redirect handlers.
* **[`utils/mediapipeCoach.js`](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/frontend/src/utils/mediapipeCoach.js)** (391 lines): Face Landmarker engine. Runs at ~3.3 fps via `setInterval(300ms)`. Computes:
  * `interviewPresence`: % frames with detected, centered face.
  * `eyeContact`: % frames with head yaw within ±15° and pitch within ±10°.
  * `bodyLanguage`: 100 minus fidget penalty (landmark displacement variance) minus slouch penalty (nose vertical drift from initial baseline).
  * Real-time debounced tips (`TIP_DEBOUNCE_MS = 6000ms`): "Move into the camera's view", "Try to face the camera directly", "Maintain eye contact with the camera".

---

## 2. Database Schema Audit

### 2.1 Entity & Database Tables

The database is PostgreSQL (managed via Spring Boot Hibernate `ddl-auto=update` and documented in `SCHEMA.md`).

```
  +------------------+         +----------------------+
  |      users       | 1 --- 1 |       resumes        |
  +------------------+         +----------------------+
  | PK id            |         | PK id                |
  |    name          |         | FK user_id (unique)  |
  |    email (uq)    |         |    raw_text          |
  |    password_hash |         |    ats_score         |
  |    created_at    |         |    feedback_json     |
  +--------+---------+         |    updated_at        |
           |                   +----------------------+
           | 1
           |
           | M
  +--------v---------+         +----------------------+
  |interview_sessions| 1 --- M | question_answer_logs |
  +------------------+         +----------------------+
  | PK id            |         | PK id                |
  | FK user_id       |         | FK session_id        |
  |    job_desc      |         |    question_text     |
  |    status        |         |    transcript        |
  |    overall_score |         |    metrics_json      |
  |    created_at    |         |    created_at        |
  +------------------+         +----------------------+
```

#### Table Definitions

1. **`users`**
   * `id`: `BIGSERIAL PRIMARY KEY`
   * `name`: `VARCHAR(255) NOT NULL`
   * `email`: `VARCHAR(255) UNIQUE NOT NULL`
   * `password_hash`: `VARCHAR(255) NOT NULL`
   * `created_at`: `TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP`

2. **`resumes`**
   * `id`: `BIGSERIAL PRIMARY KEY`
   * `user_id`: `BIGINT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE`
   * `raw_text`: `TEXT NOT NULL`
   * `ats_score`: `INT NOT NULL`
   * `feedback_json`: `JSONB NOT NULL` (contains `missingKeywords`, `strengths`, `weaknesses`, `suggestions`, `generatedQuestions`)
   * `updated_at`: `TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP`

3. **`interview_sessions`**
   * `id`: `BIGSERIAL PRIMARY KEY`
   * `user_id`: `BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE`
   * `job_description`: `TEXT NOT NULL`
   * `status`: `VARCHAR(50) NOT NULL` (`CREATED`, `ACTIVE`, `COMPLETED`)
   * `overall_score`: `INT DEFAULT 0`
   * `created_at`: `TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP`

4. **`question_answer_logs`**
   * `id`: `BIGSERIAL PRIMARY KEY`
   * `session_id`: `BIGINT NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE`
   * `question_text`: `TEXT NOT NULL`
   * `transcript`: `TEXT NULLABLE`
   * `metrics_json`: `JSONB NULLABLE`
   * `created_at`: `TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP`

### 2.2 Actual Current Shape of `metrics_json`

In [`InterviewService.java`](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/backend/src/main/java/com/project/system/service/InterviewService.java#L288-L298), the JSON string stored in `question_answer_logs.metrics_json` is produced by serializing a map that merges `ai-service` outputs with frontend-submitted camera parameters:

```json
{
  "technicalScore": 85,
  "communicationScore": 90,
  "professionalism": 88,
  "confidence": 82,
  "constructiveFeedback": "The explanation cleanly covered architectural definitions...",
  "speakingPace": 92,
  "interviewPresence": 95,
  "eyeContact": 88,
  "bodyLanguage": 91
}
```

* **`technicalScore`** (`Integer 0-100`): Evaluated by Groq Llama from transcript accuracy and structure.
* **`communicationScore`** (`Integer 0-100`): Evaluated by Groq Llama from articulation and clarity.
* **`professionalism`** (`Integer 0-100`): Evaluated by Groq Llama from tone and demeanor.
* **`confidence`** (`Integer 0-100`): Evaluated by Groq Llama from phrasing and assertiveness.
* **`constructiveFeedback`** (`String`): Detailed diagnostic feedback paragraph.
* **`speakingPace`** (`Integer 0-100`, nullable): Calculated in `ai-service` via word count divided by audio duration (Groq duration -> client duration -> null).
* **`interviewPresence`** (`Integer 0-100`, nullable): Computed client-side via MediaPipe Face Landmarker (% centered frames). Null if audio-only or insufficient frames.
* **`eyeContact`** (`Integer 0-100`, nullable): Computed client-side via MediaPipe Face Landmarker (% forward head pose). Null if audio-only.
* **`bodyLanguage`** (`Integer 0-100`, nullable): Computed client-side via MediaPipe Face Landmarker (landmark stability & slouch drift). Null if audio-only.

---

## 3. Per-Feature Status Audit

| Feature | Status | Verification & Code Evidence |
| :--- | :---: | :--- |
| **Groq Whisper for speech-to-text transcription** | **DONE** | [`ai-service/main.py:190-218`](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/ai-service/main.py#L190-L218): Calls `groq_client.audio.transcriptions.create` using `model="whisper-large-v3"` with `response_format="verbose_json"` to capture both `text` and `duration`. |
| **Groq Qwen for answer evaluation** | **DONE** | [`ai-service/main.py:323-377`](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/ai-service/main.py#L323-L377): Migrated to `qwen/qwen3.6-27b` via Groq Chat Completions API with 1 retry on failure. Returns 4 core scores, feedback, and next question. |
| **Groq Qwen for question generation** | **DONE** | [`ai-service/main.py:381-431`](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/ai-service/main.py#L381-L431): `POST /api/v1/ai/generate-question` migrated to `qwen/qwen3.6-27b`. Produces role-specific opening question. |
| **Gemini for resume analysis (narrative)** | **DONE** | [`ai-service/main.py:86-157`](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/ai-service/main.py#L86-L157): Uses `gemini-3.5-flash` via `google-genai` SDK for ATS scoring, keyword extraction, and suggestions. |
| **Camera-based interview coaching (MediaPipe)** | **DONE** | [`frontend/src/utils/mediapipeCoach.js`](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/frontend/src/utils/mediapipeCoach.js): Uses `@mediapipe/tasks-vision` `FaceLandmarker` running client-side at ~3.3 fps (300ms intervals). Computes `interviewPresence`, `eyeContact`, and `bodyLanguage`. Passed in `submitAnswer` form data in [`InterviewArenaPage.jsx:278-283`](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/frontend/src/pages/InterviewArenaPage.jsx#L278-L283). |
| **Real-time coaching tips (debounced)** | **DONE** | [`frontend/src/utils/mediapipeCoach.js:332-377`](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/frontend/src/utils/mediapipeCoach.js#L332-L377): `getCoachingTip` debounces by 6,000ms (`TIP_DEBOUNCE_MS`) across 3 progressive alerts. Displayed in [`InterviewArenaPage.jsx:460-465`](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/frontend/src/pages/InterviewArenaPage.jsx#L460-L465) as a pill overlay. |
| **Extended 8-metric performance report** | **DONE** | Supported end-to-end across `ai-service` schema, Spring Boot DTO (`EvaluationMetricsDto.java`), backend service merging, database JSON, and frontend presentation. |
| **Legacy metric backward compatibility** | **DONE** | [`backend/src/main/java/com/project/system/service/InterviewService.java:85-132`](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/backend/src/main/java/com/project/system/service/InterviewService.java#L85-L132): `translateLegacyMetrics()` dynamically maps old rows containing `technicalAccuracy`, `communicationClarity`, `structuralLogic` into the 8-metric DTO. Verified with unit tests in `InterviewServiceTest.java`. |
| **Live sidebar metric display fix** | **DONE** | [`frontend/src/pages/InterviewArenaPage.jsx:313-352`](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/frontend/src/pages/InterviewArenaPage.jsx#L313-L352): Stale field names removed. Arena sidebar displays all non-null metrics with color-coded progress bars. |
| **History page report UI showing all 8 metrics** | **DONE** | [`frontend/src/pages/HistoryPage.jsx:165-180`](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/frontend/src/pages/HistoryPage.jsx#L165-L180): Iterates over all 8 metrics (`Technical`, `Communication`, `Professionalism`, `Confidence`, `Pace`, `Presence`, `Eye Contact`, `Body Language`) filtering out nulls. |
| **Semantic resume screening (embeddings)** | **NOT STARTED** | Phase 2 planned feature. Not in codebase. Currently uses generative prompt heuristics. |
| **Vocal confidence via librosa prosody** | **NOT STARTED** | Future enhancement. Audio is evaluated textually after transcription; no acoustic prosody extraction currently exists. |
| **Facial emotion via blendshapes** | **NOT STARTED** | Future enhancement. `outputFaceBlendshapes` is disabled in `mediapipeCoach.js`; only facial pose/displacement landmarks are evaluated. |

---

## 4. Known Issues, Bugs & Discrepancies

### 4.1 Bugs Spotted in the Code

1. **Uncaught Error Variable in `InterviewArenaPage.jsx`:**
   * **Location:** [`frontend/src/pages/InterviewArenaPage.jsx:156-158`](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/frontend/src/pages/InterviewArenaPage.jsx#L156-L158)
   * **Issue:** 
     ```javascript
     } catch {
       setError(err.response?.data?.message || 'Failed to start mock session. Please try again.');
     }
     ```
     The `catch` statement uses optional catch binding (`catch {`) without binding `err`, but the body references `err.response`. If session creation fails, JavaScript throws an unhandled `ReferenceError: err is not defined`.
   * **Fix Required:** Change to `} catch (err) {`.

2. **Stale Metric Label in `DashboardPage.jsx`:**
   * **Location:** [`frontend/src/pages/DashboardPage.jsx:14,67`](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/frontend/src/pages/DashboardPage.jsx#L14)
   * **Issue:** `DashboardPage.jsx` still initializes state with `technicalAccuracy: 84` and renders a card labeled `"Technical accuracy"`, which is the old metric name superseded by `technicalScore`.

3. **Missing Resume Data Binding in `ResumeAnalyzerPage.jsx`:**
   * **Location:** [`frontend/src/pages/ResumeAnalyzerPage.jsx:241-243`](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/frontend/src/pages/ResumeAnalyzerPage.jsx#L241-L243)
   * **Issue:** The page renders hardcoded dummy strengths `['Project impact', 'Relevant skills', 'Readable structure', 'Role focus']` instead of mapping `results.strengths` returned by the backend API.
   * **Issue:** `results.weaknesses` returned by the API is completely omitted from the UI.

### 4.2 Hardcoded Values & Mock Data Present

1. **Dashboard Mock Stats:**
   * [`frontend/src/pages/DashboardPage.jsx:10-15`](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/frontend/src/pages/DashboardPage.jsx#L10-L15): Defaults to `totalInterviews: 12`, `avgScore: 78`, `atsScore: 82`, `technicalAccuracy: 84`.
   * [`frontend/src/pages/DashboardPage.jsx:33-34`](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/frontend/src/pages/DashboardPage.jsx#L33-L34): Even when session data loads from the backend, `atsScore: 82` and `technicalAccuracy: 84` remain hardcoded because the backend has no aggregate stats endpoint.
   * [`frontend/src/pages/DashboardPage.jsx:51-55`](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/frontend/src/pages/DashboardPage.jsx#L51-L55): Mock session list (`displaySessions`) shown if no sessions exist.
   * [`frontend/src/pages/DashboardPage.jsx:164-171`](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/frontend/src/pages/DashboardPage.jsx#L164-L171): SVG weekly performance trend line is completely static/hardcoded.
   * [`frontend/src/pages/DashboardPage.jsx:185-188`](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/frontend/src/pages/DashboardPage.jsx#L185-L188): Skill improvement bars (Technical logic 85%, Communication 78%, Confidence 90%, Answer structure 72%) are static arrays.

2. **Resume Analyzer PDF Scaffold:**
   * [`frontend/src/pages/ResumeAnalyzerPage.jsx:183-205`](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/frontend/src/pages/ResumeAnalyzerPage.jsx#L183-L205): The document preview is a static CSS skeleton placeholder rather than rendering the uploaded PDF.

3. **Backend Application Properties Configuration:**
   * [`backend/src/main/resources/application.properties:25`](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/backend/src/main/resources/application.properties#L25): `ai.service.url=http://localhost:8000` is hardcoded without environment variable fallback (`${AI_SERVICE_URL:http://localhost:8000}`).

### 4.3 Documentation Mismatches

1. **`SCHEMA.md` Out of Sync with Code:**
   * Line 95 claims `metrics_json` stores `-- Stores Technical Accuracy, Communication Clarity, Structural Logic, Corrections`.
   * Line 182–186 shows the legacy 4-metric response schema.
   * The actual code stores and returns the extended 8 metrics.
2. **`ARCHITECTURE.md` Out of Sync with Code:**
   * Section 1 states frontend files are `App.js` and `index.js`. They are `App.jsx` and `main.jsx` under Vite.
   * Section 2 & 3 states Gemini 1.5 processes multimodal audio streaming directly. The actual implementation uses Groq Whisper for STT and Groq Llama for text reasoning.
   * Does not document MediaPipe client-side coaching, `duration_seconds` fallback, or the 8 metrics.
3. **`PRD.md` Out of Sync with Code:**
   * Feature 3 describes Gemini multimodal answer processing against the legacy 3 criteria.
4. **`ai-service/.env` Stale Keys:**
   * Contains `OPENROUTER_API_KEY`, which is no longer used anywhere in the codebase.

---

## 5. Environment & Configuration Audit

### Required Environment Variables Across All Tiers

#### 1. AI Microservice (`ai-service/.env`)
| Variable | Required? | Purpose | Current Value / Notes |
| :--- | :---: | :--- | :--- |
| `PORT` | Optional (default 8000) | Uvicorn server port | `8000` |
| `GEMINI_API_KEY` | **Required** | Google GenAI SDK key for resume analysis (`gemini-3.5-flash`) | Present and valid. |
| `GROQ_API_KEY` | **Required** | Groq SDK key for Whisper STT and Llama 3.3 70B evaluations | Present and valid. |
| `OPENROUTER_API_KEY` | **Obsolete** | Leftover from previous iteration | Unused by current code. Can be safely removed. |

#### 2. Backend Application Server (`backend/src/main/resources/application.properties`)
| Property / Environment Variable | Default Value | Required in Production? | Purpose |
| :--- | :--- | :---: | :--- |
| `server.port` | `8080` | No | HTTP server port |
| `SPRING_DATASOURCE_HOST` | `localhost` | Yes | PostgreSQL host |
| `SPRING_DATASOURCE_PORT` | `5432` | No | PostgreSQL port |
| `SPRING_DATASOURCE_DB` | `interview_db` | Yes | Database name |
| `SPRING_DATASOURCE_USERNAME` | `postgres` | Yes | Database username |
| `SPRING_DATASOURCE_PASSWORD` | `venu3421` | Yes | Database password |
| `JWT_SECRET` | `InterviewIQ_AI_2024_Super_Secure_...` | **Yes** | 64+ character HMAC signing key |
| `jwt.expiration` | `86400000` (24 hours) | No | Token lifetime in ms |
| `ai.service.url` | `http://localhost:8000` | Yes | URL to AI microservice (Needs `${AI_SERVICE_URL:...}` wrapper) |
| `GOOGLE_OAUTH_CLIENT_ID` | `your-google-client-id` | Yes (for Google auth) | Google Cloud Console OAuth 2.0 Web Client ID |
| `GOOGLE_OAUTH_CLIENT_SECRET` | `your-google-client-secret` | Yes (for Google auth) | Google Cloud Console OAuth Client Secret |

#### 3. Frontend Client (`frontend/.env`)
| Variable | Required? | Purpose | Notes |
| :--- | :---: | :--- | :--- |
| `VITE_API_BASE_URL` | Optional (default `http://localhost:8080`) | Backend REST API root URL | Configured as `http://localhost:8080`. |
| `VITE_GOOGLE_CLIENT_ID` | Optional (for Google auth) | Google OAuth Client ID for `@react-oauth/google` | Present: `878245794947-aidf981hqs97v7j5emsnrrdoos5lmk7e...` |

*(Note: `AGENTS.md` originally specified `REACT_APP_API_BASE_URL`, but the frontend was scaffolded using Vite, so all client environment variables must begin with `VITE_`).*

---

## 6. What's Next for Development

### 6.1 Immediate Bugs to Fix (Before New Features)
1. **Fix `InterviewArenaPage.jsx` catch block bug:**
   Update line 156 from `} catch {` to `} catch (err) {` to prevent `ReferenceError` when start-session API calls fail.
2. **Bind Real Strengths and Weaknesses in `ResumeAnalyzerPage.jsx`:**
   Replace the hardcoded `['Project impact', ...]` array with `results.strengths` and add a section rendering `results.weaknesses`.
3. **Correct Dashboard Stale Metric Reference:**
   Update `DashboardPage.jsx` to replace `technicalAccuracy` with `technicalScore`.
4. **Make `ai.service.url` Configurable:**
   Update `application.properties` line 25 to `ai.service.url=${AI_SERVICE_URL:http://localhost:8000}`.

### 6.2 Next Planned Milestone: Phase 2 — Semantic Resume Screening
The current resume analyzer relies exclusively on LLM generative prompts to calculate ATS compatibility. Phase 2 introduces objective, deterministic semantic vector matching:
* **Architecture:** Add `sentence-transformers` (`all-MiniLM-L6-v2`) to `ai-service`.
* **Workflow:**
  1. Chunk resume text into structural sections (Skills, Experience, Projects, Education).
  2. Embed resume chunks and target job description requirements into 384-dimensional dense vectors.
  3. Compute cosine similarity between candidate experience vectors and job requirement vectors.
  4. Blend the cosine similarity metric with keyword coverage to produce a reproducible ATS score, feeding the semantic gaps into Gemini for final narrative recommendations.

### 6.3 Future Enhancements (Backlog)
* **Vocal Confidence Analysis via Prosody (`librosa`):** Analyze speech tempo, pitch variability, and jitter/shimmer directly from audio files to produce acoustic confidence metrics.
* **Facial Emotion Recognition (MediaPipe Blendshapes):** Enable `outputFaceBlendshapes: true` in `FaceLandmarker` to track composure, smile, and tension metrics during interview responses.
* **Documentation Synchronization:** Overhaul `ARCHITECTURE.md`, `SCHEMA.md`, and `PRD.md` to reflect the current hybrid pipeline, 8-metric model, and client-side MediaPipe vision architecture.

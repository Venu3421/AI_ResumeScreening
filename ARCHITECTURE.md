### 1. Repository Directory Structure
The system is constructed as a decoupled, three-tier microservice architecture to ensure modular scalability and clear separation of concerns.

```
/ai-interview-system
├── /frontend               # React 19 SPA (Vite + TailwindCSS v4)
│   ├── /public             # Assets, icons, and PDF worker (pdf.worker.min.mjs)
│   └── /src
│       ├── /components     # UI Modules (Navbar, PdfHighlightViewer)
│       ├── /context        # Auth & Session State Contexts
│       ├── /pages          # DashboardPage, ResumeAnalyzerPage, InterviewArenaPage, HistoryPage
│       ├── /services       # Axios API Base Configurations
│       ├── /utils          # mediapipeCoach.js (Edge Vision FaceLandmarker)
│       ├── App.jsx
│       └── main.jsx
├── /backend                # Spring Boot 3.3.3 Monolith Application Server (Java 17)
│   ├── mvnw
│   ├── pom.xml
│   └── /src/main/java/com/project/system
│       ├── /config         # CORS, Security, and PasswordEncoder Configurations
│       ├── /controller     # AuthController, ResumeController, InterviewController
│       ├── /dto            # Request/Response payloads (DashboardStatsResponse, EvaluationMetricsDto)
│       ├── /entity         # JPA Database Entities (User, Resume, InterviewSession, QuestionAnswerLog)
│       ├── /repository     # Spring Data PostgreSQL Repositories
│       └── /service        # AuthService, ResumeService, InterviewService
└── /ai-service             # FastAPI Multimodal Microservice (Python 3.10+)
    ├── .env
    ├── main.py             # FastAPI App Engine & Pipeline Router
    ├── pdf_extractor.py    # PyMuPDF section parsing & word-level coordinate extraction
    ├── resume_matcher.py   # Deterministic 20/80 keyword & dense vector semantic matcher
    ├── /schemas            # Pydantic Request & Response Models
    └── /tests              # Pytest verification suite
```

---

### 2. Component Boundaries & Core Subsystems

```
+-----------------------------------------------------------------------------------------+
|                                    FRONTEND CLIENT                                      |
|                                                                                         |
|   +-----------------------+   +-----------------------+   +-------------------------+   |
|   | Resume Upload & PDF   |   | Live Audio Recording  |   | In-Arena Monaco Editor  |   |
|   | Coordinate Viewer     |   | + MediaPipe Coach     |   | (JS, Python, Java, SQL) |   |
|   +-----------+-----------+   +-----------+-----------+   +------------+------------+   |
+---------------|---------------------------|----------------------------|----------------+
                | (PDF / Text)              | (Audio Binary + Metrics)   | (Code + Language)
                ▼                           ▼                            ▼
+-----------------------------------------------------------------------------------------+
|                               BACKEND APPLICATION SERVER                                |
|                                                                                         |
|   +-----------------------+   +-----------------------------------------------------+   |
|   | Document Dispatch     |   | Session Progression & Dual-Path Submission Router   |   |
|   +-----------+-----------+   +--------------------------+--------------------------+   |
|               |                                          |                              |
|               |   +--------------------------------------+                              |
|               |   | Null-Safe Dashboard Aggregation (/api/v1/interview/stats)           |
|               |   +-----------------------------------------------------------------+   |
+---------------|------------------------------------------|------------------------------+
                | (Multipart/JSON)                         | (Audio Multipart OR Code JSON)
                ▼                                          ▼
+-----------------------------------------------------------------------------------------+
|                                 AI RUNTIME MICROSERVICE                                 |
|                                                                                         |
|   +---------------------------------------------------------------------------------+   |
|   | Deterministic ATS Engine: PyMuPDF + SentenceTransformers (all-MiniLM-L6-v2)     |   |
|   | Narrative & Feedback: Google Gemini 3.8 Flash (Fallback: Gemini 3 Flash Preview)|   |
|   | Speech-to-Text: Groq Whisper Large v3 (verbose_json)                            |   |
|   | Vocal Prosody: Librosa (Pitch, Pause, Speaking Rate, RMS Energy)                |   |
|   | Answer & Code Evaluation: Groq Qwen 3.8 27B (qwen/qwen3.8-27b)                  |   |
|   +---------------------------------------------------------------------------------+   |
+-----------------------------------------------------------------------------------------+
```

*   **Layer 1 (Frontend Client):** Manages local microphone hardware controls and MediaPipe FaceLandmarker edge inference (~3.3 FPS). Camera frames are evaluated entirely client-side via WASM/WebGL; zero video is transmitted over the network. Supports interactive in-interview code editing with Monaco and coordinate-mapped PDF resume visual highlights.
*   **Layer 2 (Backend Application Server):** System source of truth. Manages JWT sessions, session progression, backward-compatible metrics translation, database persistence, and aggregate statistics computation with strict null-safety.
*   **Layer 3 (AI Microservice Engine):** Stateless high-performance AI engine. Implements a multi-step hybrid pipeline combining deterministic NLP scoring, local embeddings, acoustic signal processing, and low-latency Groq/Gemini LLM inference.

---

### 3. Comprehensive Data Flow Controls

#### Context Generation Cycle (Resume Processing Execution)
1. The user drops a PDF document into `ResumeAnalyzerPage.jsx`.
2. React dispatches a multipart request to Spring Boot (`POST /api/v1/resumes/upload`).
3. Spring Boot forwards the file and target job description to FastAPI (`POST /api/v1/ai/analyze-resume`).
4. **Deterministic ATS Engine:**
   - `pdf_extractor.py` extracts section headers, structured text, and exact word-level point coordinates `[x0, y0, x1, y1]`.
   - `resume_matcher.py` computes stemmed keyword overlap (Layer 1, weight: 20%) and dense vector cosine similarity via `all-MiniLM-L6-v2` (Layer 2, weight: 80%). Cosine scores are calibrated against empirical bounds (0.40 weak threshold, 0.70 natural-text ceiling).
5. **Generative Narrative & Fallback:**
   - Prompt context is sent to `gemini-3.8-flash`. If HTTP 429 (rate limit) or HTTP 503 (high demand) is returned, the engine automatically falls back to `gemini-3-flash-preview`.
   - `build_highlight_map()` cross-references extracted word coordinates with matched skills and feedback.
6. The combined payload (`ats_score`, `highlights`, `page_dimensions`, `strengths`, `suggestions`, `generated_questions`) flows back to PostgreSQL and the interactive `<PdfHighlightViewer>`.

#### Feedback Generation Cycle (Spoken Answer Mode)
1. The candidate records their spoken response in `InterviewArenaPage.jsx`. MediaPipe captures real-time edge signals (`interviewPresence`, `eyeContact`, `bodyLanguage`, `facialComposure`).
2. The browser submits audio binary + edge presence metrics to Spring Boot (`POST /api/v1/interview/submit-answer`).
3. Spring Boot forwards the multipart payload to FastAPI (`POST /api/v1/ai/evaluate-answer`).
4. **AI Microservice Processing:**
   - **Step A:** Groq Whisper (`whisper-large-v3`) transcribes audio with `response_format="verbose_json"`.
   - **Step B:** Speaking pace is computed from word count / duration.
   - **Step C:** Librosa acoustic prosody analysis extracts pitch variance, pause frequency, speaking rate variability, and RMS energy consistency.
   - **Step D:** Groq Qwen (`qwen/qwen3.8-27b`) evaluates transcript correctness, communication, and professionalism. LLM confidence is blended with acoustic prosody (60/40) for a composite confidence score.
5. Evaluated metrics and the next question are stored in `question_answer_logs` and returned to the UI.

#### Feedback Generation Cycle (In-Arena Code/Logic Answer Mode)
1. When encountering coding or SQL challenges, the candidate toggles to Code Mode and writes their implementation in Monaco Editor.
2. The browser submits `sessionId`, `questionText`, `codeAnswer`, and `codeLanguage` as FormData to Spring Boot.
3. Spring Boot detects `codeAnswer` and branches to the code-evaluation path (`POST /api/v1/ai/evaluate-code-answer`).
4. **AI Microservice Processing:**
   - Bypasses Whisper STT and Librosa acoustic prosody completely.
   - Groq Qwen (`qwen/qwen3.8-27b`) evaluates code syntax validity, logical correctness, time/space complexity awareness, and code structure/readability.
   - Audio presence metrics are set to `None`. Code text is stored directly as the question transcript.
5. Evaluated code metrics and next question return to the user.

#### Dashboard Analytics Cycle
1. `DashboardPage.jsx` fetches `GET /api/v1/interview/stats`.
2. Spring Boot aggregates all completed sessions for the authenticated user:
   - Latest ATS score from `Resume` entity.
   - Per-dimension averages across Technical, Communication, Confidence, and Speaking Pace (skipping nulls).
   - Chronological session scores `List<TrendPoint>` (`date`, `overallScore`).
3. Frontend renders smooth cubic Bezier trend curves, skill breakdown percentages, and honest empty states.

---

### 4. Application State Strategy
*   **Authentication State:** Managed via a global React Context provider (`AuthContext.jsx`) storing JWT tokens with automatic logout on token expiry.
*   **Interview Session State:** Managed via Spring Boot with lifecycle states (`ACTIVE`, `COMPLETED`). Sessions can be resumed within a 24-hour expiration window.
*   **AI Context Management:** Stateless prompt orchestration. Full session context is maintained by passing serialized question history into each turn without storing conversational state inside external AI APIs.
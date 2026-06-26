### 1. Repository Directory Structure
The system is constructed as a decoupled monorepo to ensure clean local agent separation during parallel feature generation sprints.

```
/ai-interview-system
├── /frontend               # React.js SPA Application
│   ├── /public
│   └── /src
│       ├── /components     # Reusable UI Modules (Buttons, Form Elements)
│       ├── /context        # Auth & Active Interview State Contexts
│       ├── /pages          # Dashboard, UploadArena, InterviewArena, Reports
│       ├── /services       # Axios API Base Configurations
│       ├── App.js
│       └── index.js
├── /backend                # Spring Boot Monolith Application Server
│   ├── mvnw
│   ├── pom.xml
│   └── /src/main/java/com/project/system
│       ├── /config         # CORS and Security Configurations
│       ├── /controller     # REST Controller Layers
│       ├── /entity         # JPA Database Entities
│       ├── /repository     # Spring Data Postgres Repositories
│       └── /service        # Central System Core Business Logic
└── /ai-service             # FastAPI Microservice
    ├── .env
    ├── main.py             # Microservice Execution Hub
    └── /schemas            # Pydantic Core Models & Input Validations
```

---

### 2. Component Boundaries & Core Subsystems
The system enforces strict boundary conditions to manage local system boundaries and isolate failure vectors.

```
+--------------------------------------------------------------+
|                        FRONTEND CLIENT                       |
|                                                              |
|   +-------------------+              +-------------------+   |
|   |   Resume Upload   |              |  Audio Recording  |   |
|   +---------+---------+              +---------+---------+   |
+-------------|----------------------------------|-------------+
              | (PDF + JD text)                  | (Audio Blobs)
              ▼                                  ▼
+--------------------------------------------------------------+
|                   BACKEND APPLICATION SERVER                 |
|                                                              |
|   +-------------------+              +-------------------+   |
|   |   Resume Parsing  |              |   Session State   |   |
|   |   (Apache Tika)   |              |    Management     |   |
|   +---------+---------+              +---------+---------+   |
+-------------|----------------------------------|-------------+
              | (Extracted Text JSON)            | (Raw Binary + Context)
              ▼                                  ▼
+--------------------------------------------------------------+
|                     AI RUNTIME MICROSERVICE                  |
|                                                              |
|   +------------------------------------------------------+   |
|   |               FastAPI Route Handlers                 |   |
|   +--------------------------+---------------------------+   |
+------------------------------|-------------------------------+
                               ▼ (Direct Multimodal Streaming)
                +------------------------------+
                |    Google Gemini 1.5 API     |
                +------------------------------+
```

*   **System Layer 1 (Frontend Client):** Manages local microphone hardware controls using standard browser web APIs. Handles individual chunk conversions to prevent memory exhaustion on high-latency client networks.
*   **System Layer 2 (Backend Application Server):** Acts as the system source of truth. Manages all entity persistence, identity verifications, and structural system configurations. It isolates the AI layer from knowing specific user registration details.
*   **System Layer 3 (AI Runtime Microservice):** Stateless environment. Translates structural database data and file objects into hyper-focused system prompts optimized for fast pipeline processing via remote edge execution APIs.

---

### 3. Comprehensive Data Flow Controls

#### Context Generation Cycle (Resume Processing Execution)
1. The user drops a PDF document into the React UI interface window.
2. React dispatches a multi-part payload request to the Spring Boot endpoint `/api/v1/resumes/upload`.
3. Spring Boot extracts structural text representations using internal text extraction utilities and posts the text structure to the Python AI microservice route `/api/v1/ai/analyze-resume`.
4. The Python service sets up specific role profiles and passes them directly to Gemini 1.5 Flash.
5. Gemini evaluates the layout profiles and returns structural JSON data containing parsed matching criteria directly down the call chain to preserve application state integrity.

#### Feedback Generation Cycle (Interview Execution)
1. The client speaks into the dynamic interface dashboard to answer an interview question.
2. The user executes a confirmation submit event. The React UI converts the data profile to a standard binary audio object format.
3. The Spring Boot backend receives the raw stream payload at `/api/v1/interview/submit-answer` and pipes the data forward alongside historical question state logs directly to the Python runtime microservice.
4. Python streams the audio file to the Gemini multimodal interface, bypassing traditional intermediary text file creation steps.
5. Gemini processes the voice acoustics and answer content simultaneously, applying the evaluation rubric. It passes validated schema data structures back through the infrastructure tiers to update the PostgreSQL persistence tables.

---

### 4. Application State Strategy
*   **Authentication State:** Managed via a global React Context provider. The client captures the verified authentication token payload and appends authorization headers to all outbound requests.
*   **Interview Session State:** Spring Boot manages state transitions through specific interview progress states (`CREATED`, `ACTIVE`, `EVALUATING`, `COMPLETED`).
*   **AI Context Management:** The system avoids storing long-running chat sessions inside the AI API. Instead, it uses stateless prompt extensions, combining the original job description, the question history, and the current answer into each new transaction payload.

---
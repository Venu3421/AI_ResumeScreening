# InterviewIQ AI — Complete PlantUML Design Presentation Specification
**System:** AI Resume Screening and Multimodal Mock Interview System  
**Presentation Track:** System Analysis & Object-Oriented Design (UML Architecture)  
**Standard:** UML 2.5 Specification modeled in **PlantUML**  
**Architecture:** Decoupled 3-Tier Monorepo (React 19 + Spring Boot 3.3 + FastAPI + PostgreSQL + Multimodal AI)

---

## Interactive Presentation Deck
You can open the complete interactive slide deck directly in your browser:
- **Presentation Deck:** [docs/presentation.html](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/docs/presentation.html)
- **Features:** Authentic vector PlantUML diagrams, keyboard shortcuts (`←`/`→`/`Space`), Zoom In/Out (`+`/`-`), Fullscreen mode (`⛶ Present`), and a live **"📄 View .puml Source"** code inspector with one-click clipboard copying.

---

## Table of Contents
1. [Class Diagram (Structural Model)](#1-class-diagram)
2. [Use Case Diagram (Behavioral Model)](#2-use-case-diagram)
3. [Sequence Diagram (Dynamic Interaction Model)](#3-sequence-diagram)
4. [Activity Diagram (Operational Workflow Model)](#4-activity-diagram)
5. [Object Diagram (Runtime Instance Snapshot)](#5-object-diagram)
6. [State Chart Diagram (State Machine Model)](#6-state-chart-diagram)
7. [Collaboration Diagram (Communication Topology Model)](#7-collaboration-diagram)
8. [Component Diagram (Modular Subsystems Model)](#8-component-diagram)
9. [Deployment Diagram (Physical Hardware & Infrastructure)](#9-deployment-diagram)
10. [Viva / Presentation Defense Guide](#10-viva--presentation-defense-guide)
11. [PlantUML Source Files Directory](#11-plantuml-source-files-directory)

---

## 1. Class Diagram
### Categorization: Structural Diagram (UML 2.5)
### Purpose:
Illustrates the static structure of the system, showing domain JPA entities, Spring Boot REST controllers, service isolation, repository interfaces, and strongly typed AI contracts.

### PlantUML Source Code:
File: [docs/plantuml/02_class_diagram.puml](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/docs/plantuml/02_class_diagram.puml)
```plantuml
@startuml
skinparam classAttributeIconSize 10
skinparam classFontSize 12
skinparam classFontName Arial
skinparam shadowing true

package "domain.entities" {
  class User {
    -Long id
    -String name
    -String email
    -String passwordHash
    -LocalDateTime createdAt
    +getId() : Long
    +getName() : String
    +getEmail() : String
  }

  class Resume {
    -Long id
    -User user
    -String rawText
    -Integer atsScore
    -String feedbackJson
    -LocalDateTime updatedAt
    +getId() : Long
    +getAtsScore() : Integer
    +getFeedbackJson() : String
  }

  class InterviewSession {
    -Long id
    -User user
    -String jobDescription
    -String status
    -Integer overallScore
    -LocalDateTime createdAt
    +calculateOverallScore() : void
    +getStatus() : String
    +getOverallScore() : Integer
  }

  class QuestionAnswerLog {
    -Long id
    -InterviewSession session
    -String questionText
    -String transcript
    -String metricsJson
    -LocalDateTime createdAt
    +getId() : Long
    +getTranscript() : String
    +getMetricsJson() : String
  }
}

package "controllers" {
  class AuthController {
    -AuthService authService
    +register(RegisterRequest) : ResponseEntity
    +login(LoginRequest) : ResponseEntity
    +googleLogin(GoogleLoginRequest) : ResponseEntity
  }

  class ResumeController {
    -ResumeService resumeService
    +uploadResume(MultipartFile, String) : ResponseEntity
    +getResume() : ResponseEntity
  }

  class InterviewController {
    -InterviewService interviewService
    +startSession(InterviewStartRequest) : ResponseEntity
    +submitAnswer(Long, String, MultipartFile, ...) : ResponseEntity
    +getSessionHistory() : ResponseEntity
  }
}

package "services" {
  class AuthService {
    -UserRepository userRepository
    -PasswordEncoder passwordEncoder
    -JwtTokenProvider tokenProvider
    +register(RegisterRequest) : ApiResponse
    +login(LoginRequest) : AuthResponse
  }

  class ResumeService {
    -ResumeRepository resumeRepository
    -Tika tikaParser
    -RestTemplate restTemplate
    +uploadAndAnalyze(MultipartFile, String) : ResumeUploadResponse
  }

  class InterviewService {
    -InterviewSessionRepository sessionRepository
    -QuestionAnswerLogRepository logRepository
    -RestTemplate restTemplate
    +startSession(InterviewStartRequest) : InterviewStartResponse
    +submitAnswer(...) : SubmitAnswerResponse
    -calculateAverageScore(List) : Integer
  }
}

package "ai.contracts" {
  class ResumeAnalysisResponse {
    +int ats_score
    +List<String> missing_keywords
    +List<String> strengths
    +List<String> suggestions
  }

  class InterviewEvaluationResponse {
    +String transcript
    +EvaluationMetrics evaluation_metrics
    +String next_question
  }

  class EvaluationMetrics {
    +int technicalScore
    +int communicationScore
    +int speakingPace
    +int eyeContact
  }
}

User "1" *-- "1" Resume : owns >
User "1" *-- "0..*" InterviewSession : initiates >
InterviewSession "1" *-- "1..5" QuestionAnswerLog : contains >

AuthController ..> AuthService : invokes
ResumeController ..> ResumeService : invokes
InterviewController ..> InterviewService : invokes

ResumeService ..> ResumeAnalysisResponse : receives
InterviewService ..> InterviewEvaluationResponse : receives
InterviewEvaluationResponse *-- EvaluationMetrics : aggregates
@enduml
```

### Presentation Defense Script:
> "This Class Diagram illustrates the structural domain of our backend. Notice the strict separation of concerns: `User` acts as the aggregate root, holding a 1-to-1 composition with `Resume` and a 1-to-Many relationship with `InterviewSession`. `InterviewSession` composes up to five `QuestionAnswerLog` instances. Notice that our controllers never leak raw entities directly to the client; all operations strictly pass through typed DTOs and strongly typed AI contract schemas like `ResumeAnalysisResponse` and `InterviewEvaluationResponse`."

---

## 2. Use Case Diagram
### Categorization: Behavioral Diagram (UML 2.5)
### Purpose:
Captures core user goals and primary/secondary actor interactions across human users (Candidates, Admins) and automated cloud service actors (Google OAuth, Groq Cloud, Gemini).

### PlantUML Source Code:
File: [docs/plantuml/03_use_case_diagram.puml](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/docs/plantuml/03_use_case_diagram.puml)
```plantuml
@startuml
left to right direction
skinparam packageStyle rectangle
skinparam shadowing true
skinparam defaultFontName Arial

actor "Candidate\n(Job Seeker)" as Candidate <<Human>>
actor "Recruiter /\nAdmin" as Admin <<Human>>

actor "Google OAuth\nProvider" as GoogleAuth <<External System>>
actor "Google Gemini 1.5\nCloud AI" as Gemini <<External System>>
actor "Groq Cloud\nLPU AI" as Groq <<External System>>

rectangle "InterviewIQ AI Platform" #F8F9FA {
  usecase "UC-1: Register & Authenticate" as UC1
  usecase "UC-1.1: Verify Google OAuth Token" as UC1_1
  usecase "UC-1.2: Issue JWT Bearer Token" as UC1_2

  usecase "UC-2: Upload PDF Resume" as UC2
  usecase "UC-2.1: Extract Text via Apache Tika" as UC2_1

  usecase "UC-3: Run ATS Gap Analysis" as UC3
  usecase "UC-3.1: Generate Target Questions" as UC3_1

  usecase "UC-4: Start Mock Interview Session" as UC4

  usecase "UC-5: Capture Edge Video Coaching" as UC5
  usecase "UC-5.1: Track Gaze & Presence (MediaPipe)" as UC5_1

  usecase "UC-6: Submit Spoken Audio Answer" as UC6
  usecase "UC-6.1: Whisper Speech-to-Text" as UC6_1
  usecase "UC-6.2: Calculate Speaking Pace (WPM)" as UC6_2
  usecase "UC-6.3: AI Rubric Scoring" as UC6_3

  usecase "UC-7: View Historical Analytics" as UC7
  usecase "UC-8: Audit Token Usage" as UC8
}

Candidate --> UC1
Candidate --> UC2
Candidate --> UC3
Candidate --> UC4
Candidate --> UC5
Candidate --> UC6
Candidate --> UC7

Admin --> UC7
Admin --> UC8

UC1 <.. UC1_1 : <<extend>>
UC1 ..> UC1_2 : <<include>>
UC2 ..> UC2_1 : <<include>>
UC3 ..> UC3_1 : <<include>>
UC5 ..> UC5_1 : <<include>>
UC6 ..> UC6_1 : <<include>>
UC6 ..> UC6_2 : <<include>>
UC6 ..> UC6_3 : <<include>>

UC1_1 -- GoogleAuth
UC3 -- Gemini
UC6_1 -- Groq
UC6_3 -- Groq
@enduml
```

### Presentation Defense Script:
> "Our Use Case Diagram defines the behavioral interactions. The Candidate initiates core workflows like PDF Resume Upload and Mock Interviewing. Crucially, we treat Groq Cloud and Google Gemini as external secondary actors. Notice the `<<include>>` relationships: submitting an audio answer unconditionally triggers speech transcription, speaking pace heuristics, and multi-metric rubric scoring. Google OAuth login is modeled with an `<<extend>>` relationship since candidates can also authenticate via standard credentials."

---

## 3. Sequence Diagram
### Categorization: Interaction Diagram (UML 2.5)
### Purpose:
Models the precise chronological message exchange across tiers for answer recording, client-side vision extraction, server transaction handling, cloud speech transcription, LLM rubric scoring, and database persistence.

### PlantUML Source Code:
File: [docs/plantuml/04_sequence_diagram.puml](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/docs/plantuml/04_sequence_diagram.puml)
```plantuml
@startuml
autonumber
skinparam sequenceMessageAlign center
skinparam shadowing true
skinparam defaultFontName Arial

actor Candidate as "Candidate"
participant UI as "React Client\n(InterviewArena)" #D4EDDA
participant MP as "MediaPipe\n(WASM Edge)" #D4EDDA
participant SB as "Spring Boot\nBackend" #FFF3CD
participant DB as "PostgreSQL\nDatabase" #F8D7DA
participant AI as "FastAPI AI\nMicroservice" #E2E3E5
participant Groq as "Groq Cloud\n(Whisper + LLM)" #E2E3E5

Candidate -> UI : Speaks answer & clicks "Submit Answer"
activate UI

UI -> MP : Read Edge Vision Scalars
activate MP
MP --> UI : Return eyeContact (94%), presence (90%)
deactivate MP

UI -> SB : POST /api/v1/interview/submit-answer\n(Audio Blob + Vision Metrics)
activate SB

SB -> DB : Verify Session Ownership (Status == ACTIVE)
activate DB
DB --> SB : Session Verified
deactivate DB

SB -> AI : POST /api/v1/ai/evaluate-answer\n(Audio Stream + Job Description)
activate AI

AI -> Groq : POST /v1/audio/transcriptions (Whisper Large v3)
activate Groq
Groq --> AI : Transcript + Duration (42.5s)
deactivate Groq

AI -> AI : Compute Speaking Pace: (Words / Minutes) = 138 WPM

AI -> Groq : POST /v1/chat/completions (Rubric Evaluation)
activate Groq
Groq --> AI : Technical(92), Comm(88), Feedback, NextQuestion
deactivate Groq

AI --> SB : Return InterviewEvaluationResponse
deactivate AI

SB -> SB : Merge Vision + Acoustic + Rubric Metrics
SB -> DB : INSERT INTO question_answer_logs (SessionId, Q, Transcript, Metrics)
activate DB
DB --> SB : Row Persisted (ID: 4912)
deactivate DB

alt Question Index == 5 (Session Completed)
  SB -> SB : calculateOverallScore() (Avg of 5 rounds)
  SB -> DB : UPDATE interview_sessions SET status='COMPLETED', score=89
end

SB --> UI : HTTP 200 OK (Transcript, 8 Metrics, NextQuestion)
deactivate SB

UI -> Candidate : Render Score Badges, Waveform Review & Load Next Question
deactivate UI
@enduml
```

### Presentation Defense Script:
> "This Sequence Diagram illustrates our flagship workflow: real-time answer evaluation. Notice how the client's webcam frames are processed locally using WebAssembly via MediaPipe at 3.3 FPS. This completely eliminates video streaming bandwidth costs. Spring Boot orchestrates the transaction, dispatches audio to our FastAPI microservice, invokes Groq Whisper and LLM reasoning, and commits the result to PostgreSQL in a single cohesive flow under 1.5 seconds."

---

## 4. Activity Diagram
### Categorization: Behavioral / Control Flow Diagram (UML 2.5)
### Purpose:
Depicts the end-to-end operational control flow of a candidate navigating InterviewIQ AI, showing branching decisions, concurrent processing (fork/join), and loop iterations across the 5 interview rounds.

### PlantUML Source Code:
File: [docs/plantuml/05_activity_diagram.puml](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/docs/plantuml/05_activity_diagram.puml)
```plantuml
@startuml
skinparam activityFontSize 12
skinparam activityFontName Arial
skinparam shadowing true

start
:Candidate Logs In / Registers;

if (Credentials Valid?) then (Yes)
  :Display Candidate Dashboard;
else (No)
  :Display Authentication Error;
  stop
endif

if (Select Mode) then (Resume Screening)
  :Upload PDF Resume & Job Description;
  :Apache Tika Extracts Raw Text Content;
  :Google Gemini Evaluates ATS Match & Skill Gaps;
  :Display ATS Score Dial, Missing Keywords & Badges;
  if (Proceed to Mock Interview?) then (Yes)
    :Initialize Interview Session;
  else (No)
    :Return to Dashboard;
    stop
  endif
else (Direct Mock Interview)
  :Initialize Interview Session with Target JD;
endif

:AI Generates Question 1;
:Display Question in Interview Arena;

repeat
  :Candidate Starts Recording;
  fork
    :Record Spoken Audio via MediaRecorder API;
  fork again
    :MediaPipe WASM Tracks Gaze & Face Landmarks (~3.3 FPS);
  end fork
  :Candidate Submits Answer;

  :Upload Audio Blob + Vision Metrics to Backend;
  :Groq Whisper Transcribes Audio to Text;
  :Calculate Speaking Pace (WPM);
  :Groq LLM Evaluates Technical & Communication Rubric;
  :Merge Edge Vision + Acoustic + LLM Scores;
  :Persist QuestionAnswerLog to PostgreSQL;
repeat while (Question Count < 5) is (Next Question)
-> Completed 5 Questions;

:Calculate Overall Session Average Score;
:Update Interview Session Status to COMPLETED;
:Display Comprehensive Analytics & Radar Chart;
stop
@enduml
```

### Presentation Defense Script:
> "The Activity Diagram models procedural control flow. Notice the Fork and Join constructs when the candidate begins speaking: audio recording and visual eye-tracking execute in parallel threads on the browser. Once submitted, the system enters the AI evaluation pipeline and checks if all 5 questions have been answered. If not, the loop dynamically loads the next adaptive question."

---

## 5. Object Diagram
### Categorization: Structural Diagram (Runtime Instance Model)
### Purpose:
Provides a concrete snapshot of actual objects in memory and database rows during Question 2 of an active session for candidate "Paka Venu Yadav".

### PlantUML Source Code:
File: [docs/plantuml/06_object_diagram.puml](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/docs/plantuml/06_object_diagram.puml)
```plantuml
@startuml
skinparam objectFontSize 12
skinparam objectFontName Arial
skinparam shadowing true

object "currentUser : User" as user {
  id = 101
  name = "Paka Venu Yadav"
  email = "venu.yadav@example.com"
  createdAt = "2026-09-01T10:00:00"
}

object "candidateResume : Resume" as resume {
  id = 45
  userId = 101
  atsScore = 84
  feedbackMissingKeywords = "Kafka, Docker"
  feedbackStrengths = "Spring Boot, Java 17"
}

object "activeSession : InterviewSession" as session {
  id = 812
  userId = 101
  status = "ACTIVE"
  currentQuestionIndex = 2
  overallScore = 0
}

object "log1 : QuestionAnswerLog" as log1 {
  id = 4911
  question = "Explain polymorphism vs inheritance"
  technicalScore = 90
  speakingPace = 135
  eyeContact = 95
}

object "log2 : QuestionAnswerLog" as log2 {
  id = 4912
  question = "How do B-Tree indexes work in PostgreSQL?"
  technicalScore = 94
  speakingPace = 142
  eyeContact = 92
}

object "liveUIState : ArenaState" as ui {
  isRecording = false
  audioDuration = 48s
  liveSpeakingPace = 142 WPM
  liveEyeContact = 92%
}

user --> resume : has uploaded
user --> session : is taking
session *-- log1 : contains (Round 1)
session *-- log2 : contains (Round 2)
session ..> ui : active in browser
@enduml
```

### Presentation Defense Script:
> "To demonstrate that our design is fully grounded in reality, this Object Diagram captures an actual runtime instance during an active interview session. You can see object references for candidate user 101, session 812, and completed question logs 4911 and 4912. Notice that overallScore remains 0 because the session is still ACTIVE and will only be finalized after question 5."

---

## 6. State Chart Diagram
### Categorization: Behavioral Diagram (State Machine Model)
### Purpose:
Formally specifies the lifecycle, event triggers, guard conditions, and state transitions of an `InterviewSession` entity from creation to terminal completion or early abortion.

### PlantUML Source Code:
File: [docs/plantuml/07_state_chart_diagram.puml](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/docs/plantuml/07_state_chart_diagram.puml)
```plantuml
@startuml
skinparam stateFontSize 12
skinparam stateFontName Arial
skinparam shadowing true

[*] --> CREATED : Candidate selects JD & clicks "Start Interview"

state CREATED {
  [*] --> GENERATING_FIRST_QUESTION
  GENERATING_FIRST_QUESTION --> READY : AI returns opening question
}

CREATED --> ACTIVE : Enters Interview Arena & grants Mic/Cam perms

state ACTIVE {
  [*] --> WAITING_FOR_INPUT
  
  WAITING_FOR_INPUT --> RECORDING : Candidate clicks "Start Recording"
  
  state RECORDING {
    [*] --> STREAMING_MEDIA
    STREAMING_MEDIA --> TRACKING_VISION : MediaPipe extracts face landmarks
    TRACKING_VISION --> STREAMING_MEDIA : Update scalar state
  }

  RECORDING --> EVALUATING : Candidate clicks "Submit Answer"

  state EVALUATING {
    [*] --> TRANSCRIBING_AUDIO : Groq Whisper STT
    TRANSCRIBING_AUDIO --> COMPUTING_WPM : Word count heuristic
    COMPUTING_WPM --> LLM_SCORING : Groq Qwen/Llama Rubric Reasoning
    LLM_SCORING --> PERSISTING_LOG : Write to question_answer_logs
  }

  EVALUATING --> WAITING_FOR_INPUT : Next Question Loaded [questionCount < 5]
}

ACTIVE --> COMPLETED : 5th Answer Evaluated [questionCount == 5] / calculateOverallScore()
ACTIVE --> ABORTED : Candidate quits / closes browser tab

COMPLETED --> ARCHIVED : Saved to Historical Review
ABORTED --> ARCHIVED : Partial Session Retained

ARCHIVED --> [*]
@enduml
```

### Presentation Defense Script:
> "This State Chart tracks the finite state machine of an interview session. The session transitions from CREATED to ACTIVE once permissions are verified. Inside ACTIVE, we model nested sub-states: WAITING_FOR_INPUT, RECORDING, and EVALUATING. Guard conditions ensure that when questionCount equals 5, the state transitions cleanly to COMPLETED, triggering overall score aggregation."

---

## 7. Collaboration Diagram
### Categorization: Interaction Diagram (Communication Topology Model)
### Purpose:
Depicts object interactions and numbered message propagation during the **Resume Upload, Parsing, and ATS Screening Transaction**.

### PlantUML Source Code:
File: [docs/plantuml/08_collaboration_diagram.puml](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/docs/plantuml/08_collaboration_diagram.puml)
```plantuml
@startuml
skinparam componentStyle uml2
skinparam defaultFontName Arial
skinparam shadowing true

rectangle "Candidate" as user #D4EDDA
rectangle "ResumeAnalyzerPage\n(React Client)" as ui #D4EDDA
rectangle "ResumeController\n(Spring Boot)" as ctrl #FFEBAA
rectangle "ResumeService" as svc #FFEBAA
rectangle "ApacheTikaParser" as tika #FFEBAA
rectangle "FastApiAiMicroservice" as ai #D6D8D9
rectangle "GoogleGeminiAPI" as gemini #E2E3E5
rectangle "ResumeRepository" as repo #FFEBAA
database "PostgresDatabase\n(Supabase)" as db #F8D7DA

user -> ui : 1: drops PDF & submits JD >
ui -> ctrl : 2: POST /api/v1/resumes/upload >
ctrl -> svc : 3: uploadAndAnalyze() >
svc -> tika : 3.1: parseToString() >
tika -> svc : 3.2: return rawText >
svc -> ai : 3.3: POST /analyze-resume >
ai -> gemini : 3.3.1: generate_content() >
gemini -> ai : 3.3.2: return ATS JSON >
ai -> svc : 3.4: ResumeAnalysisResponse >
svc -> repo : 3.5: save(resumeEntity) >
repo -> db : 3.5.1: INSERT/UPDATE SQL >
db -> repo : 3.5.2: SQL ACK >
repo -> svc : 3.6: return saved Resume >
svc -> ctrl : 4: return ResumeUploadResponse >
ctrl -> ui : 5: HTTP 200 OK >
ui -> user : 6: render ATS Dial & Badges >
@enduml
```

### Presentation Defense Script:
> "Unlike the Sequence Diagram which focuses on time sequence, this Collaboration Diagram emphasizes object relationships during Resume Screening. Notice message hierarchy: Message 3 from the Controller prompts ResumeService to coordinate with Apache Tika for parsing (3.1), dispatch extracted text to FastAPI and Google Gemini (3.3), and persist the resulting ATS scorecard in PostgreSQL (3.5)."

---

## 8. Component Diagram
### Categorization: Structural Diagram (Subsystem Architecture)
### Purpose:
Shows high-level modular building blocks, exposed interfaces, and architectural boundaries across the React frontend, Spring Boot server, and Python AI microservice.

### PlantUML Source Code:
File: [docs/plantuml/09_component_diagram.puml](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/docs/plantuml/09_component_diagram.puml)
```plantuml
@startuml
skinparam componentStyle uml2
skinparam defaultFontName Arial
skinparam shadowing true

package "Frontend Tier (React 19 + Vite)" #E8F4F8 {
  [UI Presentation Views\n(Arena, Resume, Dashboard)] as UIComp
  [MediaPipe Edge Vision WASM] as MediaPipeComp
  [MediaRecorder Audio Module] as AudioRecComp
  [Axios REST Client] as AxiosClient

  UIComp ..> MediaPipeComp : uses
  UIComp ..> AudioRecComp : uses
  UIComp ..> AxiosClient : uses
}

package "Backend Tier (Spring Boot 3.3)" #FFF3CD {
  [Spring Security JWT Filter] as SecurityComp
  [REST Controllers Layer] as RESTCtrl
  [Business Service Layer] as BizService
  [Apache Tika Text Extractor] as TikaComp
  [Spring Data JPA Repositories] as JPADataAccess

  SecurityComp --> RESTCtrl
  RESTCtrl --> BizService
  BizService --> TikaComp
  BizService --> JPADataAccess
}

package "AI Microservice Tier (FastAPI)" #E2E3E5 {
  [FastAPI HTTP Router] as FastAPIRouter
  [Pydantic Validation Engine] as PydanticValidator
  [Speaking Pace Heuristic Engine] as WpmEngine
  [LLM Client Hub] as AiClientHub

  FastAPIRouter --> PydanticValidator
  PydanticValidator --> WpmEngine
  PydanticValidator --> AiClientHub
}

database "PostgreSQL 15 Database\n(Supabase)" as PostgresDB #F8D7DA

cloud "Groq Cloud LPU\n(Whisper + LLM)" as GroqCloud #D6D8D9
cloud "Google Gemini 1.5 Cloud" as GeminiCloud #D6D8D9

AxiosClient --> SecurityComp : HTTPS / REST / JSON (Port 8080)
BizService --> FastAPIRouter : HTTP / REST (Port 8000)
JPADataAccess --> PostgresDB : JDBC / TLS (Port 5432)
AiClientHub --> GroqCloud : HTTPS REST (Port 443)
AiClientHub --> GeminiCloud : HTTPS REST (Port 443)
@enduml
```

### Presentation Defense Script:
> "Our Component Diagram demonstrates modularity and loose coupling. The frontend communicates with Spring Boot over standard HTTPS REST. Spring Boot offloads AI processing to our Python FastAPI service. This means if we ever swap AI models—say from Groq to an on-premise Ollama instance—we only modify the AI microservice without touching backend business logic or frontend views."

---

## 9. Deployment Diagram
### Categorization: Physical Diagram (Hardware Nodes & Execution Environments)
### Purpose:
Maps software artifacts to physical execution environments, cloud nodes, and network ports.

### PlantUML Source Code:
File: [docs/plantuml/10_deployment_diagram.puml](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/docs/plantuml/10_deployment_diagram.puml)
```plantuml
@startuml
skinparam defaultFontName Arial
skinparam nodeFontSize 12
skinparam shadowing true

node "«device» Candidate Workstation" as ClientDevice #E8F4F8 {
  node "«execution environment» Modern Web Browser" as Browser {
    artifact "«artifact»\nReact 19 SPA Bundle" as SPAArtifact #D4EDDA
    artifact "«artifact»\nMediaPipe WASM Engine" as WasmArtifact #D4EDDA
  }
  node "«hardware» HD Webcam" as Webcam
  node "«hardware» Microphone" as Mic
  Webcam --> WasmArtifact
  Mic --> SPAArtifact
}

node "«device» Backend Application Server" as BackendServer #FFF3CD {
  node "«execution environment» OpenJDK 17 + Tomcat 10.1" as JRE {
    artifact "«artifact»\nbackend-0.0.1-SNAPSHOT.jar" as SpringArtifact #FFEBAA
  }
}

node "«device» AI Microservice Server" as AIServer #E2E3E5 {
  node "«execution environment» Python 3.10+ Virtualenv" as PythonEnv {
    artifact "«artifact»\nai-service/main.py\n(FastAPI ASGI)" as FastAPIArtifact #D6D8D9
  }
}

node "«device» Database Server (Supabase Cloud)" as DatabaseNode #F8D7DA {
  database "«database»\nPostgreSQL 15 Engine" as DBEngine #F5C6CB
}

cloud "«cloud» High-Speed AI Inference Clouds" as CloudEngines {
  node "Groq Cloud LPU Cluster\n(Whisper Large v3 + Qwen)" as GroqNode
  node "Google Cloud AI Studio\n(Gemini 1.5 Flash)" as GeminiNode
}

SPAArtifact --> SpringArtifact : HTTPS / TLS 1.3\n(Port 443 / 8080)
SpringArtifact --> FastAPIArtifact : HTTP REST\n(Port 8000)
SpringArtifact --> DBEngine : JDBC over TLS\n(Port 5432)
FastAPIArtifact --> GroqNode : HTTPS REST (Port 443)
FastAPIArtifact --> GeminiNode : HTTPS REST (Port 443)
@enduml
```

### Presentation Defense Script:
> "Finally, our Deployment Diagram illustrates the physical infrastructure. It shows how our React SPA and WebAssembly worker execute directly inside the user's browser, leveraging local hardware acceleration. The Spring Boot backend JAR runs on an OpenJDK 17 environment, communicating over JDBC with our cloud PostgreSQL database on Supabase and forwarding inference requests to our FastAPI container. All public traffic is strictly encrypted via TLS 1.3."

---

## 10. Viva / Presentation Defense Guide

| Question from Evaluator | Recommended Architectural Defense | Related Diagram |
| :--- | :--- | :--- |
| **"Why did you use both Spring Boot and FastAPI instead of writing everything in Python or Java?"** | "We selected a **decoupled polyglot microservice architecture**. Spring Boot provides enterprise-grade transaction management, robust JPA/Hibernate persistence, and mature Spring Security with JWT. Python and FastAPI provide native, first-class support for AI/ML libraries, asynchronous streaming, and the modern Google GenAI and Groq SDKs. This separation isolates AI compute spikes from our primary transactional database." | Component & Deployment Diagrams |
| **"Where does video processing happen, and does it cause server latency?"** | "Video coaching (eye contact, head presence, and posture) runs **100% on the client side** using Google MediaPipe compiled to WebAssembly (WASM) running at ~3.3 FPS. Only lightweight scalar integer scores (0–100) are transmitted with the audio payload, guaranteeing zero video upload bandwidth bottlenecks and absolute privacy for the candidate." | Sequence & Activity Diagrams |
| **"What happens if an interview is interrupted midway?"** | "The `InterviewSession` entity uses explicit state tracking (`CREATED`, `ACTIVE`, `COMPLETED`, `ABORTED`). Each completed question is atomically persisted in `question_answer_logs` as soon as it is evaluated. If the user disconnects, previous answers and scores are fully preserved, and the session can be resumed or audited." | State Chart & Class Diagrams |
| **"Why is Groq Whisper used instead of standard browser SpeechRecognition?"** | "The Web Speech API is vendor-dependent, inconsistent across browsers (Chrome vs Safari), and fails on technical domain vocabulary. Groq Whisper Large v3 runs cloud-level acoustic models with high transcription accuracy on developer terminology (e.g., 'Kubernetes', 'Polymorphism', 'B-Tree') with near-instant inference (<700ms)." | Sequence & Collaboration Diagrams |
| **"Explain the difference between your Sequence and Collaboration diagrams."** | "Our **Sequence Diagram** models time-ordered message lifelines during answer evaluation to trace latency and execution flow. Our **Collaboration Diagram** models the structural topology and spatial organization of objects during resume upload, emphasizing object associations and hierarchical message dispatch." | Sequence & Collaboration Diagrams |

---

## 11. PlantUML Source Files Directory

| Diagram # | Diagram Type | PlantUML File (.puml) | Vector SVG File (.svg) |
| :---: | :--- | :--- | :--- |
| 0 | System Architecture Overview | [01_overview.puml](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/docs/plantuml/01_overview.puml) | [01_overview.svg](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/docs/plantuml/svg/01_overview.svg) |
| 1 | Class Diagram | [02_class_diagram.puml](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/docs/plantuml/02_class_diagram.puml) | [02_class_diagram.svg](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/docs/plantuml/svg/02_class_diagram.svg) |
| 2 | Use Case Diagram | [03_use_case_diagram.puml](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/docs/plantuml/03_use_case_diagram.puml) | [03_use_case_diagram.svg](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/docs/plantuml/svg/03_use_case_diagram.svg) |
| 3 | Sequence Diagram | [04_sequence_diagram.puml](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/docs/plantuml/04_sequence_diagram.puml) | [04_sequence_diagram.svg](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/docs/plantuml/svg/04_sequence_diagram.svg) |
| 4 | Activity Diagram | [05_activity_diagram.puml](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/docs/plantuml/05_activity_diagram.puml) | [05_activity_diagram.svg](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/docs/plantuml/svg/05_activity_diagram.svg) |
| 5 | Object Diagram | [06_object_diagram.puml](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/docs/plantuml/06_object_diagram.puml) | [06_object_diagram.svg](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/docs/plantuml/svg/06_object_diagram.svg) |
| 6 | State Chart Diagram | [07_state_chart_diagram.puml](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/docs/plantuml/07_state_chart_diagram.puml) | [07_state_chart_diagram.svg](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/docs/plantuml/svg/07_state_chart_diagram.svg) |
| 7 | Collaboration Diagram | [08_collaboration_diagram.puml](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/docs/plantuml/08_collaboration_diagram.puml) | [08_collaboration_diagram.svg](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/docs/plantuml/svg/08_collaboration_diagram.svg) |
| 8 | Component Diagram | [09_component_diagram.puml](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/docs/plantuml/09_component_diagram.puml) | [09_component_diagram.svg](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/docs/plantuml/svg/09_component_diagram.svg) |
| 9 | Deployment Diagram | [10_deployment_diagram.puml](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/docs/plantuml/10_deployment_diagram.puml) | [10_deployment_diagram.svg](file:///d:/AI%20Resume%20Screening%20and%20Mock%20Interview%20System/docs/plantuml/svg/10_deployment_diagram.svg) |

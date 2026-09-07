# InterviewIQ AI — LLM Prompt Context for UML Diagram Generation

*Instructions: Copy and paste the text below into an LLM (like ChatGPT, Claude, or Gemini) to generate or regenerate the UML diagrams for this project in Mermaid or PlantUML formats.*

---
**[COPY BELOW THIS LINE]**

## System Overview
You are an expert software architect. I need you to generate 9 standard UML diagrams for my software engineering project, **"InterviewIQ AI"**. 

**Project Name:** AI Resume Screening and Mock Interview System  
**Architecture:** Decoupled 3-Tier Microservices Architecture  

### Technology Stack
- **Frontend Client (Tier 1):** React 19, TailwindCSS, Web Audio API (MediaRecorder) for audio capture, and Google MediaPipe (WASM/WebGL) for edge-vision tracking (eye contact and presence).
- **Backend Application Server (Tier 2):** Spring Boot 3.3 (Java 17), Spring Security (JWT authentication), Spring Data JPA, Apache Tika (PDF text extraction), and REST controllers.
- **AI Microservice Engine (Tier 3):** Python 3.10+, FastAPI (orchestration), Pydantic (data validation).
- **Database:** PostgreSQL 15 (hosted on Supabase).
- **External AI Integrations (Cloud):** 
  1. Google Gemini 1.5 Flash (for ATS Resume Screening and feedback).
  2. Groq Cloud LPU (Whisper Large v3 for extremely fast Speech-to-Text).

### Core Workflows
1. **Resume Screening:** Candidate uploads a PDF resume. Spring Boot extracts text using Tika, then passes it to the FastAPI AI service. FastAPI prompts Google Gemini to generate an ATS score (0-100), identify missing keywords, and provide suggestions. The result is saved to PostgreSQL and returned to the React frontend.
2. **Mock Interview:** After reviewing their resume analysis, the candidate starts a mock interview. React records their spoken answer (audio) and tracks their eye contact via webcam locally (MediaPipe). React sends the audio and metrics to Spring Boot. Spring Boot forwards the audio to FastAPI. FastAPI uses Groq Whisper for STT transcription, then prompts Gemini to evaluate the answer technically and communicatively. The scores are returned, saved as `QuestionAnswerLog`s in PostgreSQL, and displayed to the user.

### Key Entities (Database Tables)
- **User:** `id`, `name`, `email`, `passwordHash`, `createdAt`
- **Resume:** `id`, `user_id`, `rawText`, `atsScore`, `feedbackJson`, `updatedAt`
- **InterviewSession:** `id`, `user_id`, `jobDescription`, `status` (CREATED, ACTIVE, COMPLETED), `overallScore`, `createdAt`
- **QuestionAnswerLog:** `id`, `session_id`, `questionText`, `transcript`, `metricsJson`, `createdAt`

### Output Requirements
Please generate the following 9 UML diagrams. The diagrams should be **"Medium Detail"**—comprehensive enough to show the 3 tiers, MVC patterns, and database interactions, but simple enough that they are easy to read and draw on a whiteboard.

For each diagram, output the code in **[CHOOSE: Mermaid OR PlantUML]** format:
1. **Class Diagram** (Focus on the 4 core entities + AuthController, ResumeController, InterviewController + FastAPI AIService).
2. **Use Case Diagram** (Show Candidate, Gemini AI, and core interactions like Upload Resume, Start Mock Interview, View Report).
3. **Sequence Diagram** (Show the Mock Interview flow: Candidate -> React -> Spring Boot -> FastAPI -> Gemini -> Postgres DB).
4. **Activity Diagram** (Show the flow from Resume Upload -> Parsing -> ATS Report -> Mock Interview -> Evaluation).
5. **Object Diagram** (Show a concrete runtime snapshot of 1 User owning 1 Resume and 1 InterviewSession containing 1 QuestionAnswerLog).
6. **State Chart Diagram** (Show the lifecycle of an InterviewSession: IDLE -> RESUME_UPLOADED -> ACTIVE [loops for 5 questions] -> COMPLETED).
7. **Collaboration (Communication) Diagram** (Show the spatial topology and numbered messages between Candidate, React, Spring Boot, FastAPI, and Postgres).
8. **Component Diagram** (Show the 3 architectural tiers + Database and their standard protocols like REST, HTTP, JDBC).
9. **Deployment Diagram** (Show physical nodes: Client Browser, Backend Server [Tomcat/Java], AI Server [Uvicorn/Python], Database Cloud).

---
**[COPY ABOVE THIS LINE]**

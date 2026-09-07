import os
import zlib
import urllib.request

plantuml_alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_'

def encode64(data):
    res = ''
    for i in range(0, len(data), 3):
        b1 = data[i]
        b2 = data[i+1] if i+1 < len(data) else 0
        b3 = data[i+2] if i+2 < len(data) else 0
        c1 = b1 >> 2
        c2 = ((b1 & 0x3) << 4) | (b2 >> 4)
        c3 = ((b2 & 0xF) << 2) | (b3 >> 6)
        c4 = b3 & 0x3F
        res += plantuml_alphabet[c1] + plantuml_alphabet[c2]
        if i+1 < len(data):
            res += plantuml_alphabet[c3]
        if i+2 < len(data):
            res += plantuml_alphabet[c4]
    return res

def deflate_and_encode(text):
    compressed = zlib.compress(text.encode('utf-8'))[2:-4]
    return encode64(compressed)

diagrams = {
    "01_overview": """@startuml
skinparam handwritten false
skinparam monochrome false
skinparam packageStyle rectangle
skinparam shadowing true
skinparam defaultFontName Arial
skinparam defaultFontSize 12

package "Frontend Tier" #E8F4F8 {
  [React SPA Component] as ReactClient #D4EDDA
  [MediaPipe WASM Worker] as WASM #D4EDDA
}

package "Backend Tier" #FFF3CD {
  [Spring Boot REST API] as SpringBackend #FFEBAA
  [Spring Security JWT] as Security #FFEBAA
  [Apache Tika Parser] as Tika #FFEBAA
}

package "AI Microservice Tier" #E2E3E5 {
  [FastAPI AI Engine] as FastApiAI #D6D8D9
  [Pydantic Validator] as Pydantic #D6D8D9
}

database "PostgreSQL Component" as DB #F8D7DA

ReactClient --> SpringBackend : REST API / HTTP
ReactClient ..> WASM : invokes locally
SpringBackend ..> Security
SpringBackend ..> Tika
SpringBackend --> FastApiAI : HTTP / JSON
FastApiAI ..> Pydantic
SpringBackend --> DB : JDBC Connection
@enduml""",

    "02_class_diagram": """@startuml
skinparam classAttributeIconSize 10
skinparam classFontSize 12
skinparam classFontName Arial
skinparam shadowing true

class User {
  +Long id
  +String name
  +String email
  -String passwordHash
  +register()
  +login()
}

class Resume {
  +Long id
  +String rawText
  +Integer atsScore
  +String feedback
  +LocalDateTime updatedAt
  +analyzeResume()
}

class InterviewSession {
  +Long id
  +String jobRole
  +String status
  +Integer overallScore
  +startSession()
  +calculateFinalScore()
}

class QuestionAnswerLog {
  +Long id
  +String questionText
  +String transcript
  +Integer score
  +evaluate()
}

class AuthController {
  +login(request)
  +register(request)
}

class InterviewController {
  +startSession(request)
  +submitAnswer(audio, metrics)
}

class AIService {
  +screenResume()
  +evaluateAnswer()
}

User "1" *-- "1" Resume : owns
User "1" *-- "0..*" InterviewSession : initiates
InterviewSession "1" *-- "1..*" QuestionAnswerLog : contains

AuthController ..> User : authenticates
InterviewController ..> InterviewSession : manages
InterviewSession ..> AIService : evaluates via
@enduml""",

    "03_use_case_diagram": """@startuml
skinparam actorFontSize 12
skinparam usecaseFontSize 12
left to right direction

actor "Candidate / User" as Candidate
actor "External Gemini AI" as GeminiAI

rectangle "AI Resume & Mock Interview System" {
  usecase "(1) Register & Login" as UC1
  usecase "(1a) Google OAuth" as UC1a
  usecase "(2) Upload Resume" as UC2
  usecase "(3) Analyze ATS Score" as UC3
  usecase "(4) Start Mock Interview" as UC4
  usecase "(5) Submit Audio Answer" as UC5
  usecase "(6) View Performance Report" as UC6
}

Candidate --> UC1
Candidate --> UC2
Candidate --> UC4
Candidate --> UC5
Candidate --> UC6

UC1 <.. UC1a : <<extend>>
UC2 .> UC3 : <<include>>
UC5 .> UC6 : <<include>>

UC3 <--> GeminiAI
UC5 <--> GeminiAI
@enduml""",

    "04_sequence_diagram": """@startuml
autonumber
actor Candidate
participant "React Frontend" as React
participant "Spring Boot Backend" as Backend
participant "PostgreSQL Database" as DB
participant "FastAPI (Gemini AI)" as AI

Candidate -> React : 1. Upload Resume (PDF)
React -> Backend : 2. POST /api/resumes/upload
Backend -> AI : 3. POST /ai/screen-resume
AI --> Backend : 4. Return ATS Score & Feedback JSON
Backend -> DB : 5. Persist Resume Entity
DB --> Backend : 6. Acknowledge Save
Backend --> React : 7. 200 OK (Resume Score)
React --> Candidate : 8. Display ATS Report & Tips
@enduml""",

    "05_activity_diagram": """@startuml
start
:Candidate Uploads Resume PDF;
:System Extracts Resume Text;
:Gemini AI Analyzes ATS Score;
:Display ATS Report & Tips;
:Proceed to Mock Interview;

fork
  :Record Answer Audio;
fork again
  :MediaPipe Face Landmarking;
end fork

:Gemini AI Scores Response;
:Display Final Scorecard;
stop
@enduml""",

    "06_object_diagram": """@startuml
object "u1 : User" as u1 {
  id = 1
  name = "Alice"
  email = "alice@example.com"
  createdAt = "2026-09-07"
}

object "r1 : Resume" as r1 {
  id = 101
  atsScore = 85
  status = "ANALYZED"
  updatedAt = "2026-09-07"
}

object "s1 : InterviewSession" as s1 {
  id = 501
  jobRole = "Senior Java Developer"
  overallScore = 88
  status = "COMPLETED"
}

object "q1 : QuestionAnswerLog" as q1 {
  id = 901
  question = "Explain Spring Boot Autoconfiguration"
  score = 90
}

u1 -- r1 : owns >
u1 -- s1 : initiates >
s1 -- q1 : contains >
@enduml""",

    "07_state_chart": """@startuml
[*] --> IDLE
IDLE --> RESUME_UPLOADED : uploadResume()
RESUME_UPLOADED --> ACTIVE : startInterview()

state ACTIVE {
  [*] --> WAITING_FOR_ANSWER
  WAITING_FOR_ANSWER --> EVALUATING : submitAnswer()
  EVALUATING --> WAITING_FOR_ANSWER : [questions < 5]
}

ACTIVE --> COMPLETED : [questions == 5]
ACTIVE --> ABORTED : cancel()
COMPLETED --> [*]
ABORTED --> [*]
@enduml""",

    "08_collaboration_diagram": """@startuml
agent ":Candidate" as C
agent ":ReactApp" as F
agent ":BackendServer" as B
agent ":PostgresDB" as DB
agent ":AIService" as A

C -> F : 1: submitAnswer()
F -> B : 2: sendAudioPayload()
B -> A : 3: evaluateAudioWithGemini()
A -> B : 4: returnMetrics()
B -> DB : 5: saveSessionLog()
B -> F : 6: displayScoreCard()
@enduml""",

    "09_component_diagram": """@startuml
package "Frontend Tier" {
  [React SPA Component] as UI
  [MediaPipe WASM Worker] as WASM
}

package "Backend Tier" {
  [Spring Boot REST API] as API
  [Spring Security JWT] as Security
  [Apache Tika Parser] as Tika
}

package "AI Microservice Tier" {
  [FastAPI AI Engine] as AI
  [Pydantic Validator] as Pydantic
}

database "PostgreSQL Component" as DB

UI --> API : REST API / HTTP
UI ..> WASM
API ..> Security
API ..> Tika
API --> AI : HTTP / JSON
AI ..> Pydantic
API --> DB : JDBC Connection
@enduml""",

    "10_deployment_diagram": """@startuml
node "<<Device>> Client Computer" {
  [Web Browser (React SPA)] as Browser
}

node "<<Server>> Application Host" {
  node "OpenJDK 17 JRE" {
    [Spring Boot Container (Port 8080)] as SpringBoot
  }
  node "Python 3.10 Virtualenv" {
    [Uvicorn FastAPI Container (Port 8000)] as FastAPI
  }
}

cloud "<<Cloud Services>>" {
  database "Supabase PostgreSQL (Port 5432)" as DB
  [Google Gemini API] as Gemini
}

Browser --> SpringBoot : HTTPS (:3000 -> :8080)
SpringBoot --> FastAPI : HTTP (:8000)
SpringBoot --> DB : JDBC (:5432)
FastAPI --> Gemini : HTTPS
@enduml"""
}

def generate_svgs():
    out_dir = os.path.abspath("docs/plantuml/svg")
    puml_dir = os.path.abspath("docs/plantuml")
    os.makedirs(out_dir, exist_ok=True)
    os.makedirs(puml_dir, exist_ok=True)

    for key, puml_code in diagrams.items():
        # Save raw puml
        puml_file = os.path.join(puml_dir, f"{key}.puml")
        with open(puml_file, "w", encoding="utf-8") as f:
            f.write(puml_code)

        encoded = deflate_and_encode(puml_code)
        url = f"http://www.plantuml.com/plantuml/svg/{encoded}"
        svg_file = os.path.join(out_dir, f"{key}.svg")

        print(f"Fetching SVG for {key} from {url}...")
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req) as resp, open(svg_file, "wb") as out:
                out.write(resp.read())
            print(f"Successfully generated {svg_file}")
        except Exception as e:
            print(f"Failed to fetch SVG for {key}: {e}")

if __name__ == "__main__":
    generate_svgs()

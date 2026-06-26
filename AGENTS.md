### 1. Technology Stack Overview
This project uses a decoupled, three-tier architecture optimized for rapid deployment using free cloud tiers and native multimodal AI processing.

*   **Frontend:** React.js (v18+), TailwindCSS, Axios, HTML5 MediaRecorder API.
*   **Backend Application Server:** Spring Boot (Java 17), Spring Data JPA, Spring Security (JWT).
*   **AI Orchestration Microservice:** Python (v3.10+), FastAPI, Google GenAI SDK (Gemini 1.5 Flash free tier).
*   **Database:** PostgreSQL (Hosted on Supabase free tier).

---

### 2. Environment Setup & Execution Commands

#### Pre-requisites
Ensure Java 17, Node.js v18+, Python 3.10+, and PostgreSQL are installed locally.

#### Backend Application Server (Spring Boot)
1. Navigate to `/backend`.
2. Create an `application.properties` file in `src/main/resources/`:
```properties
server.port=8080
spring.datasource.url=jdbc:postgresql://localhost:5432/interview_db
spring.datasource.username=postgres
spring.datasource.password=your_secure_password
spring.jpa.hibernate.ddl-auto=update
spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.PostgreSQLDialect
jwt.secret=your_64_character_super_secret_key_for_jwt_token_generation_here
ai.service.url=http://localhost:8000
```
3. Run the application:
```bash
./mvnw spring-boot:run
```

#### AI Microservice (FastAPI)
1. Navigate to `/ai-service`.
2. Create a `.env` file:
```env
PORT=8000
GEMINI_API_KEY=your_free_google_ai_studio_api_key
```
3. Initialize environment and start server:
```bash
python -m venv venv
source venv/bin/activate  # On Windows use `venv\Scripts\activate`
pip install fastapi uvicorn google-genai pydantic python-multipart python-dotenv
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

#### Frontend Client (React)
1. Navigate to `/frontend`.
2. Create a `.env` file:
```env
REACT_APP_API_BASE_URL=http://localhost:8080
```
3. Install dependencies and start development server:
```bash
npm install
npm start
```

---

### 3. Coding Standards & Agent Constraints

#### Global Constraints
*   **No Placeholders:** Agents must write fully production-ready code. Do not use `// TODO`, `...`, or truncated logic.
*   **CORS Configuration:** Ensure cross-origin resource sharing is enabled globally on Spring Boot and FastAPI to allow requests from `http://localhost:3000`.

#### Frontend (React) Rules
*   **Component Structure:** Use functional components with explicit prop-types or inline TypeScript interfaces.
*   **State Isolation:** Keep local UI states inside the component using `useState`. Use context or a global store only for user session authentication.
*   **Styling:** Use utility-first TailwindCSS patterns exclusively. Avoid inline styles or standard CSS files.

#### Backend (Spring Boot) Rules
*   **Package Architecture:** Follow standard tier isolation: `controller` -> `service` -> `repository` -> `entity`.
*   **Exception Handling:** Implement a global exception handler using `@ControllerAdvice` returning standardized JSON errors.
*   **Entity Mapping:** Define explicit columns, foreign key constraints, and cascade properties. Use `Lombok` for boilerplate logging and getter/setter generations.

#### AI Microservice (FastAPI) Rules
*   **Pydantic Enforcement:** All incoming payload bodies and outgoing responses must enforce strict Pydantic model validation.
*   **Streaming & Files:** Handle incoming audio files as `UploadFile` components and close the files explicitly after passing them to the AI client to prevent memory leaks.

---
# AI Resume Screening and Mock Interview System (InterviewIQ AI)

This project uses a decoupled, three-tier architecture optimized for rapid deployment using free cloud tiers and native multimodal AI processing.

## Architecture

*   **Frontend:** React.js (v19+), Vite, TailwindCSS (v4), Axios, HTML5 MediaRecorder API.
*   **Backend Application Server:** Spring Boot (Java 17), Spring Data JPA, Spring Security (JWT).
*   **AI Orchestration Microservice:** Python (v3.10+), FastAPI, Google GenAI SDK (Gemini 1.5 Flash free tier).
*   **Database:** PostgreSQL.

---

## Environment Setup & Execution Commands

### Pre-requisites
Ensure the following are installed on your local machine:
*   Java 17
*   Node.js v18+
*   Python 3.10+
*   PostgreSQL

### 1. Database Setup
Ensure PostgreSQL is running and create a database named `interview_db`.

### 2. Backend Application Server (Spring Boot)
1. Navigate to the `/backend` directory.
2. The `src/main/resources/application.properties` file is configured to use environment variables `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` for Google OAuth credentials (with local fallbacks). You can set these in your environment or update `application.properties` directly.
3. Run the application:
```bash
cd backend
./mvnw spring-boot:run
```
The backend server will start on `http://localhost:8080`.

### 3. AI Microservice (FastAPI)
1. Navigate to the `/ai-service` directory.
2. Create a `.env` file in the `ai-service` directory with your Google AI Studio API key:
```env
PORT=8000
GEMINI_API_KEY=your_free_google_ai_studio_api_key
```
3. Initialize the environment and start the server:
```bash
cd ai-service
python -m venv venv
source venv/bin/activate  # On Windows use: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
The AI service will start on `http://localhost:8000`.

### 4. Frontend Client (React)
1. Navigate to the `/frontend` directory.
2. Create a `.env` file in the `frontend` directory:
```env
VITE_API_BASE_URL=http://localhost:8080
VITE_GOOGLE_CLIENT_ID=your_google_client_id_here
```
3. Install dependencies and start the development server:
```bash
cd frontend
npm install
npm run dev
```
The frontend will be accessible at `http://localhost:5173`.

---

## Contributing
Please ensure you do not commit any sensitive secrets (e.g., API keys, database passwords, OAuth secrets) to version control. Use environment variables and `.env` files (which are ignored by `.gitignore`) for local secrets.

import os
import json

puml_dir = os.path.abspath("docs/plantuml")
svg_dir = os.path.abspath("docs/plantuml/svg")

slide_meta = [
    {
        "id": "01_overview",
        "tabLabel": "1. Overview",
        "category": "System Architecture & Engineering Defense",
        "title": "InterviewIQ AI — UML Object-Oriented Architecture",
        "summary": "Decoupled 3-tier polyglot architecture combining ATS Resume Screening with Multimodal AI Mock Interview Simulations.",
        "architecture": [
            "Frontend Client: React 19, TailwindCSS 4, MediaPipe Edge Vision (WebGL/WASM), Web Audio API / MediaRecorder.",
            "Backend Application Server: Spring Boot 3.3.5 (Java 17), Spring Security JWT, Apache Tika PDF Extractor, Spring Data JPA.",
            "AI Orchestration Hub: Python 3.10+, FastAPI, Groq Cloud (Whisper Large v3 + Qwen/Llama 3.3), Google Gemini 1.5.",
            "Relational Database: PostgreSQL 15 on Supabase cloud connecting via TLS."
        ],
        "script": "Good morning respected professors and panel members. Today we present the object-oriented design and UML architectural blueprint of InterviewIQ AI — an enterprise-grade AI Resume Screening and Multimodal Mock Interview System modeled in standard PlantUML. Our design follows a decoupled 3-tier microservice architecture that maximizes transactional security, data isolation, and ultra-low-latency multimodal AI inference.",
        "plantumlNotes": "Modeled using standard PlantUML package and component notation with distinct tier color coding (#E8F4F8 for Frontend, #FFF3CD for Spring Boot, #E2E3E5 for FastAPI, and #F8D7DA for Supabase PostgreSQL). Protocol interfaces are explicitly labeled with transport types and ports."
    },
    {
        "id": "02_class_diagram",
        "tabLabel": "2. Class Diagram",
        "category": "Structural UML Diagram 1 / 9",
        "title": "Class Diagram — Domain Entities & Service Contracts",
        "summary": "Defines core relational JPA entities, Spring Boot REST controllers, service isolation, and strongly typed AI contracts.",
        "architecture": [
            "Entities: User acts as the aggregate root with 1:1 ownership of Resume and 1:N with InterviewSession.",
            "Composition: InterviewSession composes 1 to 5 QuestionAnswerLog entities (cascade delete, lifecycle ownership).",
            "Layered Isolation: Strictly adheres to Controller -> Service -> Repository -> Entity architecture.",
            "AI Contract Isolation: AI response schemas (ResumeAnalysisResponse, InterviewEvaluationResponse) prevent microservice schema leakage."
        ],
        "script": "This Class Diagram illustrates the structural domain of our backend. Notice the strict separation of concerns: User acts as the aggregate root, holding a 1-to-1 relationship with Resume and a 1-to-Many relationship with InterviewSession. InterviewSession composes up to five QuestionAnswerLog instances. Services never expose raw entities directly to the client; all operations strictly pass through typed DTOs.",
        "plantumlNotes": "Utilizes formal UML 3-compartment class notation with typed private attributes (-), public getters/methods (+), and explicit UML relationship semantics (*-- for composition, ..> for dependency invocation)."
    },
    {
        "id": "03_use_case_diagram",
        "tabLabel": "3. Use Case Diagram",
        "category": "Behavioral UML Diagram 2 / 9",
        "title": "Use Case Diagram — Actor Interactions & Boundaries",
        "summary": "Captures core user goals and primary/secondary actor interactions across human users and external AI engines.",
        "architecture": [
            "Primary Actor: Job Candidate / Student practicing for technical interviews.",
            "Secondary Actor: Recruiter / Admin reviewing candidate analytics and token audits.",
            "Automated System Actors: Google OAuth for identity, Groq Cloud for speech/LLM reasoning, Google Gemini for ATS analysis.",
            "UML Stereotypes: <<include>> for mandatory steps (Whisper STT, WPM calculation, rubric scoring) and <<extend>> for optional paths (Google OAuth login)."
        ],
        "script": "Our Use Case Diagram defines the behavioral interactions. The Candidate initiates core workflows like PDF Resume Upload and Mock Interviewing. Crucially, we treat Groq Cloud and Google Gemini as external secondary actors. Notice the <<include>> relationships: submitting an audio answer unconditionally triggers speech transcription, speaking pace heuristics, and multi-metric rubric scoring.",
        "plantumlNotes": "Employs classic PlantUML stick-figure actors with <<Human>> and <<External System>> stereotypes, bounded within a formal System rectangle boundary."
    },
    {
        "id": "04_sequence_diagram",
        "tabLabel": "4. Sequence Diagram",
        "category": "Interaction UML Diagram 3 / 9",
        "title": "Sequence Diagram — Multimodal Answer Evaluation",
        "summary": "Traces the chronological message sequence for submitting an interview answer and receiving real-time evaluation.",
        "architecture": [
            "Steps 1-3: MediaPipe calculates client-side gaze and presence metrics without video upload latency.",
            "Steps 4-7: React posts audio + vision metrics to Spring Boot, which validates session ownership in PostgreSQL.",
            "Steps 8-14: FastAPI invokes Groq Whisper for STT (audio duration 42.5s) and Groq LLM for rubric scoring.",
            "Steps 15-18: Scores are merged, persisted to PostgreSQL, and returned to the UI in under 1.5 seconds."
        ],
        "script": "This Sequence Diagram illustrates our flagship workflow: real-time answer evaluation. Notice how the client's webcam frames are processed locally using WebAssembly via MediaPipe at 3.3 FPS. This completely eliminates video streaming bandwidth costs. Spring Boot orchestrates the transaction, dispatches audio to our FastAPI microservice, invokes Groq Whisper and LLM reasoning, and commits the result to PostgreSQL in a single cohesive flow.",
        "plantumlNotes": "Leverages PlantUML's autonumber feature, activation bars (activate/deactivate), conditional alt blocks for completion detection, and tier color-coded participant boxes."
    },
    {
        "id": "05_activity_diagram",
        "tabLabel": "5. Activity Diagram",
        "category": "Behavioral UML Diagram 4 / 9",
        "title": "Activity Diagram — End-to-End Operational Workflow",
        "summary": "Models the end-to-end user navigation with conditional branches, loops, and parallel processing.",
        "architecture": [
            "Parallel Processing (Fork/Join): Simultaneous audio streaming via MediaRecorder and edge face landmarking via MediaPipe.",
            "Adaptive Loop: The interview cycle repeats until Question Count reaches 5.",
            "Dynamic Score Aggregation: Overall session score is calculated by averaging technical and communication scores upon session completion."
        ],
        "script": "The Activity Diagram models procedural control flow. Notice the Fork and Join constructs when the candidate begins speaking: audio recording and visual eye-tracking execute in parallel threads on the browser. Once submitted, the system enters the AI evaluation pipeline and checks if all 5 questions have been answered. If not, the loop dynamically loads the next adaptive question.",
        "plantumlNotes": "Uses PlantUML's new beta activity syntax with standard start/stop nodes, decision diamonds, fork/fork again/end fork concurrency, and repeat/repeat while loops."
    },
    {
        "id": "06_object_diagram",
        "tabLabel": "6. Object Diagram",
        "category": "Structural UML Diagram 5 / 9",
        "title": "Object Diagram — Runtime Instance Snapshot",
        "summary": "A concrete snapshot of actual objects in memory and database rows during Question 2 of an active session.",
        "architecture": [
            "Candidate User: id=101 ('Paka Venu Yadav').",
            "Active Session: id=812 with status='ACTIVE' and currentQuestion=2.",
            "Persisted QA Logs: id=4911 (Polymorphism) and id=4912 (PostgreSQL B-Trees) with live technical and communication scores.",
            "Frontend State: Displays live speaking pace (142 WPM) and eye contact score (92%)."
        ],
        "script": "To demonstrate that our design is fully grounded in reality, this Object Diagram captures an actual runtime instance during an active interview session. You can see object references for candidate user 101, session 812, and completed question logs 4911 and 4912. Notice that overallScore remains 0 because the session is still ACTIVE and will only be finalized after question 5.",
        "plantumlNotes": "Uses standard PlantUML object notation (object \"instanceName : ClassName\") with underlined titles and slot-value attribute assignments according to UML 2.5."
    },
    {
        "id": "07_state_chart_diagram",
        "tabLabel": "7. State Chart",
        "category": "Behavioral UML Diagram 6 / 9",
        "title": "State Chart Diagram — Interview Session Lifecycle",
        "summary": "Formally specifies the lifecycle states and transitions of an InterviewSession.",
        "architecture": [
            "States: CREATED -> ACTIVE (sub-states: WAITING_FOR_INPUT, RECORDING, EVALUATING) -> COMPLETED.",
            "Resilience: ABORTED state captures unexpected browser exits while preserving answered logs.",
            "Archive: Both COMPLETED and ABORTED sessions transition to ARCHIVED for historical analytics."
        ],
        "script": "This State Chart tracks the finite state machine of an interview session. The session transitions from CREATED to ACTIVE once permissions are verified. Inside ACTIVE, we model nested sub-states: WAITING_FOR_INPUT, RECORDING, and EVALUATING. Guard conditions ensure that when questionCount equals 5, the state transitions cleanly to COMPLETED, triggering overall score aggregation.",
        "plantumlNotes": "Models composite nested states with entry/exit points ([*]), internal state transitions, and guard conditions in brackets ([questionCount < 5])."
    },
    {
        "id": "08_collaboration_diagram",
        "tabLabel": "8. Collaboration",
        "category": "Interaction UML Diagram 7 / 9",
        "title": "Collaboration Diagram — Resume Upload & ATS Pipeline",
        "summary": "Depicts object interactions and numbered message propagation during the Resume Upload & ATS pipeline.",
        "architecture": [
            "Spatial Topology: Focuses on inter-object wiring rather than timeline lifelines.",
            "Nested Hierarchy: Steps 3.1 to 3.5 demonstrate how ResumeService acts as a facade coordinator between Apache Tika, FastAPI, Gemini AI, and ResumeRepository."
        ],
        "script": "Unlike the Sequence Diagram which focuses on time sequence, this Collaboration Diagram emphasizes object relationships during Resume Screening. Notice message hierarchy: Message 3 from the Controller prompts ResumeService to coordinate with Apache Tika for parsing (3.1), dispatch extracted text to FastAPI and Google Gemini (3.3), and persist the resulting ATS scorecard in PostgreSQL (3.5).",
        "plantumlNotes": "Uses PlantUML's communication/collaboration topology with directional arrows and numbered hierarchical dispatch labels (e.g. 3.3 -> 3.3.1 -> 3.3.2)."
    },
    {
        "id": "09_component_diagram",
        "tabLabel": "9. Component",
        "category": "Structural UML Diagram 8 / 9",
        "title": "Component Diagram — Subsystem Architecture",
        "summary": "Shows high-level modular building blocks, exposed interfaces, and architectural boundaries.",
        "architecture": [
            "Frontend Tier: UI presentation, MediaPipe WASM edge engine, Axios client.",
            "Backend Server: Spring Security, REST controllers, Core business logic, Apache Tika, Spring Data JPA.",
            "AI Microservice: FastAPI routing, Pydantic schema validation, WPM heuristics, LLM client hub.",
            "External Clouds: Supabase PostgreSQL, Groq Cloud LPU, Google Gemini API."
        ],
        "script": "Our Component Diagram demonstrates modularity and loose coupling. The frontend communicates with Spring Boot over standard HTTPS REST. Spring Boot offloads AI processing to our Python FastAPI service. This means if we ever swap AI models—say from Groq to an on-premise Ollama instance—we only modify the AI microservice without touching backend business logic or frontend views.",
        "plantumlNotes": "Standard UML 2 component boxes with package boundaries and explicit port-to-port bindings across architectural layers."
    },
    {
        "id": "10_deployment_diagram",
        "tabLabel": "10. Deployment",
        "category": "Physical UML Diagram 9 / 9",
        "title": "Deployment Diagram — Physical Hardware & Cloud Infrastructure",
        "summary": "Maps software artifacts to physical execution environments, cloud nodes, and network ports.",
        "architecture": [
            "Client Device: Modern Browser running React SPA bundle and WebAssembly MediaPipe engine using local GPU/WebGL.",
            "Backend Node: OpenJDK 17 with embedded Tomcat 10.1 serving backend JAR on port 8080.",
            "AI Node: Python 3.10+ running Uvicorn ASGI server on port 8000.",
            "Database Node: PostgreSQL 15 on Supabase cloud connecting via JDBC over TLS on port 5432.",
            "Cloud Edge: Groq Cloud LPU cluster and Google AI Studio over TLS 1.3 HTTPS."
        ],
        "script": "Finally, our Deployment Diagram illustrates the physical infrastructure. It shows how our React SPA and WebAssembly worker execute directly inside the user's browser, leveraging local hardware acceleration. The Spring Boot backend JAR runs on an OpenJDK 17 environment, communicating over JDBC with our cloud PostgreSQL database on Supabase and forwarding inference requests to our FastAPI container. All public traffic is strictly encrypted via TLS 1.3.",
        "plantumlNotes": "Uses 3D node cubes (node <<device>>, node <<execution environment>>), hardware devices, and deployed artifact rectangles (<<artifact>>) connected via secure network protocols."
    }
]

# Load SVGs and PUML codes
slides_payload = []
for item in slide_meta:
    sid = item["id"]
    puml_file = os.path.join(puml_dir, f"{sid}.puml")
    svg_file = os.path.join(svg_dir, f"{sid}.svg")
    
    with open(puml_file, "r", encoding="utf-8") as pf:
        puml_code = pf.read()
    with open(svg_file, "r", encoding="utf-8") as sf:
        svg_code = sf.read()
        
    slides_payload.append({
        "id": sid,
        "tabLabel": item["tabLabel"],
        "category": item["category"],
        "title": item["title"],
        "summary": item["summary"],
        "architecture": item["architecture"],
        "script": item["script"],
        "plantumlNotes": item["plantumlNotes"],
        "puml": puml_code,
        "svg": svg_code
    })

slides_json_str = json.dumps(slides_payload)

html_template = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>InterviewIQ AI — Classic PlantUML Design Presentation</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {{
      --bg-primary: #0b0f19;
      --bg-secondary: #111827;
      --bg-card: #1f2937;
      --border-color: #374151;
      --text-primary: #f9fafb;
      --text-secondary: #9ca3af;
      --accent: #2563eb;
      --accent-glow: rgba(37, 99, 235, 0.3);
      --accent-plantuml: #f59e0b;
      --accent-success: #10b981;
    }}

    * {{
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }}

    body {{
      font-family: 'Inter', sans-serif;
      background-color: var(--bg-primary);
      color: var(--text-primary);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      overflow-x: hidden;
    }}

    header {{
      background: rgba(17, 24, 39, 0.9);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border-color);
      padding: 0.85rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: sticky;
      top: 0;
      z-index: 100;
    }}

    .brand {{
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-weight: 700;
      font-size: 1.25rem;
      letter-spacing: -0.025em;
    }}

    .badge {{
      background: linear-gradient(135deg, #f59e0b, #d97706);
      color: #111827;
      padding: 0.25rem 0.65rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }}

    .nav-controls {{
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }}

    .btn {{
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      color: var(--text-primary);
      padding: 0.5rem 0.9rem;
      border-radius: 8px;
      font-size: 0.85rem;
      font-weight: 500;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      transition: all 0.2s ease;
    }}

    .btn:hover {{
      background: #374151;
      border-color: var(--accent);
      box-shadow: 0 0 10px var(--accent-glow);
    }}

    .btn-primary {{
      background: var(--accent);
      border-color: var(--accent);
      color: white;
    }}

    .btn-primary:hover {{
      background: #1d4ed8;
    }}

    .btn-puml {{
      background: rgba(245, 158, 11, 0.15);
      border-color: rgba(245, 158, 11, 0.4);
      color: #fbbf24;
    }}

    .btn-puml:hover {{
      background: rgba(245, 158, 11, 0.25);
      border-color: #f59e0b;
      color: #ffffff;
    }}

    .slide-indicator {{
      font-size: 0.9rem;
      font-weight: 600;
      color: var(--text-secondary);
      padding: 0 0.5rem;
      font-variant-numeric: tabular-nums;
    }}

    .tabs-nav {{
      display: flex;
      gap: 0.5rem;
      overflow-x: auto;
      padding: 0.5rem 2rem;
      background: #0d1322;
      border-bottom: 1px solid var(--border-color);
    }}

    .tab-item {{
      padding: 0.4rem 0.85rem;
      border-radius: 6px;
      font-size: 0.8rem;
      font-weight: 500;
      cursor: pointer;
      white-space: nowrap;
      color: var(--text-secondary);
      border: 1px solid transparent;
      transition: all 0.2s;
    }}

    .tab-item:hover {{
      color: var(--text-primary);
      background: rgba(255, 255, 255, 0.05);
    }}

    .tab-item.active {{
      color: #111827;
      background: #f59e0b;
      font-weight: 700;
      box-shadow: 0 0 12px rgba(245, 158, 11, 0.35);
    }}

    .presentation-container {{
      display: flex;
      flex: 1;
      height: calc(100vh - 105px);
      overflow: hidden;
    }}

    .diagram-panel {{
      flex: 7;
      display: flex;
      flex-direction: column;
      padding: 1.5rem;
      overflow-y: auto;
      background: radial-gradient(circle at top left, rgba(245, 158, 11, 0.04), transparent 40%),
                  radial-gradient(circle at bottom right, rgba(37, 99, 235, 0.04), transparent 40%);
    }}

    .notes-panel {{
      flex: 5;
      border-left: 1px solid var(--border-color);
      background: var(--bg-secondary);
      padding: 1.5rem;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }}

    .slide-header {{
      margin-bottom: 1.25rem;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }}

    .slide-category {{
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #fbbf24;
      font-weight: 700;
      margin-bottom: 0.25rem;
    }}

    .slide-title {{
      font-size: 1.65rem;
      font-weight: 800;
      letter-spacing: -0.03em;
      background: linear-gradient(135deg, #ffffff, #cbd5e1);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }}

    .zoom-toolbar {{
      display: flex;
      gap: 0.4rem;
    }}

    .btn-icon {{
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      color: var(--text-secondary);
      width: 32px;
      height: 32px;
      border-radius: 6px;
      display: inline-flex;
      justify-content: center;
      align-items: center;
      cursor: pointer;
      font-weight: bold;
      transition: all 0.2s;
    }}

    .btn-icon:hover {{
      color: white;
      border-color: var(--accent-plantuml);
      background: #374151;
    }}

    .diagram-viewport {{
      background: #ffffff;
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 1.5rem;
      flex: 1;
      display: flex;
      justify-content: center;
      align-items: center;
      overflow: auto;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
      position: relative;
    }}

    .diagram-canvas {{
      width: 100%;
      height: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      transform-origin: center center;
      transition: transform 0.2s ease;
    }}

    .diagram-canvas svg {{
      max-width: 100%;
      max-height: 100%;
      height: auto;
      filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.1));
    }}

    .notes-card {{
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 10px;
      padding: 1.25rem;
    }}

    .notes-card h3 {{
      font-size: 1rem;
      font-weight: 700;
      color: #fbbf24;
      margin-bottom: 0.75rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }}

    .notes-card p, .notes-card li {{
      font-size: 0.875rem;
      line-height: 1.6;
      color: #d1d5db;
    }}

    .notes-card ul {{
      padding-left: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }}

    .script-box {{
      background: rgba(245, 158, 11, 0.08);
      border-left: 4px solid var(--accent-plantuml);
      padding: 1rem;
      border-radius: 0 8px 8px 0;
      font-style: italic;
      color: #fef3c7;
      line-height: 1.65;
    }}

    /* PlantUML Code Modal */
    .modal-overlay {{
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.8);
      backdrop-filter: blur(8px);
      display: none;
      justify-content: center;
      align-items: center;
      z-index: 1000;
      padding: 2rem;
    }}

    .modal-overlay.active {{
      display: flex;
    }}

    .modal-box {{
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      width: 100%;
      max-width: 850px;
      max-height: 85vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 40px rgba(0,0,0,0.6);
    }}

    .modal-header {{
      padding: 1rem 1.5rem;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }}

    .modal-title {{
      font-size: 1.1rem;
      font-weight: 700;
      color: #fbbf24;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }}

    .modal-body {{
      padding: 1.5rem;
      overflow-y: auto;
      flex: 1;
      background: #0f172a;
    }}

    .modal-body pre {{
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.85rem;
      color: #e2e8f0;
      line-height: 1.6;
      white-space: pre-wrap;
    }}

    .modal-footer {{
      padding: 1rem 1.5rem;
      border-top: 1px solid var(--border-color);
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
    }}

    @media (max-width: 1024px) {{
      .presentation-container {{
        flex-direction: column;
        height: auto;
        overflow-y: auto;
      }}
      .notes-panel {{
        border-left: none;
        border-top: 1px solid var(--border-color);
      }}
    }}
  </style>
</head>
<body>

  <header>
    <div class="brand">
      <span>InterviewIQ AI</span>
      <span class="badge">PlantUML Design Presentation</span>
    </div>
    <div class="nav-controls">
      <button class="btn" id="prevBtn" onclick="prevSlide()">‹ Previous</button>
      <span class="slide-indicator" id="slideIndicator">Slide 1 / 10</span>
      <button class="btn btn-primary" id="nextBtn" onclick="nextSlide()">Next ›</button>
      <button class="btn btn-puml" onclick="openPumlModal()">📄 View .puml Source</button>
      <button class="btn" onclick="toggleFullScreen()" title="Full Screen (F11)">⛶ Present</button>
    </div>
  </header>

  <nav class="tabs-nav" id="tabsNav"></nav>

  <main class="presentation-container">

    <!-- DIAGRAM VIEWPORT PANEL -->
    <section class="diagram-panel">
      <div class="slide-header">
        <div>
          <div class="slide-category" id="slideCategory">System Architecture</div>
          <h1 class="slide-title" id="slideTitle">Loading...</h1>
        </div>
        <div class="zoom-toolbar">
          <button class="btn-icon" onclick="zoomIn()" title="Zoom In">+</button>
          <button class="btn-icon" onclick="zoomOut()" title="Zoom Out">-</button>
          <button class="btn-icon" onclick="resetZoom()" title="Reset Zoom">⟲</button>
        </div>
      </div>

      <div class="diagram-viewport" id="viewport">
        <div class="diagram-canvas" id="canvas">
          <!-- Vector PlantUML SVG loaded here -->
        </div>
      </div>
    </section>

    <!-- SPEAKER NOTES & DEFENSE PANEL -->
    <aside class="notes-panel" id="notesPanel"></aside>

  </main>

  <!-- PLANTUML CODE MODAL -->
  <div class="modal-overlay" id="pumlModal" onclick="closeModalOnOverlay(event)">
    <div class="modal-box">
      <div class="modal-header">
        <div class="modal-title">
          <span>🌿 PlantUML Source Code</span>
          <span id="modalFileName" style="font-size: 0.8rem; color: #94a3b8; font-weight: normal;"></span>
        </div>
        <button class="btn-icon" onclick="closePumlModal()">✕</button>
      </div>
      <div class="modal-body">
        <pre id="modalPumlCode"></pre>
      </div>
      <div class="modal-footer">
        <button class="btn btn-puml" id="copyBtn" onclick="copyPumlCode()">📋 Copy .puml Code</button>
        <button class="btn" onclick="closePumlModal()">Close</button>
      </div>
    </div>
  </div>

  <script>
    const slidesData = {slides_json_str};

    let currentSlide = 0;
    let zoomLevel = 1.0;

    // Build Tabs
    const tabsNav = document.getElementById('tabsNav');
    slidesData.forEach((s, i) => {{
      const tab = document.createElement('div');
      tab.className = `tab-item ${{i === 0 ? 'active' : ''}}`;
      tab.textContent = s.tabLabel;
      tab.onclick = () => goToSlide(i);
      tabsNav.appendChild(tab);
    }});

    function renderSlide(index) {{
      currentSlide = index;
      resetZoom();

      // Update Tabs
      const tabItems = document.querySelectorAll('.tab-item');
      tabItems.forEach((t, i) => {{
        t.classList.toggle('active', i === index);
      }});

      if (tabItems[index]) {{
        tabItems[index].scrollIntoView({{ behavior: 'smooth', block: 'nearest', inline: 'center' }});
      }}

      // Update Header
      const data = slidesData[index];
      document.getElementById('slideCategory').textContent = data.category;
      document.getElementById('slideTitle').textContent = data.title;
      document.getElementById('slideIndicator').textContent = `Slide ${{index + 1}} / ${{slidesData.length}}`;

      // Update Diagram Canvas directly with embedded pure PlantUML SVG
      const canvas = document.getElementById('canvas');
      canvas.innerHTML = data.svg;

      // Update Notes Panel
      const notesPanel = document.getElementById('notesPanel');
      notesPanel.innerHTML = `
        <div class="notes-card">
          <div class="slide-category">${{data.category}}</div>
          <h2 style="font-size: 1.25rem; margin-bottom: 0.5rem; font-weight: 700;">${{data.title}}</h2>
          <p>${{data.summary}}</p>
        </div>

        <div class="notes-card">
          <h3>⚡ Architectural Breakdown</h3>
          <ul>
            ${{data.architecture.map(a => `<li>${{a}}</li>`).join('')}}
          </ul>
        </div>

        <div class="notes-card">
          <h3>🎤 Speaker Presentation Script (What to Say)</h3>
          <div class="script-box">
            "${{data.script}}"
          </div>
        </div>

        <div class="notes-card">
          <h3>🌿 PlantUML Notation Defense</h3>
          <p>${{data.plantumlNotes}}</p>
        </div>
      `;
    }}

    function zoomIn() {{
      if (zoomLevel < 2.5) {{
        zoomLevel += 0.2;
        applyZoom();
      }}
    }}

    function zoomOut() {{
      if (zoomLevel > 0.5) {{
        zoomLevel -= 0.2;
        applyZoom();
      }}
    }}

    function resetZoom() {{
      zoomLevel = 1.0;
      applyZoom();
    }}

    function applyZoom() {{
      const canvas = document.getElementById('canvas');
      canvas.style.transform = `scale(${{zoomLevel}})`;
    }}

    function nextSlide() {{
      if (currentSlide < slidesData.length - 1) {{
        goToSlide(currentSlide + 1);
      }}
    }}

    function prevSlide() {{
      if (currentSlide > 0) {{
        goToSlide(currentSlide - 1);
      }}
    }}

    function goToSlide(index) {{
      renderSlide(index);
    }}

    function toggleFullScreen() {{
      if (!document.fullscreenElement) {{
        document.documentElement.requestFullscreen().catch(err => {{
          console.warn('Fullscreen request failed', err);
        }});
      }} else {{
        if (document.exitFullscreen) {{
          document.exitFullscreen();
        }}
      }}
    }}

    // PlantUML Modal Controls
    function openPumlModal() {{
      const data = slidesData[currentSlide];
      document.getElementById('modalFileName').textContent = `(docs/plantuml/${{data.id}}.puml)`;
      document.getElementById('modalPumlCode').textContent = data.puml;
      document.getElementById('pumlModal').classList.add('active');
    }}

    function closePumlModal() {{
      document.getElementById('pumlModal').classList.remove('active');
    }}

    function closeModalOnOverlay(e) {{
      if (e.target === document.getElementById('pumlModal')) {{
        closePumlModal();
      }}
    }}

    function copyPumlCode() {{
      const code = slidesData[currentSlide].puml;
      navigator.clipboard.writeText(code).then(() => {{
        const btn = document.getElementById('copyBtn');
        const origText = btn.textContent;
        btn.textContent = '✓ Copied to Clipboard!';
        btn.style.background = '#10b981';
        btn.style.color = 'white';
        setTimeout(() => {{
          btn.textContent = origText;
          btn.style.background = '';
          btn.style.color = '';
        }}, 2000);
      }}).catch(err => {{
        alert('Failed to copy: ' + err);
      }});
    }}

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {{
      if (document.getElementById('pumlModal').classList.contains('active')) {{
        if (e.key === 'Escape') closePumlModal();
        return;
      }}
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {{
        nextSlide();
      }} else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {{
        prevSlide();
      }} else if (e.key === '+' || e.key === '=') {{
        zoomIn();
      }} else if (e.key === '-') {{
        zoomOut();
      }} else if (e.key === '0') {{
        resetZoom();
      }} else if (e.key.toLowerCase() === 'p') {{
        openPumlModal();
      }}
    }});

    // Boot presentation
    renderSlide(0);
  </script>
</body>
</html>
"""

out_html_path = os.path.abspath("docs/presentation.html")
with open(out_html_path, "w", encoding="utf-8") as f:
    f.write(html_template)

print(f"Updated: {out_html_path} with classic PlantUML diagrams and source code viewer!")

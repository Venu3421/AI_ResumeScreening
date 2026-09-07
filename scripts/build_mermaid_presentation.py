import os
import re
import json

md_file = os.path.abspath("docs/UML_DESIGN_PRESENTATION.md")
html_file = os.path.abspath("docs/mermaid_presentation.html")

with open(md_file, "r", encoding="utf-8") as f:
    content = f.read()

# Extract sections
# We'll split by "\n## "
sections = content.split("\n## ")

slides_payload = []
for i, section in enumerate(sections):
    if i == 0:
        continue # Title section
    
    # Extract title
    title_match = re.search(r"^(.*?)\n", section)
    if not title_match:
        continue
    title = title_match.group(1).strip()
    
    # Extract Categorization
    cat_match = re.search(r"### Categorization:\s*(.*?)\n", section)
    category = cat_match.group(1).strip() if cat_match else "General Presentation"
    
    # Extract Purpose (Summary)
    purpose_match = re.search(r"### Purpose:\n(.*?)\n\n", section, re.DOTALL)
    summary = purpose_match.group(1).strip().replace("\n", " ") if purpose_match else ""
    
    # Extract Mermaid Code
    mermaid_match = re.search(r"```mermaid\n(.*?)\n```", section, re.DOTALL)
    mermaid_code = mermaid_match.group(1).strip() if mermaid_match else ""
    
    # Fix Mermaid Code to avoid syntax errors
    if "stateDiagram" in mermaid_code:
        mermaid_code = mermaid_code.replace('"', "'")
        
    # Raw Markdown: Everything except the ### Categorization and ### Purpose blocks
    # We can just keep the whole section but remove the mermaid block for the raw text view
    raw_markdown = section
    if mermaid_match:
        raw_markdown = raw_markdown.replace(mermaid_match.group(0), "")
    
    # Extract Talking points
    talking_points = []
    points_match = re.search(r"### Key Presentation Talking Points:\n(.*?)(\n---|\Z)", section, re.DOTALL)
    if points_match:
        points_text = points_match.group(1).strip()
        for line in points_text.split('\n'):
            line = line.strip()
            if line.startswith('* **'):
                talking_points.append(line.lstrip('* ').strip())
            elif line.startswith('*'):
                talking_points.append(line.lstrip('* ').strip())

    slides_payload.append({
        "id": f"slide_{i}",
        "tabLabel": f"{i}. {title.split('. ')[-1] if '. ' in title else title}",
        "category": category,
        "title": title,
        "summary": summary,
        "architecture": talking_points,
        "mermaid": mermaid_code,
        "raw_markdown": "## " + raw_markdown
    })

slides_json_str = json.dumps(slides_payload)

html_template = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>InterviewIQ AI — Classic Mermaid Design Presentation</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <script type="module">
    import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
    mermaid.initialize({{ startOnLoad: false, theme: 'dark' }});
    window.mermaid = mermaid;
  </script>
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
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
      --accent-plantuml: #10b981;
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
      background: linear-gradient(135deg, #10b981, #059669);
      color: #ffffff;
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
      background: rgba(16, 185, 129, 0.15);
      border-color: rgba(16, 185, 129, 0.4);
      color: #10b981;
    }}

    .btn-puml:hover {{
      background: rgba(16, 185, 129, 0.25);
      border-color: #10b981;
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
      background: #10b981;
      font-weight: 700;
      box-shadow: 0 0 12px rgba(16, 185, 129, 0.35);
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
      background: radial-gradient(circle at top left, rgba(16, 185, 129, 0.04), transparent 40%),
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
      color: #10b981;
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
      background: #111827;
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 1.5rem;
      flex: 1;
      display: flex;
      flex-direction: column;
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
    
    .markdown-canvas {{
      width: 100%;
      height: 100%;
      overflow-y: auto;
      text-align: left;
      padding: 1rem;
      line-height: 1.6;
    }}
    
    .markdown-canvas h2, .markdown-canvas h3 {{
      color: #10b981;
      margin-bottom: 1rem;
      font-weight: 700;
    }}
    
    .markdown-canvas table {{
      width: 100%;
      border-collapse: collapse;
      margin-top: 1rem;
    }}
    
    .markdown-canvas th, .markdown-canvas td {{
      border: 1px solid var(--border-color);
      padding: 0.75rem;
      text-align: left;
    }}
    
    .markdown-canvas th {{
      background: rgba(16, 185, 129, 0.1);
      color: #10b981;
    }}
    
    .markdown-canvas a {{
      color: #3b82f6;
      text-decoration: none;
    }}

    .diagram-canvas svg {{
      max-width: 100%;
      max-height: 100%;
      height: auto;
      filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.5));
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
      color: #10b981;
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

    .error-box {{
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid #ef4444;
      color: #fca5a5;
      padding: 1rem;
      border-radius: 8px;
      font-family: monospace;
      white-space: pre-wrap;
      width: 100%;
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
      color: #10b981;
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
      <span class="badge">Mermaid Design Presentation</span>
    </div>
    <div class="nav-controls">
      <button class="btn" id="prevBtn" onclick="prevSlide()">‹ Previous</button>
      <span class="slide-indicator" id="slideIndicator">Slide 1 / 10</span>
      <button class="btn btn-primary" id="nextBtn" onclick="nextSlide()">Next ›</button>
      <button class="btn btn-puml" onclick="openPumlModal()">📄 View Source</button>
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
        <!-- Render target -->
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
          <span>🌿 Markdown / Mermaid Source Code</span>
          <span id="modalFileName" style="font-size: 0.8rem; color: #94a3b8; font-weight: normal;"></span>
        </div>
        <button class="btn-icon" onclick="closePumlModal()">✕</button>
      </div>
      <div class="modal-body">
        <pre id="modalPumlCode"></pre>
      </div>
      <div class="modal-footer">
        <button class="btn btn-puml" id="copyBtn" onclick="copyPumlCode()">📋 Copy Code</button>
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

    async function renderSlide(index) {{
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

      // Render Mermaid or Markdown
      const viewport = document.getElementById('viewport');
      viewport.innerHTML = '<div style="color:white;">Rendering...</div>';
      
      if (data.mermaid && data.mermaid.trim() !== '') {{
        viewport.innerHTML = '<div class="diagram-canvas" id="canvas"></div>';
        const canvas = document.getElementById('canvas');
        try {{
          if (window.mermaid) {{
            const {{ svg }} = await window.mermaid.render(`mermaid-svg-${{index}}`, data.mermaid);
            canvas.innerHTML = svg;
          }} else {{
            canvas.innerHTML = '<div class="error-box">Mermaid library not loaded yet. Please try again.</div>';
          }}
        }} catch (err) {{
          console.error('Mermaid render error:', err);
          canvas.innerHTML = `<div class="error-box">Failed to render diagram:\\n${{err.message}}</div>`;
        }}
      }} else {{
        // Render Markdown for text-only sections like Table of Contents or Viva Guide
        viewport.innerHTML = '<div class="markdown-canvas" id="canvas"></div>';
        const canvas = document.getElementById('canvas');
        canvas.innerHTML = marked.parse(data.raw_markdown);
      }}

      // Update Notes Panel
      const notesPanel = document.getElementById('notesPanel');
      let notesHtml = '';
      
      if (data.summary) {{
        notesHtml += `
          <div class="notes-card">
            <div class="slide-category">${{data.category}}</div>
            <h2 style="font-size: 1.25rem; margin-bottom: 0.5rem; font-weight: 700;">${{data.title}}</h2>
            <p>${{data.summary}}</p>
          </div>`;
      }}
      
      if (data.architecture && data.architecture.length > 0) {{
        notesHtml += `
          <div class="notes-card">
            <h3>⚡ Architectural Breakdown & Talking Points</h3>
            <ul>
              ${{data.architecture.map(a => `<li>${{a}}</li>`).join('')}}
            </ul>
          </div>`;
      }}
      
      if (!data.summary && (!data.architecture || data.architecture.length === 0)) {{
        notesHtml += `
          <div class="notes-card">
            <h2 style="font-size: 1.25rem; margin-bottom: 0.5rem; font-weight: 700;">${{data.title}}</h2>
            <p>This is a textual reference slide containing project documentation.</p>
          </div>`;
      }}
      
      notesPanel.innerHTML = notesHtml;
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
      if (canvas && canvas.classList.contains('diagram-canvas')) {{
        canvas.style.transform = `scale(${{zoomLevel}})`;
      }}
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
      document.getElementById('modalFileName').textContent = `(Diagram ${{currentSlide + 1}})`;
      document.getElementById('modalPumlCode').textContent = data.mermaid ? data.mermaid : data.raw_markdown;
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
      const data = slidesData[currentSlide];
      const code = data.mermaid ? data.mermaid : data.raw_markdown;
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
    
    // Wait for mermaid to load, then render first slide
    setTimeout(() => {{
        goToSlide(0);
    }}, 500);

  </script>
</body>
</html>
"""

with open(html_file, "w", encoding="utf-8") as f:
    f.write(html_template)

print(f"Generated {html_file} successfully.")

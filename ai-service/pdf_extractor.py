"""
Structure-aware PDF text extraction using pymupdf (fitz).
Preserves section headers and bullet structure for better semantic chunking.
"""
import pymupdf

def extract_resume_sections(pdf_bytes: bytes) -> dict:
    """
    Extract resume text with section awareness.
    Returns:
    {
      "full_text": str,           # complete text for keyword matching
      "sections": {               # structured sections for semantic chunking
        "skills": str,
        "experience": str,
        "projects": str,
        "education": str,
        "summary": str,
        "other": str
      }
    }
    """
    try:
        doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    except Exception as e:
        print(f"Error opening PDF with pymupdf: {e}")
        return {"full_text": "", "sections": {}}

    sections = {
        "skills": "",
        "experience": "",
        "projects": "",
        "education": "",
        "summary": "",
        "other": ""
    }
    
    full_text_parts = []
    
    section_keywords = {
        "skills": ["SKILLS", "TECHNICAL SKILLS", "CORE COMPETENCIES"],
        "experience": ["EXPERIENCE", "WORK EXPERIENCE", "EMPLOYMENT HISTORY", "PROFESSIONAL EXPERIENCE"],
        "projects": ["PROJECTS", "PERSONAL PROJECTS", "ACADEMIC PROJECTS"],
        "education": ["EDUCATION", "ACADEMIC BACKGROUND", "CERTIFICATIONS"],
        "summary": ["SUMMARY", "OBJECTIVE", "PROFESSIONAL SUMMARY", "ABOUT ME"]
    }
    
    current_section = "other"
    
    for page in doc:
        blocks = page.get_text("blocks")
        # Blocks are usually sorted, but sorting by y0 then x0 ensures reading order
        blocks.sort(key=lambda b: (b[1], b[0]))
        
        for b in blocks:
            # Block type 0 is text
            if b[6] != 0:
                continue
                
            text = b[4].strip()
            if not text:
                continue
                
            full_text_parts.append(text)
            
            # Simple heuristic: check if the first line matches a known section keyword (case-insensitive)
            text_upper = text.upper()
            lines = [l.strip() for l in text_upper.split('\n') if l.strip()]
            first_line = lines[0] if lines else ""
            
            is_header = False
            # Clean first line (remove trailing colons etc)
            clean_first = first_line.rstrip(':').strip()
            
            if len(clean_first.split()) <= 4:
                for sec_name, keywords in section_keywords.items():
                    if any(kw == clean_first for kw in keywords):
                        current_section = sec_name
                        is_header = True
                        break
            
            if is_header:
                original_lines = b[4].strip().split('\n')
                rest = "\n".join(original_lines[1:]).strip()
                if rest:
                    sections[current_section] += rest + "\n\n"
            else:
                sections[current_section] += text + "\n\n"
                
    doc.close()
    
    return {
        "full_text": "\n\n".join(full_text_parts),
        "sections": {k: v.strip() for k, v in sections.items() if v.strip()}
    }

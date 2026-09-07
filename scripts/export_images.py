import os
import zlib
import urllib.request
import shutil

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

from generate_plantuml import diagrams

name_mapping = {
    "01_overview": "01_System_Overview",
    "02_class_diagram": "02_Class_Diagram",
    "03_use_case_diagram": "03_Use_Case_Diagram",
    "04_sequence_diagram": "04_Sequence_Diagram",
    "05_activity_diagram": "05_Activity_Diagram",
    "06_object_diagram": "06_Object_Diagram",
    "07_state_chart": "07_State_Chart_Diagram",
    "08_collaboration_diagram": "08_Collaboration_Diagram",
    "09_component_diagram": "09_Component_Diagram",
    "10_deployment_diagram": "10_Deployment_Diagram"
}

def export_all():
    base_dir = os.path.abspath("uml_diagram_images")
    png_dir = os.path.join(base_dir, "png")
    svg_dir = os.path.join(base_dir, "svg")
    os.makedirs(png_dir, exist_ok=True)
    os.makedirs(svg_dir, exist_ok=True)

    print(f"Exporting diagram images to: {base_dir}")

    for key, puml_code in diagrams.items():
        clean_name = name_mapping.get(key, key)
        encoded = deflate_and_encode(puml_code)
        
        # 1. Download PNG
        png_url = f"http://www.plantuml.com/plantuml/png/{encoded}"
        png_path = os.path.join(png_dir, f"{clean_name}.png")
        print(f"Fetching PNG for {clean_name}...")
        try:
            req = urllib.request.Request(png_url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req) as resp, open(png_path, "wb") as out:
                out.write(resp.read())
            print(f"  [OK] Saved PNG: {png_path}")
        except Exception as e:
            print(f"  [FAIL] PNG error for {clean_name}: {e}")

        # 2. Download SVG
        svg_url = f"http://www.plantuml.com/plantuml/svg/{encoded}"
        svg_path = os.path.join(svg_dir, f"{clean_name}.svg")
        print(f"Fetching SVG for {clean_name}...")
        try:
            req = urllib.request.Request(svg_url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req) as resp, open(svg_path, "wb") as out:
                out.write(resp.read())
            print(f"  [OK] Saved SVG: {svg_path}")
        except Exception as e:
            print(f"  [FAIL] SVG error for {clean_name}: {e}")

    # Generate a README index in uml_diagram_images
    readme_path = os.path.join(base_dir, "README.md")
    with open(readme_path, "w", encoding="utf-8") as f:
        f.write("# 📐 InterviewIQ AI — PlantUML Diagram Image Gallery\n\n")
        f.write("This folder contains standalone high-resolution **PNG** and **SVG** images of all UML design diagrams for the system.\n\n")
        f.write("## Folder Structure\n")
        f.write("- `png/`: High-resolution PNG raster images (ready to drag-and-drop into PowerPoint, Google Slides, Word, etc.)\n")
        f.write("- `svg/`: High-quality vector SVG files (lossless scaling for print or zoom)\n\n")
        f.write("## Diagram Index\n\n")
        f.write("| # | Diagram Name | Category | PNG File | SVG File |\n")
        f.write("|---|---|---|---|---|\n")
        for key in sorted(diagrams.keys()):
            clean_name = name_mapping.get(key, key)
            category = "Structural" if any(x in clean_name for x in ["Class", "Object", "Component", "Deployment", "Overview"]) else "Behavioral"
            f.write(f"| {clean_name[:2]} | {clean_name[3:].replace('_', ' ')} | {category} | [`png/{clean_name}.png`](png/{clean_name}.png) | [`svg/{clean_name}.svg`](svg/{clean_name}.svg) |\n")

    print("\nAll diagram images successfully exported to uml_diagram_images/")

if __name__ == "__main__":
    export_all()

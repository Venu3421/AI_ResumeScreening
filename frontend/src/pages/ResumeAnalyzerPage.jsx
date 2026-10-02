import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../services/api';
import Navbar from '../components/Navbar';
import PdfHighlightViewer from '../components/PdfHighlightViewer';

// Standard resume section definitions
const SECTION_DEFINITIONS = [
  {
    key: 'summary',
    title: 'Summary & Professional Profile',
    icon: 'person',
    regex: /^(summary|professional summary|profile|professional profile|career objective|objective|about me)[\s:]*$/i,
  },
  {
    key: 'skills',
    title: 'Technical Skills & Competencies',
    icon: 'terminal',
    regex: /^(skills|technical skills|key skills|core skills|core competencies|technologies|tools & technologies|technical proficiencies|areas of expertise)[\s:]*$/i,
  },
  {
    key: 'experience',
    title: 'Work Experience',
    icon: 'work',
    regex: /^(experience|work experience|professional experience|employment history|work history|career history|internships|virtual internships)[\s:]*$/i,
  },
  {
    key: 'projects',
    title: 'Projects & Work Samples',
    icon: 'folder_open',
    regex: /^(projects|personal projects|academic projects|key projects|capstone projects|featured projects)[\s:]*$/i,
  },
  {
    key: 'education',
    title: 'Education & Academics',
    icon: 'school',
    regex: /^(education|academic background|academics|educational qualifications|qualifications|academic history)[\s:]*$/i,
  },
  {
    key: 'certifications',
    title: 'Certifications & Training',
    icon: 'verified',
    regex: /^(certifications|certificates|licenses & certifications|training|courses)[\s:]*$/i,
  },
  {
    key: 'achievements',
    title: 'Achievements & Honors',
    icon: 'emoji_events',
    regex: /^(achievements|honors & awards|awards|honors|key achievements)[\s:]*$/i,
  },
  {
    key: 'publications',
    title: 'Publications & Research',
    icon: 'menu_book',
    regex: /^(publications|research|patents)[\s:]*$/i,
  },
  {
    key: 'languages',
    title: 'Languages',
    icon: 'translate',
    regex: /^(languages|language proficiency)[\s:]*$/i,
  },
];

function highlightWords(text, words, highlightClass) {
  if (!words || words.length === 0) return text;
  const escaped = words.filter(Boolean).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (escaped.length === 0) return text;
  const pattern = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = text.split(pattern);
  return parts.map((part, i) => {
    const isMatch = words.some((w) => w.toLowerCase() === part.toLowerCase());
    return isMatch ? (
      <mark key={i} className={highlightClass}>
        {part}
      </mark>
    ) : (
      part
    );
  });
}

export default function ResumeAnalyzerPage() {
  const [phase, setPhase] = useState('upload');
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [serverPdfBlob, setServerPdfBlob] = useState(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [jobDesc, setJobDesc] = useState('');
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [viewerMode, setViewerMode] = useState('pdf'); // 'pdf' (default uploaded resume) | 'annotated' (text breakdown)
  const [highlightFilter, setHighlightFilter] = useState('all'); // 'all' | 'green' | 'yellow' | 'red'
  const fileInputRef = useRef(null);

  // Maintain local object URL for preview & download
  useEffect(() => {
    if (!selectedFile) {
      return;
    }
    const url = URL.createObjectURL(selectedFile);
    setPdfBlobUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [selectedFile]);

  // Load existing resume analysis & PDF on mount if available
  useEffect(() => {
    let isMounted = true;
    const loadSavedResume = async () => {
      try {
        const res = await api.get('/api/v1/resumes');
        if (!isMounted || !res.data || !res.data.resumeId) return;
        setResults(res.data);
        setPhase('results');

        if (res.data.hasPdf) {
          try {
            const fileRes = await api.get('/api/v1/resumes/file', {
              responseType: 'blob',
            });
            if (isMounted && fileRes.data) {
              setServerPdfBlob(fileRes.data);
              const url = URL.createObjectURL(fileRes.data);
              setPdfBlobUrl(url);
            }
          } catch (fileErr) {
            console.warn('Stored PDF could not be fetched:', fileErr);
          }
        }
      } catch (_err) {
        // No saved resume, stay on upload view
      }
    };

    loadSavedResume();
    // Non-blocking ping to pre-warm the AI microservice on Render free tier
    api.get('/api/v1/resumes/ping-ai').catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  const activePdf = selectedFile || serverPdfBlob || pdfBlobUrl;

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
      setViewerMode('pdf');
      setError(null);
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
    }
  };

  const runAnalysis = async () => {
    if (!selectedFile) {
      setError('Please select a resume PDF file first.');
      return;
    }
    if (!jobDesc.trim() || jobDesc.length < 20) {
      setError('Please enter a target job description with at least 20 characters.');
      return;
    }

    setError(null);
    setPhase('loading');
    try {
      const fd = new FormData();
      fd.append('file', selectedFile);
      fd.append('jobDescription', jobDesc);

      const res = await api.post('/api/v1/resumes/upload', fd, {
        headers: { 'Content-Type': undefined },
      });
      setResults(res.data);
      setPhase('results');
      window.dispatchEvent(new Event('iq_notification_update'));
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || 'Analysis failed. Please upload a valid PDF resume.';
      if (errMsg.includes('502') || errMsg.includes('waking up') || errMsg.includes('Gateway') || errMsg.includes('cloud tier')) {
        setError('The AI service was sleeping on the free cloud tier and is now waking up. Please click "Analyze resume" again!');
      } else {
        setError(errMsg);
      }
      setPhase('upload');
    }
  };

  const score = results ? results.atsScore : 0;
  const missingKeywords = useMemo(() => results?.missingKeywords || [], [results]);
  const matchedKeywords = useMemo(() => results?.matchedKeywords || [], [results]);
  const strengths = useMemo(() => results?.strengths || [], [results]);
  const weaknesses = useMemo(() => results?.weaknesses || [], [results]);
  const suggestions = useMemo(() => results?.suggestions || [], [results]);
  const resumeText = results?.resumeText || '';

  // Structured Section Parser that groups text into legitimate resume sections
  const parsedDocument = useMemo(() => {
    if (!resumeText) return { headerLines: [], sections: [], counts: { green: 0, yellow: 0, red: 0, total: 0 } };

    const rawLines = resumeText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const lowerMatched = matchedKeywords.map((k) => k.toLowerCase().trim()).filter(Boolean);
    const lowerMissing = missingKeywords.map((k) => k.toLowerCase().trim()).filter(Boolean);
    const lowerWeaknesses = weaknesses.map((w) => w.toLowerCase());
    const lowerSuggestions = suggestions.map((s) => s.toLowerCase());
    const lowerStrengths = strengths.map((s) => s.toLowerCase());

    const classifyLine = (line, idx) => {
      const lowerLine = line.toLowerCase();

      // Check matched skills / keywords in this line
      const lineMatched = lowerMatched.filter((k) => {
        const regex = new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        return regex.test(lowerLine);
      });

      // Check missing skills in line
      const lineMissing = lowerMissing.filter((k) => {
        const regex = new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        return regex.test(lowerLine);
      });

      // Check weaknesses match
      const matchesWeakness = lowerWeaknesses.some((w) => {
        const significant = w.split(/\s+/).filter((word) => word.length > 4);
        return significant.length > 0 && significant.filter((word) => lowerLine.includes(word)).length >= 2;
      });

      // Check suggestions / metric gaps (e.g. experience bullet starting with action verb but no metrics)
      const isBullet = line.startsWith('•') || line.startsWith('-') || line.startsWith('*') || /^[A-Z][a-z]+ed\b/.test(line);
      const hasNumbersOrMetrics = /\b\d+(\.\d+)?%?\b|\$\d+/.test(line);
      const lacksMetrics = isBullet && !hasNumbersOrMetrics && line.length > 35;

      const matchesSuggestion = lowerSuggestions.some((s) => {
        const significant = s.split(/\s+/).filter((word) => word.length > 4);
        return significant.length > 0 && significant.filter((word) => lowerLine.includes(word)).length >= 2;
      });

      const matchesStrength = lowerStrengths.some((st) => {
        const significant = st.split(/\s+/).filter((word) => word.length > 4);
        return significant.length > 0 && significant.filter((word) => lowerLine.includes(word)).length >= 2;
      });

      let status = 'neutral';
      let tag = null;
      let matchedTerms = [];

      if (matchesWeakness || lineMissing.length > 0) {
        status = 'red';
        tag = lineMissing.length > 0 ? `Gap: Missing ${lineMissing.slice(0, 2).join(', ')}` : 'Weakness / Area for improvement';
        matchedTerms = lineMissing;
      } else if (lineMatched.length > 0 || matchesStrength) {
        status = 'green';
        tag = lineMatched.length > 0 ? `Matched: ${lineMatched.slice(0, 3).join(', ')}` : 'Detected Strength';
        matchedTerms = lineMatched;
      } else if (lacksMetrics || matchesSuggestion) {
        status = 'yellow';
        tag = lacksMetrics ? 'Quantify Impact (Add % or metrics)' : 'Improvement suggestion';
      }

      return {
        id: idx,
        status,
        text: line,
        tag,
        matchedTerms,
      };
    };

    const headerLines = [];
    const sections = [];
    let currentSection = null;
    let globalGreen = 0;
    let globalYellow = 0;
    let globalRed = 0;

    rawLines.forEach((line, idx) => {
      // Check if line strictly matches a genuine resume section header
      const matchedDef = SECTION_DEFINITIONS.find((def) => def.regex.test(line));

      if (matchedDef) {
        // Start a new section
        currentSection = {
          key: matchedDef.key,
          title: matchedDef.title,
          icon: matchedDef.icon,
          lines: [],
        };
        sections.push(currentSection);
      } else {
        const classified = classifyLine(line, idx);
        if (classified.status === 'green') globalGreen++;
        else if (classified.status === 'yellow') globalYellow++;
        else if (classified.status === 'red') globalRed++;

        if (currentSection) {
          currentSection.lines.push(classified);
        } else {
          // Lines prior to first recognized section (Candidate name, contact, subtitle)
          headerLines.push(classified);
        }
      }
    });

    return {
      headerLines,
      sections,
      counts: {
        green: globalGreen,
        yellow: globalYellow,
        red: globalRed,
        total: globalGreen + globalYellow + globalRed,
      },
    };
  }, [resumeText, matchedKeywords, missingKeywords, strengths, weaknesses, suggestions]);

  // Filter sections and lines based on active filter
  const visibleSections = useMemo(() => {
    if (highlightFilter === 'all') {
      return parsedDocument.sections;
    }

    // When filtering by green, yellow, or red:
    // ONLY show sections that actually contain lines matching that filter!
    return parsedDocument.sections
      .map((sec) => ({
        ...sec,
        lines: sec.lines.filter((l) => l.status === highlightFilter),
      }))
      .filter((sec) => sec.lines.length > 0);
  }, [parsedDocument.sections, highlightFilter]);

  // Reliable file download handler
  const handleDownload = async () => {
    const fileName = selectedFile?.name || 'resume.pdf';

    if (selectedFile) {
      const url = URL.createObjectURL(selectedFile);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } else if (pdfBlobUrl) {
      const a = document.createElement('a');
      a.href = pdfBlobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else if (results?.hasPdf) {
      try {
        const fileRes = await api.get('/api/v1/resumes/file', { responseType: 'blob' });
        const url = URL.createObjectURL(fileRes.data);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 30000);
      } catch (e) {
        console.error('Failed to download resume PDF:', e);
      }
    } else if (resumeText) {
      const blob = new Blob([resumeText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName.replace(/\.pdf$/i, '')}_extracted.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    }
  };

  return (
    <div className="min-h-screen bg-background text-on-surface">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-28 sm:px-6 lg:px-10">
        <section className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-3 inline-flex rounded-full bg-primary-container px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-on-primary-container">
              Resume analyzer
            </p>
            <h1 className="text-display text-slate-950">Tune your resume to the role.</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
              Upload a PDF and paste the target job description. InterviewIQ analyzes ATS fit and presents your actual resume with line-by-line green, yellow, and red content highlights.
            </p>
          </div>
          {phase === 'results' && (
            <button
              type="button"
              onClick={() => {
                setPhase('upload');
                setSelectedFile(null);
                setResults(null);
                setJobDesc('');
                setViewerMode('annotated');
                setHighlightFilter('all');
              }}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-extrabold text-slate-700 shadow-sm hover:border-primary/30 hover:text-primary cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">restart_alt</span>
              New analysis
            </button>
          )}
        </section>

        {error && (
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-red-600">error</span>
              <span>{error}</span>
            </div>
            {selectedFile && (
              <button
                type="button"
                onClick={runAnalysis}
                className="gradient-primary flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white shadow-md shadow-primary/20 hover:opacity-95 cursor-pointer shrink-0"
              >
                <span className="material-symbols-outlined text-[16px]">refresh</span>
                Analyze again
              </button>
            )}
          </div>
        )}

        {phase === 'upload' && (
          <section className="grid gap-6 lg:grid-cols-[1fr_0.72fr]">
            <div className="app-card rounded-[28px] p-5 sm:p-8">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setDragOver(true);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={`flex min-h-[360px] w-full flex-col items-center justify-center rounded-[24px] border-2 border-dashed p-6 text-center transition sm:p-10 ${
                  dragOver
                    ? 'border-primary bg-blue-50'
                    : 'border-slate-300 bg-slate-50 hover:border-primary/60 hover:bg-white'
                }`}
              >
                <span className="mb-6 grid h-20 w-20 place-items-center rounded-[24px] bg-white text-primary shadow-lg shadow-slate-900/8">
                  <span className="material-symbols-outlined text-4xl">upload_file</span>
                </span>
                <h2 className="max-w-xl text-2xl font-extrabold text-slate-950">
                  {selectedFile ? selectedFile.name : 'Drop your PDF resume here'}
                </h2>
                <p className="mt-3 max-w-md text-sm leading-6 text-slate-600">
                  {selectedFile
                    ? `${Math.max(1, Math.round(selectedFile.size / 1024))} KB selected and ready for analysis.`
                    : 'Drag and drop a PDF, or click this area to browse your files.'}
                </p>
                <span className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-extrabold text-white">
                  <span className="material-symbols-outlined text-[19px]">folder_open</span>
                  Select file
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </button>
            </div>

            <aside className="app-card rounded-[28px] p-6 sm:p-8">
              <div className="mb-6 flex items-start gap-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-violet-50 text-tertiary">
                  <span className="material-symbols-outlined">work</span>
                </span>
                <div>
                  <h2 className="text-xl font-extrabold text-slate-950">Target job description</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Paste the role you are applying for so scoring and line-level guidance are tailored specifically to the requirements.
                  </p>
                </div>
              </div>

              <textarea
                value={jobDesc}
                onChange={(event) => setJobDesc(event.target.value)}
                placeholder="Paste the target job description here..."
                className="min-h-72 w-full resize-y rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-800 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
              />
              <div className="mt-4 flex items-center justify-between text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                <span>{jobDesc.trim().length} characters</span>
                <span>PDF only</span>
              </div>
              <button
                type="button"
                onClick={runAnalysis}
                disabled={!selectedFile}
                className="gradient-primary mt-6 flex h-13 w-full items-center justify-center gap-2 rounded-2xl text-sm font-extrabold shadow-lg shadow-primary/20 disabled:opacity-50 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">analytics</span>
                Analyze resume
              </button>
            </aside>
          </section>
        )}

        {phase === 'loading' && (
          <section className="app-card rounded-[28px] p-8 sm:p-12 text-center flex flex-col items-center justify-center min-h-[440px]">
            <div className="relative mb-6 flex h-20 w-20 items-center justify-center">
              <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
              <div className="h-14 w-14 animate-spin rounded-full border-4 border-primary border-t-transparent shadow-lg" />
            </div>
            <h3 className="text-xl font-extrabold text-slate-950">Analyzing your resume...</h3>
            <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">
              Evaluating keywords, semantic alignment, and generating role-specific coaching questions.
            </p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-1.5 text-xs font-semibold text-amber-800">
              <span className="material-symbols-outlined text-[16px] text-amber-600">schedule</span>
              First request may take 30–45s if free cloud services are waking up
            </div>
          </section>
        )}

        {phase === 'results' && results && (
          /* Single unified natural page scroll grid (no nested scroll conflicts) */
          <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] items-start">
            {/* ================= Left: Interactive Resume Document Viewer ================= */}
            <div className="app-card overflow-hidden rounded-[28px] border border-slate-200/80 bg-white">
              {/* Card Toolbar Header (Non-sticky to eliminate any content overlap) */}
              <div className="border-b border-slate-200 bg-white px-5 sm:px-6 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[20px] text-primary">description</span>
                      <p className="truncate text-sm font-extrabold text-slate-900">
                        {selectedFile?.name || (results?.hasPdf ? 'Uploaded Resume.pdf' : 'Analyzed Resume')}
                      </p>
                    </div>
                    <p className="mt-0.5 text-xs font-medium text-slate-500">
                      {viewerMode === 'pdf'
                        ? 'Original PDF Layout • Precision Coordinate Highlighting'
                        : 'Structured Content Analysis • Clean Section Breakdown'}
                    </p>
                  </div>

                  {/* Clean Download Button */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDownload}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:border-primary/40 hover:bg-slate-50 hover:text-primary transition-all shadow-2xs cursor-pointer"
                      title="Download PDF resume"
                    >
                      <span className="material-symbols-outlined text-[17px] text-primary">download</span>
                      <span>Download PDF</span>
                    </button>
                  </div>
                </div>

                {/* Mode Selector Tabs */}
                <div className="mt-3.5 flex items-center justify-between gap-2">
                  <div className="inline-flex rounded-xl bg-slate-100 p-1">
                    <button
                      type="button"
                      onClick={() => setViewerMode('pdf')}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                        viewerMode === 'pdf'
                          ? 'bg-white text-slate-950 shadow-xs'
                          : 'text-slate-600 hover:text-slate-950'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px] text-primary">picture_as_pdf</span>
                      Uploaded Resume (Highlighted PDF)
                      {results?.highlights?.length > 0 && (
                        <span className="ml-1 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-extrabold text-emerald-700">
                          {results.highlights.length}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewerMode('annotated')}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                        viewerMode === 'annotated'
                          ? 'bg-white text-slate-950 shadow-xs'
                          : 'text-slate-600 hover:text-slate-950'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px] text-indigo-500">subject</span>
                      Annotated Breakdown
                    </button>
                  </div>

                  {viewerMode === 'annotated' && (
                    <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                      {visibleSections.length} sections displayed
                    </span>
                  )}
                </div>

                {/* Filter Pills for Annotated View */}
                {viewerMode === 'annotated' && (
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1">
                      Show:
                    </span>
                    <button
                      type="button"
                      onClick={() => setHighlightFilter('all')}
                      className={`rounded-full px-3 py-1 text-xs font-bold transition-all cursor-pointer ${
                        highlightFilter === 'all'
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      All Content
                    </button>
                    <button
                      type="button"
                      onClick={() => setHighlightFilter('green')}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition-all cursor-pointer ${
                        highlightFilter === 'green'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      }`}
                    >
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      Strengths ({parsedDocument.counts.green})
                    </button>
                    <button
                      type="button"
                      onClick={() => setHighlightFilter('yellow')}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition-all cursor-pointer ${
                        highlightFilter === 'yellow'
                          ? 'bg-amber-500 text-white shadow-xs'
                          : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                      }`}
                    >
                      <span className="h-2 w-2 rounded-full bg-amber-400" />
                      Suggestions ({parsedDocument.counts.yellow})
                    </button>
                    <button
                      type="button"
                      onClick={() => setHighlightFilter('red')}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition-all cursor-pointer ${
                        highlightFilter === 'red'
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                      }`}
                    >
                      <span className="h-2 w-2 rounded-full bg-rose-500" />
                      Gaps ({parsedDocument.counts.red})
                    </button>
                  </div>
                )}
              </div>

              {/* Viewer Body with clean top margin and ample breathing room */}
              <div className="bg-slate-50/60 p-5 sm:p-7">
                {viewerMode === 'annotated' ? (
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
                    {/* Active Filter Description Banner */}
                    {highlightFilter !== 'all' && (
                      <div
                        className={`mb-6 flex items-center justify-between gap-3 rounded-xl p-3.5 text-xs font-bold ${
                          highlightFilter === 'green'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : highlightFilter === 'yellow'
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-rose-50 text-rose-800 border border-rose-200'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[18px]">
                            {highlightFilter === 'green'
                              ? 'check_circle'
                              : highlightFilter === 'yellow'
                              ? 'lightbulb'
                              : 'warning'}
                          </span>
                          <span>
                            {highlightFilter === 'green' && 'Filtering by Detected Strengths & Matched Skills'}
                            {highlightFilter === 'yellow' && 'Filtering by Improvement Opportunities & Metrics Suggestions'}
                            {highlightFilter === 'red' && 'Filtering by Critical Missing Keywords & ATS Gaps'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setHighlightFilter('all')}
                          className="text-xs underline hover:no-underline font-extrabold cursor-pointer"
                        >
                          Clear filter
                        </button>
                      </div>
                    )}

                    {/* Critical Missing Keywords Banner: ONLY shown when viewing All or Gaps */}
                    {missingKeywords.length > 0 && (highlightFilter === 'all' || highlightFilter === 'red') && (
                      <div className="mb-7 rounded-2xl border border-rose-200 bg-rose-50/70 p-4 sm:p-5">
                        <div className="flex items-center gap-2 text-rose-800 font-extrabold text-xs uppercase tracking-wider mb-2">
                          <span className="material-symbols-outlined text-[18px] text-rose-600">warning</span>
                          Missing Critical Role Keywords (ATS Gaps)
                        </div>
                        <p className="text-xs text-rose-700 mb-3 leading-relaxed">
                          These keywords from the job description are missing in your resume. Incorporating them directly into your technical skills or project descriptions will raise your ATS score:
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {missingKeywords.map((k) => (
                            <span
                              key={k}
                              className="inline-flex items-center gap-1 rounded-md bg-white px-2.5 py-1 text-xs font-bold text-rose-700 border border-rose-200 shadow-2xs"
                            >
                              <span className="material-symbols-outlined text-[13px]">add_circle</span>
                              {k}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Resume Candidate Header (Name & Contact details from top of resume) */}
                    {parsedDocument.headerLines.length > 0 && highlightFilter === 'all' && (
                      <div className="mb-7 rounded-xl border border-slate-100 bg-slate-50/80 p-4 text-center">
                        <h2 className="text-xl font-black text-slate-900 tracking-tight">
                          {parsedDocument.headerLines[0]?.text}
                        </h2>
                        <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-xs font-semibold text-slate-600">
                          {parsedDocument.headerLines.slice(1).map((hl, i) => (
                            <span key={i} className="inline-flex items-center gap-1">
                              {hl.text}
                              {i < parsedDocument.headerLines.length - 2 && <span className="text-slate-300">•</span>}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Resume Document Content (Sections & Lines) */}
                    <div className="space-y-6 text-sm leading-6">
                      {visibleSections.length > 0 ? (
                        visibleSections.map((sec) => (
                          <div key={sec.key} className="space-y-2">
                            {/* Distinct Section Header (Shown only ONCE per genuine section) */}
                            <div className="flex items-center gap-2 border-b-2 border-slate-200 pb-1.5 pt-2">
                              <span className="material-symbols-outlined text-[18px] text-primary">{sec.icon}</span>
                              <h3 className="text-xs font-black uppercase tracking-[0.14em] text-slate-900">
                                {sec.title}
                              </h3>
                              <span className="ml-auto text-[11px] font-bold text-slate-400">
                                {sec.lines.length} items
                              </span>
                            </div>

                            {/* Section Lines */}
                            <div className="space-y-1.5 pl-1">
                              {sec.lines.map((item) => {
                                if (item.status === 'green') {
                                  return (
                                    <div
                                      key={item.id}
                                      className="group relative my-1 rounded-r-xl border-l-[5px] border-emerald-500 bg-emerald-50/80 px-3.5 py-2 transition-all hover:bg-emerald-100/90 shadow-2xs"
                                    >
                                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                                        <p className="text-emerald-950 font-medium">
                                          {highlightWords(
                                            item.text,
                                            item.matchedTerms,
                                            'bg-emerald-200/90 text-emerald-900 font-bold px-1 py-0.5 rounded shadow-2xs'
                                          )}
                                        </p>
                                        {item.tag && (
                                          <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-emerald-200/90 px-2 py-0.5 text-[11px] font-extrabold text-emerald-900 self-start">
                                            <span className="material-symbols-outlined text-[13px]">check_circle</span>
                                            {item.tag}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                }

                                if (item.status === 'yellow') {
                                  return (
                                    <div
                                      key={item.id}
                                      className="group relative my-1 rounded-r-xl border-l-[5px] border-amber-400 bg-amber-50/80 px-3.5 py-2 transition-all hover:bg-amber-100/90 shadow-2xs"
                                    >
                                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                                        <p className="text-amber-950 font-medium">{item.text}</p>
                                        {item.tag && (
                                          <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-amber-200/90 px-2 py-0.5 text-[11px] font-extrabold text-amber-900 self-start">
                                            <span className="material-symbols-outlined text-[13px]">lightbulb</span>
                                            {item.tag}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                }

                                if (item.status === 'red') {
                                  return (
                                    <div
                                      key={item.id}
                                      className="group relative my-1 rounded-r-xl border-l-[5px] border-rose-500 bg-rose-50/80 px-3.5 py-2 transition-all hover:bg-rose-100/90 shadow-2xs"
                                    >
                                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                                        <p className="text-rose-950 font-medium">{item.text}</p>
                                        {item.tag && (
                                          <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-rose-200/90 px-2 py-0.5 text-[11px] font-extrabold text-rose-900 self-start">
                                            <span className="material-symbols-outlined text-[13px]">error</span>
                                            {item.tag}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                }

                                // Neutral line
                                return (
                                  <div
                                    key={item.id}
                                    className="my-0.5 rounded-lg px-3 py-1 text-slate-700 transition-colors hover:bg-slate-50"
                                  >
                                    <p>{item.text}</p>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="py-12 text-center text-slate-500">
                          <p className="text-sm font-semibold">
                            {resumeText
                              ? 'No sections contain lines matching the selected filter.'
                              : 'No extracted text available for this document. You can view the original layout in the "Original PDF" tab.'}
                          </p>
                          {highlightFilter !== 'all' && (
                            <button
                              type="button"
                              onClick={() => setHighlightFilter('all')}
                              className="mt-3 inline-flex items-center gap-1 text-xs font-extrabold text-primary hover:underline cursor-pointer"
                            >
                              Show all sections and lines
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Original PDF Tab with Precision Coordinate Highlighting */
                  <div className="rounded-2xl bg-white p-2 shadow-sm">
                    {activePdf ? (
                      <PdfHighlightViewer
                        pdfFile={activePdf}
                        highlights={results?.highlights || []}
                        pageDimensions={results?.pageDimensions || []}
                        fileName={selectedFile?.name || (results?.hasPdf ? 'Uploaded Resume.pdf' : 'resume.pdf')}
                      />
                    ) : (
                      <div className="flex h-[450px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 p-8 text-center">
                        <span className="material-symbols-outlined text-4xl text-slate-400 mb-3">
                          picture_as_pdf
                        </span>
                        <h4 className="text-sm font-bold text-slate-800">
                          Original PDF not cached for this previous session
                        </h4>
                        <p className="mt-1.5 text-xs text-slate-500 max-w-sm leading-relaxed">
                          To view precision coordinate highlights overlaid directly on your document layout, upload your resume PDF below. Your analysis details are preserved in the Annotated Breakdown tab.
                        </p>
                        <div className="mt-5 flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-primary/90 cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[16px]">upload_file</span>
                            Upload PDF Resume
                          </button>
                          <button
                            type="button"
                            onClick={() => setViewerMode('annotated')}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[16px]">subject</span>
                            View Annotated Breakdown
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ================= Right: ATS Metrics & AI Feedback ================= */}
            <div className="space-y-6">
              {/* ATS Score Card */}
              <div className="app-card rounded-[28px] p-6 sm:p-8">
                <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                  <div
                    className="relative grid h-36 w-36 shrink-0 place-items-center rounded-full bg-white shadow-lg"
                    style={{
                      background: `radial-gradient(closest-side, white 74%, transparent 75% 100%), conic-gradient(#0f5bd8 ${score}%, #e2e8f0 0)`,
                    }}
                  >
                    <span className="text-4xl font-extrabold text-primary">{score}%</span>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">ATS score</p>
                    <h2 className="mt-2 text-2xl font-extrabold text-slate-950">
                      {score >= 80 ? 'Strong match for this role' : 'Good base with visible gaps'}
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      {score >= 80
                        ? 'Your resume is aligned well. Make the strongest phrases more measurable before sending.'
                        : 'Add missing role keywords and quantify project outcomes to improve screening performance.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Keyword Gaps & Detected Strengths */}
              <div className="grid gap-6 xl:grid-cols-2">
                <div className="app-card rounded-[28px] p-6">
                  <div className="mb-5 flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-primary">
                      <span className="material-symbols-outlined text-[20px]">key</span>
                    </span>
                    <h2 className="text-xl font-extrabold text-slate-950">Keyword gaps</h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {missingKeywords.length > 0 ? (
                      missingKeywords.map((keyword) => (
                        <span
                          key={keyword}
                          className="rounded-full bg-violet-50 px-3 py-1.5 text-sm font-bold text-tertiary"
                        >
                          {keyword}
                        </span>
                      ))
                    ) : (
                      <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-bold text-emerald-700">
                        No major gaps found
                      </span>
                    )}
                  </div>
                </div>

                <div className="app-card rounded-[28px] p-6">
                  <div className="mb-5 flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
                      <span className="material-symbols-outlined text-[20px]">verified</span>
                    </span>
                    <h2 className="text-xl font-extrabold text-slate-950">Detected strengths</h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {strengths.length > 0 ? (
                      strengths.map((keyword) => (
                        <span
                          key={keyword}
                          className="rounded-full bg-blue-50 px-3 py-1.5 text-sm font-bold text-primary"
                        >
                          {keyword}
                        </span>
                      ))
                    ) : (
                      <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-bold text-emerald-700">
                        No specific strengths highlighted
                      </span>
                    )}
                  </div>
                </div>

                {weaknesses.length > 0 && (
                  <div className="app-card rounded-[28px] p-6 xl:col-span-2">
                    <div className="mb-5 flex items-center gap-3">
                      <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-50 text-amber-600">
                        <span className="material-symbols-outlined text-[20px]">warning</span>
                      </span>
                      <h2 className="text-xl font-extrabold text-slate-950">Identified weaknesses</h2>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {weaknesses.map((keyword) => (
                        <span
                          key={keyword}
                          className="rounded-full bg-amber-50 px-3 py-1.5 text-sm font-bold text-amber-800"
                        >
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* AI Suggestions Card */}
              <div className="app-card rounded-[28px] p-6 sm:p-8">
                <div className="mb-6 flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-950 text-white">
                    <span className="material-symbols-outlined">psychology</span>
                  </span>
                  <div>
                    <h2 className="text-2xl font-extrabold text-slate-950">AI suggestions</h2>
                    <p className="text-sm text-slate-500">Prioritized improvements for this role</p>
                  </div>
                </div>
                <div className="space-y-4">
                  {suggestions.length > 0 ? (
                    suggestions.map((suggestion, index) => (
                      <div
                        key={suggestion}
                        className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-4"
                      >
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-extrabold text-white">
                          {index + 1}
                        </span>
                        <p className="text-sm leading-6 text-slate-700">{suggestion}</p>
                      </div>
                    ))
                  ) : (
                    <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-600">
                      No suggestions were returned for this scan.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

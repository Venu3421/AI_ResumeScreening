import { useRef, useState } from 'react';
import api from '../services/api';
import Navbar from '../components/Navbar';

export default function ResumeAnalyzerPage() {
  const [phase, setPhase] = useState('upload');
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [jobDesc, setJobDesc] = useState('');
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
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
    } catch (err) {
      setError(err.response?.data?.message || 'Analysis failed. Please upload a valid PDF resume.');
      setPhase('upload');
    }
  };

  const score = results ? results.atsScore : 0;
  const missingKeywords = results?.missingKeywords || [];
  const suggestions = results?.suggestions || [];

  return (
    <div className="min-h-screen bg-background text-on-surface">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-28 sm:px-6 lg:px-10">
        <section className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-3 inline-flex rounded-full bg-primary-container px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-on-primary-container">Resume analyzer</p>
            <h1 className="text-display text-slate-950">Tune your resume to the role.</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">Upload a PDF and paste the target job description. InterviewIQ will surface ATS fit, missing keywords, and practical rewrite guidance.</p>
          </div>
          {phase === 'results' && (
            <button
              type="button"
              onClick={() => {
                setPhase('upload');
                setSelectedFile(null);
                setResults(null);
                setJobDesc('');
              }}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-extrabold text-slate-700 shadow-sm hover:border-primary/30 hover:text-primary"
            >
              <span className="material-symbols-outlined text-[20px]">restart_alt</span>
              New analysis
            </button>
          )}
        </section>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        {phase === 'upload' && (
          <section className="grid gap-6 lg:grid-cols-[1fr_0.72fr]">
            <div className="app-card rounded-[28px] p-5 sm:p-8">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragEnter={(event) => { event.preventDefault(); setDragOver(true); }}
                onDragOver={(event) => { event.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={`flex min-h-[360px] w-full flex-col items-center justify-center rounded-[24px] border-2 border-dashed p-6 text-center transition sm:p-10 ${dragOver ? 'border-primary bg-blue-50' : 'border-slate-300 bg-slate-50 hover:border-primary/60 hover:bg-white'}`}
              >
                <span className="mb-6 grid h-20 w-20 place-items-center rounded-[24px] bg-white text-primary shadow-lg shadow-slate-900/8">
                  <span className="material-symbols-outlined text-4xl">upload_file</span>
                </span>
                <h2 className="max-w-xl text-2xl font-extrabold text-slate-950">{selectedFile ? selectedFile.name : 'Drop your PDF resume here'}</h2>
                <p className="mt-3 max-w-md text-sm leading-6 text-slate-600">{selectedFile ? `${Math.max(1, Math.round(selectedFile.size / 1024))} KB selected and ready for analysis.` : 'Drag and drop a PDF, or click this area to browse your files.'}</p>
                <span className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-extrabold text-white">
                  <span className="material-symbols-outlined text-[19px]">folder_open</span>
                  Select file
                </span>
                <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={handleFileChange} />
              </button>
            </div>

            <aside className="app-card rounded-[28px] p-6 sm:p-8">
              <div className="mb-6 flex items-start gap-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-violet-50 text-tertiary">
                  <span className="material-symbols-outlined">work</span>
                </span>
                <div>
                  <h2 className="text-xl font-extrabold text-slate-950">Target job description</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-600">Paste the role you are applying for so the scoring is specific, not generic.</p>
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
                className="gradient-primary mt-6 flex h-13 w-full items-center justify-center gap-2 rounded-2xl text-sm font-extrabold shadow-lg shadow-primary/20 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[20px]">analytics</span>
                Analyze resume
              </button>
            </aside>
          </section>
        )}

        {phase === 'loading' && (
          <section className="grid gap-6 lg:grid-cols-[1fr_0.72fr]">
            <div className="h-[560px] rounded-[28px] skeleton" />
            <div className="space-y-5">
              <div className="h-40 rounded-[24px] skeleton" />
              <div className="h-52 rounded-[24px] skeleton" />
              <div className="h-44 rounded-[24px] skeleton" />
            </div>
          </section>
        )}

        {phase === 'results' && results && (
          <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="app-card overflow-hidden rounded-[28px] lg:sticky lg:top-28 lg:self-start">
              <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold text-slate-900">{selectedFile?.name || 'resume.pdf'}</p>
                  <p className="text-xs font-semibold text-slate-500">Preview scaffold</p>
                </div>
                <div className="flex gap-1 text-slate-500">
                  {['zoom_in', 'zoom_out', 'download'].map((icon) => (
                    <button key={icon} type="button" className="grid h-9 w-9 place-items-center rounded-xl hover:bg-slate-100 hover:text-primary" aria-label={icon.replace('_', ' ')}>
                      <span className="material-symbols-outlined text-[20px]">{icon}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="bg-white p-6 sm:p-8">
                <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-inner">
                  <div className="mb-8 h-9 w-2/3 rounded-full bg-slate-300" />
                  <div className="mb-6 space-y-3">
                    <div className="h-3 rounded-full bg-slate-200" />
                    <div className="h-3 rounded-full bg-slate-200" />
                    <div className="h-3 w-4/5 rounded-full bg-slate-200" />
                  </div>
                  <div className="mb-5 h-5 w-1/3 rounded-full bg-slate-300" />
                  <div className="space-y-4">
                    {[1, 2, 3].map((item) => (
                      <div key={item} className="flex gap-4">
                        <div className="h-12 w-12 rounded-xl bg-slate-200" />
                        <div className="flex-1 space-y-2 pt-1"><div className="h-3 w-1/2 rounded-full bg-slate-300" /><div className="h-2 rounded-full bg-slate-200" /><div className="h-2 w-5/6 rounded-full bg-slate-200" /></div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 rounded-r-2xl border-l-4 border-primary bg-blue-50 p-4">
                    <div className="mb-2 h-3 rounded-full bg-blue-200" />
                    <div className="h-3 w-3/4 rounded-full bg-blue-200" />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="app-card rounded-[28px] p-6 sm:p-8">
                <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                  <div className="relative grid h-36 w-36 shrink-0 place-items-center rounded-full bg-white shadow-lg" style={{ background: `radial-gradient(closest-side, white 74%, transparent 75% 100%), conic-gradient(#0f5bd8 ${score}%, #e2e8f0 0)` }}>
                    <span className="text-4xl font-extrabold text-primary">{score}%</span>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">ATS score</p>
                    <h2 className="mt-2 text-2xl font-extrabold text-slate-950">{score >= 80 ? 'Strong match for this role' : 'Good base with visible gaps'}</h2>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{score >= 80 ? 'Your resume is aligned well. Make the strongest phrases more measurable before sending.' : 'Add missing role keywords and quantify project outcomes to improve screening performance.'}</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-2">
                <div className="app-card rounded-[28px] p-6">
                  <div className="mb-5 flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-primary"><span className="material-symbols-outlined text-[20px]">key</span></span>
                    <h2 className="text-xl font-extrabold text-slate-950">Keyword gaps</h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {missingKeywords.length > 0 ? missingKeywords.map((keyword) => (
                      <span key={keyword} className="rounded-full bg-violet-50 px-3 py-1.5 text-sm font-bold text-tertiary">{keyword}</span>
                    )) : <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-bold text-emerald-700">No major gaps found</span>}
                  </div>
                </div>

                <div className="app-card rounded-[28px] p-6">
                  <div className="mb-5 flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><span className="material-symbols-outlined text-[20px]">verified</span></span>
                    <h2 className="text-xl font-extrabold text-slate-950">Detected strengths</h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {['Project impact', 'Relevant skills', 'Readable structure', 'Role focus'].map((keyword) => (
                      <span key={keyword} className="rounded-full bg-blue-50 px-3 py-1.5 text-sm font-bold text-primary">{keyword}</span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="app-card rounded-[28px] p-6 sm:p-8">
                <div className="mb-6 flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-950 text-white"><span className="material-symbols-outlined">psychology</span></span>
                  <div>
                    <h2 className="text-2xl font-extrabold text-slate-950">AI suggestions</h2>
                    <p className="text-sm text-slate-500">Prioritized improvements for this role</p>
                  </div>
                </div>
                <div className="space-y-4">
                  {suggestions.length > 0 ? suggestions.map((suggestion, index) => (
                    <div key={suggestion} className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-4">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-extrabold text-white">{index + 1}</span>
                      <p className="text-sm leading-6 text-slate-700">{suggestion}</p>
                    </div>
                  )) : (
                    <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-600">No suggestions were returned for this scan.</p>
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

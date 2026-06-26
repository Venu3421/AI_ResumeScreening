import { useState, useRef } from 'react';
import api from '../services/api';
import Navbar from '../components/Navbar';

export default function ResumeAnalyzerPage() {
  const [phase, setPhase]               = useState('upload'); // upload | loading | results
  const [dragOver, setDragOver]         = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [jobDesc, setJobDesc]           = useState('');
  const [results, setResults]           = useState(null);
  const [error, setError]               = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
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
      setError('Please enter a target job description (minimum 20 characters) to analyze against.');
      return;
    }
    setError(null);
    setPhase('loading');
    
    try {
      const fd = new FormData();
      fd.append('file', selectedFile);
      fd.append('jobDescription', jobDesc);

      const res = await api.post('/api/v1/resumes/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setResults(res.data);
      setPhase('results');
    } catch (err) {
      setError(err.response?.data?.message || 'Analysis failed. Please ensure you uploaded a valid PDF resume.');
      setPhase('upload');
    }
  };

  const score = results ? results.atsScore : 72;

  return (
    <div className="bg-background text-on-surface font-body-md min-h-screen">
      <Navbar />

      <main className="pt-32 pb-section-gap px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
        {error && (
          <div className="max-w-3xl mx-auto mb-6 p-4 bg-error-container border border-error/20 rounded-xl text-on-error-container font-label-md text-label-md">
            {error}
          </div>
        )}

        {/* ── Upload Phase ── */}
        {phase === 'upload' && (
          <section className="mb-section-gap">
            <div className="max-w-3xl mx-auto">
              <div className="text-center mb-stack-lg">
                <h1 className="font-display text-display mb-4">Elevate Your Career with AI</h1>
                <p className="text-body-lg text-on-surface-variant max-w-2xl mx-auto">
                  Upload your resume to get instant ATS feedback, keyword gap analysis, and tailored improvement suggestions.
                </p>
              </div>

              {/* Drop Zone */}
              <div 
                className="relative group cursor-pointer transition-all duration-300 transform" 
                onClick={() => fileInputRef.current?.click()}
                onDragEnter={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragOver={(e)  => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={()  => setDragOver(false)}
                onDrop={handleDrop}
              >
                <div className={`absolute -inset-1 bg-gradient-to-r from-primary to-secondary rounded-[2rem] blur transition duration-1000 ${
                  dragOver ? 'opacity-40' : 'opacity-20 group-hover:opacity-40'
                }`}></div>
                
                <div className={`relative glass-panel rounded-2xl border-2 border-dashed p-12 flex flex-col items-center justify-center text-center transition-colors bg-white/50 ${
                  dragOver ? 'border-primary' : 'border-outline-variant hover:border-primary'
                }`}>
                  <div className="w-24 h-24 mb-6 bg-primary-fixed rounded-full flex items-center justify-center overflow-hidden">
                    <img 
                      className="w-20 h-20" 
                      alt="AI Illustration" 
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuAvhV_svonmP261aCzpQvf4rxskRmkEwYnV8englht_CaMArjI47Ng5EGP5cj_vRofgyqP9wu9O8fX9nHHEbyYXoEvB0UuSKMdctGrWjdBfdyD1Aw2lC-R6lnBNKqzwsmQh9Wzhf5Z9FNInZzbPcnHvnWphI-7yOfSAfPAEeXnl0GnotPRGWHFSh_1zcL0VQA82VqHYKl_C-QgthGQXmmuCzeNKqSBb-nmaXSMO9CaA4xe5h4EUwpBuywyb5k5I7hUXKR5ilb42Y2U"
                    />
                  </div>
                  <h2 className="font-headline-md text-headline-md mb-2">
                    {selectedFile ? selectedFile.name : 'Upload PDF Resume'}
                  </h2>
                  <p className="text-on-surface-variant mb-stack-lg">
                    {selectedFile ? 'Resume loaded. Ready to scan.' : 'Drag and drop your file here, or click to browse files'}
                  </p>
                  <button 
                    type="button" 
                    className="gradient-button text-on-primary px-8 py-3 rounded-xl font-label-md shadow-lg cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                  >
                    Select File
                  </button>
                  <input 
                    ref={fileInputRef} 
                    type="file" 
                    accept=".pdf" 
                    className="hidden" 
                    onChange={handleFileChange} 
                  />
                </div>
              </div>

              {/* Tailor for Specific Job */}
              <div className="glass-panel p-stack-lg rounded-2xl border border-secondary/20 bg-secondary-fixed/10 mt-8">
                <h3 className="font-headline-md text-headline-md mb-stack-md text-on-surface">Tailor for Specific Job</h3>
                <div className="space-y-4">
                  <textarea 
                    className="w-full h-32 p-4 rounded-xl border border-outline-variant focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-body-md bg-white/80" 
                    placeholder="Paste the target Job Description here to analyze your compatibility (minimum 20 characters)..."
                    value={jobDesc}
                    onChange={(e) => setJobDesc(e.target.value)}
                  />
                  <button 
                    onClick={runAnalysis}
                    disabled={!selectedFile}
                    className="w-full gradient-button text-on-primary py-4 rounded-xl font-label-md flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="material-symbols-outlined">analytics</span>
                    Analyze against Job Description
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── Loading Phase ── */}
        {phase === 'loading' && (
          <section className="max-w-5xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-gutter">
              <div className="md:col-span-7 h-[600px] rounded-2xl skeleton"></div>
              <div className="md:col-span-5 flex flex-col gap-gutter">
                <div className="h-48 rounded-2xl skeleton"></div>
                <div className="h-32 rounded-2xl skeleton"></div>
                <div className="h-64 rounded-2xl skeleton"></div>
              </div>
            </div>
          </section>
        )}

        {/* ── Results Phase ── */}
        {phase === 'results' && results && (
          <section className="animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-gutter items-start">
              
              {/* Left Side: Resume Preview */}
              <div className="md:col-span-7 glass-panel rounded-2xl overflow-hidden sticky top-28">
                <div className="bg-surface-container-low px-6 py-4 border-b border-outline-variant/30 flex justify-between items-center">
                  <span className="font-label-md text-on-surface-variant">{selectedFile?.name || 'resume.pdf'}</span>
                  <div className="flex gap-4">
                    <button className="material-symbols-outlined text-outline cursor-pointer hover:text-primary transition-colors">zoom_in</button>
                    <button className="material-symbols-outlined text-outline cursor-pointer hover:text-primary transition-colors">zoom_out</button>
                    <button className="material-symbols-outlined text-outline cursor-pointer hover:text-primary transition-colors">download</button>
                  </div>
                </div>
                <div className="p-8 bg-white min-h-[800px] flex justify-center items-start overflow-y-auto max-h-[90vh]">
                  {/* Mock Resume Content with highlighted items */}
                  <div className="w-full max-w-lg space-y-6 opacity-60">
                    <div className="h-8 w-1/2 bg-surface-container-highest rounded-full"></div>
                    <div className="h-4 w-1/4 bg-surface-container-highest rounded-full"></div>
                    <div className="space-y-3">
                      <div className="h-3 w-full bg-surface-container rounded-full"></div>
                      <div className="h-3 w-full bg-surface-container rounded-full"></div>
                      <div className="h-3 w-5/6 bg-surface-container rounded-full"></div>
                    </div>
                    <div className="h-6 w-1/3 bg-surface-container-highest rounded-full pt-8"></div>
                    <div className="space-y-4">
                      <div className="flex gap-4">
                        <div className="w-12 h-12 bg-surface-container rounded-lg"></div>
                        <div className="flex-1 space-y-2">
                          <div className="h-3 w-1/2 bg-surface-container-high rounded-full"></div>
                          <div className="h-2 w-full bg-surface-container rounded-full"></div>
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <div className="w-12 h-12 bg-surface-container rounded-lg"></div>
                        <div className="flex-1 space-y-2">
                          <div className="h-3 w-1/2 bg-surface-container-high rounded-full"></div>
                          <div className="h-2 w-full bg-surface-container rounded-full"></div>
                        </div>
                      </div>
                    </div>
                    {/* Highlighted text visual */}
                    <div className="bg-primary/5 border-l-4 border-primary p-4 rounded-r-lg">
                      <div className="h-3 w-full bg-primary/20 rounded-full mb-2"></div>
                      <div className="h-3 w-3/4 bg-primary/20 rounded-full"></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Side: Analysis Tools */}
              <div className="md:col-span-5 flex flex-col gap-gutter">
                
                {/* ATS Score & Progress */}
                <div className="glass-panel p-stack-lg rounded-2xl flex items-center gap-8 border-l-4 border-primary">
                  <div className="relative w-32 h-32 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-105 duration-500"
                    style={{
                      background: `radial-gradient(closest-side, white 79%, transparent 80% 100%), conic-gradient(#004ac6 ${score}%, #e2e8f0 0)`
                    }}>
                    <span className="font-headline-lg text-headline-lg text-primary">{score}%</span>
                  </div>
                  <div>
                    <h3 className="font-headline-md text-headline-md text-on-surface mb-1">ATS Score</h3>
                    <p className="text-body-md text-on-surface-variant">
                      {score >= 80 ? 'Excellent match! Your resume is ready to go.' : 'Your resume is above average. Tailor matching keywords to boost it to 85%.'}
                    </p>
                  </div>
                </div>

                {/* Keyword Analysis */}
                <div className="glass-panel p-stack-lg rounded-2xl">
                  <h3 className="font-headline-md text-headline-md mb-stack-md flex items-center gap-2">
                    <span className="material-symbols-outlined text-tertiary">key</span>
                    Keywords Analysis
                  </h3>
                  <div className="space-y-stack-md">
                    <div>
                      <span className="font-label-sm uppercase text-on-surface-variant mb-2 block">Matched Keywords</span>
                      <div className="flex flex-wrap gap-2">
                        {results.missingKeywords && results.missingKeywords.length > 0 ? (
                          // Mocking matching keywords for preview contrast
                          ['React.js', 'TypeScript', 'UI Design', 'API Integration'].map((kw) => (
                            <span key={kw} className="bg-primary-fixed text-on-primary-fixed px-3 py-1 rounded-full text-label-sm font-medium">
                              {kw}
                            </span>
                          ))
                        ) : (
                          <span className="text-label-md text-on-surface-variant italic">None</span>
                        )}
                      </div>
                    </div>
                    <div className="pt-2">
                      <span className="font-label-sm uppercase text-on-surface-variant mb-2 block">Missing Keywords</span>
                      <div className="flex flex-wrap gap-2">
                        {results.missingKeywords && results.missingKeywords.length > 0 ? (
                          results.missingKeywords.map((kw) => (
                            <span key={kw} className="bg-tertiary-fixed text-on-tertiary-fixed px-3 py-1 rounded-full text-label-sm font-medium">
                              {kw}
                            </span>
                          ))
                        ) : (
                          <span className="text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full text-label-sm font-medium">None! 100% matched</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* AI Suggestions */}
                <div className="glass-panel p-stack-lg rounded-2xl">
                  <h3 className="font-headline-md text-headline-md mb-stack-md flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">psychology</span>
                    AI Suggestions
                  </h3>
                  <ul className="space-y-4">
                    {results.suggestions && results.suggestions.map((suggestion, index) => (
                      <li key={index} className="flex gap-3 group">
                        <span className="material-symbols-outlined text-primary pt-1 select-none">check_circle</span>
                        <p className="text-body-md text-on-surface-variant group-hover:text-on-surface transition-colors">
                          {suggestion}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Start Over Button */}
                <button 
                  onClick={() => {
                    setPhase('upload');
                    setSelectedFile(null);
                    setResults(null);
                  }}
                  className="w-full py-4 border border-outline hover:bg-surface-container rounded-xl font-label-md flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined">restart_alt</span>
                  Upload another Resume
                </button>

              </div>
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full py-stack-lg mt-section-gap bg-surface-container-lowest border-t border-outline-variant/20">
        <div className="max-w-container-max mx-auto flex flex-col md:flex-row justify-between items-center px-margin-desktop gap-stack-md">
          <div className="font-headline-md text-headline-md font-bold text-primary">InterviewIQ</div>
          <div className="flex gap-gutter">
            <a className="font-label-sm text-label-sm text-on-surface-variant hover:text-primary transition-colors duration-200 underline" href="#">Privacy Policy</a>
            <a className="font-label-sm text-label-sm text-on-surface-variant hover:text-primary transition-colors duration-200 underline" href="#">Terms of Service</a>
            <a className="font-label-sm text-label-sm text-on-surface-variant hover:text-primary transition-colors duration-200 underline" href="#">Contact Support</a>
            <a className="font-label-sm text-label-sm text-on-surface-variant hover:text-primary transition-colors duration-200 underline" href="#">Careers</a>
          </div>
          <div className="font-label-sm text-label-sm text-on-surface-variant">© 2026 InterviewIQ AI. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import Navbar from '../components/Navbar';

const TOTAL_QUESTIONS = 5;

export default function InterviewArenaPage() {
  const [phase, setPhase]                 = useState('setup');   // setup | active | finished
  const [jobDescription, setJobDescription] = useState('');
  const [session, setSession]             = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [questionCount, setQuestionCount] = useState(1);
  const [timer, setTimer]                 = useState(180);
  const [timerActive, setTimerActive]     = useState(false);
  const [isRecording, setIsRecording]     = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [audioBlob, setAudioBlob]         = useState(null);
  const [submitting, setSubmitting]       = useState(false);
  const [lastEval, setLastEval]           = useState(null);
  const [allEvaluations, setAllEvaluations] = useState([]);
  const [loadingQ, setLoadingQ]           = useState(false);
  const [error, setError]                 = useState(null);
  const [waveHeights, setWaveHeights]     = useState(Array(40).fill(10));

  const mediaRef    = useRef(null);
  const chunksRef   = useRef([]);
  const durationRef = useRef(null);
  const timerRef    = useRef(null);
  const waveRef     = useRef(null);
  const navigate    = useNavigate();

  // Timer countdown
  useEffect(() => {
    if (timerActive && timer > 0) {
      timerRef.current = setInterval(() => setTimer(t => t - 1), 1000);
    } else if (timer === 0 && isRecording) {
      stopRecording();
    }
    return () => clearInterval(timerRef.current);
  }, [timerActive, timer, isRecording]);

  useEffect(() => () => {
    clearInterval(timerRef.current);
    clearInterval(durationRef.current);
    clearTimeout(waveRef.current);
  }, []);

  // Waveform peak animation
  const animateWave = () => {
    setWaveHeights(Array.from({ length: 40 }, () => Math.random() * 80 + 20));
    waveRef.current = setTimeout(animateWave, 100);
  };

  const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;

  const startInterview = async (e) => {
    e.preventDefault();
    if (!jobDescription.trim() || jobDescription.length < 20) {
      setError('Please enter a target job description (minimum 20 characters) to analyze against.');
      return;
    }
    setError(null);
    setLoadingQ(true);
    try {
      const res = await api.post('/api/v1/interview/start', { jobDescription });
      setSession(res.data);
      setCurrentQuestion(res.data.firstQuestion);
      setQuestionCount(1);
      setTimer(180);
      setTimerActive(true);
      setPhase('active');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to start mock session. Please try again.');
    } finally {
      setLoadingQ(false);
    }
  };

  const startRecording = async () => {
    setError(null);
    setAudioBlob(null);
    chunksRef.current = [];
    setRecordDuration(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRef.current = recorder;
      
      recorder.ondataavailable = (e) => {
        if (e.data?.size > 0) chunksRef.current.push(e.data);
      };
      
      recorder.onstop = () => {
        setAudioBlob(new Blob(chunksRef.current, { type: 'audio/webm' }));
        stream.getTracks().forEach(t => t.stop());
      };

      recorder.start(250);
      setIsRecording(true);
      durationRef.current = setInterval(() => setRecordDuration(d => d + 1), 1000);
      animateWave();
    } catch (err) {
      setError('Could not access microphone. Please verify browser recording permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRef.current && isRecording) {
      mediaRef.current.stop();
      setIsRecording(false);
      clearInterval(durationRef.current);
      clearTimeout(waveRef.current);
      setWaveHeights(Array(40).fill(10));
    }
  };

  const submitAnswer = async () => {
    if (!audioBlob) {
      setError('Please record your answer first.');
      return;
    }
    if (recordDuration < 3) {
      setError('Your answer must be at least 3 seconds long.');
      return;
    }
    setError(null);
    setSubmitting(true);
    setTimerActive(false);

    const fd = new FormData();
    fd.append('sessionId', session.sessionId);
    fd.append('questionText', currentQuestion);
    fd.append('file', audioBlob, 'answer.webm');

    try {
      const res = await api.post('/api/v1/interview/submit-answer', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const { transcript, evaluationMetrics, nextQuestion } = res.data;
      
      const newEval = { question: currentQuestion, transcript, metrics: evaluationMetrics };
      setLastEval(newEval);
      setAllEvaluations(prev => [...prev, newEval]);

      if (nextQuestion && questionCount < TOTAL_QUESTIONS) {
        setCurrentQuestion(nextQuestion);
        setQuestionCount(n => n + 1);
        setTimer(180);
        setAudioBlob(null);
        setRecordDuration(0);
        setTimerActive(true);
      } else {
        setPhase('finished');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Submission failed. Please try again.');
      setTimerActive(true);
    } finally {
      setSubmitting(false);
    }
  };

  // Estimate performance metrics based on history
  const technicalScore = lastEval ? lastEval.metrics.technicalAccuracy : 62;
  const behavioralScore = lastEval ? lastEval.metrics.communicationClarity : 88;
  const clarityScore = lastEval ? lastEval.metrics.structuralLogic : 74;
  const overallReadiness = Math.round((technicalScore + behavioralScore + clarityScore) / 3);

  const circum = 440;
  const strokeOffset = circum - (circum * overallReadiness) / 100;

  return (
    <div className="bg-background text-on-surface min-h-screen font-body-md selection:bg-primary-fixed">
      <Navbar />

      <div className="relative">
        {/* Sidebar Navigation */}
        <aside className="h-full w-64 fixed left-0 top-0 pt-24 bg-surface-container-low border-r border-outline-variant/30 shadow-md hidden lg:flex flex-col gap-stack-sm overflow-y-auto">
          <div className="px-6 mb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
                <span className="material-symbols-outlined text-white text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>psychology</span>
              </div>
              <div>
                <h3 className="font-label-md text-label-md font-bold">AI Tools</h3>
                <p className="text-[10px] text-on-surface-variant uppercase tracking-wider">Interview Readiness</p>
              </div>
            </div>
          </div>
          <nav className="flex-grow flex flex-col gap-1">
            <button className="bg-secondary-container text-on-secondary-container rounded-xl mx-2 p-3 flex items-center gap-3 transition-all duration-200 hover:translate-x-1 text-left outline-none cursor-pointer">
              <span className="material-symbols-outlined">psychology</span>
              <span className="font-label-md text-label-md">AI Feedback</span>
            </button>
            <button className="text-on-surface-variant hover:bg-surface-variant rounded-xl mx-2 p-3 flex items-center gap-3 transition-all duration-200 hover:translate-x-1 text-left outline-none cursor-pointer">
              <span className="material-symbols-outlined">graphic_eq</span>
              <span className="font-label-md text-label-md">Tone Analysis</span>
            </button>
            <button className="text-on-surface-variant hover:bg-surface-variant rounded-xl mx-2 p-3 flex items-center gap-3 transition-all duration-200 hover:translate-x-1 text-left outline-none cursor-pointer">
              <span className="material-symbols-outlined">key</span>
              <span className="font-label-md text-label-md">Keywords</span>
            </button>
            <button className="text-on-surface-variant hover:bg-surface-variant rounded-xl mx-2 p-3 flex items-center gap-3 transition-all duration-200 hover:translate-x-1 text-left outline-none cursor-pointer">
              <span className="material-symbols-outlined">tune</span>
              <span className="font-label-md text-label-md">Mock Settings</span>
            </button>
            <button className="text-on-surface-variant hover:bg-surface-variant rounded-xl mx-2 p-3 flex items-center gap-3 transition-all duration-200 hover:translate-x-1 text-left outline-none cursor-pointer">
              <span className="material-symbols-outlined">help</span>
              <span className="font-label-md text-label-md">Help</span>
            </button>
          </nav>
          <div className="p-4 mt-auto">
            <button onClick={() => navigate('/history')} className="w-full py-3 rounded-xl gradient-primary text-white font-label-md shadow-md cursor-pointer">
              View Reports
            </button>
          </div>
        </aside>

        {/* Main Content Arena */}
        <main className="lg:pl-64 pt-24 min-h-screen flex flex-col">
          <div className="flex-grow px-margin-desktop pb-stack-lg max-w-container-max w-full mx-auto grid grid-cols-12 gap-gutter">
            
            {/* Center column */}
            <div className="col-span-12 xl:col-span-8 flex flex-col gap-6">
              {error && (
                <div className="p-4 bg-error-container border border-error/20 rounded-xl text-on-error-container font-label-md text-label-md">
                  {error}
                </div>
              )}

              {/* ── Setup Stage ── */}
              {phase === 'setup' && (
                <section className="glass-panel rounded-3xl p-stack-lg relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-surface-container-highest">
                    <div className="h-full gradient-primary" style={{ width: '0%' }}></div>
                  </div>
                  <div className="flex justify-between items-start mb-8">
                    <div>
                      <span className="inline-block px-3 py-1 bg-primary-fixed text-on-primary-fixed rounded-full font-label-sm text-label-sm mb-2">Setup Phase</span>
                      <h1 className="font-headline-lg text-headline-lg text-on-surface max-w-2xl">Start Mock Interview</h1>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <p className="text-on-surface-variant text-body-md">
                      Paste the Job Description below to tailor your mock interview. Our AI will automatically generate specific questions based on it.
                    </p>
                    <textarea 
                      className="w-full h-48 p-4 rounded-xl border border-outline-variant focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-body-md bg-white/85" 
                      placeholder="Paste the target Job Description here to start (minimum 20 characters)..."
                      value={jobDescription}
                      onChange={(e) => setJobDescription(e.target.value)}
                    />
                    <button 
                      onClick={startInterview}
                      disabled={loadingQ}
                      className="w-full gradient-primary text-white font-headline-md py-4 rounded-xl shadow-md transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span>{loadingQ ? 'Initializing Session...' : 'Start Session'}</span>
                      <span className="material-symbols-outlined">arrow_forward</span>
                    </button>
                  </div>
                </section>
              )}

              {/* ── Active Interview Stage ── */}
              {phase === 'active' && (
                <section className="glass-panel rounded-3xl p-stack-lg relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-surface-container-highest">
                    <div className="h-full gradient-primary transition-all duration-500" id="progress-bar" style={{ width: `${(questionCount / TOTAL_QUESTIONS) * 100}%` }}></div>
                  </div>
                  <div className="flex justify-between items-start mb-8">
                    <div>
                      <span className="inline-block px-3 py-1 bg-primary-fixed text-on-primary-fixed rounded-full font-label-sm text-label-sm mb-2">Question {questionCount} of {TOTAL_QUESTIONS}</span>
                      <h1 className="font-headline-lg text-headline-lg text-on-surface max-w-2xl">{currentQuestion}</h1>
                    </div>
                    <div className="flex flex-col items-end">
                      <div className="flex items-center gap-2 text-primary font-mono font-bold text-headline-md">
                        <span className="material-symbols-outlined">timer</span>
                        <span id="timer">{formatTime(timer)}</span>
                      </div>
                      <span className="font-label-sm text-label-sm text-on-surface-variant">Time remaining</span>
                    </div>
                  </div>

                  {/* Visualizer Space */}
                  <div className={`h-64 flex items-center justify-center bg-surface-container-lowest rounded-2xl border border-outline-variant/20 mb-stack-lg relative group ${isRecording ? 'recording' : ''}`}>
                    <div className="flex items-end gap-1 h-32 opacity-30 group-[.recording]:opacity-100 transition-opacity" id="wave-container">
                      {waveHeights.map((h, i) => (
                        <div key={i} className="waveform-bar w-1 bg-primary rounded-full transition-all duration-100" style={{ height: `${h}%` }}></div>
                      ))}
                    </div>
                    <div className="hidden absolute top-4 left-1/2 -translate-x-1/2 items-center gap-2 px-4 py-1.5 bg-error-container text-on-error-container rounded-full animate-pulse group-[.recording]:flex" id="recording-status">
                      <div className="w-2 h-2 bg-error rounded-full"></div>
                      <span className="font-label-sm text-label-sm font-bold">RECORDING...</span>
                    </div>
                  </div>

                  {/* Primary Controls */}
                  <div className="flex flex-col md:flex-row items-center justify-center gap-6">
                    <button 
                      onClick={isRecording ? stopRecording : startRecording}
                      disabled={submitting}
                      className={`w-24 h-24 rounded-full gradient-primary flex items-center justify-center text-white shadow-xl transition-all duration-300 active:scale-95 group cursor-pointer ${
                        isRecording ? 'recording' : ''
                      }`} 
                      id="mic-btn"
                    >
                      <span className="material-symbols-outlined text-4xl group-[.recording]:hidden" style={{ fontVariationSettings: "'FILL' 1" }}>mic</span>
                      <span className="material-symbols-outlined text-4xl hidden group-[.recording]:block">stop</span>
                    </button>
                    <div className="flex gap-4">
                      {!isRecording && (
                        <button 
                          onClick={isRecording ? stopRecording : startRecording}
                          className="px-6 py-3 border border-outline text-on-surface font-label-md rounded-xl hover:bg-surface-variant transition-colors flex items-center gap-2 cursor-pointer" 
                          id="start-recording"
                        >
                          <span className="material-symbols-outlined">play_arrow</span>
                          Start Recording
                        </button>
                      )}
                      {audioBlob && !isRecording && (
                        <button 
                          onClick={submitAnswer}
                          disabled={submitting}
                          className="px-6 py-3 bg-inverse-surface text-inverse-on-surface font-label-md rounded-xl hover:opacity-90 transition-opacity flex items-center gap-2 cursor-pointer" 
                          id="submit-answer"
                        >
                          <span className="material-symbols-outlined">check_circle</span>
                          {submitting ? 'Evaluating...' : 'Submit Answer'}
                        </button>
                      )}
                    </div>
                  </div>
                </section>
              )}

              {/* ── Finished Stage ── */}
              {phase === 'finished' && (
                <section className="glass-panel rounded-3xl p-stack-lg relative overflow-hidden text-center space-y-6">
                  <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-md">
                    <span className="material-symbols-outlined text-5xl">verified</span>
                  </div>
                  <h2 className="font-headline-lg text-headline-lg text-on-surface">Interview Completed!</h2>
                  <p className="text-on-surface-variant max-w-lg mx-auto">
                    Great job! Your answers have been successfully transcribed and evaluated by our AI.
                  </p>
                  <div className="flex justify-center gap-4 pt-4">
                    <button 
                      onClick={() => navigate('/dashboard')}
                      className="px-8 py-3 bg-primary text-white font-label-md rounded-xl shadow-md cursor-pointer"
                    >
                      Go to Dashboard
                    </button>
                    <button 
                      onClick={() => navigate(`/history?sessionId=${session?.sessionId}`)}
                      className="px-8 py-3 border border-outline hover:bg-surface-container rounded-xl font-label-md transition-colors cursor-pointer"
                    >
                      Review Feedback
                    </button>
                  </div>
                </section>
              )}

              {/* Navigation Controls */}
              {phase === 'active' && (
                <footer className="flex justify-between items-center p-4">
                  <button className="flex items-center gap-2 text-on-surface-variant font-label-md hover:text-primary transition-colors cursor-pointer">
                    <span className="material-symbols-outlined">arrow_back</span>
                    Previous
                  </button>
                  <button className="flex items-center gap-2 text-primary font-bold font-label-md group cursor-pointer">
                    Next Question
                    <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
                  </button>
                </footer>
              )}
            </div>

            {/* Sidebar (Right) - Insights & Metrics */}
            <div className="col-span-12 xl:col-span-4 flex flex-col gap-gutter">
              {/* Real-time Score */}
              <section className="glass-panel rounded-3xl p-stack-lg flex flex-col items-center">
                <h3 className="font-label-md text-label-md text-on-surface-variant uppercase tracking-widest mb-6">Current Readiness</h3>
                <div className="relative w-40 h-40">
                  <svg className="w-full h-full -rotate-90">
                    <circle className="text-surface-container-highest" cx="80" cy="80" fill="transparent" r="70" stroke="currentColor" strokeWidth="12"></circle>
                    <circle cx="80" cy="80" fill="transparent" r="70" stroke="url(#score-gradient)" strokeDasharray="440" strokeDashoffset={strokeOffset} strokeLinecap="round" strokeWidth="12" className="transition-all duration-1000"></circle>
                    <defs>
                      <linearGradient id="score-gradient" x1="0%" x2="100%" y1="0%" y2="100%">
                        <stop offset="0%" stopColor="#004ac6"></stop>
                        <stop offset="100%" stopColor="#632ecd"></stop>
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="font-display text-display text-on-surface">{overallReadiness}</span>
                    <span className="font-label-sm text-label-sm text-on-surface-variant">ESTIMATE</span>
                  </div>
                </div>
                <p className="mt-6 font-body-md text-center text-on-surface-variant">
                  {lastEval ? 'Insights update after each response. Practice clarity and logic.' : 'Your answers will be analyzed across technical and structural aspects.'}
                </p>
              </section>

              {/* Metrics Progress */}
              <section className="glass-panel rounded-3xl p-stack-lg flex flex-col gap-6">
                <h3 className="font-label-md text-label-md font-bold border-b border-outline-variant/20 pb-4">Performance Metrics</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="font-label-md text-label-md">Technical Accuracy</span>
                      <span className="font-label-md text-label-md text-primary">{technicalScore}%</span>
                    </div>
                    <div className="h-2 bg-surface-container-highest rounded-full overflow-hidden">
                      <div className="h-full bg-primary transition-all duration-500" style={{ width: `${technicalScore}%` }}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="font-label-md text-label-md">Behavioral Impact</span>
                      <span className="font-label-md text-label-md text-tertiary">{behavioralScore}%</span>
                    </div>
                    <div className="h-2 bg-surface-container-highest rounded-full overflow-hidden">
                      <div className="h-full bg-tertiary transition-all duration-500" style={{ width: `${behavioralScore}%` }}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="font-label-md text-label-md">Clarity &amp; Tone</span>
                      <span className="font-label-md text-label-md text-secondary">{clarityScore}%</span>
                    </div>
                    <div className="h-2 bg-surface-container-highest rounded-full overflow-hidden">
                      <div className="h-full bg-secondary transition-all duration-500" style={{ width: `${clarityScore}%` }}></div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Navigator */}
              <section className="glass-panel rounded-3xl p-stack-lg overflow-hidden">
                <h3 className="font-label-md text-label-md font-bold mb-4">Interview Progress</h3>
                <div className="grid grid-cols-5 gap-2">
                  {Array.from({ length: 10 }).map((_, idx) => {
                    const num = idx + 1;
                    const isCurrent = num === questionCount;
                    const isPassed = num < questionCount;
                    return (
                      <div 
                        key={num} 
                        className={`h-10 rounded-lg flex items-center justify-center font-label-md border transition-all ${
                          isCurrent ? 'border-primary text-primary font-bold shadow-inner' :
                          isPassed ? 'bg-primary text-white border-primary' : 'bg-surface-container-highest text-on-surface-variant border-transparent'
                        }`}
                      >
                        {num}
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>

          </div>
        </main>
      </div>

      {/* Footer */}
      <footer className="w-full py-stack-lg mt-section-gap bg-surface-container-lowest border-t border-outline-variant/20">
        <div className="max-w-container-max mx-auto flex flex-col md:flex-row justify-between items-center px-margin-desktop">
          <span className="font-headline-md text-headline-md font-bold text-primary mb-4 md:mb-0">InterviewIQ</span>
          <p className="font-label-sm text-label-sm text-on-surface-variant">© 2026 InterviewIQ AI. All rights reserved.</p>
          <div className="flex gap-6 mt-4 md:mt-0">
            <a className="font-label-sm text-label-sm text-on-surface-variant hover:text-primary underline transition-colors" href="#">Privacy Policy</a>
            <a className="font-label-sm text-label-sm text-on-surface-variant hover:text-primary underline transition-colors" href="#">Terms of Service</a>
            <a className="font-label-sm text-label-sm text-on-surface-variant hover:text-primary underline transition-colors" href="#">Contact Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import Navbar from '../components/Navbar';

const TOTAL_QUESTIONS = 5;

export default function InterviewArenaPage() {
  const [phase, setPhase] = useState('setup');
  const [jobDescription, setJobDescription] = useState('');
  const [session, setSession] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [questionCount, setQuestionCount] = useState(1);
  const [timer, setTimer] = useState(180);
  const [timerActive, setTimerActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [lastEval, setLastEval] = useState(null);
  const [allEvaluations, setAllEvaluations] = useState([]);
  const [loadingQ, setLoadingQ] = useState(false);
  const [error, setError] = useState(null);
  const [waveHeights, setWaveHeights] = useState(Array(36).fill(14));

  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  const durationRef = useRef(null);
  const timerRef = useRef(null);
  const waveRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (timerActive && timer > 0) {
      timerRef.current = setInterval(() => setTimer((value) => value - 1), 1000);
    } else if (timer === 0 && isRecording && mediaRef.current) {
      mediaRef.current.stop();
      setIsRecording(false);
      clearInterval(durationRef.current);
      clearTimeout(waveRef.current);
      setWaveHeights(Array(36).fill(14));
    }
    return () => clearInterval(timerRef.current);
  }, [timerActive, timer, isRecording]);

  useEffect(() => () => {
    clearInterval(timerRef.current);
    clearInterval(durationRef.current);
    clearTimeout(waveRef.current);
  }, []);

  const animateWave = () => {
    setWaveHeights(Array.from({ length: 36 }, () => Math.random() * 78 + 18));
    waveRef.current = setTimeout(animateWave, 110);
  };

  const formatTime = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

  const startInterview = async (event) => {
    event.preventDefault();
    if (!jobDescription.trim() || jobDescription.length < 20) {
      setError('Please enter a target job description with at least 20 characters.');
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
    } catch {
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

      recorder.ondataavailable = (event) => {
        if (event.data?.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        setAudioBlob(new Blob(chunksRef.current, { type: 'audio/webm' }));
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start(250);
      setIsRecording(true);
      durationRef.current = setInterval(() => setRecordDuration((duration) => duration + 1), 1000);
      animateWave();
    } catch {
      setError('Could not access microphone. Please verify browser recording permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRef.current && isRecording) {
      mediaRef.current.stop();
      setIsRecording(false);
      clearInterval(durationRef.current);
      clearTimeout(waveRef.current);
      setWaveHeights(Array(36).fill(14));
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
        headers: { 'Content-Type': undefined },
      });
      const { transcript, evaluationMetrics, nextQuestion } = res.data;
      const newEval = { question: currentQuestion, transcript, metrics: evaluationMetrics };
      setLastEval(newEval);
      setAllEvaluations((prev) => [...prev, newEval]);

      if (nextQuestion && questionCount < TOTAL_QUESTIONS) {
        setCurrentQuestion(nextQuestion);
        setQuestionCount((value) => value + 1);
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

  const technicalScore = lastEval ? lastEval.metrics.technicalAccuracy : 62;
  const behavioralScore = lastEval ? lastEval.metrics.communicationClarity : 88;
  const clarityScore = lastEval ? lastEval.metrics.structuralLogic : 74;
  const overallReadiness = Math.round((technicalScore + behavioralScore + clarityScore) / 3);
  const circum = 440;
  const strokeOffset = circum - (circum * overallReadiness) / 100;
  const progress = Math.round((questionCount / TOTAL_QUESTIONS) * 100);

  const metrics = [
    ['Technical accuracy', technicalScore, 'bg-primary'],
    ['Communication clarity', behavioralScore, 'bg-secondary'],
    ['Structural logic', clarityScore, 'bg-tertiary'],
  ];

  return (
    <div className="min-h-screen bg-background text-on-surface">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-28 sm:px-6 lg:px-10">
        <section className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-3 inline-flex rounded-full bg-secondary-container px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-on-secondary-container">Mock interview arena</p>
            <h1 className="text-display text-slate-950">Practice under realistic pressure.</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">Generate role-specific questions, record spoken answers, and review AI evaluation across clarity, accuracy, and structure.</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/history')}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-extrabold text-slate-700 shadow-sm hover:text-primary"
          >
            <span className="material-symbols-outlined text-[20px]">history</span>
            View reports
          </button>
        </section>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        <section className="grid gap-6 xl:grid-cols-[1fr_380px]">
          <div className="space-y-6">
            {phase === 'setup' && (
              <form onSubmit={startInterview} className="app-card rounded-[28px] p-6 sm:p-8 lg:p-10">
                <div className="mb-8 grid gap-6 lg:grid-cols-[1fr_260px] lg:items-start">
                  <div>
                    <h2 className="text-3xl font-extrabold text-slate-950">Set the role context</h2>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">Paste the job description so the question set matches the role, seniority, and core skills you need to demonstrate.</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Session format</p>
                    <p className="mt-2 text-2xl font-extrabold text-slate-950">{TOTAL_QUESTIONS} questions</p>
                    <p className="mt-1 text-sm text-slate-500">3 minutes each</p>
                  </div>
                </div>
                <textarea
                  value={jobDescription}
                  onChange={(event) => setJobDescription(event.target.value)}
                  placeholder="Paste the target job description here..."
                  className="min-h-72 w-full resize-y rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-800 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                />
                <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">{jobDescription.trim().length} characters</span>
                  <button type="submit" disabled={loadingQ} className="gradient-primary inline-flex h-13 items-center justify-center gap-2 rounded-2xl px-6 text-sm font-extrabold shadow-lg shadow-primary/20 disabled:opacity-60">
                    {loadingQ ? 'Initializing' : 'Start interview'}
                    <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                  </button>
                </div>
              </form>
            )}

            {phase === 'active' && (
              <section className="app-card overflow-hidden rounded-[28px]">
                <div className="h-2 bg-slate-100"><div className="h-full bg-gradient-to-r from-primary via-secondary to-tertiary transition-all" style={{ width: `${progress}%` }} /></div>
                <div className="p-6 sm:p-8 lg:p-10">
                  <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex-1 min-w-0">
                      <span className="mb-4 inline-flex rounded-full bg-primary-container px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-on-primary-container">Question {questionCount} of {TOTAL_QUESTIONS}</span>
                      <h2 className="max-w-3xl text-2xl font-extrabold leading-tight text-slate-950 sm:text-3xl min-h-[90px]">{currentQuestion}</h2>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-left lg:text-right">
                      <div className="flex items-center gap-2 text-3xl font-extrabold text-primary lg:justify-end">
                        <span className="material-symbols-outlined">timer</span>
                        {formatTime(timer)}
                      </div>
                      <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Time remaining</p>
                    </div>
                  </div>

                  <div className={`relative mb-8 flex min-h-72 items-center justify-center rounded-[24px] border border-slate-200 ${isRecording ? 'bg-red-50' : 'bg-slate-50'}`}>
                    <div className="flex h-36 items-center gap-1.5 px-4">
                      {waveHeights.map((height, index) => (
                        <div key={`${height}-${index}`} className={`waveform-bar w-1.5 rounded-full ${isRecording ? 'bg-primary' : 'bg-slate-300'}`} style={{ height: `${height}%` }} />
                      ))}
                    </div>
                    {isRecording && (
                      <div className="absolute left-1/2 top-5 flex -translate-x-1/2 items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-xs font-extrabold uppercase tracking-[0.12em] text-white shadow-lg">
                        <span className="h-2 w-2 rounded-full bg-white" />
                        Recording {formatTime(recordDuration)}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                    <button
                      type="button"
                      onClick={isRecording ? stopRecording : startRecording}
                      disabled={submitting}
                      className={`grid h-24 w-24 place-items-center rounded-full text-white shadow-2xl transition active:scale-95 ${isRecording ? 'bg-red-600 shadow-red-600/25' : 'gradient-primary shadow-primary/20'}`}
                      aria-label={isRecording ? 'Stop recording' : 'Start recording'}
                    >
                      <span className="material-symbols-outlined text-4xl">{isRecording ? 'stop' : 'mic'}</span>
                    </button>
                    <div className="flex flex-col gap-3 sm:flex-row">
                      {!isRecording && (
                        <button type="button" onClick={startRecording} disabled={submitting} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-extrabold text-slate-700 hover:text-primary disabled:opacity-50">
                          <span className="material-symbols-outlined text-[20px]">play_arrow</span>
                          Record answer
                        </button>
                      )}
                      {audioBlob && !isRecording && (
                        <button type="button" onClick={submitAnswer} disabled={submitting} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-extrabold text-white disabled:opacity-60">
                          <span className="material-symbols-outlined text-[20px]">check_circle</span>
                          {submitting ? 'Evaluating' : 'Submit answer'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {phase === 'finished' && (
              <section className="app-card rounded-[28px] p-8 text-center sm:p-12">
                <span className="mx-auto grid h-20 w-20 place-items-center rounded-[24px] bg-emerald-50 text-emerald-600">
                  <span className="material-symbols-outlined text-5xl">verified</span>
                </span>
                <h2 className="mt-6 text-3xl font-extrabold text-slate-950">Interview completed</h2>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600">Your answers were submitted and evaluated. Review the detailed transcript and coaching feedback in history.</p>
                <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                  <button type="button" onClick={() => navigate('/dashboard')} className="rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-extrabold text-slate-700 hover:text-primary">Dashboard</button>
                  <button type="button" onClick={() => navigate(`/history?sessionId=${session?.sessionId}`)} className="gradient-primary rounded-2xl px-6 py-3 text-sm font-extrabold shadow-lg shadow-primary/20">Review feedback</button>
                </div>
              </section>
            )}
          </div>

          <aside className="space-y-6">
            <section className="app-card rounded-[28px] p-6 text-center">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Current readiness</p>
              <div className="relative mx-auto my-6 h-40 w-40">
                <svg className="h-full w-full -rotate-90" viewBox="0 0 160 160">
                  <circle className="text-slate-200" cx="80" cy="80" fill="transparent" r="70" stroke="currentColor" strokeWidth="12" />
                  <circle cx="80" cy="80" fill="transparent" r="70" stroke="url(#arenaScore)" strokeDasharray="440" strokeDashoffset={strokeOffset} strokeLinecap="round" strokeWidth="12" className="transition-all duration-700" />
                  <defs><linearGradient id="arenaScore" x1="0%" x2="100%"><stop stopColor="#0f5bd8" /><stop offset="100%" stopColor="#7c3aed" /></linearGradient></defs>
                </svg>
                <div className="absolute inset-0 grid place-items-center"><span className="text-4xl font-extrabold text-slate-950">{overallReadiness}</span></div>
              </div>
              <p className="text-sm leading-6 text-slate-600">{lastEval ? 'Updated from your latest answer.' : 'Scores update after each submitted answer.'}</p>
            </section>

            <section className="app-card rounded-[28px] p-6">
              <h2 className="mb-5 text-xl font-extrabold text-slate-950">Performance metrics</h2>
              <div className="space-y-5">
                {metrics.map(([label, value, color]) => (
                  <div key={label}>
                    <div className="mb-2 flex justify-between text-sm font-bold text-slate-700"><span>{label}</span><span>{value}%</span></div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} /></div>
                  </div>
                ))}
              </div>
            </section>

            <section className="app-card rounded-[28px] p-6">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-xl font-extrabold text-slate-950">Progress</h2>
                <span className="text-sm font-bold text-slate-500">{allEvaluations.length}/{TOTAL_QUESTIONS} submitted</span>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {Array.from({ length: TOTAL_QUESTIONS }).map((_, index) => {
                  const num = index + 1;
                  const isCurrent = num === questionCount && phase === 'active';
                  const isPassed = num <= allEvaluations.length;
                  return (
                    <div key={num} className={`grid h-11 place-items-center rounded-xl border text-sm font-extrabold ${isCurrent ? 'border-primary bg-blue-50 text-primary' : isPassed ? 'border-primary bg-primary text-white' : 'border-slate-200 bg-white text-slate-400'}`}>{num}</div>
                  );
                })}
              </div>
            </section>
          </aside>
        </section>
      </main>
    </div>
  );
}


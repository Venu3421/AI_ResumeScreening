import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import api from '../services/api';
import Navbar from '../components/Navbar';
import {
  initCoach,
  runInference,
  resetAggregator,
  addFrame,
  getSummary,
  getCoachingTip,
  dispose,
} from '../utils/mediapipeCoach';

const TOTAL_QUESTIONS = 5;

const isCodingQuestion = (text) => {
  if (!text) return false;
  const t = text.toLowerCase();
  const codingKeywords = [
    'write a function',
    'write code',
    'implement a',
    'implement an',
    'write a query',
    'sql query',
    'select statement',
    'write an algorithm',
    'coding challenge',
    'leetcode',
    'time complexity and write',
    'code snippet',
    'in python',
    'in javascript',
    'in java',
    'in sql',
    'write a method',
    'data structure',
    'class implementation',
    'sql query to',
    'write a program',
  ];
  return codingKeywords.some((kw) => t.includes(kw));
};

const isSqlQuestion = (text) => {
  if (!text) return false;
  const t = text.toLowerCase();
  const sqlKeywords = ['sql', 'query', 'table', 'select', 'join', 'group by', 'schema', 'relational', 'database query'];
  return sqlKeywords.some((kw) => t.includes(kw));
};


export default function InterviewArenaPage() {
  const [phase, setPhase] = useState('setup');
  const [jobDescription, setJobDescription] = useState('');
  const [session, setSession] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [questionCount, setQuestionCount] = useState(1);
  const [timer, setTimer] = useState(180);
  const [timerActive, setTimerActive] = useState(false);

  // Resume session state
  const [searchParams] = useSearchParams();
  const resumeSessionId = searchParams.get('sessionId');
  const [resumingSession, setResumingSession] = useState(Boolean(resumeSessionId));
  const [isResumedSession, setIsResumedSession] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [lastEval, setLastEval] = useState(null);
  const [allEvaluations, setAllEvaluations] = useState([]);
  const [loadingQ, setLoadingQ] = useState(false);
  const [error, setError] = useState(null);
  const [waveHeights, setWaveHeights] = useState(Array(36).fill(14));

  // Code answer mode state
  const [answerMode, setAnswerMode] = useState('voice');
  const [codeText, setCodeText] = useState('');
  const [codeLanguage, setCodeLanguage] = useState('javascript');

  // Settings integration (Seniority, Theme, Speaking Pace)
  const [editorTheme, setEditorTheme] = useState(() => localStorage.getItem('iq_editor_theme') || 'vs-dark');
  const [difficulty, setDifficulty] = useState(() => localStorage.getItem('iq_difficulty') || 'mid');
  const [speechPaceEnabled, setSpeechPaceEnabled] = useState(() => localStorage.getItem('iq_speech_pace') !== 'false');

  useEffect(() => {
    // Non-blocking ping to pre-warm the AI microservice on Render free tier
    api.get('/api/v1/resumes/ping-ai').catch(() => {});

    const handleSettingsChange = (e) => {
      if (!e.detail) return;
      const { key, value } = e.detail;
      if (key === 'editorTheme') setEditorTheme(value);
      if (key === 'difficulty') setDifficulty(value);
      if (key === 'speechPace') setSpeechPaceEnabled(value);
    };
    window.addEventListener('iq_settings_changed', handleSettingsChange);
    return () => window.removeEventListener('iq_settings_changed', handleSettingsChange);
  }, []);

  // Camera & MediaPipe state (Phase 4)
  const [cameraActive, setCameraActive] = useState(false);
  const [coachingTip, setCoachingTip] = useState(null);
  const [presenceSummary, setPresenceSummary] = useState(null);

  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  const durationRef = useRef(null);
  const timerRef = useRef(null);
  const waveRef = useRef(null);
  const navigate = useNavigate();

  // Camera refs (Phase 4)
  const videoRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const inferenceRef = useRef(null);
  /** Tracks whether an audio-only stream was created for MediaRecorder cleanup */
  const audioOnlyStreamRef = useRef(null);

  // ─── Timer effect ────────────────────────────────────────────────────────
  useEffect(() => {
    if (timerActive && timer > 0) {
      timerRef.current = setInterval(() => setTimer((value) => value - 1), 1000);
    } else if (timer === 0 && isRecording && mediaRef.current) {
      // Timer expired — force-stop recording (including MediaPipe)
      if (inferenceRef.current) {
        clearInterval(inferenceRef.current);
        inferenceRef.current = null;
      }
      setPresenceSummary(getSummary());
      setCoachingTip(null);

      mediaRef.current.stop();
      setIsRecording(false);
      clearInterval(durationRef.current);
      clearTimeout(waveRef.current);
      setWaveHeights(Array(36).fill(14));
    }
    return () => clearInterval(timerRef.current);
  }, [timerActive, timer, isRecording]);

  // ─── Camera lifecycle: start on 'active' phase, cleanup on exit ──────────
  useEffect(() => {
    let mounted = true;

    if (phase === 'active') {
      (async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 320 }, height: { ideal: 240 } },
            audio: true,
          });
          if (!mounted) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          cameraStreamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
          setCameraActive(true);
          // Pre-load the FaceLandmarker model in background
          initCoach();
        } catch {
          // Camera not available or denied — interview proceeds audio-only.
          // Audio will be requested per-recording in startRecording().
        }
      })();
    }

    return () => {
      mounted = false;
      // Cleanup camera and MediaPipe on phase change or unmount
      if (inferenceRef.current) {
        clearInterval(inferenceRef.current);
        inferenceRef.current = null;
      }
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((t) => t.stop());
        cameraStreamRef.current = null;
      }
      setCameraActive(false);
      setCoachingTip(null);
      dispose();
    };
  }, [phase]);

  // ─── Cleanup all intervals on unmount ────────────────────────────────────
  useEffect(() => () => {
    clearInterval(timerRef.current);
    clearInterval(durationRef.current);
    clearTimeout(waveRef.current);
    clearInterval(inferenceRef.current);
  }, []);

  // ─── Resume session effect (when ?sessionId=... is present) ──────────────
  useEffect(() => {
    if (!resumeSessionId) return;

    let isMounted = true;
    const loadResumeSession = async () => {
      try {
        setResumingSession(true);
        setError(null);
        const res = await api.get(`/api/v1/interview/sessions/${resumeSessionId}`);
        if (!isMounted) return;
        const sessionData = res.data;

        // Check if session is already completed
        if (sessionData.status === 'COMPLETED') {
          setError('This mock interview session has already been completed.');
          return;
        }

        // Check 24-hour expiration limit
        const ONE_DAY_MS = 24 * 60 * 60 * 1000;
        const createdTime = new Date(sessionData.createdAt).getTime();
        if (Date.now() - createdTime > ONE_DAY_MS) {
          setError('This interview session has expired. Mock interview sessions can only be resumed within 24 hours of creation.');
          return;
        }

        const logs = sessionData.logs || [];
        const answeredLogs = logs.filter((l) => l.transcript != null);
        const pendingLog = logs.find((l) => l.transcript == null);

        // If all 5 questions were answered but status not yet marked completed
        if (!pendingLog && answeredLogs.length >= TOTAL_QUESTIONS) {
          setPhase('finished');
          return;
        }

        // Restore evaluation history so sidebar and summary reflect previous questions
        const restoredEvaluations = answeredLogs.map((l) => ({
          question: l.questionText,
          transcript: l.transcript,
          metrics: l.evaluationMetrics,
        }));
        setAllEvaluations(restoredEvaluations);
        if (restoredEvaluations.length > 0) {
          setLastEval(restoredEvaluations[restoredEvaluations.length - 1]);
        }

        // Determine the next question to answer
        const nextQ = pendingLog ? pendingLog.questionText : logs[logs.length - 1]?.questionText || '';
        setCurrentQuestion(nextQ);
        if (isCodingQuestion(nextQ)) {
          setAnswerMode('code');
          if (isSqlQuestion(nextQ)) {
            setCodeLanguage('sql');
          }
        }
        setQuestionCount(answeredLogs.length + 1);

        // Populate session state (providing both id and sessionId for compatibility)
        setSession({
          id: sessionData.id,
          sessionId: sessionData.id,
          jobDescription: sessionData.jobDescription,
          status: sessionData.status,
        });
        setJobDescription(sessionData.jobDescription);
        setIsResumedSession(true);
        setTimer(180);
        setTimerActive(true);
        setPhase('active');
      } catch (err) {
        if (isMounted) {
          setError(err.response?.data?.message || 'Failed to resume interview session.');
        }
      } finally {
        if (isMounted) {
          setResumingSession(false);
        }
      }
    };

    loadResumeSession();

    return () => {
      isMounted = false;
    };
  }, [resumeSessionId]);

  // ─── Waveform animation ──────────────────────────────────────────────────
  const animateWave = () => {
    setWaveHeights(Array.from({ length: 36 }, () => Math.random() * 78 + 18));
    waveRef.current = setTimeout(animateWave, 110);
  };

  const formatTime = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

  // ─── Start interview ────────────────────────────────────────────────────
  const startInterview = async (event) => {
    event.preventDefault();
    if (!jobDescription.trim() || jobDescription.length < 20) {
      setError('Please enter a target job description with at least 20 characters.');
      return;
    }

    setError(null);
    setLoadingQ(true);
    try {
      let finalJd = jobDescription.trim();
      const currentDiff = difficulty || localStorage.getItem('iq_difficulty') || 'mid';
      const seniorityTag = currentDiff === 'junior'
        ? 'Junior Level (0-2 years experience)'
        : currentDiff === 'senior'
        ? 'Senior Level (5+ years experience, architectural & system design depth)'
        : 'Mid-Level (2-5 years experience)';
      if (!finalJd.toLowerCase().includes('seniority') && !finalJd.toLowerCase().includes('junior') && !finalJd.toLowerCase().includes('senior')) {
        finalJd += `\n\n[Target Seniority Level: ${seniorityTag}]`;
      }

      const res = await api.post('/api/v1/interview/start', { jobDescription: finalJd });
      const firstQ = res.data.firstQuestion;
      setSession(res.data);
      setCurrentQuestion(firstQ);
      if (isCodingQuestion(firstQ)) {
        setAnswerMode('code');
        if (isSqlQuestion(firstQ)) {
          setCodeLanguage('sql');
        }
      } else {
        setAnswerMode('voice');
      }
      setQuestionCount(1);
      setTimer(180);
      setTimerActive(true);
      setPhase('active');
      window.dispatchEvent(new Event('iq_notification_update'));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to start mock session. Please try again.');
    } finally {
      setLoadingQ(false);
    }
  };

  // ─── Start recording ────────────────────────────────────────────────────
  const startRecording = async () => {
    setError(null);
    setAudioBlob(null);
    chunksRef.current = [];
    setRecordDuration(0);
    setPresenceSummary(null);
    audioOnlyStreamRef.current = null;

    let audioStream;

    if (cameraStreamRef.current) {
      // Camera mode: extract audio tracks from the persistent camera stream.
      // The camera stream stays alive across recordings — don't stop its tracks.
      const audioTracks = cameraStreamRef.current.getAudioTracks();
      if (audioTracks.length > 0) {
        audioStream = new MediaStream(audioTracks);
      }
    }

    if (!audioStream) {
      // Audio-only fallback: request microphone separately
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioStream = stream;
        audioOnlyStreamRef.current = stream;
      } catch {
        setError('Could not access microphone. Please verify browser recording permissions.');
        return;
      }
    }

    const recorder = new MediaRecorder(audioStream, { mimeType: 'audio/webm' });
    mediaRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data?.size > 0) chunksRef.current.push(event.data);
    };

    recorder.onstop = () => {
      setAudioBlob(new Blob(chunksRef.current, { type: 'audio/webm' }));
      // In audio-only mode, stop the standalone audio stream.
      // In camera mode, audio tracks belong to the persistent camera stream — don't stop them.
      if (audioOnlyStreamRef.current) {
        audioOnlyStreamRef.current.getTracks().forEach((track) => track.stop());
        audioOnlyStreamRef.current = null;
      }
    };

    recorder.start(250);
    setIsRecording(true);
    durationRef.current = setInterval(() => setRecordDuration((duration) => duration + 1), 1000);
    animateWave();

    // Start MediaPipe inference loop if camera is active (~3.3 fps / 300ms interval)
    if (cameraStreamRef.current) {
      const ready = await initCoach();
      if (ready) {
        resetAggregator();
        inferenceRef.current = setInterval(() => {
          if (videoRef.current && videoRef.current.readyState >= 2) {
            const signals = runInference(videoRef.current);
            if (signals) {
              addFrame(signals);
              setCoachingTip(getCoachingTip(signals));
            }
          }
        }, 300);
      }
    }
  };

  // ─── Stop recording ──────────────────────────────────────────────────────
  const stopRecording = () => {
    if (mediaRef.current && isRecording) {
      // Finalize MediaPipe summary before stopping
      if (inferenceRef.current) {
        clearInterval(inferenceRef.current);
        inferenceRef.current = null;
      }
      setPresenceSummary(getSummary());
      setCoachingTip(null);

      mediaRef.current.stop();
      setIsRecording(false);
      clearInterval(durationRef.current);
      clearTimeout(waveRef.current);
      setWaveHeights(Array(36).fill(14));
    }
  };

  // ─── Shared post-submit handler ───────────────────────────────────────────
  const handlePostSubmit = (resData) => {
    const { transcript, evaluationMetrics, nextQuestion } = resData;
    const newEval = { question: currentQuestion, transcript, metrics: evaluationMetrics };
    setLastEval(newEval);
    setAllEvaluations((prev) => [...prev, newEval]);

    if (nextQuestion && questionCount < TOTAL_QUESTIONS) {
      setCurrentQuestion(nextQuestion);
      setQuestionCount((value) => value + 1);
      setTimer(180);
      setAudioBlob(null);
      setRecordDuration(0);
      setPresenceSummary(null);
      setCodeText('');
      if (isCodingQuestion(nextQuestion)) {
        setAnswerMode('code');
        if (isSqlQuestion(nextQuestion)) {
          setCodeLanguage('sql');
        }
      } else {
        setAnswerMode('voice');
      }
      setTimerActive(true);
    } else {
      setPhase('finished');
    }
    window.dispatchEvent(new Event('iq_notification_update'));
  };

  // ─── Submit voice answer ─────────────────────────────────────────────────
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
    fd.append('questionText', currentQuestion ? currentQuestion.trim() : '');
    fd.append('file', audioBlob, 'answer.webm');
    fd.append('durationSeconds', String(recordDuration));

    // Append camera-derived presence metrics if available (Phase 4).
    // Only sent when camera was active AND MediaPipe captured enough usable frames.
    // When absent, backend keeps these fields null (same as audio-only).
    if (presenceSummary) {
      fd.append('interviewPresence', String(presenceSummary.interviewPresence));
      fd.append('eyeContact', String(presenceSummary.eyeContact));
      fd.append('bodyLanguage', String(presenceSummary.bodyLanguage));
      if (presenceSummary.facialComposure != null) {
        fd.append('facialComposure', String(presenceSummary.facialComposure));
      }
    }

    try {
      const res = await api.post('/api/v1/interview/submit-answer', fd, {
        headers: { 'Content-Type': undefined },
      });
      handlePostSubmit(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Submission failed. Please try again.');
      setTimerActive(true);
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Submit code answer ──────────────────────────────────────────────────
  const submitCodeAnswer = async () => {
    if (codeText.trim().length < 10) {
      setError('Your code answer must be at least 10 characters.');
      return;
    }

    setError(null);
    setSubmitting(true);
    setTimerActive(false);

    const fd = new FormData();
    fd.append('sessionId', session.sessionId);
    fd.append('questionText', currentQuestion ? currentQuestion.trim() : '');
    fd.append('codeAnswer', codeText);
    fd.append('codeLanguage', codeLanguage);

    try {
      const res = await api.post('/api/v1/interview/submit-answer', fd, {
        headers: { 'Content-Type': undefined },
      });
      handlePostSubmit(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Code submission failed. Please try again.');
      setTimerActive(true);
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Sidebar metric derivation ───────────────────────────────────────────
  const technicalScore = lastEval?.metrics?.technicalScore;
  const communicationScore = lastEval?.metrics?.communicationScore;
  const professionalism = lastEval?.metrics?.professionalism;
  const confidence = lastEval?.metrics?.confidence;
  const speakingPace = lastEval?.metrics?.speakingPace;
  
  const interviewPresence = lastEval?.metrics?.interviewPresence;
  const eyeContact = lastEval?.metrics?.eyeContact;
  const bodyLanguage = lastEval?.metrics?.bodyLanguage;
  const facialComposure = lastEval?.metrics?.facialComposure;

  let overallReadiness = 0;
  if (lastEval) {
      const scores = [
        technicalScore,
        communicationScore,
        professionalism,
        confidence,
        speechPaceEnabled ? speakingPace : null,
        interviewPresence,
        eyeContact,
        bodyLanguage,
        facialComposure
      ].filter(s => s != null);
      if (scores.length > 0) {
          overallReadiness = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
      }
  }

  const circum = 440;
  const strokeOffset = circum - (circum * overallReadiness) / 100;
  const progress = Math.round((questionCount / TOTAL_QUESTIONS) * 100);

  // Core metrics always show (with '—' if no answer submitted yet)
  const coreMetrics = [
    ['Technical Score', technicalScore, 'bg-primary'],
    ['Communication', communicationScore, 'bg-secondary'],
    ['Professionalism', professionalism, 'bg-tertiary'],
    ['Confidence', confidence, 'bg-blue-500'],
    ['Speaking Pace', speakingPace, 'bg-indigo-500'],
  ].filter(([name, value]) => {
    if (name === 'Speaking Pace' && !speechPaceEnabled) return false;
    return !lastEval || value != null;
  });

  // Camera metrics only show if they were populated
  const cameraMetrics = [
    ['Interview Presence', interviewPresence, 'bg-emerald-500'],
    ['Eye Contact', eyeContact, 'bg-teal-500'],
    ['Body Language', bodyLanguage, 'bg-cyan-500'],
    ['Facial Composure', facialComposure, 'bg-rose-500']
  ].filter(([_, value]) => value != null);

  const metrics = [...coreMetrics, ...cameraMetrics];

  // ─── Render ──────────────────────────────────────────────────────────────
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
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">
            <div className="flex items-center gap-2 font-bold">
              <span className="material-symbols-outlined text-[20px]">error</span>
              {error}
            </div>
            {resumeSessionId && (
              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/history')}
                  className="rounded-xl bg-white px-4 py-2 text-xs font-bold text-slate-700 border border-slate-200 hover:bg-slate-50"
                >
                  View Past Sessions
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    navigate('/interview', { replace: true });
                  }}
                  className="rounded-xl bg-slate-950 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
                >
                  Start New Interview
                </button>
              </div>
            )}
          </div>
        )}

        <section className="grid gap-6 xl:grid-cols-[1fr_380px]">
          <div className="space-y-6">
            {resumingSession ? (
              <div className="app-card flex min-h-[400px] flex-col items-center justify-center rounded-[28px] p-8 text-center">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                <h2 className="mt-6 text-xl font-extrabold text-slate-950">Resuming your interview session...</h2>
                <p className="mt-2 max-w-md text-sm text-slate-500">Retrieving previous question responses, evaluation metrics, and coaching history.</p>
              </div>
            ) : phase === 'setup' ? (
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
                    <div className="mt-3 border-t border-slate-200 pt-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Seniority Target</p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className={`inline-block h-2 w-2 rounded-full ${difficulty === 'senior' ? 'bg-purple-500' : difficulty === 'junior' ? 'bg-emerald-500' : 'bg-primary'}`} />
                        <span className="text-xs font-extrabold capitalize text-slate-800">{difficulty} Level</span>
                        <span className="text-[10px] text-slate-400">(⚙️ settings)</span>
                      </div>
                    </div>
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
            ) : null}

            {phase === 'active' && (
              <section className="app-card overflow-hidden rounded-[28px]">
                <div className="h-2 bg-slate-100"><div className="h-full bg-gradient-to-r from-primary via-secondary to-tertiary transition-all" style={{ width: `${progress}%` }} /></div>
                <div className="p-6 sm:p-8 lg:p-10">
                  <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="mb-4 flex flex-wrap items-center gap-2">
                        <span className="inline-flex rounded-full bg-primary-container px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-on-primary-container">Question {questionCount} of {TOTAL_QUESTIONS}</span>
                        <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${
                          difficulty === 'senior' ? 'bg-purple-100 text-purple-800' : difficulty === 'junior' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-800'
                        }`}>
                          <span className="material-symbols-outlined text-[14px]">tune</span>
                          {difficulty.toUpperCase()}
                        </span>
                        {isCodingQuestion(currentQuestion) && (
                          <span
                            id="coding-challenge-badge"
                            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold ${
                              isSqlQuestion(currentQuestion)
                                ? 'border-amber-300 bg-amber-50 text-amber-800'
                                : 'border-indigo-200 bg-indigo-50 text-indigo-700'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[14px]">
                              {isSqlQuestion(currentQuestion) ? 'database' : 'terminal'}
                            </span>
                            {isSqlQuestion(currentQuestion) ? 'SQL Challenge' : 'Coding Challenge'}
                          </span>
                        )}
                        {isResumedSession && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-blue-50 px-3 py-1 text-xs font-bold text-primary">
                            <span className="material-symbols-outlined text-[14px]">sync</span>
                            Resumed Session
                          </span>
                        )}
                      </div>
                      <h2 className="max-w-3xl text-2xl font-extrabold leading-tight text-slate-950 sm:text-3xl min-h-[90px] whitespace-pre-line">{currentQuestion}</h2>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-left lg:text-right">
                      <div className="flex items-center gap-2 text-3xl font-extrabold text-primary lg:justify-end">
                        <span className="material-symbols-outlined">timer</span>
                        {formatTime(timer)}
                      </div>
                      <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Time remaining</p>
                    </div>
                  </div>

                  {/* Answer mode toggle */}
                  <div className="mb-6 flex items-center justify-center">
                    <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
                      <button
                        type="button"
                        onClick={() => setAnswerMode('voice')}
                        disabled={isRecording || submitting}
                        className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-extrabold transition ${
                          answerMode === 'voice'
                            ? 'bg-white text-primary shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[18px]">mic</span>
                        Voice answer
                      </button>
                      <button
                        type="button"
                        onClick={() => setAnswerMode('code')}
                        disabled={isRecording || submitting}
                        className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-extrabold transition ${
                          answerMode === 'code'
                            ? 'bg-white text-primary shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[18px]">code</span>
                        Code answer
                        {isCodingQuestion(currentQuestion) && (
                          <span className="ml-1 rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-indigo-700">
                            Recommended
                          </span>
                        )}
                      </button>
                    </div>
                  </div>

                  {answerMode === 'voice' ? (
                    <>
                      {/* Recording area with waveform, camera preview, and coaching tip */}
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

                        {/* Camera preview — PiP overlay in bottom-right corner */}
                        {/* Always rendered during active phase for ref availability; */}
                        {/* visually hidden via opacity when camera is not active */}
                        <div className={`absolute bottom-3 right-3 overflow-hidden rounded-2xl border-2 border-white/80 shadow-lg transition-opacity duration-500 ${cameraActive ? 'opacity-100' : 'pointer-events-none opacity-0'}`}>
                          <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            width={160}
                            height={120}
                            className="h-[120px] w-[160px] bg-slate-900 object-cover"
                            style={{ transform: 'scaleX(-1)' }}
                          />
                        </div>

                        {/* Coaching tip pill — bottom-left, only during active recording */}
                        {isRecording && coachingTip && (
                          <div className="absolute bottom-3 left-3 flex max-w-[240px] items-center gap-1.5 rounded-full bg-slate-900/80 px-3 py-1.5 text-xs font-semibold text-white shadow-md backdrop-blur-sm transition-opacity duration-500">
                            <span className="material-symbols-outlined text-[14px] text-amber-400">tips_and_updates</span>
                            <span>{coachingTip}</span>
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
                    </>
                  ) : (
                    <>
                      {/* Code answer editor */}
                      <div className="mb-4 flex items-center gap-3">
                        <label htmlFor="code-language" className="text-sm font-bold text-slate-700">Language</label>
                        <select
                          id="code-language"
                          value={codeLanguage}
                          onChange={(e) => setCodeLanguage(e.target.value)}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                        >
                          <option value="javascript">JavaScript</option>
                          <option value="python">Python</option>
                          <option value="java">Java</option>
                          <option value="cpp">C++</option>
                          <option value="sql">SQL</option>
                          <option value="pseudocode">Pseudocode</option>
                        </select>
                      </div>

                      <div className="mb-4 overflow-hidden rounded-[24px] border border-slate-200">
                        <Editor
                          height="320px"
                          language={codeLanguage === 'pseudocode' ? 'plaintext' : codeLanguage}
                          value={codeText}
                          onChange={(value) => setCodeText(value || '')}
                          theme={editorTheme}
                          options={{
                            minimap: { enabled: false },
                            fontSize: 14,
                            lineNumbers: 'on',
                            scrollBeyondLastLine: false,
                            wordWrap: 'on',
                            padding: { top: 16, bottom: 16 },
                            automaticLayout: true,
                          }}
                        />
                      </div>

                      <div className="mb-6 flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                          {codeText.split('\n').length} lines · {codeText.length} chars
                        </span>
                        <button
                          type="button"
                          onClick={submitCodeAnswer}
                          disabled={submitting || codeText.trim().length < 10}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-extrabold text-white disabled:opacity-60"
                        >
                          <span className="material-symbols-outlined text-[20px]">check_circle</span>
                          {submitting ? 'Evaluating' : 'Submit code answer'}
                        </button>
                      </div>
                    </>
                  )}
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
                    <div className="mb-2 flex justify-between text-sm font-bold text-slate-700">
                      <span>{label}</span>
                      <span>{value != null ? `${value}%` : (lastEval ? 'N/A' : '—')}</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full rounded-full ${value != null ? color : 'bg-slate-200'}`} style={{ width: `${value != null ? value : 0}%` }} />
                    </div>
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

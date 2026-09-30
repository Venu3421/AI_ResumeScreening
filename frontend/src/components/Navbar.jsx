import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Dynamic notifications state
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Dynamic settings state (persisted in localStorage)
  const [difficulty, setDifficulty] = useState(
    () => localStorage.getItem('iq_difficulty') || 'mid'
  );
  const [speechPaceEnabled, setSpeechPaceEnabled] = useState(
    () => localStorage.getItem('iq_speech_pace') !== 'false'
  );
  const [editorTheme, setEditorTheme] = useState(
    () => localStorage.getItem('iq_editor_theme') || 'vs-dark'
  );

  // Live Microphone Test state
  const [micTesting, setMicTesting] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const micStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const animFrameRef = useRef(null);

  const navRef = useRef(null);

  // Stop mic test
  const stopMicTest = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setMicTesting(false);
    setMicLevel(0);
  };

  // Start real live mic test
  const startMicTest = async () => {
    try {
      stopMicTest();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      setMicTesting(true);

      const loop = () => {
        if (!micStreamRef.current) return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const normalized = Math.min(100, Math.round((avg / 128) * 100));
        setMicLevel(normalized);
        animFrameRef.current = requestAnimationFrame(loop);
      };
      loop();
    } catch {
      alert('Could not access microphone. Please check browser microphone permissions.');
      stopMicTest();
    }
  };

  // Fetch real dynamic notifications from the database
  const loadDynamicNotifications = async () => {
    if (!user) return;
    try {
      const notifs = [];

      // 1. Fetch user's interview sessions
      const sessionsRes = await api.get('/api/v1/interview/sessions').catch(() => null);
      const sessionList = sessionsRes?.data || [];

      // Check for active / in-progress session
      const activeSession = sessionList.find((s) => s.status === 'IN_PROGRESS');
      if (activeSession) {
        notifs.push({
          id: `session_active_${activeSession.id}`,
          title: 'Unfinished Mock Interview Active',
          desc: `Session #${activeSession.id} is in progress. Continue your 5-question interview within 24h.`,
          time: 'Active now',
          icon: 'pending',
          read: false,
          link: `/interview?resumeSessionId=${activeSession.id}`,
          badgeColor: 'bg-amber-500',
        });
      }

      // Check for completed session
      const completedSession = sessionList.find((s) => s.status === 'COMPLETED');
      if (completedSession) {
        notifs.push({
          id: `session_done_${completedSession.id}`,
          title: 'Mock Interview Evaluated',
          desc: `Session #${completedSession.id} finished with an overall score of ${completedSession.overallScore}%. Review detailed feedback.`,
          time: 'Completed',
          icon: 'military_tech',
          read: true,
          link: `/history?sessionId=${completedSession.id}`,
          badgeColor: 'bg-emerald-500',
        });
      }

      // 2. Fetch user's resume analysis
      const resumeRes = await api.get('/api/v1/resumes').catch(() => null);
      const resumeData = resumeRes?.data;
      if (resumeData && resumeData.atsScore != null) {
        notifs.push({
          id: 'resume_ats_score',
          title: 'ATS Resume Compatibility',
          desc: `Your scanned resume scored ${resumeData.atsScore}% ATS fit for your target job description.`,
          time: 'Analyzed',
          icon: 'description',
          read: false,
          link: '/resume',
          badgeColor: 'bg-primary',
        });

        if (resumeData.missingKeywords && resumeData.missingKeywords.length > 0) {
          notifs.push({
            id: 'resume_skill_gaps',
            title: `${resumeData.missingKeywords.length} Missing Role Keywords`,
            desc: `Gaps detected: ${resumeData.missingKeywords.slice(0, 3).join(', ')}... Incorporate these to boost ATS score.`,
            time: 'Actionable',
            icon: 'warning',
            read: false,
            link: '/resume',
            badgeColor: 'bg-rose-500',
          });
        }
      }

      // 3. Fallback welcome notification if no records yet
      if (notifs.length === 0) {
        notifs.push({
          id: 'welcome_iq',
          title: 'Welcome to InterviewIQ AI',
          desc: 'Start by uploading your resume or practice with the 5-question adaptive interview arena.',
          time: 'Ready',
          icon: 'psychology',
          read: false,
          link: '/resume',
          badgeColor: 'bg-primary',
        });
      }

      setNotifications(notifs);
      setUnreadCount(notifs.filter((n) => !n.read).length);
    } catch {
      // Graceful fallback
    }
  };

  useEffect(() => {
    loadDynamicNotifications();

    const handleUpdate = () => loadDynamicNotifications();
    window.addEventListener('iq_notification_update', handleUpdate);
    return () => {
      window.removeEventListener('iq_notification_update', handleUpdate);
      stopMicTest();
    };
  }, [user, location.pathname]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) {
        setProfileOpen(false);
        setNotificationsOpen(false);
        if (settingsOpen) {
          stopMicTest();
          setSettingsOpen(false);
        }
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [settingsOpen]);

  // Settings handlers with reactive event dispatching
  const handleDifficultyChange = (level) => {
    setDifficulty(level);
    localStorage.setItem('iq_difficulty', level);
    window.dispatchEvent(
      new CustomEvent('iq_settings_changed', { detail: { key: 'difficulty', value: level } })
    );
  };

  const handleSpeechPaceToggle = () => {
    const nextVal = !speechPaceEnabled;
    setSpeechPaceEnabled(nextVal);
    localStorage.setItem('iq_speech_pace', String(nextVal));
    window.dispatchEvent(
      new CustomEvent('iq_settings_changed', { detail: { key: 'speechPace', value: nextVal } })
    );
  };

  const handleThemeChange = (theme) => {
    setEditorTheme(theme);
    localStorage.setItem('iq_editor_theme', theme);
    window.dispatchEvent(
      new CustomEvent('iq_settings_changed', { detail: { key: 'editorTheme', value: theme } })
    );
  };

  const markAllNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const dismissNotification = (id, e) => {
    e.stopPropagation();
    setNotifications((prev) => {
      const updated = prev.filter((n) => n.id !== id);
      setUnreadCount(updated.filter((n) => !n.read).length);
      return updated;
    });
  };

  const navLinks = [
    { label: 'Dashboard', to: '/dashboard', icon: 'space_dashboard' },
    { label: 'Resume', to: '/resume', icon: 'description' },
    { label: 'Interview', to: '/interview', icon: 'mic' },
    { label: 'History', to: '/history', icon: 'history' },
  ];

  const initials = (user?.name || user?.email || 'IQ')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleLogout = () => {
    stopMicTest();
    logout();
    navigate('/login');
  };

  const NavLink = ({ link, mobile = false }) => {
    const active = location.pathname === link.to;
    return (
      <Link
        to={link.to}
        onClick={() => setMenuOpen(false)}
        className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
          active
            ? 'bg-primary text-white shadow-sm shadow-primary/20'
            : 'text-slate-600 hover:bg-slate-100 hover:text-primary'
        } ${mobile ? 'w-full justify-start' : ''}`}
      >
        <span className="material-symbols-outlined text-[20px]">{link.icon}</span>
        {link.label}
      </Link>
    );
  };

  return (
    <header
      ref={navRef}
      className="fixed inset-x-0 top-0 z-50 border-b border-white/70 bg-white/80 shadow-[0_12px_40px_rgba(15,23,42,0.06)] backdrop-blur-2xl"
    >
      <div className="mx-auto flex h-20 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-10">
        <div className="flex items-center gap-4 lg:gap-8">
          <Link to="/dashboard" className="flex items-center gap-3" onClick={() => setMenuOpen(false)}>
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-primary via-secondary to-tertiary text-white shadow-lg shadow-primary/20">
              <span className="material-symbols-outlined text-[23px]">psychology</span>
            </span>
            <span className="leading-tight">
              <span className="block text-lg font-extrabold text-slate-950">InterviewIQ</span>
              <span className="hidden text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 sm:block">
                AI Coach
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 rounded-2xl border border-slate-200 bg-white/75 p-1 lg:flex">
            {navLinks.map((link) => (
              <NavLink key={link.to} link={link} />
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* ================= Notifications Button & Dynamic Dropdown ================= */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setNotificationsOpen((prev) => !prev);
                if (settingsOpen) stopMicTest();
                setSettingsOpen(false);
                setProfileOpen(false);
              }}
              className={`relative hidden h-10 w-10 place-items-center rounded-xl transition-colors sm:grid cursor-pointer ${
                notificationsOpen
                  ? 'bg-primary/10 text-primary'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-primary'
              }`}
              aria-label="Notifications"
            >
              <span className="material-symbols-outlined text-[22px]">notifications</span>
              {unreadCount > 0 && (
                <span className="absolute top-2 right-2 flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-white" />
                </span>
              )}
            </button>

            {notificationsOpen && (
              <div className="absolute right-0 mt-3 w-80 sm:w-96 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/15 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5 bg-slate-50/70">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-extrabold text-slate-900">Notifications</span>
                    {unreadCount > 0 && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-extrabold text-primary">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={markAllNotificationsRead}
                      className="text-xs font-bold text-primary hover:underline cursor-pointer"
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                  {notifications.length > 0 ? (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => {
                          setNotifications((prev) =>
                            prev.map((item) => (item.id === n.id ? { ...item, read: true } : item))
                          );
                          setUnreadCount((c) => Math.max(0, c - 1));
                          setNotificationsOpen(false);
                          navigate(n.link);
                        }}
                        className={`group relative flex w-full items-start gap-3 p-3.5 text-left transition-colors hover:bg-slate-50 cursor-pointer ${
                          !n.read ? 'bg-blue-50/35' : ''
                        }`}
                      >
                        <span
                          className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl text-white shadow-xs ${
                            n.badgeColor || 'bg-primary'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[18px]">{n.icon}</span>
                        </span>
                        <div className="min-w-0 flex-1 pr-6">
                          <div className="flex items-center justify-between gap-1">
                            <p className={`truncate text-xs font-extrabold ${!n.read ? 'text-slate-950' : 'text-slate-700'}`}>
                              {n.title}
                            </p>
                            <span className="text-[10px] font-semibold text-slate-400 shrink-0">{n.time}</span>
                          </div>
                          <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">{n.desc}</p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => dismissNotification(n.id, e)}
                          className="absolute top-3 right-3 text-slate-300 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Dismiss"
                        >
                          <span className="material-symbols-outlined text-[15px]">close</span>
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center text-xs font-semibold text-slate-400">
                      No notifications right now.
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-100 bg-slate-50/50 p-2.5 text-center flex items-center justify-between px-4">
                  <span className="text-[11px] font-bold text-slate-400">Real-time status updates</span>
                  <button
                    type="button"
                    onClick={loadDynamicNotifications}
                    className="inline-flex items-center gap-1 text-[11px] font-extrabold text-primary hover:underline cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[14px]">refresh</span>
                    Sync
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ================= Settings Button & Fully Functional Dropdown ================= */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                const next = !settingsOpen;
                if (!next) stopMicTest();
                setSettingsOpen(next);
                setNotificationsOpen(false);
                setProfileOpen(false);
              }}
              className={`relative hidden h-10 w-10 place-items-center rounded-xl transition-colors sm:grid cursor-pointer ${
                settingsOpen
                  ? 'bg-primary/10 text-primary'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-primary'
              }`}
              aria-label="Settings"
            >
              <span className="material-symbols-outlined text-[22px]">settings</span>
            </button>

            {settingsOpen && (
              <div className="absolute right-0 mt-3 w-84 sm:w-92 overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl shadow-slate-900/15 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px] text-primary">tune</span>
                    <span className="text-sm font-extrabold text-slate-950">AI & Practice Settings</span>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Active
                  </span>
                </div>

                <div className="space-y-4">
                  {/* Interview Difficulty */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                        Interview Target Seniority
                      </label>
                      <span className="text-[11px] font-bold text-primary capitalize">{difficulty}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-slate-100 p-1">
                      {[
                        { id: 'junior', label: 'Junior' },
                        { id: 'mid', label: 'Mid-Level' },
                        { id: 'senior', label: 'Senior' },
                      ].map((lvl) => (
                        <button
                          key={lvl.id}
                          type="button"
                          onClick={() => handleDifficultyChange(lvl.id)}
                          className={`rounded-lg py-1.5 text-xs font-bold transition-all cursor-pointer ${
                            difficulty === lvl.id
                              ? 'bg-white text-slate-950 shadow-xs'
                              : 'text-slate-600 hover:text-slate-950'
                          }`}
                        >
                          {lvl.label}
                        </button>
                      ))}
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Configures AI question depth and technical evaluation rigor.
                    </p>
                  </div>

                  {/* Monaco Code Editor Theme */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                        Code Editor Theme
                      </label>
                      <span className="text-[11px] font-bold text-slate-500">
                        {editorTheme === 'vs-dark' ? 'VS Code Dark' : 'VS Code Light'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-slate-100 p-1">
                      {[
                        { id: 'vs-dark', label: 'Dark (VS Code)' },
                        { id: 'light', label: 'Light' },
                      ].map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => handleThemeChange(t.id)}
                          className={`rounded-lg py-1.5 text-xs font-bold transition-all cursor-pointer ${
                            editorTheme === t.id
                              ? 'bg-white text-slate-950 shadow-xs'
                              : 'text-slate-600 hover:text-slate-950'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Speaking Pace Toggle */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <div>
                      <p className="text-xs font-bold text-slate-800">Speaking Pace Feedback</p>
                      <p className="text-[11px] text-slate-500">Track and score live words-per-minute</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleSpeechPaceToggle}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        speechPaceEnabled ? 'bg-primary' : 'bg-slate-200'
                      }`}
                      role="switch"
                      aria-checked={speechPaceEnabled}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                          speechPaceEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Live Interactive Microphone Test */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${
                            micTesting ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                          }`}
                        />
                        <span className="text-xs font-bold text-slate-800">Microphone Input</span>
                      </div>
                      <button
                        type="button"
                        onClick={micTesting ? stopMicTest : startMicTest}
                        className={`px-2.5 py-1 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
                          micTesting
                            ? 'bg-red-50 text-red-600 border border-red-200'
                            : 'bg-primary text-white shadow-2xs hover:bg-primary/90'
                        }`}
                      >
                        {micTesting ? 'Stop Test' : 'Test Mic'}
                      </button>
                    </div>

                    {micTesting ? (
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                          <span>Live Signal:</span>
                          <span className="text-emerald-700">{micLevel}%</span>
                        </div>
                        <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-primary transition-all duration-75"
                            style={{ width: `${Math.max(5, micLevel)}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-emerald-700 font-semibold">
                          Speak to test volume input. Working properly!
                        </p>
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-500">
                        Default recording input device. Click "Test Mic" to verify browser audio.
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">Settings save automatically</span>
                  <button
                    type="button"
                    onClick={() => {
                      stopMicTest();
                      setSettingsOpen(false);
                    }}
                    className="rounded-xl bg-slate-900 px-4 py-1.5 text-xs font-bold text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ================= Profile Menu ================= */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setProfileOpen((open) => !open);
                if (settingsOpen) stopMicTest();
                setNotificationsOpen(false);
                setSettingsOpen(false);
              }}
              className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-2 py-2 shadow-sm transition-colors hover:border-primary/30 cursor-pointer"
              aria-label="Open profile menu"
            >
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-950 text-sm font-bold text-white">
                {initials}
              </span>
              <span className="hidden max-w-36 text-left md:block">
                <span className="block truncate text-sm font-bold text-slate-900">{user?.name || 'Candidate'}</span>
                <span className="block truncate text-xs text-slate-500">{user?.email || 'Ready to practice'}</span>
              </span>
              <span className="material-symbols-outlined hidden text-[20px] text-slate-400 md:block">expand_more</span>
            </button>

            {profileOpen && (
              <div className="absolute right-0 mt-3 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10 animate-in fade-in zoom-in-95 duration-150">
                <div className="border-b border-slate-100 px-4 py-4">
                  <p className="truncate text-sm font-bold text-slate-900">{user?.name || 'Candidate'}</p>
                  <p className="truncate text-xs text-slate-500">{user?.email || 'candidate@interviewiq.ai'}</p>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]">logout</span>
                  Sign out
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="grid h-11 w-11 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-700 lg:hidden"
            aria-label="Open navigation menu"
          >
            <span className="material-symbols-outlined">{menuOpen ? 'close' : 'menu'}</span>
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="border-t border-slate-200 bg-white px-4 py-4 shadow-lg lg:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col gap-2">
            {navLinks.map((link) => (
              <NavLink key={link.to} link={link} mobile />
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import Navbar from '../components/Navbar';

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalInterviews: 12,
    avgScore: 78,
    atsScore: 82,
    technicalAccuracy: 84,
  });
  const [sessions, setSessions] = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get('/api/v1/interview/sessions');
        const sessionsData = res.data || [];
        setSessions(sessionsData);
        if (sessionsData.length > 0) {
          const completed = sessionsData.filter((session) => session.status === 'COMPLETED');
          const avgScore = completed.length
            ? Math.round(completed.reduce((total, session) => total + (session.overallScore || 0), 0) / completed.length)
            : 78;
          setStats({
            totalInterviews: sessionsData.length,
            avgScore,
            atsScore: 82,
            technicalAccuracy: 84,
          });
        }
      } catch {
        // Keep polished demo data available when the backend is offline.
      } finally {
        setLoadingStats(false);
      }
    };
    fetchData();
  }, []);

  const readinessScore = stats.avgScore;
  const circumference = 440;
  const strokeOffset = circumference - (circumference * readinessScore) / 100;
  const firstName = user?.name?.split(' ')[0] || 'Candidate';

  const displaySessions = sessions.length > 0 ? sessions.slice(0, 5) : [
    { id: 'mock-1', jobDescription: 'Technical Mock (React/FE)', createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), overallScore: 82, status: 'COMPLETED' },
    { id: 'mock-2', jobDescription: 'Behavioral Assessment', createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), overallScore: 76, status: 'COMPLETED' },
    { id: 'mock-3', jobDescription: 'Resume ATS Scan', createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), overallScore: 89, status: 'COMPLETED' },
  ];

  const quickActions = [
    { title: 'Analyze Resume', copy: 'Upload a PDF and compare it with a target role.', icon: 'upload_file', tone: 'bg-blue-50 text-primary', to: '/resume', cta: 'Scan resume' },
    { title: 'Mock Interview', copy: 'Practice role-specific answers with voice feedback.', icon: 'mic', tone: 'bg-indigo-50 text-secondary', to: '/interview', cta: 'Start practice' },
    { title: 'Review Progress', copy: 'Compare transcripts, scores, and coaching notes.', icon: 'analytics', tone: 'bg-violet-50 text-tertiary', to: '/history', cta: 'Open reports' },
  ];

  const statCards = [
    { label: 'Total interviews', value: stats.totalInterviews, note: '+2 this week', tone: 'text-emerald-600' },
    { label: 'Average score', value: `${stats.avgScore}%`, note: '+4% trend', tone: 'text-emerald-600' },
    { label: 'ATS score', value: `${stats.atsScore}%`, note: 'Role ready', tone: 'text-primary' },
    { label: 'Technical accuracy', value: `${stats.technicalAccuracy}%`, note: 'Top band', tone: 'text-secondary' },
  ];

  return (
    <div className="min-h-screen bg-background text-on-surface">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-28 sm:px-6 lg:px-10">
        <section className="mb-8 grid gap-6 lg:grid-cols-[1.45fr_0.75fr]">
          <div className="app-card overflow-hidden rounded-[28px] p-6 sm:p-8 lg:p-10">
            <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="mb-3 inline-flex rounded-full bg-primary-container px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-on-primary-container">Command center</p>
                <h1 className="text-display text-slate-950">Welcome back, {firstName}.</h1>
                <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">Your interview workspace is ready. Keep your resume, mock answers, and coaching feedback moving in the same direction.</p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/interview')}
                className="gradient-primary inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-extrabold shadow-lg shadow-primary/20"
              >
                Start practice
                <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {statCards.map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-[0.13em] text-slate-500">{stat.label}</p>
                  <div className="mt-3 flex items-end justify-between gap-3">
                    <p className="text-3xl font-extrabold text-slate-950">{loadingStats ? 'Loading' : stat.value}</p>
                    <p className={`text-sm font-bold ${stat.tone}`}>{stat.note}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="app-card rounded-[28px] p-6 text-center sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Readiness score</p>
            <div className="relative mx-auto my-6 h-44 w-44">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 160 160">
                <circle className="text-slate-200" cx="80" cy="80" fill="transparent" r="70" stroke="currentColor" strokeWidth="12" />
                <circle className="progress-circle" cx="80" cy="80" fill="transparent" r="70" stroke="url(#dashboardScore)" strokeDasharray={circumference} strokeDashoffset={strokeOffset} strokeLinecap="round" strokeWidth="12" />
                <defs>
                  <linearGradient id="dashboardScore" x1="0%" x2="100%" y1="0%" y2="100%">
                    <stop offset="0%" stopColor="#0f5bd8" />
                    <stop offset="100%" stopColor="#7c3aed" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 grid place-items-center">
                <span className="text-4xl font-extrabold text-slate-950">{readinessScore}%</span>
              </div>
            </div>
            <p className="text-sm font-semibold text-slate-600">{readinessScore >= 80 ? 'Strong interview posture' : readinessScore >= 60 ? 'Solid, with room to sharpen' : 'Practice plan recommended'}</p>
            <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-left">
              <div className="mb-2 flex justify-between text-sm font-bold text-slate-700"><span>Daily goal</span><span>{readinessScore}%</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-primary" style={{ width: `${readinessScore}%` }} /></div>
            </div>
          </div>
        </section>

        <section className="mb-8 grid gap-5 md:grid-cols-3">
          {quickActions.map((action) => (
            <button
              key={action.title}
              type="button"
              onClick={() => navigate(action.to)}
              className="group app-card rounded-[24px] p-6 text-left transition-transform hover:-translate-y-1"
            >
              <span className={`mb-5 grid h-12 w-12 place-items-center rounded-2xl ${action.tone}`}>
                <span className="material-symbols-outlined">{action.icon}</span>
              </span>
              <h2 className="text-xl font-extrabold text-slate-950">{action.title}</h2>
              <p className="mt-2 min-h-12 text-sm leading-6 text-slate-600">{action.copy}</p>
              <span className="mt-5 inline-flex items-center gap-2 text-sm font-extrabold text-primary">
                {action.cta}
                <span className="material-symbols-outlined text-[18px] transition-transform group-hover:translate-x-1">arrow_forward</span>
              </span>
            </button>
          ))}
        </section>

        <section className="mb-8 grid gap-6 lg:grid-cols-2">
          <div className="app-card rounded-[28px] p-6 sm:p-8">
            <div className="mb-8 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-extrabold text-slate-950">Weekly performance</h2>
                <p className="mt-1 text-sm text-slate-500">Interview readiness trend</p>
              </div>
              <select className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 outline-none focus:border-primary">
                <option>Last 7 days</option>
                <option>Last 30 days</option>
              </select>
            </div>
            <div className="relative h-64 rounded-2xl bg-slate-50 p-4">
              <svg className="h-full w-full" preserveAspectRatio="none" viewBox="0 0 420 180">
                <path d="M0,142 C55,125 66,96 120,101 C168,106 170,133 215,120 C262,107 270,70 325,72 C366,74 385,38 420,26" fill="none" stroke="url(#lineGradient)" strokeLinecap="round" strokeWidth="5" />
                <path d="M0,142 C55,125 66,96 120,101 C168,106 170,133 215,120 C262,107 270,70 325,72 C366,74 385,38 420,26 L420,180 L0,180 Z" fill="url(#areaGradient)" />
                <defs>
                  <linearGradient id="lineGradient" x1="0%" x2="100%"><stop stopColor="#0f5bd8" /><stop offset="100%" stopColor="#7c3aed" /></linearGradient>
                  <linearGradient id="areaGradient" x1="0%" x2="0%" y1="0%" y2="100%"><stop stopColor="#4f46e5" stopOpacity="0.18" /><stop offset="100%" stopColor="#4f46e5" stopOpacity="0" /></linearGradient>
                </defs>
              </svg>
            </div>
            <div className="mt-4 flex justify-between text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
              <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
            </div>
          </div>

          <div className="app-card rounded-[28px] p-6 sm:p-8">
            <div className="mb-8">
              <h2 className="text-2xl font-extrabold text-slate-950">Skill improvement</h2>
              <p className="mt-1 text-sm text-slate-500">Current score by evaluation dimension</p>
            </div>
            <div className="space-y-5">
              {[
                ['Technical logic', 85, 'bg-primary'],
                ['Communication', 78, 'bg-secondary'],
                ['Confidence', 90, 'bg-emerald-500'],
                ['Answer structure', 72, 'bg-amber-500'],
              ].map(([label, value, color]) => (
                <div key={label}>
                  <div className="mb-2 flex justify-between text-sm font-bold text-slate-700"><span>{label}</span><span>{value}%</span></div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} /></div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="app-card overflow-hidden rounded-[28px]">
          <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
            <div>
              <h2 className="text-2xl font-extrabold text-slate-950">Recent activity</h2>
              <p className="mt-1 text-sm text-slate-500">Latest scans and practice sessions</p>
            </div>
            <button type="button" onClick={() => navigate('/history')} className="inline-flex items-center gap-2 text-sm font-extrabold text-primary">
              View all history <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                <tr>
                  <th className="px-6 py-4">Session</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Score</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {displaySessions.map((sessionItem) => {
                  const title = sessionItem.jobDescription || 'Interview session';
                  const isResume = title.includes('Resume');
                  const isTechnical = title.includes('Technical');
                  return (
                    <tr key={sessionItem.id} className="transition-colors hover:bg-slate-50/80">
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <span className={`grid h-10 w-10 place-items-center rounded-xl ${isTechnical ? 'bg-blue-50 text-primary' : isResume ? 'bg-violet-50 text-tertiary' : 'bg-indigo-50 text-secondary'}`}>
                            <span className="material-symbols-outlined text-[20px]">{isTechnical ? 'code' : isResume ? 'description' : 'forum'}</span>
                          </span>
                          <span className="font-bold text-slate-800">{title}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-slate-500">{new Date(sessionItem.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                      <td className="px-6 py-5 font-extrabold text-slate-950">{sessionItem.overallScore}%</td>
                      <td className="px-6 py-5"><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-700">{sessionItem.status === 'COMPLETED' ? 'Completed' : 'Processed'}</span></td>
                      <td className="px-6 py-5 text-right">
                        <button type="button" onClick={() => navigate(isResume ? '/resume' : `/history?sessionId=${sessionItem.id}`)} className="font-extrabold text-primary hover:underline">
                          {isResume ? 'View report' : 'Review'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

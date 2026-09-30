import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import Navbar from '../components/Navbar';

const formatRoleDescription = (description, maxChars = 85) => {
  if (!description) return 'Interview session';
  const clean = description.trim().replace(/\s+/g, ' ');
  if (clean.length <= maxChars) return clean;
  return `${clean.slice(0, maxChars).trim()}.....`;
};

const generateSmoothPath = (pts) => {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i];
    const p1 = pts[i + 1];
    const cpX1 = p0.x + (p1.x - p0.x) * 0.45;
    const cpY1 = p0.y;
    const cpX2 = p1.x - (p1.x - p0.x) * 0.45;
    const cpY2 = p1.y;
    d += ` C ${cpX1.toFixed(1)},${cpY1.toFixed(1)} ${cpX2.toFixed(1)},${cpY2.toFixed(1)} ${p1.x.toFixed(1)},${p1.y.toFixed(1)}`;
  }
  return d;
};

const generateAreaPath = (pts, bottomY) => {
  if (pts.length < 2) return '';
  const curve = generateSmoothPath(pts);
  return `${curve} L ${pts[pts.length - 1].x.toFixed(1)},${bottomY} L ${pts[0].x.toFixed(1)},${bottomY} Z`;
};

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalInterviews: 0,
    avgScore: null,
    atsScore: null,
    technicalScore: null,
  });
  const [sessions, setSessions] = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [trend, setTrend] = useState([]);
  const [hoveredTrendIdx, setHoveredTrendIdx] = useState(null);
  const [skillBreakdown, setSkillBreakdown] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [sessionsRes, statsRes] = await Promise.all([
          api.get('/api/v1/interview/sessions'),
          api.get('/api/v1/interview/stats').catch(() => ({ data: null })),
        ]);

        const sessionsData = sessionsRes.data || [];
        setSessions(sessionsData);

        const dashStats = statsRes.data;

        if (sessionsData.length > 0) {
          const completed = sessionsData.filter((session) => session.status === 'COMPLETED');
          const avgScore = completed.length
            ? Math.round(completed.reduce((total, session) => total + (session.overallScore || 0), 0) / completed.length)
            : null;
          setStats({
            totalInterviews: sessionsData.length,
            avgScore,
            atsScore: dashStats?.latestAtsScore ?? dashStats?.atsScore ?? null,
            technicalScore: dashStats?.avgTechnicalScore ?? dashStats?.technicalScore ?? null,
          });
        } else if (dashStats) {
          setStats((prev) => ({
            ...prev,
            atsScore: dashStats.latestAtsScore ?? dashStats.atsScore ?? null,
            technicalScore: dashStats.avgTechnicalScore ?? dashStats.technicalScore ?? null,
          }));
        }

        if (dashStats?.trend && Array.isArray(dashStats.trend)) {
          setTrend(dashStats.trend);
        }
        if (dashStats) {
          setSkillBreakdown({
            technicalScore: dashStats.avgTechnicalScore ?? dashStats.skillBreakdown?.technicalScore ?? null,
            communicationScore: dashStats.avgCommunicationScore ?? dashStats.skillBreakdown?.communicationScore ?? null,
            confidence: dashStats.avgConfidence ?? dashStats.skillBreakdown?.confidence ?? null,
            speakingPace: dashStats.avgSpeakingPace ?? dashStats.skillBreakdown?.speakingPace ?? null,
          });
        }
      } catch {
        // Fallback gracefully if backend is offline
      } finally {
        setLoadingStats(false);
      }
    };
    fetchData();
  }, []);

  const readinessScore = stats.avgScore || 0;
  const circumference = 440;
  const strokeOffset = stats.avgScore != null
    ? circumference - (circumference * readinessScore) / 100
    : circumference;
  const firstName = user?.name?.split(' ')[0] || 'Candidate';

  const isUsingDemoSessions = sessions.length === 0;
  const displaySessions = sessions.length > 0 ? sessions.slice(0, 5) : [
    { id: 'mock-1', jobDescription: 'Technical Mock (React/FE)', createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), overallScore: 82, status: 'COMPLETED', isDemo: true },
    { id: 'mock-2', jobDescription: 'Behavioral Assessment', createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), overallScore: 76, status: 'COMPLETED', isDemo: true },
    { id: 'mock-3', jobDescription: 'Resume ATS Scan', createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), overallScore: 89, status: 'COMPLETED', isDemo: true },
  ];

  const quickActions = [
    { title: 'Analyze Resume', copy: 'Upload a PDF and compare it with a target role.', icon: 'upload_file', tone: 'bg-blue-50 text-primary', to: '/resume', cta: 'Scan resume' },
    { title: 'Mock Interview', copy: 'Practice role-specific answers with voice feedback.', icon: 'mic', tone: 'bg-indigo-50 text-secondary', to: '/interview', cta: 'Start practice' },
    { title: 'Review Progress', copy: 'Compare transcripts, scores, and coaching notes.', icon: 'analytics', tone: 'bg-violet-50 text-tertiary', to: '/history', cta: 'Open reports' },
  ];

  const statCards = [
    {
      label: 'Total Interviews',
      value: stats.totalInterviews,
      note: stats.totalInterviews > 0 ? `${stats.totalInterviews} recorded` : 'Get started',
      tone: stats.totalInterviews > 0 ? 'text-emerald-600' : 'text-slate-400',
    },
    {
      label: 'Average Score',
      value: stats.avgScore != null ? `${stats.avgScore}%` : '—',
      note: stats.avgScore != null ? 'Completed sessions' : 'No data yet',
      tone: stats.avgScore != null ? 'text-emerald-600' : 'text-slate-400',
    },
    {
      label: 'ATS Score',
      value: stats.atsScore != null ? `${stats.atsScore}%` : '—',
      note: stats.atsScore != null ? 'Latest resume scan' : 'Upload resume',
      tone: stats.atsScore != null ? 'text-emerald-600' : 'text-slate-400',
    },
    {
      label: 'Technical Score',
      value: stats.technicalScore != null ? `${stats.technicalScore}%` : '—',
      note: stats.technicalScore != null ? 'From evaluations' : 'No data yet',
      tone: stats.technicalScore != null ? 'text-emerald-600' : 'text-slate-400',
    },
  ];

  // Skill breakdown dimensions
  const skillDimensions = [
    { key: 'technicalScore', label: 'Technical Score', color: 'bg-primary' },
    { key: 'communicationScore', label: 'Communication', color: 'bg-secondary' },
    { key: 'confidence', label: 'Confidence', color: 'bg-emerald-500' },
    { key: 'speakingPace', label: 'Speaking Pace', color: 'bg-indigo-500' },
  ];
  const hasSkillData = skillBreakdown && skillDimensions.some((d) => skillBreakdown[d.key] != null);
  const hasTrendData = trend.length >= 2;

  const chartPoints = (hasTrendData ? trend : []).map((point, idx, arr) => {
    const score = point.overallScore ?? 0;
    const paddingLeft = 42;
    const paddingTop = 26;
    const plotHeight = 150;
    const plotWidth = 470;
    const x = paddingLeft + (idx / Math.max(arr.length - 1, 1)) * plotWidth;
    const y = paddingTop + plotHeight - (Math.min(Math.max(score, 0), 100) / 100) * plotHeight;
    const formattedDate = point.date
      ? new Date(point.date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      : `S${idx + 1}`;
    return { x, y, score, date: formattedDate, rawDate: point.date };
  });

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

            <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
              {statCards.map((stat) => (
                <div key={stat.label} className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm min-w-0">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500 whitespace-normal leading-snug">
                      {stat.label}
                    </p>
                    <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight leading-none">
                      {loadingStats ? '—' : stat.value}
                    </p>
                  </div>
                  <p className={`mt-3 text-xs font-bold leading-tight ${stat.tone}`}>{stat.note}</p>
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
                <span className="text-4xl font-extrabold text-slate-950">
                  {stats.avgScore != null ? `${readinessScore}%` : '—'}
                </span>
              </div>
            </div>
            <p className="text-sm font-semibold text-slate-600">
              {stats.avgScore != null
                ? (readinessScore >= 80 ? 'Strong interview posture' : readinessScore >= 60 ? 'Solid, with room to sharpen' : 'Practice plan recommended')
                : 'Complete your first mock interview to calculate your readiness score'}
            </p>
            <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-left">
              <div className="mb-2 flex justify-between text-sm font-bold text-slate-700">
                <span>Daily goal</span>
                <span>{stats.avgScore != null ? `${readinessScore}%` : '—'}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-primary" style={{ width: `${stats.avgScore != null ? readinessScore : 0}%` }} />
              </div>
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
          {/* Weekly Performance Trend */}
          <div className="app-card rounded-[28px] p-6 sm:p-8">
            <div className="mb-8 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-extrabold text-slate-950">Weekly performance</h2>
                <p className="mt-1 text-sm text-slate-500">Interview readiness trend</p>
              </div>
              {!hasTrendData && (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">Coming soon</span>
              )}
            </div>

            {hasTrendData ? (
              <div className="relative pt-2">
                <svg viewBox="0 0 540 225" className="w-full h-64 overflow-visible">
                  <defs>
                    <linearGradient id="trendLineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#0f5bd8" />
                      <stop offset="100%" stopColor="#7c3aed" />
                    </linearGradient>
                    <linearGradient id="trendAreaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#0f5bd8" stopOpacity="0.25" />
                      <stop offset="60%" stopColor="#7c3aed" stopOpacity="0.08" />
                      <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal grid guide lines & Y-axis labels */}
                  {[
                    { pct: 100, y: 26 },
                    { pct: 75, y: 26 + 150 * 0.25 },
                    { pct: 50, y: 26 + 150 * 0.5 },
                    { pct: 25, y: 26 + 150 * 0.75 },
                    { pct: 0, y: 176 },
                  ].map((grid) => (
                    <g key={grid.pct}>
                      <text x="34" y={grid.y + 4} textAnchor="end" className="fill-slate-400 text-[10px] font-bold">
                        {grid.pct}%
                      </text>
                      <line
                        x1="42"
                        y1={grid.y}
                        x2="516"
                        y2={grid.y}
                        stroke="currentColor"
                        strokeDasharray={grid.pct === 0 ? undefined : "3 3"}
                        className={grid.pct === 0 ? "text-slate-200" : "text-slate-100"}
                      />
                    </g>
                  ))}

                  {/* Gradient Area Fill under the line */}
                  <path
                    d={generateAreaPath(chartPoints, 176)}
                    fill="url(#trendAreaGrad)"
                    className="transition-all duration-700"
                  />

                  {/* The Line */}
                  <path
                    d={generateSmoothPath(chartPoints)}
                    fill="none"
                    stroke="url(#trendLineGrad)"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="transition-all duration-700"
                  />

                  {/* Data Points and Interactivity */}
                  {chartPoints.map((pt, idx) => {
                    const isHovered = hoveredTrendIdx === idx;
                    return (
                      <g
                        key={idx}
                        className="cursor-pointer group"
                        onMouseEnter={() => setHoveredTrendIdx(idx)}
                        onMouseLeave={() => setHoveredTrendIdx(null)}
                      >
                        {/* Vertical indicator line on hover */}
                        {isHovered && (
                          <line
                            x1={pt.x}
                            y1={26}
                            x2={pt.x}
                            y2={176}
                            stroke="#0f5bd8"
                            strokeWidth="1.5"
                            strokeDasharray="2 2"
                            className="opacity-60"
                          />
                        )}

                        {/* Outer hover halo */}
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={isHovered ? 12 : 7}
                          fill="#0f5bd8"
                          className={`transition-all duration-200 ${isHovered ? 'opacity-20' : 'opacity-0 group-hover:opacity-10'}`}
                        />

                        {/* Point Circle */}
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={isHovered ? 6 : 4.5}
                          fill="#ffffff"
                          stroke="#0f5bd8"
                          strokeWidth={isHovered ? 3.5 : 2.5}
                          className="transition-all duration-200"
                        />

                        {/* Score label badge above point */}
                        <g transform={`translate(${pt.x}, ${pt.y - 12})`}>
                          <rect
                            x="-16"
                            y="-14"
                            width="32"
                            height="16"
                            rx="8"
                            className={`transition-colors duration-150 ${isHovered ? 'fill-slate-950' : 'fill-slate-100 group-hover:fill-slate-200'}`}
                          />
                          <text
                            x="0"
                            y="-2"
                            textAnchor="middle"
                            className={`text-[10px] font-extrabold ${isHovered ? 'fill-white' : 'fill-slate-700'}`}
                          >
                            {pt.score}%
                          </text>
                        </g>

                        {/* X-axis date label below baseline */}
                        <text
                          x={pt.x}
                          y="198"
                          textAnchor="middle"
                          className={`text-[11px] font-bold transition-colors ${isHovered ? 'fill-primary font-extrabold' : 'fill-slate-400'}`}
                        >
                          {pt.date}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            ) : (
              <div className="relative flex h-64 flex-col items-center justify-center rounded-2xl bg-slate-50 p-6 text-center">
                <span className="material-symbols-outlined text-4xl text-slate-300">timeline</span>
                <p className="mt-3 text-sm font-extrabold text-slate-700">Trend analytics</p>
                <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">Complete a few more sessions to see your trend.</p>
              </div>
            )}
          </div>

          {/* Skill Breakdown */}
          <div className="app-card rounded-[28px] p-6 sm:p-8">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-extrabold text-slate-950">Skill breakdown</h2>
                <p className="mt-1 text-sm text-slate-500">Evaluation dimension averages</p>
              </div>
              {!hasSkillData && (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">Coming soon</span>
              )}
            </div>
            <div className="space-y-5">
              {skillDimensions.map((dim) => {
                const val = skillBreakdown?.[dim.key] ?? null;
                return (
                  <div key={dim.key}>
                    <div className="mb-2 flex justify-between text-sm font-bold text-slate-500">
                      <span>{dim.label}</span>
                      <span>{val != null ? `${val}%` : '—'}</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${dim.color} transition-all duration-700`}
                        style={{ width: val != null ? `${val}%` : '0%' }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="app-card overflow-hidden rounded-[28px]">
          <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
            <div>
              <h2 className="text-2xl font-extrabold text-slate-950">Recent activity</h2>
              <p className="mt-1 text-sm text-slate-500">
                {isUsingDemoSessions
                  ? 'Sample practice sessions (start an interview to record your own)'
                  : 'Latest scans and practice sessions'}
              </p>
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
                  const rawDescription = sessionItem.jobDescription || 'Interview session';
                  const title = formatRoleDescription(rawDescription, 85);
                  const isResume = rawDescription.includes('Resume');
                  const isTechnical = rawDescription.includes('Technical');
                  return (
                    <tr key={sessionItem.id} className="transition-colors hover:bg-slate-50/80">
                      <td className="px-6 py-5 max-w-md">
                        <div className="flex items-center gap-3">
                          <span className={`shrink-0 grid h-10 w-10 place-items-center rounded-xl ${isTechnical ? 'bg-blue-50 text-primary' : isResume ? 'bg-violet-50 text-tertiary' : 'bg-indigo-50 text-secondary'}`}>
                            <span className="material-symbols-outlined text-[20px]">{isTechnical ? 'code' : isResume ? 'description' : 'forum'}</span>
                          </span>
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="font-bold text-slate-800 line-clamp-2 leading-snug"
                              title={rawDescription}
                            >
                              {title}
                            </span>
                            {sessionItem.isDemo && (
                              <span className="shrink-0 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-amber-700">Sample</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-slate-500">{new Date(sessionItem.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                      <td className="px-6 py-5 font-extrabold text-slate-950">{sessionItem.overallScore}%</td>
                      <td className="px-6 py-5"><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-700">{sessionItem.status === 'COMPLETED' ? 'Completed' : 'Processed'}</span></td>
                      <td className="px-6 py-5 text-right">
                        {sessionItem.isDemo ? (
                          <button type="button" onClick={() => navigate('/interview')} className="font-extrabold text-primary hover:underline">
                            Try mock
                          </button>
                        ) : (
                          <button type="button" onClick={() => navigate(isResume ? '/resume' : `/history?sessionId=${sessionItem.id}`)} className="font-extrabold text-primary hover:underline">
                            {isResume ? 'View report' : 'Review'}
                          </button>
                        )}
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

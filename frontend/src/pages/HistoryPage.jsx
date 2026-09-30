import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import Navbar from '../components/Navbar';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export const isSessionExpired = (createdAt) => {
  if (!createdAt) return false;
  const createdTime = new Date(createdAt).getTime();
  if (isNaN(createdTime)) return false;
  return Date.now() - createdTime > ONE_DAY_MS;
};

export const getRemainingTimeText = (createdAt) => {
  if (!createdAt) return null;
  const createdTime = new Date(createdAt).getTime();
  if (isNaN(createdTime)) return null;
  const remainingMs = ONE_DAY_MS - (Date.now() - createdTime);
  if (remainingMs <= 0) return 'Expired';
  const hours = Math.floor(remainingMs / (1000 * 60 * 60));
  const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
};

export default function HistoryPage() {
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState(null);

  const [searchParams] = useSearchParams();
  const querySessionId = searchParams.get('sessionId');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoadingList(true);
        const res = await api.get('/api/v1/interview/sessions');
        const sessionList = res.data || [];
        setSessions(sessionList);

        if (querySessionId) {
          fetchSessionDetail(Number(querySessionId));
        } else if (sessionList.length > 0) {
          fetchSessionDetail(sessionList[0].id);
        }
      } catch {
        setError('Failed to fetch interview history.');
      } finally {
        setLoadingList(false);
      }
    };
    fetchHistory();
  }, [querySessionId]);

  const fetchSessionDetail = async (id) => {
    try {
      setLoadingDetail(true);
      setError(null);
      const res = await api.get(`/api/v1/interview/sessions/${id}`);
      setSelectedSession(res.data);
    } catch {
      setError('Failed to retrieve detailed session metrics.');
    } finally {
      setLoadingDetail(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-on-surface">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-28 sm:px-6 lg:px-10">
        <section className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-3 inline-flex rounded-full bg-tertiary-container px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-on-tertiary-container">Performance history</p>
            <h1 className="text-display text-slate-950">Review every practice signal.</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">Browse previous interview sessions, transcripts, evaluation metrics, and coaching feedback without losing context.</p>
          </div>
          <button type="button" onClick={() => navigate('/interview')} className="gradient-primary inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-extrabold shadow-lg shadow-primary/20">
            <span className="material-symbols-outlined text-[20px]">mic</span>
            New mock interview
          </button>
        </section>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        <section className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <aside className="app-card rounded-[28px] p-5 sm:p-6 lg:sticky lg:top-28 lg:max-h-[calc(100vh-140px)] lg:overflow-hidden">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-extrabold text-slate-950">Past sessions</h2>
                <p className="mt-1 text-sm text-slate-500">{sessions.length} saved records</p>
              </div>
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-50 text-slate-500"><span className="material-symbols-outlined">history</span></span>
            </div>

            {loadingList ? (
              <div className="space-y-3">
                <div className="h-24 rounded-2xl skeleton" />
                <div className="h-24 rounded-2xl skeleton" />
                <div className="h-24 rounded-2xl skeleton" />
              </div>
            ) : sessions.length === 0 ? (
              <div className="flex min-h-80 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                <span className="material-symbols-outlined mb-3 text-4xl text-slate-400">history</span>
                <p className="text-sm leading-6 text-slate-600">No mock interviews completed yet.</p>
                <button type="button" onClick={() => navigate('/interview')} className="mt-5 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-extrabold text-white">Start practice</button>
              </div>
            ) : (
              <div className="space-y-3 overflow-y-auto pr-1 lg:max-h-[calc(100vh-250px)]">
                {sessions.map((sessionItem) => {
                  const active = selectedSession?.id === sessionItem.id;
                  const isCompleted = sessionItem.status === 'COMPLETED';
                  const expired = !isCompleted && isSessionExpired(sessionItem.createdAt);
                  return (
                    <button
                      key={sessionItem.id}
                      type="button"
                      onClick={() => {
                        fetchSessionDetail(sessionItem.id);
                        navigate(`/history?sessionId=${sessionItem.id}`, { replace: true });
                      }}
                      className={`w-full rounded-2xl border p-4 text-left transition ${active ? 'border-primary bg-blue-50 shadow-sm' : 'border-slate-200 bg-white hover:border-primary/40 hover:bg-slate-50'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="line-clamp-2 text-sm font-extrabold leading-5 text-slate-900">{sessionItem.jobDescription}</p>
                        {isCompleted ? (
                          <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-extrabold text-emerald-700">
                            {sessionItem.overallScore}%
                          </span>
                        ) : expired ? (
                          <span className="shrink-0 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">
                            Expired
                          </span>
                        ) : (
                          <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-extrabold text-amber-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                            Active
                          </span>
                        )}
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-2 text-xs font-semibold">
                        <span className="text-slate-500">{new Date(sessionItem.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        {!isCompleted && !expired && (
                          <span className="inline-flex items-center gap-0.5 font-bold text-primary">
                            Resume
                            <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </aside>

          <div>
            {loadingDetail ? (
              <div className="h-[640px] rounded-[28px] skeleton" />
            ) : selectedSession ? (
              <article className="app-card overflow-hidden rounded-[28px]">
                <header className="border-b border-slate-200 p-6 sm:p-8">
                  <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                    <div className="flex-1 min-w-0 pr-0 xl:pr-6">
                      <span className={`mb-4 inline-flex rounded-full px-3 py-1 text-xs font-extrabold uppercase tracking-[0.14em] ${selectedSession.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700' : isSessionExpired(selectedSession.createdAt) ? 'bg-slate-100 text-slate-600' : 'bg-amber-50 text-amber-700'}`}>
                        {selectedSession.status === 'COMPLETED' ? 'COMPLETED' : isSessionExpired(selectedSession.createdAt) ? 'EXPIRED' : 'ACTIVE'}
                      </span>
                      <h2 className="text-2xl font-extrabold leading-tight text-slate-950 sm:text-3xl">{selectedSession.jobDescription}</h2>
                      <p className="mt-3 text-sm font-semibold text-slate-500">Created {new Date(selectedSession.createdAt).toLocaleString()}</p>
                    </div>
                    {selectedSession.status === 'COMPLETED' ? (
                      <div className="shrink-0 rounded-[24px] border border-primary/15 bg-blue-50 p-5 text-center xl:min-w-36">
                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Overall</p>
                        <p className="mt-1 text-4xl font-extrabold text-primary">{selectedSession.overallScore}%</p>
                      </div>
                    ) : !isSessionExpired(selectedSession.createdAt) ? (
                      <div className="shrink-0 flex flex-col items-start xl:items-end gap-2.5">
                        <button
                          type="button"
                          id="resume-interview-btn"
                          onClick={() => navigate(`/interview?sessionId=${selectedSession.id}`)}
                          className="gradient-primary inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-extrabold shadow-lg shadow-primary/25 transition hover:scale-[1.02] active:scale-[0.98]"
                        >
                          <span className="material-symbols-outlined text-[20px]">play_circle</span>
                          Resume Interview
                        </button>
                        <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-200/80 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">
                          <span className="material-symbols-outlined text-[15px] text-amber-600">schedule</span>
                          {getRemainingTimeText(selectedSession.createdAt)} to complete
                        </div>
                      </div>
                    ) : (
                      <div className="shrink-0 flex flex-col items-start xl:items-end gap-2.5">
                        <button
                          type="button"
                          id="resume-interview-btn-disabled"
                          disabled
                          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-100 px-6 py-3.5 text-sm font-extrabold text-slate-400 cursor-not-allowed shadow-none"
                          title="Interview sessions can only be resumed within 24 hours of creation."
                        >
                          <span className="material-symbols-outlined text-[20px]">lock_clock</span>
                          Resume Interview (Disabled)
                        </button>
                        <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                          <span className="material-symbols-outlined text-[15px] text-slate-400">history_toggle_off</span>
                          24h resume window passed
                        </div>
                      </div>
                    )}
                  </div>
                </header>

                <div className="p-6 sm:p-8">
                  <h3 className="mb-5 text-sm font-extrabold uppercase tracking-[0.16em] text-slate-500">Sequential evaluation</h3>
                  {selectedSession.logs && selectedSession.logs.length > 0 ? (
                    <div className="space-y-5">
                      {selectedSession.logs.map((log, index) => (
                        <section key={log.id} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <h4 className="text-lg font-extrabold leading-7 text-slate-950"><span className="text-primary">Q{index + 1}.</span> {log.questionText}</h4>
                            <span className="shrink-0 rounded-xl bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-500">{new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>

                          {log.transcript ? (
                            <div className="space-y-5">
                              <div className="rounded-2xl bg-slate-50 p-4">
                                <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.14em] text-slate-400">Transcript</p>
                                <p className="text-sm leading-7 text-slate-700 whitespace-pre-wrap font-mono text-xs">{log.transcript}</p>
                              </div>

                              {log.evaluationMetrics && (
                                <>
                                  <div className="grid gap-3 sm:grid-cols-4">
                                    {[
                                      ['Technical', log.evaluationMetrics.technicalScore, 'text-primary bg-blue-50'],
                                      ['Communication', log.evaluationMetrics.communicationScore, 'text-secondary bg-indigo-50'],
                                      ['Professionalism', log.evaluationMetrics.professionalism, 'text-tertiary bg-violet-50'],
                                      ['Confidence', log.evaluationMetrics.confidence, 'text-blue-700 bg-blue-50'],
                                      ['Pace', log.evaluationMetrics.speakingPace, 'text-indigo-700 bg-indigo-50'],
                                      ['Presence', log.evaluationMetrics.interviewPresence, 'text-emerald-700 bg-emerald-50'],
                                      ['Eye Contact', log.evaluationMetrics.eyeContact, 'text-teal-700 bg-teal-50'],
                                      ['Body Language', log.evaluationMetrics.bodyLanguage, 'text-cyan-700 bg-cyan-50'],
                                      ['Facial Composure', log.evaluationMetrics.facialComposure, 'text-rose-700 bg-rose-50'],
                                    ].filter(item => item[1] != null).map(([label, value, tone]) => (
                                      <div key={label} className={`rounded-2xl p-4 text-center ${tone}`}>
                                        <p className="text-xs font-bold uppercase tracking-[0.12em] opacity-75">{label}</p>
                                        <p className="mt-1 text-2xl font-extrabold">{value}%</p>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                    <p className="mb-2 text-sm font-extrabold text-slate-950">Coach feedback</p>
                                    <p className="text-sm leading-7 text-slate-600">{log.evaluationMetrics.constructiveFeedback}</p>
                                  </div>
                                </>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50/70 p-5 text-sm">
                              <div className="flex items-center gap-3 font-semibold text-amber-900">
                                <span className="material-symbols-outlined text-[24px] text-amber-600">pending</span>
                                <div>
                                  <p className="font-bold">This question has not been answered yet.</p>
                                  <p className="mt-0.5 text-xs font-normal text-amber-700">
                                    {!isSessionExpired(selectedSession.createdAt)
                                      ? `You can resume this mock session (${getRemainingTimeText(selectedSession.createdAt)} remaining).`
                                      : 'The 24-hour window to complete this interview has passed.'}
                                  </p>
                                </div>
                              </div>
                              {!isSessionExpired(selectedSession.createdAt) ? (
                                <button
                                  type="button"
                                  onClick={() => navigate(`/interview?sessionId=${selectedSession.id}`)}
                                  className="shrink-0 gradient-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold shadow-md shadow-primary/20 transition hover:scale-[1.02] active:scale-[0.98]"
                                >
                                  <span className="material-symbols-outlined text-[16px]">play_arrow</span>
                                  Continue here
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled
                                  className="shrink-0 rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-xs font-bold text-slate-400 cursor-not-allowed"
                                >
                                  Expired
                                </button>
                              )}
                            </div>
                          )}
                        </section>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm text-slate-600">No questions recorded in this session.</div>
                  )}
                </div>
              </article>
            ) : (
              <div className="app-card flex min-h-[560px] flex-col items-center justify-center rounded-[28px] p-8 text-center">
                <span className="grid h-16 w-16 place-items-center rounded-[24px] bg-blue-50 text-primary"><span className="material-symbols-outlined text-4xl">analytics</span></span>
                <h2 className="mt-6 text-2xl font-extrabold text-slate-950">Select an interview</h2>
                <p className="mt-3 max-w-md text-sm leading-6 text-slate-600">Choose a session from the list to view transcripts, metrics, and coaching feedback.</p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import Navbar from '../components/Navbar';

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
          // Pre-select first session if nothing specified in URL
          fetchSessionDetail(sessionList[0].id);
        }
      } catch (err) {
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
    } catch (err) {
      setError('Failed to retrieve detailed session metrics.');
    } finally {
      setLoadingDetail(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-on-surface font-body-md overflow-x-hidden flex flex-col">
      <Navbar />

      <main className="flex-grow max-w-container-max mx-auto px-margin-desktop pt-32 pb-section-gap w-full flex flex-col">
        <div className="mb-10 text-left">
          <h1 className="font-display text-display text-on-surface mb-2">Performance History</h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl">
            Review all your previous evaluations, detailed transcripts, and scoring charts.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-error-container border border-error/20 rounded-xl text-on-error-container font-label-md text-label-md animate-fade-in">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-start">
          
          {/* Left Side: Session List */}
          <div className="lg:col-span-4 bg-surface-container-lowest p-stack-lg border border-outline-variant/20 rounded-3xl shadow-sm space-y-stack-md flex flex-col h-[650px] sticky top-28">
            <h3 className="font-headline-md text-headline-md text-on-surface border-b border-outline-variant/10 pb-4">Past Sessions</h3>
            
            {loadingList ? (
              <div className="space-y-3">
                <div className="h-20 bg-surface-container-high rounded-xl skeleton"></div>
                <div className="h-20 bg-surface-container-high rounded-xl skeleton"></div>
                <div className="h-20 bg-surface-container-high rounded-xl skeleton"></div>
              </div>
            ) : sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-grow text-center p-4">
                <span className="material-symbols-outlined text-outline text-4xl mb-3">history</span>
                <p className="font-body-md text-body-md text-on-surface-variant">No mock interviews completed yet.</p>
                <button 
                  onClick={() => navigate('/interview')}
                  className="mt-4 px-4 py-2 text-label-md bg-primary text-white rounded-lg cursor-pointer"
                >
                  Start Practice
                </button>
              </div>
            ) : (
              <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar flex-grow">
                {sessions.map((s) => (
                  <div 
                    key={s.id}
                    onClick={() => {
                      fetchSessionDetail(s.id);
                      navigate(`/history?sessionId=${s.id}`, { replace: true });
                    }}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer text-left group ${
                      selectedSession?.id === s.id 
                        ? 'border-primary bg-primary-fixed/20 shadow-sm' 
                        : 'border-outline-variant/30 hover:border-primary/50 hover:bg-surface-container/30'
                    }`}
                  >
                    <p className="font-label-md text-label-md font-bold text-on-surface truncate group-hover:text-primary transition-colors">{s.jobDescription}</p>
                    <div className="flex justify-between items-center mt-3 text-on-surface-variant">
                      <span className="font-label-sm text-label-sm">
                        {new Date(s.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                      <span className={`font-label-sm text-label-sm font-bold ${s.status === 'COMPLETED' ? 'text-primary' : 'text-amber-600'}`}>
                        {s.status === 'COMPLETED' ? `${s.overallScore}%` : 'ACTIVE'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Side: Selected Session Details */}
          <div className="lg:col-span-8">
            {loadingDetail ? (
              <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-3xl skeleton h-[650px]"></div>
            ) : selectedSession ? (
              <div className="glass-card p-stack-lg border border-outline-variant/20 rounded-3xl shadow-sm space-y-stack-lg animate-fade-in relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary-fixed/10 to-transparent pointer-events-none"></div>
                
                {/* Header Summary */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 border-b border-outline-variant/10 pb-8 relative z-10">
                  <div>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full font-label-sm text-label-sm uppercase tracking-wider mb-4 border ${
                      selectedSession.status === 'COMPLETED' 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {selectedSession.status}
                    </span>
                    <h2 className="font-headline-lg text-[24px] font-bold text-on-surface leading-tight max-w-xl mb-2">
                      {selectedSession.jobDescription}
                    </h2>
                    <span className="font-label-sm text-label-sm text-on-surface-variant">
                      Created on {new Date(selectedSession.createdAt).toLocaleString()}
                    </span>
                  </div>

                  {selectedSession.status === 'COMPLETED' && (
                    <div className="flex flex-col items-center justify-center p-4 bg-primary-fixed/30 border border-primary/20 rounded-2xl shrink-0 min-w-[120px]">
                      <span className="font-label-sm text-[10px] uppercase font-bold text-on-surface-variant tracking-wider mb-1">Overall Score</span>
                      <span className="font-display text-[32px] font-bold text-primary">{selectedSession.overallScore}%</span>
                    </div>
                  )}
                </div>

                {/* Q&A logs */}
                <div className="space-y-stack-md relative z-10">
                  <h3 className="font-label-md text-label-md text-on-surface uppercase tracking-widest border-b border-outline-variant/10 pb-3">
                    Sequential Evaluation
                  </h3>
                  
                  {selectedSession.logs && selectedSession.logs.length > 0 ? (
                    selectedSession.logs.map((log, index) => (
                      <div className="p-6 bg-surface-container-lowest/80 border border-outline-variant/20 rounded-2xl space-y-stack-sm hover:shadow-sm transition-shadow" key={log.id}>
                        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-2">
                          <h4 className="font-headline-md text-headline-md text-on-surface leading-snug">
                            <span className="text-primary font-bold mr-2">Q{index + 1}.</span> {log.questionText}
                          </h4>
                          <span className="font-label-sm text-label-sm text-on-surface-variant shrink-0 bg-surface-container-low px-2 py-1 rounded-md">
                            {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        {log.transcript ? (
                          <div className="space-y-4">
                            <div className="p-4 bg-surface rounded-xl border border-outline-variant/10">
                              <span className="font-label-sm text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-2 block">Transcription</span>
                              <p className="font-body-md text-on-surface italic">"{log.transcript}"</p>
                            </div>

                            {log.evaluationMetrics && (
                              <div className="space-y-4 pt-2">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                  <div className="p-3 bg-primary-fixed/35 rounded-xl text-center border border-primary/10">
                                    <span className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Technical</span>
                                    <span className="font-headline-lg text-[22px] font-bold text-primary">{log.evaluationMetrics.technicalAccuracy}%</span>
                                  </div>
                                  <div className="p-3 bg-secondary-fixed/35 rounded-xl text-center border border-secondary/10">
                                    <span className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Clarity</span>
                                    <span className="font-headline-lg text-[22px] font-bold text-secondary">{log.evaluationMetrics.communicationClarity}%</span>
                                  </div>
                                  <div className="p-3 bg-tertiary-fixed/35 rounded-xl text-center border border-tertiary/10">
                                    <span className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Logic</span>
                                    <span className="font-headline-lg text-[22px] font-bold text-tertiary">{log.evaluationMetrics.structuralLogic}%</span>
                                  </div>
                                </div>
                                <div className="p-4 bg-surface-container-highest/20 rounded-xl border border-outline-variant/10">
                                  <span className="font-label-md text-label-md text-on-surface block mb-2 font-semibold">Coach Feedback</span>
                                  <p className="font-body-md text-on-surface-variant leading-relaxed">
                                    {log.evaluationMetrics.constructiveFeedback}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-100 rounded-lg">
                            <span className="material-symbols-outlined text-amber-500 text-sm">pending</span>
                            <p className="font-label-sm text-label-sm text-amber-700 font-semibold italic">This question has not been answered yet.</p>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="font-body-md text-body-md text-on-surface-variant py-4 text-center">No questions recorded in this session.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-surface-container-lowest/50 border border-outline-variant/20 rounded-3xl p-20 text-center shadow-sm flex flex-col items-center justify-center h-[650px]">
                <div className="w-16 h-16 bg-primary-fixed rounded-2xl flex items-center justify-center text-primary mb-6 shadow-sm">
                  <span className="material-symbols-outlined text-4xl font-light">analytics</span>
                </div>
                <h3 className="font-headline-lg text-headline-lg text-on-surface mb-2">Select an Interview</h3>
                <p className="font-body-md text-body-md text-on-surface-variant max-w-md mx-auto">
                  Choose a session from the history list to view detailed evaluation metrics, transcripts, and AI coaching feedback.
                </p>
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}

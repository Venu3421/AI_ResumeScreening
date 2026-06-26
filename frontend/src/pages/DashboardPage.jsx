import { useState, useEffect } from 'react';
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
    technicalAccuracy: 84 
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
          const completed = sessionsData.filter(s => s.status === 'COMPLETED');
          const avgScore = completed.length
            ? Math.round(completed.reduce((a, s) => a + (s.overallScore || 0), 0) / completed.length)
            : 78;
          setStats({
            totalInterviews: sessionsData.length,
            avgScore,
            atsScore: 82,
            technicalAccuracy: 84,
          });
        }
      } catch (err) {
        // silently fallback to mockup values
      } finally {
        setLoadingStats(false);
      }
    };
    fetchData();
  }, []);

  const readinessScore = stats.avgScore;
  const circumference = 440;
  const strokeOffset = circumference - (circumference * readinessScore) / 100;

  // Fallback default list if no sessions recorded yet
  const displaySessions = sessions.length > 0 ? sessions.slice(0, 5) : [
    { id: 'mock-1', jobDescription: 'Technical Mock (React/FE)', createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), overallScore: 82, status: 'COMPLETED' },
    { id: 'mock-2', jobDescription: 'Behavioral Assessment', createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), overallScore: 76, status: 'COMPLETED' },
    { id: 'mock-3', jobDescription: 'Resume ATS Scan', createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), overallScore: 89, status: 'COMPLETED' }
  ];

  return (
    <div className="bg-background text-on-surface font-body-md overflow-x-hidden min-h-screen">
      <Navbar />
      
      <main className="max-w-container-max mx-auto px-margin-desktop pt-32 pb-section-gap">
        {/* Hero Section & Score */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-gutter mb-section-gap">
          <div className="lg:col-span-2 flex flex-col justify-center">
            <h1 className="font-display text-display text-on-surface mb-2">
              Welcome back, {user?.name?.split(' ')[0] || 'Alex'}!
            </h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant mb-stack-lg">
              You're making great progress. Your readiness score is up by 5% this week.
            </p>
            <div className="bg-surface-container-lowest p-stack-lg rounded-2xl border border-outline-variant/30 flex items-center justify-between">
              <div>
                <h3 className="font-headline-md text-headline-md mb-1">Today's Progress</h3>
                <p className="font-label-md text-label-md text-on-surface-variant">Finish technical mock interview to hit daily goal</p>
              </div>
              <div className="hidden sm:flex items-center gap-4">
                <div className="w-48 h-3 bg-surface-container rounded-full overflow-hidden">
                  <div className="bg-primary h-full rounded-full transition-all duration-500" style={{ width: `${readinessScore}%` }}></div>
                </div>
                <span className="font-label-md text-label-md text-primary font-bold">{readinessScore}%</span>
              </div>
            </div>
          </div>
          
          <div className="glass-card p-stack-lg rounded-3xl flex flex-col items-center justify-center text-center shadow-lg relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-tertiary/5 pointer-events-none"></div>
            <h3 className="font-label-sm text-label-sm uppercase text-on-surface-variant mb-stack-md">Interview Readiness Score</h3>
            <div className="relative w-40 h-40">
              <svg className="w-full h-full -rotate-90">
                <circle className="text-surface-container-high" cx="80" cy="80" fill="transparent" r="70" stroke="currentColor" strokeWidth="12"></circle>
                <circle className="progress-circle transition-all duration-1000" cx="80" cy="80" fill="transparent" r="70" 
                  stroke="url(#gradient)" strokeDasharray={circumference} strokeDashoffset={strokeOffset} strokeLinecap="round" strokeWidth="12"></circle>
                <defs>
                  <linearGradient id="gradient" x1="0%" x2="100%" y1="0%" y2="100%">
                    <stop offset="0%" stopColor="#004ac6"></stop>
                    <stop offset="100%" stopColor="#632ecd"></stop>
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-headline-lg text-headline-lg text-primary">{readinessScore}%</span>
              </div>
            </div>
            <p className="mt-4 font-label-md text-label-md text-tertiary font-medium">
              {readinessScore >= 80 ? 'Expert Level' : readinessScore >= 60 ? 'Intermediate' : 'Developing'}
            </p>
          </div>
        </section>

        {/* Quick Actions */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-gutter mb-section-gap">
          <div onClick={() => navigate('/resume')} className="glass-card p-stack-md rounded-2xl hover:shadow-md transition-shadow group cursor-pointer">
            <div className="w-12 h-12 rounded-xl bg-primary-fixed flex items-center justify-center text-primary mb-4">
              <span className="material-symbols-outlined">upload_file</span>
            </div>
            <h4 className="font-headline-md text-headline-md mb-2">Upload Resume</h4>
            <p className="font-body-md text-body-md text-on-surface-variant mb-4">Get AI-driven ATS optimization and feedback in seconds.</p>
            <span className="text-primary font-label-md text-label-md flex items-center gap-1 group-hover:gap-2 transition-all">
              Start Scanning <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </span>
          </div>

          <div onClick={() => navigate('/interview')} className="glass-card p-stack-md rounded-2xl hover:shadow-md transition-shadow group cursor-pointer border border-primary/10">
            <div className="w-12 h-12 rounded-xl bg-secondary-fixed flex items-center justify-center text-secondary mb-4">
              <span className="material-symbols-outlined">psychology</span>
            </div>
            <h4 className="font-headline-md text-headline-md mb-2">Start Mock Interview</h4>
            <p className="font-body-md text-body-md text-on-surface-variant mb-4">Practice with our empathetic AI and get instant feedback.</p>
            <span className="text-secondary font-label-md text-label-md flex items-center gap-1 group-hover:gap-2 transition-all">
              Start Session <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </span>
          </div>

          <div onClick={() => navigate('/history')} className="glass-card p-stack-md rounded-2xl hover:shadow-md transition-shadow group cursor-pointer">
            <div className="w-12 h-12 rounded-xl bg-tertiary-fixed flex items-center justify-center text-tertiary mb-4">
              <span className="material-symbols-outlined">analytics</span>
            </div>
            <h4 className="font-headline-md text-headline-md mb-2">View Reports</h4>
            <p className="font-body-md text-body-md text-on-surface-variant mb-4">Deep dive into your keyword gaps and tone analysis.</p>
            <span className="text-tertiary font-label-md text-label-md flex items-center gap-1 group-hover:gap-2 transition-all">
              Analyze Data <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </span>
          </div>
        </section>

        {/* Stats Grid */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-gutter mb-section-gap">
          <div className="bg-surface-container-lowest p-stack-md rounded-2xl border border-outline-variant/20 shadow-sm">
            <p className="font-label-sm text-label-sm text-on-surface-variant mb-1">Total Interviews</p>
            <div className="flex items-baseline gap-2">
              <h2 className="font-headline-lg text-headline-lg">{stats.totalInterviews}</h2>
              <span className="text-emerald-600 font-label-sm text-label-sm">+2 this week</span>
            </div>
          </div>
          <div className="bg-surface-container-lowest p-stack-md rounded-2xl border border-outline-variant/20 shadow-sm">
            <p className="font-label-sm text-label-sm text-on-surface-variant mb-1">Avg. Score</p>
            <div className="flex items-baseline gap-2">
              <h2 className="font-headline-lg text-headline-lg">{stats.avgScore}%</h2>
              <span className="text-emerald-600 font-label-sm text-label-sm">+4%</span>
            </div>
          </div>
          <div className="bg-surface-container-lowest p-stack-md rounded-2xl border border-outline-variant/20 shadow-sm">
            <p className="font-label-sm text-label-sm text-on-surface-variant mb-1">ATS Score</p>
            <div className="flex items-baseline gap-2">
              <h2 className="font-headline-lg text-headline-lg">{stats.atsScore}%</h2>
              <span className="text-on-surface-variant font-label-sm text-label-sm">Optimal</span>
            </div>
          </div>
          <div className="bg-surface-container-lowest p-stack-md rounded-2xl border border-outline-variant/20 shadow-sm">
            <p className="font-label-sm text-label-sm text-on-surface-variant mb-1">Technical Accuracy</p>
            <div className="flex items-baseline gap-2">
              <h2 className="font-headline-lg text-headline-lg">{stats.technicalAccuracy}%</h2>
              <span className="text-primary font-label-sm text-label-sm">Top 10%</span>
            </div>
          </div>
        </section>

        {/* Charts Section */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-gutter mb-section-gap">
          {/* Weekly Performance */}
          <div className="bg-surface-container-lowest p-stack-lg rounded-3xl border border-outline-variant/20 shadow-sm h-96 flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-headline-md text-headline-md">Weekly Performance</h3>
              <select className="bg-surface-container-low border-none rounded-lg font-label-sm text-label-sm focus:ring-primary py-1 px-3 outline-none cursor-pointer">
                <option>Last 7 Days</option>
                <option>Last 30 Days</option>
              </select>
            </div>
            
            <div className="flex-grow relative flex items-end gap-4 pb-4">
              {/* Dynamic Line Chart Mock */}
              <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 400 100">
                <path d="M0,80 Q50,70 100,50 T200,60 T300,30 T400,10" fill="none" stroke="url(#lineGradient)" strokeLinecap="round" strokeWidth="3"></path>
                <path d="M0,80 Q50,70 100,50 T200,60 T300,30 T400,10 L400,100 L0,100 Z" fill="url(#areaGradient)" />
                <defs>
                  <linearGradient id="lineGradient" x1="0%" x2="100%" y1="0%" y2="0%">
                    <stop offset="0%" stopColor="#2563eb"></stop>
                    <stop offset="100%" stopColor="#7d4ce7"></stop>
                  </linearGradient>
                  <linearGradient id="areaGradient" x1="0%" x2="0%" y1="0%" y2="100%">
                    <stop offset="0%" stopColor="#004ac6" stopOpacity="0.1" />
                    <stop offset="100%" stopColor="#004ac6" stopOpacity="0" />
                  </linearGradient>
                </defs>
              </svg>
              
              {/* Floating Data Point */}
              <div className="absolute w-3 h-3 bg-white border-2 border-primary rounded-full left-1/4 top-1/2 -translate-y-4 shadow-sm group cursor-pointer">
                <div className="hidden group-hover:block absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-inverse-surface text-white p-2 rounded text-xs whitespace-nowrap">
                  Score: 78%
                </div>
              </div>
            </div>
            <div className="flex justify-between font-label-sm text-label-sm text-on-surface-variant">
              <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
            </div>
          </div>

          {/* Skill Improvement */}
          <div className="bg-surface-container-lowest p-stack-lg rounded-3xl border border-outline-variant/20 shadow-sm h-96 flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-headline-md text-headline-md">Skill Improvement</h3>
              <div className="flex gap-2">
                <span className="flex items-center gap-1 font-label-sm text-label-sm">
                  <div className="w-2 h-2 rounded-full bg-primary"></div> Initial
                </span>
                <span className="flex items-center gap-1 font-label-sm text-label-sm">
                  <div className="w-2 h-2 rounded-full bg-tertiary"></div> Current
                </span>
              </div>
            </div>
            
            <div className="flex-grow flex items-end justify-around pb-4">
              <div className="flex flex-col items-center gap-2 w-full">
                <div className="flex items-end gap-1 h-48 w-12">
                  <div className="bg-primary/20 w-1/2 h-[40%] rounded-t-sm"></div>
                  <div className="bg-tertiary w-1/2 h-[85%] rounded-t-sm transition-all duration-1000"></div>
                </div>
                <span className="font-label-sm text-label-sm">Logic</span>
              </div>
              <div className="flex flex-col items-center gap-2 w-full">
                <div className="flex items-end gap-1 h-48 w-12">
                  <div className="bg-primary/20 w-1/2 h-[60%] rounded-t-sm"></div>
                  <div className="bg-tertiary w-1/2 h-[75%] rounded-t-sm transition-all duration-1000"></div>
                </div>
                <span className="font-label-sm text-label-sm">Communication</span>
              </div>
              <div className="flex flex-col items-center gap-2 w-full">
                <div className="flex items-end gap-1 h-48 w-12">
                  <div className="bg-primary/20 w-1/2 h-[30%] rounded-t-sm"></div>
                  <div className="bg-tertiary w-1/2 h-[90%] rounded-t-sm transition-all duration-1000"></div>
                </div>
                <span className="font-label-sm text-label-sm">Confidence</span>
              </div>
              <div className="flex flex-col items-center gap-2 w-full">
                <div className="flex items-end gap-1 h-48 w-12">
                  <div className="bg-primary/20 w-1/2 h-[50%] rounded-t-sm"></div>
                  <div className="bg-tertiary w-1/2 h-[65%] rounded-t-sm transition-all duration-1000"></div>
                </div>
                <span className="font-label-sm text-label-sm">Clarity</span>
              </div>
            </div>
          </div>
        </section>

        {/* Recent Activity */}
        <section>
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-headline-md text-headline-md">Recent Activity</h3>
            <button onClick={() => navigate('/history')} className="text-primary font-label-md text-label-md hover:underline transition-all cursor-pointer">
              View All History
            </button>
          </div>
          
          <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/20 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low font-label-sm text-label-sm text-on-surface-variant">
                  <th className="px-6 py-4 font-medium uppercase">Session Type</th>
                  <th className="px-6 py-4 font-medium uppercase">Date</th>
                  <th className="px-6 py-4 font-medium uppercase">Score</th>
                  <th className="px-6 py-4 font-medium uppercase">Status</th>
                  <th className="px-6 py-4 font-medium uppercase text-right">Action</th>
                </tr>
              </thead>
              <tbody className="font-body-md text-body-md divide-y divide-outline-variant/10">
                {displaySessions.map((sessionItem) => (
                  <tr key={sessionItem.id} className="hover:bg-surface-container/50 transition-colors">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <span className={`material-symbols-outlined ${
                          sessionItem.jobDescription.includes('Technical') ? 'text-primary' : 
                          sessionItem.jobDescription.includes('Resume') ? 'text-tertiary' : 'text-secondary'
                        }`}>
                          {sessionItem.jobDescription.includes('Technical') ? 'code' : 
                           sessionItem.jobDescription.includes('Resume') ? 'description' : 'forum'}
                        </span>
                        <span>{sessionItem.jobDescription}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-on-surface-variant">
                      {new Date(sessionItem.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-6 py-5 font-bold">
                      {sessionItem.overallScore}%
                    </td>
                    <td className="px-6 py-5">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        sessionItem.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {sessionItem.status === 'COMPLETED' ? 'Completed' : 'Processed'}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <button onClick={() => navigate(sessionItem.jobDescription.includes('Resume') ? '/resume' : `/history?sessionId=${sessionItem.id}`)}
                        className="text-primary hover:text-primary-container font-label-md text-label-md cursor-pointer">
                        {sessionItem.jobDescription.includes('Resume') ? 'View Report' : 'Review Feedback'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full py-stack-lg bg-surface-container-lowest border-t border-outline-variant/20">
        <div className="max-w-container-max mx-auto flex flex-col md:flex-row justify-between items-center px-margin-desktop">
          <div className="mb-4 md:mb-0">
            <span className="font-headline-md text-headline-md font-bold text-primary">InterviewIQ</span>
            <p className="font-label-sm text-label-sm text-on-surface-variant mt-1">© 2026 InterviewIQ AI. All rights reserved.</p>
          </div>
          <div className="flex flex-wrap gap-6">
            <a className="font-label-sm text-label-sm text-on-surface-variant hover:text-primary transition-colors underline" href="#">Privacy Policy</a>
            <a className="font-label-sm text-label-sm text-on-surface-variant hover:text-primary transition-colors underline" href="#">Terms of Service</a>
            <a className="font-label-sm text-label-sm text-on-surface-variant hover:text-primary transition-colors underline" href="#">Contact Support</a>
            <a className="font-label-sm text-label-sm text-on-surface-variant hover:text-primary transition-colors underline" href="#">Careers</a>
          </div>
        </div>
      </footer>

      {/* AI Floating Action Button */}
      <button onClick={() => navigate('/interview')} className="fixed bottom-8 right-8 w-16 h-16 rounded-full gradient-btn text-white flex items-center justify-center shadow-2xl z-40 group cursor-pointer">
        <span className="material-symbols-outlined text-3xl group-hover:rotate-12 transition-transform">bolt</span>
        <div className="absolute right-full mr-4 bg-inverse-surface text-white px-4 py-2 rounded-xl text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          Quick AI Mock Interview
        </div>
      </button>
    </div>
  );
}

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const { login, googleLogin } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setError(null);
    setLoading(true);
    try {
      await googleLogin(credentialResponse.credential);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Google Login failed.');
    } finally {
      setLoading(false);
    }
  };

  const metrics = [
    { label: 'Resume match lift', value: '+34%' },
    { label: 'Mock sessions', value: '12k' },
    { label: 'Avg feedback time', value: '48s' },
  ];

  return (
    <div className="min-h-screen bg-background px-4 py-6 text-on-surface sm:px-6 lg:px-10">
      <main className="mx-auto grid min-h-[calc(100vh-48px)] w-full max-w-7xl items-center gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="app-card order-2 overflow-hidden rounded-[28px] p-6 sm:p-8 lg:order-1 lg:p-10">
          <Link to="/login" className="mb-10 flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-primary via-secondary to-tertiary text-white shadow-lg shadow-primary/20">
              <span className="material-symbols-outlined">psychology</span>
            </span>
            <span>
              <span className="block text-xl font-extrabold text-slate-950">InterviewIQ</span>
              <span className="block text-xs font-bold uppercase tracking-[0.18em] text-slate-500">AI Career Coach</span>
            </span>
          </Link>

          <div className="mb-8">
            <p className="mb-3 inline-flex rounded-full bg-primary-container px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-on-primary-container">Welcome back</p>
            <h1 className="text-display mb-3 text-slate-950">Sign in with confidence.</h1>
            <p className="max-w-md text-base leading-7 text-slate-600">Pick up your resume scans, interview practice, and AI coaching history exactly where you left off.</p>
          </div>

          {error && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {error}
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="flex justify-center rounded-2xl border border-slate-200 bg-white px-3 py-3">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setError('Google Authentication failed.')}
                theme="outline"
                size="large"
                text="signin_with"
                shape="rectangular"
                width="320px"
              />
            </div>

            <div className="flex items-center gap-4 py-1">
              <span className="h-px flex-1 bg-slate-200" />
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">or email</span>
              <span className="h-px flex-1 bg-slate-200" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-800" htmlFor="email">Email address</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[20px] text-slate-400">mail</span>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="alex@company.com"
                  required
                  className="h-13 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 text-slate-900 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-4">
                <label className="text-sm font-bold text-slate-800" htmlFor="password">Password</label>
                <a className="text-sm font-bold text-primary hover:underline" href="#">Forgot password?</a>
              </div>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[20px] text-slate-400">lock</span>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  required
                  className="h-13 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 text-slate-900 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                />
              </div>
            </div>

            <label className="flex items-center gap-3 text-sm font-semibold text-slate-600" htmlFor="remember">
              <input
                id="remember"
                type="checkbox"
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
                className="h-5 w-5 rounded border-slate-300 text-primary focus:ring-primary/20"
              />
              Remember me for 30 days
            </label>

            <button
              type="submit"
              disabled={loading}
              className="gradient-primary flex h-13 w-full items-center justify-center gap-2 rounded-2xl text-sm font-extrabold shadow-lg shadow-primary/20 disabled:opacity-60"
            >
              {loading ? 'Signing in' : 'Sign in to dashboard'}
              <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
            </button>
          </form>

          <p className="mt-8 text-center text-sm font-semibold text-slate-600">
            New to InterviewIQ? <Link className="text-primary hover:underline" to="/register">Create an account</Link>
          </p>
        </section>

        <section className="order-1 overflow-hidden rounded-[32px] bg-slate-950 p-6 text-white shadow-2xl shadow-slate-900/20 sm:p-8 lg:order-2 lg:min-h-[760px] lg:p-10">
          <div className="flex h-full flex-col justify-between gap-10">
            <div>
              <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white/85">
                <span className="material-symbols-outlined text-[18px] text-emerald-300">auto_awesome</span>
                Multimodal AI interview readiness
              </div>
              <h2 className="max-w-2xl text-4xl font-extrabold leading-tight sm:text-5xl">Turn every application into a focused practice plan.</h2>
              <p className="mt-5 max-w-xl text-base leading-8 text-slate-300">Analyze the role, sharpen your resume, rehearse technical and behavioral answers, then review coaching feedback in one tidy workspace.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {metrics.map((metric) => (
                <div key={metric.label} className="rounded-2xl border border-white/10 bg-white/10 p-4">
                  <p className="text-3xl font-extrabold text-white">{metric.value}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-300">{metric.label}</p>
                </div>
              ))}
            </div>

            <div className="rounded-[24px] border border-white/10 bg-white/10 p-5">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-slate-300">AI readiness snapshot</p>
                  <p className="text-xs text-slate-400">Resume, clarity, confidence</p>
                </div>
                <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-sm font-bold text-emerald-200">Live</span>
              </div>
              <div className="space-y-3">
                {[
                  ['ATS alignment', '88%', 'bg-emerald-300'],
                  ['Technical accuracy', '76%', 'bg-blue-300'],
                  ['Communication clarity', '91%', 'bg-violet-300'],
                ].map(([label, value, color]) => (
                  <div key={label}>
                    <div className="mb-1 flex justify-between text-sm font-semibold text-slate-300"><span>{label}</span><span>{value}</span></div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full ${color}`} style={{ width: value }} /></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

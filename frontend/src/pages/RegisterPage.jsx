import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function RegisterField({ id, label, type, placeholder, value, onChange, icon }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-bold text-slate-800" htmlFor={id}>{label}</label>
      <div className="relative">
        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[20px] text-slate-400">{icon}</span>
        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required
          className="h-13 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 text-slate-900 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
        />
      </div>
    </div>
  );
}

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!name || !email || !pass || !pass2) {
      setError('Please fill in all fields.');
      return;
    }
    if (pass !== pass2) {
      setError('Passwords do not match.');
      return;
    }
    if (pass.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      await register(name, email, pass);
      setSuccess('Account created successfully. Redirecting to login');
      setTimeout(() => navigate('/login'), 1400);
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Email might already be taken.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-6 text-on-surface sm:px-6 lg:px-10">
      <main className="mx-auto grid min-h-[calc(100vh-48px)] w-full max-w-7xl items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="overflow-hidden rounded-[32px] bg-slate-950 p-6 text-white shadow-2xl shadow-slate-900/20 sm:p-8 lg:min-h-[760px] lg:p-10">
          <div className="flex h-full flex-col justify-between gap-10">
            <div>
              <Link to="/login" className="mb-12 flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-primary">
                  <span className="material-symbols-outlined">psychology</span>
                </span>
                <span>
                  <span className="block text-xl font-extrabold">InterviewIQ</span>
                  <span className="block text-xs font-bold uppercase tracking-[0.18em] text-slate-400">AI Career Coach</span>
                </span>
              </Link>

              <p className="mb-4 inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold text-slate-200">Guided practice workspace</p>
              <h1 className="max-w-2xl text-4xl font-extrabold leading-tight sm:text-5xl">Build a sharper interview loop from day one.</h1>
              <p className="mt-5 max-w-xl text-base leading-8 text-slate-300">Create your account, map your resume against a target role, and run realistic mock interviews with AI-generated evaluation.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { icon: 'description', title: 'ATS resume scoring', copy: 'Find missing keywords and rewrite weak sections.' },
                { icon: 'mic', title: 'Voice mock rounds', copy: 'Record answers and evaluate clarity, logic, and depth.' },
                { icon: 'analytics', title: 'Progress history', copy: 'Track score movement across every practice session.' },
                { icon: 'auto_awesome', title: 'Gemini insights', copy: 'Generate role-specific questions and coaching feedback.' },
              ].map((item) => (
                <div key={item.title} className="rounded-2xl border border-white/10 bg-white/10 p-4">
                  <span className="material-symbols-outlined mb-3 text-2xl text-blue-200">{item.icon}</span>
                  <h2 className="font-bold text-white">{item.title}</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-300">{item.copy}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="app-card rounded-[28px] p-6 sm:p-8 lg:p-10">
          <div className="mb-8">
            <p className="mb-3 inline-flex rounded-full bg-secondary-container px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-on-secondary-container">Create account</p>
            <h2 className="text-display mb-3 text-slate-950">Start practicing smarter.</h2>
            <p className="max-w-md text-base leading-7 text-slate-600">Your workspace keeps resume reviews, mock interview sessions, and feedback history together.</p>
          </div>

          {error && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
              {success}
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <RegisterField id="reg-name" label="Full name" type="text" placeholder="John Doe" value={name} onChange={(event) => setName(event.target.value)} icon="person" />
            <RegisterField id="reg-email" label="Email address" type="email" placeholder="alex@company.com" value={email} onChange={(event) => setEmail(event.target.value)} icon="mail" />
            <RegisterField id="reg-pass" label="Password" type="password" placeholder="Minimum 6 characters" value={pass} onChange={(event) => setPass(event.target.value)} icon="lock" />
            <RegisterField id="reg-pass2" label="Confirm password" type="password" placeholder="Repeat your password" value={pass2} onChange={(event) => setPass2(event.target.value)} icon="lock_reset" />

            <button
              type="submit"
              disabled={loading}
              className="gradient-primary mt-2 flex h-13 w-full items-center justify-center gap-2 rounded-2xl text-sm font-extrabold shadow-lg shadow-primary/20 disabled:opacity-60"
            >
              {loading ? 'Creating account' : 'Create account'}
              <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
            </button>
          </form>

          <p className="mt-8 text-center text-sm font-semibold text-slate-600">
            Already have an account? <Link className="text-primary hover:underline" to="/login">Sign in</Link>
          </p>
        </section>
      </main>
    </div>
  );
}

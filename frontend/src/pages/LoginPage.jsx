import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError]       = useState(null);
  const [loading, setLoading]   = useState(false);
  const { login, googleLogin }  = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
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

  return (
    <div className="min-h-screen bg-background text-on-surface font-body-md overflow-x-hidden flex items-center justify-center relative"
      style={{
        backgroundImage: 'radial-gradient(circle at 0% 0%, rgba(99, 46, 205, 0.05) 0%, transparent 40%), radial-gradient(circle at 100% 100%, rgba(0, 74, 198, 0.05) 0%, transparent 40%)'
      }}>
      
      <main className="w-full max-w-container-max px-margin-mobile md:px-margin-desktop py-stack-lg min-h-[921px] flex items-center">
        {/* Split Layout Container */}
        <div className="grid grid-cols-1 md:grid-cols-12 w-full glass-card rounded-[2rem] overflow-hidden min-h-[800px]">
          
          {/* Left Side: Login Form */}
          <div className="col-span-1 md:col-span-5 p-stack-lg md:p-16 flex flex-col justify-center">
            <div className="mb-stack-lg">
              <div className="flex items-center gap-2 mb-8">
                <div className="w-10 h-10 primary-gradient rounded-xl flex items-center justify-center text-white">
                  <span className="material-symbols-outlined text-2xl">psychology</span>
                </div>
                <h1 className="font-headline-md text-headline-md font-bold tracking-tight text-primary">InterviewIQ</h1>
              </div>
              <h2 className="font-headline-lg text-headline-lg text-on-surface mb-2">Welcome Back</h2>
              <p className="text-on-surface-variant font-body-md">Login to your AI-powered career assistant.</p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-error-container border border-error/20 rounded-xl text-on-error-container font-label-md text-label-md">
                {error}
              </div>
            )}

            <form className="space-y-6" onSubmit={handleSubmit}>
              {/* Google Login container */}
              <div className="w-full flex justify-center">
                <GoogleLogin 
                  onSuccess={handleGoogleSuccess} 
                  onError={() => setError('Google Authentication failed.')} 
                  theme="outline" 
                  size="large" 
                  text="signin_with" 
                  shape="rectangular" 
                  width="350px" 
                />
              </div>

              <div className="relative flex items-center py-2">
                <div className="flex-grow border-t border-outline-variant/50"></div>
                <span className="flex-shrink mx-4 text-on-surface-variant text-label-sm font-label-sm uppercase tracking-widest">or login with email</span>
                <div className="flex-grow border-t border-outline-variant/50"></div>
              </div>

              {/* Email Input */}
              <div className="space-y-2">
                <label className="font-label-md text-on-surface ml-1" htmlFor="email">Email Address</label>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors">mail</span>
                  <input 
                    className="w-full pl-12 pr-4 py-3.5 bg-surface-container-lowest border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none" 
                    id="email" 
                    placeholder="alex@company.com" 
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-2">
                <div className="flex justify-between items-center px-1">
                  <label className="font-label-md text-on-surface" htmlFor="password">Password</label>
                  <a className="font-label-sm text-primary hover:underline transition-all" href="#">Forgot password?</a>
                </div>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors">lock</span>
                  <input 
                    className="w-full pl-12 pr-4 py-3.5 bg-surface-container-lowest border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none" 
                    id="password" 
                    placeholder="••••••••" 
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Remember Me */}
              <div className="flex items-center gap-3 px-1">
                <input 
                  className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary/20" 
                  id="remember" 
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                <label className="font-label-md text-on-surface-variant cursor-pointer" htmlFor="remember">Remember me for 30 days</label>
              </div>

              {/* Login Button */}
              <button 
                type="submit"
                disabled={loading}
                className="w-full primary-gradient text-white font-headline-md py-4 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 group cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                <span>{loading ? 'Signing In...' : 'Sign In to Dashboard'}</span>
                <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
              </button>
            </form>

            <p className="mt-8 text-center font-body-md text-on-surface-variant">
              Don't have an account? <Link className="text-primary font-bold hover:underline" to="/register">Create an account</Link>
            </p>
          </div>

          {/* Right Side: Visual Content */}
          <div className="hidden md:block md:col-span-7 relative overflow-hidden bg-primary-container">
            <div className="absolute inset-0 z-0">
              <div className="absolute inset-0 bg-gradient-to-tr from-primary/40 to-transparent"></div>
            </div>
            <div className="relative z-10 h-full flex flex-col justify-end p-16 text-white">
              <div className="max-w-lg">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 mb-6">
                  <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                  <span className="font-label-sm">NEW: Gemini 3.5 Integration Live</span>
                </div>
                <h3 className="font-display text-display mb-6 leading-tight">Master your next interview with <span className="text-secondary-fixed">precision.</span></h3>
                <p className="text-body-lg text-white/80 mb-10">Join 50,000+ professionals using InterviewIQ to land offers at top-tier tech companies through personalized AI coaching and real-time analysis.</p>
                
                {/* Floating Feedback UI Mockup */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="glass-card p-4 rounded-2xl border-white/10 bg-white/5 backdrop-blur-xl">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-400/20 flex items-center justify-center">
                        <span className="material-symbols-outlined text-emerald-400 text-lg">check_circle</span>
                      </div>
                      <span className="font-label-md text-white">Sentiment Score</span>
                    </div>
                    <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-400 w-[92%]"></div>
                    </div>
                    <p className="text-white/60 font-label-sm mt-2">Excellent confidence level</p>
                  </div>
                  <div className="glass-card p-4 rounded-2xl border-white/10 bg-white/5 backdrop-blur-xl">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 rounded-full bg-amber-400/20 flex items-center justify-center">
                        <span className="material-symbols-outlined text-amber-400 text-lg">graphic_eq</span>
                      </div>
                      <span className="font-label-md text-white">Tone Analysis</span>
                    </div>
                    <div className="flex gap-1 h-8 items-end">
                      <div className="w-1 bg-white/40 h-3 rounded-full"></div>
                      <div className="w-1 bg-white/40 h-6 rounded-full"></div>
                      <div className="w-1 bg-white h-8 rounded-full"></div>
                      <div className="w-1 bg-white/60 h-5 rounded-full"></div>
                      <div className="w-1 bg-white/40 h-4 rounded-full"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Background Image Layer */}
            <div className="absolute top-0 right-0 w-full h-full z-[-1]">
              <div 
                className="w-full h-full bg-cover bg-center opacity-30" 
                style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuAIwNGWdp5Y4FB5vfAaOVIXvgMLaBCglkr6REvUop5jCyvG7GBI1aqUod2t8XaPJG_fE8KoX_oTXj_OLt6fGaLHzV0zlIEklruGWfJA4sQmgGiLhNMJJymRSux0gHvv1mtwfiPwaFKGlPm-DZ35D_Q8gT1KNaXrg1sQ6VLmneAM03jvk63CWtJje4mW3rEA4GAJvhIOIoaJUh3vhDptIB3fClFeZudL0g5--nS2mAV-jTCvBWGs3Qn3PYP0Xzl4aGZRd8G0z-Dba7g')" }}
              />
            </div>
          </div>
          
        </div>
      </main>

      {/* Footer Links */}
      <footer className="fixed bottom-8 w-full flex justify-center px-margin-mobile">
        <div className="flex flex-wrap justify-center gap-x-8 gap-y-2 text-on-surface-variant font-label-sm">
          <span>© 2026 InterviewIQ AI</span>
          <a className="hover:text-primary transition-colors" href="#">Privacy Policy</a>
          <a className="hover:text-primary transition-colors" href="#">Terms of Service</a>
          <a className="hover:text-primary transition-colors" href="#">Help Center</a>
        </div>
      </footer>

    </div>
  );
}

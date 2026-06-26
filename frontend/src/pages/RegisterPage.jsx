import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RegisterPage() {
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [pass, setPass]         = useState('');
  const [pass2, setPass2]       = useState('');
  const [error, setError]       = useState(null);
  const [success, setSuccess]   = useState(null);
  const [loading, setLoading]   = useState(false);
  const { register }            = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
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
    setLoading(true);
    try {
      await register(name, email, pass);
      setSuccess('Account created successfully! Redirecting to login…');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Email might already be taken.');
    } finally {
      setLoading(false);
    }
  };

  const Field = ({ id, label, type, placeholder, value, onChange, icon }) => (
    <div className="space-y-2">
      <label className="font-label-md text-on-surface ml-1" htmlFor={id}>{label}</label>
      <div className="relative group">
        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors">{icon}</span>
        <input 
          id={id} 
          type={type} 
          placeholder={placeholder} 
          value={value} 
          onChange={onChange} 
          required
          className="w-full pl-12 pr-4 py-3.5 bg-surface-container-lowest border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none" 
        />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-on-surface font-body-md overflow-x-hidden flex items-center justify-center relative"
      style={{
        backgroundImage: 'radial-gradient(circle at 0% 0%, rgba(99, 46, 205, 0.05) 0%, transparent 40%), radial-gradient(circle at 100% 100%, rgba(0, 74, 198, 0.05) 0%, transparent 40%)'
      }}>
      
      <main className="w-full max-w-container-max px-margin-mobile md:px-margin-desktop py-stack-lg min-h-[921px] flex items-center">
        {/* Split Layout Container */}
        <div className="grid grid-cols-1 md:grid-cols-12 w-full glass-card rounded-[2rem] overflow-hidden min-h-[800px]">
          
          {/* Left Side: Register Form */}
          <div className="col-span-1 md:col-span-5 p-stack-lg md:p-16 flex flex-col justify-center">
            <div className="mb-stack-lg">
              <div className="flex items-center gap-2 mb-8">
                <div className="w-10 h-10 primary-gradient rounded-xl flex items-center justify-center text-white">
                  <span className="material-symbols-outlined text-2xl">psychology</span>
                </div>
                <h1 className="font-headline-md text-headline-md font-bold tracking-tight text-primary">InterviewIQ</h1>
              </div>
              <h2 className="font-headline-lg text-headline-lg text-on-surface mb-2">Create Account</h2>
              <p className="text-on-surface-variant font-body-md">Sign up to kickstart your preparation.</p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-error-container border border-error/20 rounded-xl text-on-error-container font-label-md text-label-md">
                {error}
              </div>
            )}
            {success && (
              <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 font-label-md text-label-md">
                {success}
              </div>
            )}

            <form className="space-y-4" onSubmit={handleSubmit}>
              <Field id="reg-name"  label="Full Name"         type="text"     placeholder="John Doe"         value={name}  onChange={e=>setName(e.target.value)}  icon="person" />
              <Field id="reg-email" label="Email Address"     type="email"    placeholder="alex@company.com" value={email} onChange={e=>setEmail(e.target.value)} icon="mail" />
              <Field id="reg-pass"  label="Password"          type="password" placeholder="Min 6 characters" value={pass}  onChange={e=>setPass(e.target.value)}  icon="lock" />
              <Field id="reg-pass2" label="Confirm Password"  type="password" placeholder="••••••••"         value={pass2} onChange={e=>setPass2(e.target.value)} icon="lock_reset" />

              <button 
                type="submit" 
                disabled={loading}
                className="w-full primary-gradient text-white font-headline-md py-4 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 group mt-6 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                <span>{loading ? 'Creating Account…' : 'Register'}</span>
                <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
              </button>
            </form>

            <p className="mt-8 text-center font-body-md text-on-surface-variant">
              Already have an account? <Link className="text-primary font-bold hover:underline" to="/login">Sign in</Link>
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
                  <span className="font-label-sm">NEW: Multimodal Accent Resilience</span>
                </div>
                <h3 className="font-display text-display mb-6 leading-tight">Prepare for the future with <span className="text-secondary-fixed">confidence.</span></h3>
                <p className="text-body-lg text-white/80 mb-10">Sign up and instantly scan your resume compatibility or practice advanced backend questions evaluated by state of the art AI models.</p>
                
                {/* Visual features layout */}
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { icon: 'workspace_premium', color: 'text-emerald-400', label: 'Resume ATS Check', desc: 'Verify skill frequency and alignment metrics.' },
                    { icon: 'mic_external_on', color: 'text-amber-400', label: 'Mock Interview Arena', desc: 'Practice speaking to deep system design questions.' },
                  ].map((b) => (
                    <div key={b.label} className="glass-card p-4 rounded-2xl border-white/10 bg-white/5 backdrop-blur-xl">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`material-symbols-outlined ${b.color} text-xl`}>{b.icon}</span>
                        <span className="font-label-md text-white font-medium">{b.label}</span>
                      </div>
                      <p className="text-white/60 text-xs leading-normal">{b.desc}</p>
                    </div>
                  ))}
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

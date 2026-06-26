import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

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
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/70 bg-white/80 shadow-[0_12px_40px_rgba(15,23,42,0.06)] backdrop-blur-2xl">
      <div className="mx-auto flex h-20 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-10">
        <div className="flex items-center gap-4 lg:gap-8">
          <Link to="/dashboard" className="flex items-center gap-3" onClick={() => setMenuOpen(false)}>
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-primary via-secondary to-tertiary text-white shadow-lg shadow-primary/20">
              <span className="material-symbols-outlined text-[23px]">psychology</span>
            </span>
            <span className="leading-tight">
              <span className="block text-lg font-extrabold text-slate-950">InterviewIQ</span>
              <span className="hidden text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 sm:block">AI Coach</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 rounded-2xl border border-slate-200 bg-white/75 p-1 lg:flex">
            {navLinks.map((link) => <NavLink key={link.to} link={link} />)}
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            className="hidden h-10 w-10 place-items-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-primary sm:grid"
            aria-label="Notifications"
          >
            <span className="material-symbols-outlined text-[22px]">notifications</span>
          </button>
          <button
            type="button"
            className="hidden h-10 w-10 place-items-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-primary sm:grid"
            aria-label="Settings"
          >
            <span className="material-symbols-outlined text-[22px]">settings</span>
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setProfileOpen((open) => !open)}
              className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-2 py-2 shadow-sm transition-colors hover:border-primary/30"
              aria-label="Open profile menu"
            >
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-950 text-sm font-bold text-white">{initials}</span>
              <span className="hidden max-w-36 text-left md:block">
                <span className="block truncate text-sm font-bold text-slate-900">{user?.name || 'Candidate'}</span>
                <span className="block truncate text-xs text-slate-500">{user?.email || 'Ready to practice'}</span>
              </span>
              <span className="material-symbols-outlined hidden text-[20px] text-slate-400 md:block">expand_more</span>
            </button>

            {profileOpen && (
              <div className="absolute right-0 mt-3 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10">
                <div className="border-b border-slate-100 px-4 py-4">
                  <p className="truncate text-sm font-bold text-slate-900">{user?.name || 'Candidate'}</p>
                  <p className="truncate text-xs text-slate-500">{user?.email || 'candidate@interviewiq.ai'}</p>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
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
            {navLinks.map((link) => <NavLink key={link.to} link={link} mobile />)}
          </nav>
        </div>
      )}
    </header>
  );
}

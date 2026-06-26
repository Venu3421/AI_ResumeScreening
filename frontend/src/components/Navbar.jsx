import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showDropdown, setShowDropdown] = useState(false);

  const navLinks = [
    { label: 'Dashboard', to: '/dashboard' },
    { label: 'Resume',    to: '/resume' },
    { label: 'Interview', to: '/interview' },
    { label: 'History',   to: '/history' },
  ];

  const isActive = (to) => location.pathname === to;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="fixed top-0 w-full z-50 bg-surface/70 backdrop-blur-xl border-b border-white/20 shadow-sm">
      <div className="max-w-container-max mx-auto flex justify-between items-center px-margin-desktop py-4">
        
        {/* Logo + Nav Links */}
        <div className="flex items-center gap-8">
          <Link to="/dashboard" className="font-headline-md text-headline-md font-bold text-primary">
            InterviewIQ
          </Link>
          <div className="hidden md:flex gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`font-body-md text-body-md transition-colors duration-200 pb-1 ${
                  isActive(link.to)
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-on-surface-variant hover:text-primary'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-4">
          <button className="p-2 text-on-surface-variant hover:text-primary transition-colors cursor-pointer">
            <span className="material-symbols-outlined">notifications</span>
          </button>
          <button className="p-2 text-on-surface-variant hover:text-primary transition-colors cursor-pointer">
            <span className="material-symbols-outlined">settings</span>
          </button>
          
          <div className="relative">
            <button
              className="w-10 h-10 rounded-full overflow-hidden border-2 border-primary-fixed cursor-pointer outline-none block"
              onClick={() => setShowDropdown((p) => !p)}
            >
              <img
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuABtUlTVBXBG9LGJx2MWyEEfgcwDARWZ1tPgzVrqd9HEgh_OC63ZDNvEIch5jOjS-p2210NZB6cxQRJL41VADZwvmgvvDZUhW1HAJEiZ0rUHNTMSgjZ5f2GK81WNQ6ByjABsEDAkMXIIknG0FEI2dqKUgDyrJvxNcuc_omcMtEhXZdjoIxp1ieuC4A8H0tfFPj-A5c6WBAPEksM6iUUdpNnY_agzZ7ac7jJwsVkvjTmkTMoYLe888C2_t7vzYqLePv2_NwQEJ9URNo"
                alt="User profile"
                className="w-full h-full object-cover"
              />
            </button>
            
            {showDropdown && (
              <div className="absolute right-0 mt-2 w-48 rounded-xl shadow-lg border py-1 z-50 bg-surface-container-lowest border-outline-variant/30">
                <div className="px-4 py-3 border-b border-outline-variant/10">
                  <p className="text-label-md font-semibold text-on-surface truncate">
                    {user?.name || 'Alex'}
                  </p>
                  <p className="text-label-sm text-on-surface-variant truncate">{user?.email || 'alex@company.com'}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-label-md transition-colors text-error hover:bg-error-container/20 cursor-pointer"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>

      </div>
    </nav>
  );
}

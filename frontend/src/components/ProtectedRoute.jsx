import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * ProtectedRoute wraps routes that require authentication.
 * Redirects to /login if the user is not authenticated.
 * Shows a loading spinner while auth state is being restored.
 */
export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[var(--surface)]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-[var(--on-surface-variant)] font-medium tracking-wide">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

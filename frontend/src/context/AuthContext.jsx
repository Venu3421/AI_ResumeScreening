import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

/**
 * AuthProvider wraps the application and provides authentication state
 * (user, token, login, logout, register, googleLogin) to all child components.
 * Persists JWT token and user info in localStorage.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore auth state from localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('interviewiq_token');
    const storedUser = localStorage.getItem('interviewiq_user');
    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      } catch (e) {
        localStorage.removeItem('interviewiq_token');
        localStorage.removeItem('interviewiq_user');
      }
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (email, password) => {
    const response = await api.post('/api/v1/auth/login', { email, password });
    const { token: jwt, user: userData } = response.data;
    localStorage.setItem('interviewiq_token', jwt);
    localStorage.setItem('interviewiq_user', JSON.stringify(userData));
    setToken(jwt);
    setUser(userData);
    return response.data;
  }, []);

  const register = useCallback(async (name, email, password) => {
    const response = await api.post('/api/v1/auth/register', { name, email, password });
    return response.data;
  }, []);

  const googleLogin = useCallback(async (credential) => {
    const response = await api.post('/api/v1/auth/google', { credential });
    const { token: jwt, user: userData } = response.data;
    localStorage.setItem('interviewiq_token', jwt);
    localStorage.setItem('interviewiq_user', JSON.stringify(userData));
    setToken(jwt);
    setUser(userData);
    return response.data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('interviewiq_token');
    localStorage.removeItem('interviewiq_user');
    setToken(null);
    setUser(null);
  }, []);

  const isAuthenticated = !!token;

  const value = {
    user,
    token,
    loading,
    isAuthenticated,
    login,
    register,
    googleLogin,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Custom hook to access authentication context.
 * Must be used within an AuthProvider.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;

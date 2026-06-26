import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

/**
 * Pre-configured Axios instance for all backend API calls.
 * Automatically attaches the JWT authorization header from localStorage.
 */
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: Attach JWT token to every outgoing request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('interviewiq_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor: Handle 401 responses by clearing auth state
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('interviewiq_token');
      localStorage.removeItem('interviewiq_user');
      // Redirect to login if not already there
      if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;

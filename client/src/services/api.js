import axios from 'axios';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5002/api',
  timeout: 30000, // Increased to 30 seconds
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response) {
      // Server responded with error
      if (error.response.status === 401) {
        // Unauthorized - clear token and redirect to login
        // But only if we're not on a guest-accessible page or auth pages
        const guestPages = ['/', '/service/code', '/song'];
        const authPages = ['/login', '/register'];
        const currentPath = window.location.pathname;
        const isGuestPage = guestPages.some(page => currentPath === page || currentPath.startsWith(page + '/'));
        const isAuthPage = authPages.some(page => currentPath === page || currentPath.startsWith(page + '/'));

        // Also check if this is a login/register API call - don't redirect on failed auth attempts
        const isAuthRequest = error.config && (
          error.config.url.includes('/auth/login') ||
          error.config.url.includes('/auth/register')
        );

        if (!isGuestPage && !isAuthPage && !isAuthRequest) {
          localStorage.removeItem('token');
          window.location.href = '/login';
        }
      }
      return Promise.reject(error.response.data);
    } else if (error.request) {
      // Request made but no response
      return Promise.reject({ error: 'No response from server' });
    } else {
      // Something else happened
      return Promise.reject({ error: error.message });
    }
  }
);

export default api;

import axios from 'axios';

let resolvedBaseUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '/api';
if (resolvedBaseUrl && !resolvedBaseUrl.startsWith('http') && !resolvedBaseUrl.startsWith('/')) {
  resolvedBaseUrl = `https://${resolvedBaseUrl}`;
}
if (resolvedBaseUrl.startsWith('http') && !resolvedBaseUrl.endsWith('/api') && !resolvedBaseUrl.includes('/api/')) {
  resolvedBaseUrl = `${resolvedBaseUrl.replace(/\/+$/, '')}/api`;
}

// API client with JWT interceptor
const api = axios.create({
  baseURL: resolvedBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('opticlass_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Redirect to login on 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('opticlass_token');
      localStorage.removeItem('opticlass_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

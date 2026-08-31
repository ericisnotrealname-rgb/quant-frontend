import axios from 'axios';

function getCookie(name: string) {
  const matches = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return matches ? decodeURIComponent(matches[1]) : '';
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 30000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    if (config.method && config.method.toLowerCase() !== 'get') {
      const csrf = getCookie('csrftoken');
      if (csrf) {
        config.headers = {
          ...(config.headers || {}),
          'X-CSRFToken': csrf,
        } as unknown as typeof config.headers;
      }
    }
    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  },
);

export default api;

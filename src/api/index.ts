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
  (response) => {
    // 兼容统一分页响应（N-01）：后端列表接口统一返回
    // { count, next, previous, page, total_pages, results }，
    // 旧客户端将 response.data 直接作为结果数组使用，
    // 这里统一解包 results，保持旧页面字段兼容、无需逐页改动。
    const data = response.data;
    if (
      data &&
      typeof data === 'object' &&
      !Array.isArray(data) &&
      Array.isArray(data.results) &&
      typeof data.count === 'number'
    ) {
      response.data = data.results;
    }
    return response;
  },
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  },
);

export default api;

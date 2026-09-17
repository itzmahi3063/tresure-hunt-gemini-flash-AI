import axios from 'axios';
import { getTelegramInitData, getTelegramUser } from './telegram';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use((config) => {
  const initData = getTelegramInitData();
  const user = getTelegramUser();

  if (initData) {
    config.headers['x-telegram-init-data'] = initData;
  } else if (user) {
    // Development fallback
    config.headers['x-test-user-id'] = user.id;
    config.headers['x-test-first-name'] = user.first_name || '';
    config.headers['x-test-username'] = user.username || '';
  }

  return config;
});

export default api;

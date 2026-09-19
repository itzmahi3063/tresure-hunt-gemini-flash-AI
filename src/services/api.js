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

// Any endpoint can 403 with { deviceConflict: true } if this account gets
// flagged as sharing a device with another one mid-session (see
// blockIfDeviceConflict in server/index.js). Surface it as a global event
// instead of a generic error toast, so the app can show DeviceBlockedScreen
// no matter which action triggered it.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.data?.deviceConflict && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('device-conflict', {
        detail: error.response.data.linkedUser || null
      }));
    }
    return Promise.reject(error);
  }
);

export default api;

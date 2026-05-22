import axios from 'axios';
import { ElMessage } from 'element-plus';
import { clearSession, getToken } from '../session.js';
import { router } from '../router.js';

export const api = axios.create({
  baseURL: '/prod-api',
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => {
    if (response.config.responseType === 'blob') return response;
    const body = response.data;
    if (body && typeof body === 'object' && body.code !== undefined && body.code !== 200) {
      if (body.code === 401) {
        clearSession();
        router.replace('/login');
      }
      return Promise.reject(new Error(body.msg || '请求失败'));
    }
    return body && body.data !== undefined ? body.data : body;
  },
  (error) => {
    if (error.response?.status === 401) {
      clearSession();
      router.replace('/login');
    }
    if (!error.config?.silent) {
      ElMessage.error(error.message || '网络请求失败');
    }
    return Promise.reject(error);
  },
);

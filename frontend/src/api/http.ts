import axios, { AxiosError, type AxiosRequestConfig } from 'axios';

/**
 * 统一 axios 实例。
 * - baseURL 走同源相对路径，dev 由 vite proxy 转发到 FastAPI(127.0.0.1:8000)；
 *   发布到子路径时拼接应用根前缀，避免裸根路径。
 * - 请求拦截器注入 JWT；响应拦截器在 401 时清理登录态并跳转登录页。
 */
const APP_BASE = (import.meta.env.MIAODA_CLIENT_BASE_PATH || '/').replace(/\/$/, '');

export const http = axios.create({
  baseURL: `${APP_BASE}/api/v1`,
  timeout: 120000, // 心电分析含模型推理，给足时间
});

const TOKEN_KEY = 'ecg-screen:token';

export const tokenStore = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* 隐私模式静默降级 */
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
};

http.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/** 401 处理：由 auth store 注册，避免 http 层反向依赖 store 造成循环引用。 */
type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler | null = null;
export function setUnauthorizedHandler(fn: UnauthorizedHandler) {
  onUnauthorized = fn;
}

http.interceptors.response.use(
  (resp) => resp,
  (error: AxiosError) => {
    if (error.response?.status === 401 && onUnauthorized) {
      onUnauthorized();
    }
    return Promise.reject(error);
  },
);

/** 从 axios 错误里取后端 detail，给 toast 用。 */
export function extractError(err: unknown, fallback = '请求失败，请稍后重试'): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { detail?: unknown } | undefined;
    const detail = data?.detail;
    if (typeof detail === 'string' && detail) return detail;
    if (Array.isArray(detail) && detail.length) {
      const first = detail[0] as { msg?: string };
      if (first?.msg) return first.msg;
    }
    if (err.code === 'ECONNABORTED') return '请求超时，请稍后重试';
    if (!err.response) return '无法连接服务器，请确认后端已启动';
  }
  return fallback;
}

/** 下载类请求（TXT/PDF），返回 Blob。 */
export async function downloadBlob(
  url: string,
  params?: Record<string, unknown>,
): Promise<Blob> {
  const config: AxiosRequestConfig = { responseType: 'blob', params };
  const resp = await http.get<Blob>(url, config);
  return resp.data;
}

export default http;

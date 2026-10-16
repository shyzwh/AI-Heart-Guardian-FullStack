import { create } from 'zustand';
import {
  login as apiLogin,
  register as apiRegister,
  fetchMe,
  type ILoginPayload,
  type IRegisterPayload,
} from '@/api/auth';
import { tokenStore, setUnauthorizedHandler } from '@/api/http';
import type { IUser, Role } from '@/types';

interface IAuthState {
  user: IUser | null;
  role: Role | null;
  displayName: string;
  token: string | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  login: (payload: ILoginPayload) => Promise<Role>;
  register: (payload: IRegisterPayload) => Promise<Role>;
  logout: () => void;
}

const USER_KEY = 'ecg-screen:user';

function loadCachedUser(): IUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as IUser) : null;
  } catch {
    return null;
  }
}

function cacheUser(user: IUser | null) {
  try {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  } catch {
    /* ignore */
  }
}

export const useAuthStore = create<IAuthState>((set, get) => {
  // 401 时统一登出（http 层不直接依赖 store）
  setUnauthorizedHandler(() => {
    get().logout();
  });

  return {
    user: null,
    role: null,
    displayName: '',
    token: null,
    hydrated: false,

    hydrate: async () => {
      const token = tokenStore.get();
      if (!token) {
        set({ hydrated: true });
        return;
      }
      const cached = loadCachedUser();
      set({
        token,
        user: cached,
        role: cached?.role ?? null,
        displayName: cached?.display_name ?? '',
      });
      try {
        const me = await fetchMe();
        cacheUser(me);
        set({ user: me, role: me.role, displayName: me.display_name });
      } catch {
        // token 失效：清理，回到登录页
        tokenStore.clear();
        cacheUser(null);
        set({ user: null, role: null, displayName: '', token: null });
      } finally {
        set({ hydrated: true });
      }
    },

    login: async (payload) => {
      const data = await apiLogin(payload);
      tokenStore.set(data.access_token);
      const me = await fetchMe();
      cacheUser(me);
      set({
        token: data.access_token,
        user: me,
        role: me.role,
        displayName: me.display_name,
      });
      return me.role;
    },

    register: async (payload) => {
      // 注册接口返回用户信息但不发 token，注册成功后用同一凭证登录换取 token
      await apiRegister(payload);
      const data = await apiLogin({
        username: payload.username,
        password: payload.password,
      });
      tokenStore.set(data.access_token);
      const me = await fetchMe();
      cacheUser(me);
      set({
        token: data.access_token,
        user: me,
        role: me.role,
        displayName: me.display_name,
      });
      return me.role;
    },

    logout: () => {
      tokenStore.clear();
      cacheUser(null);
      set({ user: null, role: null, displayName: '', token: null });
    },
  };
});

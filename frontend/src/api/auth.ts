import { http } from './http';
import type { IToken, IUser, Role } from '@/types';
export interface ILoginPayload {
  username: string;
  password: string;
}

export interface IRegisterPayload {
  username: string;
  password: string;
  role: Role;
  display_name?: string;
  phone?: string;
}

/** 后端登录用 OAuth2 表单编码。 */
export async function login(payload: ILoginPayload): Promise<IToken> {
  const form = new URLSearchParams();
  form.append('username', payload.username);
  form.append('password', payload.password);
  const resp = await http.post<IToken>('/auth/login', form, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  return resp.data;
}

/** 后端注册返回用户信息（不含 token），注册后需再调用 login 取 token。 */
export async function register(payload: IRegisterPayload): Promise<IUser> {
  const resp = await http.post<IUser>('/auth/register', payload);
  return resp.data;
}

export async function fetchMe(): Promise<IUser> {
  const resp = await http.get<IUser>('/auth/me');
  return resp.data;
}

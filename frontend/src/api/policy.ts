import { http } from './http';
import type { IPolicy } from '@/types';

export async function listPolicies(category?: string): Promise<IPolicy[]> {
  const resp = await http.get<IPolicy[]>('/policy', {
    params: category ? { category } : undefined,
  });
  return resp.data;
}

export async function listPolicyCategories(): Promise<string[]> {
  const resp = await http.get<string[]>('/policy/categories');
  return resp.data;
}

export async function getPolicy(id: number): Promise<IPolicy> {
  const resp = await http.get<IPolicy>(`/policy/${id}`);
  return resp.data;
}

export interface IPolicyPayload {
  title: string;
  category?: string;
  source?: string;
  source_url?: string;
  published_at?: string | null;
  summary?: string;
  content?: string;
  cover_image?: string;
  is_published?: boolean;
}

export async function createPolicy(payload: IPolicyPayload): Promise<IPolicy> {
  const resp = await http.post<IPolicy>('/policy', payload);
  return resp.data;
}

export async function updatePolicy(id: number, payload: IPolicyPayload): Promise<IPolicy> {
  const resp = await http.put<IPolicy>(`/policy/${id}`, payload);
  return resp.data;
}

export async function deletePolicy(id: number): Promise<void> {
  await http.delete(`/policy/${id}`);
}

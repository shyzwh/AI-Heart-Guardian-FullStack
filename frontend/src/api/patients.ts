import { http } from './http';
import type { IPatient, IPatientPayload } from '@/types';

export async function listPatients(): Promise<IPatient[]> {
  const resp = await http.get<IPatient[]>('/patients');
  return resp.data;
}

export async function getPatient(id: number): Promise<IPatient> {
  const resp = await http.get<IPatient>(`/patients/${id}`);
  return resp.data;
}

export async function getMyProfile(): Promise<IPatient> {
  const resp = await http.get<IPatient>('/patients/me/profile');
  return resp.data;
}

export async function createPatient(payload: IPatientPayload): Promise<IPatient> {
  const resp = await http.post<IPatient>('/patients', payload);
  return resp.data;
}

export async function updatePatient(
  id: number,
  payload: Partial<IPatientPayload>,
): Promise<IPatient> {
  const resp = await http.put<IPatient>(`/patients/${id}`, payload);
  return resp.data;
}

export async function deletePatient(id: number): Promise<void> {
  await http.delete(`/patients/${id}`);
}

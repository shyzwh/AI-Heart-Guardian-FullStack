import { http } from './http';
import type {
  ICheckIn,
  IContact,
  IFollowUp,
  IRehabPlan,
} from '@/types';

// ---------- 紧急联系人 / SOS ----------

export async function listContacts(deviceKey?: string): Promise<IContact[]> {
  const resp = await http.get<IContact[]>('/emergency-contacts', {
    params: deviceKey ? { device_key: deviceKey } : undefined,
  });
  return resp.data;
}

export async function createContact(
  payload: {
    name: string;
    relation?: string;
    phone: string;
    is_primary?: boolean;
    patient_id?: number;
  },
  deviceKey?: string,
): Promise<IContact> {
  const resp = await http.post<IContact>('/emergency-contacts', payload, {
    params: deviceKey ? { device_key: deviceKey } : undefined,
  });
  return resp.data;
}

export async function deleteContact(id: number): Promise<void> {
  await http.delete(`/emergency-contacts/${id}`);
}

export interface ISosResult {
  dial: string | null;
  primary: IContact | null;
  contacts: IContact[];
  fallback_emergency: string;
  notice: string;
}

export async function triggerSos(
  deviceKey = '',
  patientId?: number,
): Promise<ISosResult> {
  const resp = await http.post<ISosResult>('/emergency/sos', {
    device_key: deviceKey,
    patient_id: patientId,
  });
  return resp.data;
}

// ---------- 健康打卡 ----------

export async function listCheckIns(patientId: number): Promise<ICheckIn[]> {
  const resp = await http.get<ICheckIn[]>(`/checkins/${patientId}`);
  return resp.data;
}

export async function createCheckIn(payload: {
  patient_id: number;
  checkin_date?: string;
  symptoms?: string;
  symptom_tags?: string[];
  heart_rate?: number | null;
  blood_pressure?: string;
  mood?: string;
  note?: string;
}): Promise<ICheckIn> {
  const resp = await http.post<ICheckIn>('/checkins', payload);
  return resp.data;
}

// ---------- 康复方案 ----------

export async function getRehabPlans(patientId: number, limit = 10): Promise<IRehabPlan[]> {
  const resp = await http.get<IRehabPlan[]>(`/rehab/${patientId}`, {
    params: { limit },
  });
  return resp.data;
}

export async function generateRehab(
  patientId: number,
  ecgRecordId?: number,
): Promise<IRehabPlan> {
  const resp = await http.post<IRehabPlan>('/rehab/generate', {
    patient_id: patientId,
    ecg_record_id: ecgRecordId,
  });
  return resp.data;
}

// ---------- 随访 ----------

export async function listFollowUps(): Promise<IFollowUp[]> {
  const resp = await http.get<IFollowUp[]>('/followups');
  return resp.data;
}

export async function createFollowUp(payload: {
  patient_id: number;
  ecg_record_id?: number;
  due_date?: string;
  content?: string;
}): Promise<IFollowUp> {
  const resp = await http.post<IFollowUp>('/followups', payload);
  return resp.data;
}

export async function completeFollowUp(id: number): Promise<IFollowUp> {
  const resp = await http.patch<IFollowUp>(`/followups/${id}/done`);
  return resp.data;
}

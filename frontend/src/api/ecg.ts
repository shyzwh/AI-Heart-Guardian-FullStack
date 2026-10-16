import { http } from './http';
import type {
  IEcgRecord,
  IEcgRecordSummary,
  IShapEnvelope,
  IWaveform,
} from '@/types';

export interface IAnalyzePayload {
  patientId: number;
  file: File;
  symptoms?: string;
}

export async function listRecords(patientId?: number): Promise<IEcgRecordSummary[]> {
  const resp = await http.get<IEcgRecordSummary[]>('/ecg', {
    params: patientId ? { patient_id: patientId } : undefined,
  });
  return resp.data;
}

export async function getRecord(id: number): Promise<IEcgRecord> {
  const resp = await http.get<IEcgRecord>(`/ecg/${id}`);
  return resp.data;
}

export async function deleteRecord(id: number): Promise<void> {
  await http.delete(`/ecg/${id}`);
}

/** 上传并分析心电文件（multipart）。后端直接落库并返回完整记录。 */
export async function analyzeEcg(payload: IAnalyzePayload): Promise<IEcgRecord> {
  const form = new FormData();
  form.append('patient_id', String(payload.patientId));
  if (payload.symptoms) form.append('symptoms', payload.symptoms);
  form.append('file', payload.file);
  const resp = await http.post<IEcgRecord>('/ecg/analyze', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 180000,
  });
  return resp.data;
}

export async function getWaveform(id: number): Promise<IWaveform> {
  const resp = await http.get<IWaveform>(`/ecg/${id}/waveform`);
  return resp.data;
}

export type ShapKind = 'summary' | 'beeswarm' | 'interaction' | 'decision';

export async function getShap(id: number, kind: ShapKind): Promise<IShapEnvelope> {
  const resp = await http.get<IShapEnvelope>(`/ecg/${id}/shap/${kind}`);
  return resp.data;
}

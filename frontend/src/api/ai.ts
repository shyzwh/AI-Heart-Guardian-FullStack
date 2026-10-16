import { http } from './http';

export interface IAiEnvelope<T> {
  available: boolean;
  fallback?: boolean;
  reason?: string;
  [key: string]: unknown;
}

export async function polishReport(recordId: number) {
  const resp = await http.post<Record<string, unknown>>('/ai/polish', {
    record_id: recordId,
  });
  return resp.data;
}

export async function aiDiagnosis(recordId: number) {
  const resp = await http.post<Record<string, unknown>>('/ai/diagnosis', {
    record_id: recordId,
  });
  return resp.data;
}

export async function aiAsk(question: string) {
  const resp = await http.post<Record<string, unknown>>('/ai/ask', { question });
  return resp.data;
}

import { http, downloadBlob } from './http';
import type { IReport } from '@/types';

export async function getReport(recordId: number): Promise<IReport> {
  const resp = await http.get<IReport>(`/reports/${recordId}`);
  return resp.data;
}

export async function downloadReport(
  recordId: number,
  format: 'txt' | 'pdf',
): Promise<Blob> {
  return downloadBlob(`/reports/${recordId}/download`, { format });
}

/** 触发浏览器下载，文件名优先取响应头。 */
export function saveBlob(blob: Blob, fallbackName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fallbackName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

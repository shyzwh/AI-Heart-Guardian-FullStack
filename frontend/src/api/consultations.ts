import { http } from './http';

export interface IConsultation {
  id: number;
  patient_id: number;
  doctor_id: number;
  patient_name: string;
  counterpart_name: string;
  status: string;
  last_message: string;
  last_message_at: string;
  updated_at: string;
}

export interface IConsultationMessage {
  id: number;
  consultation_id: number;
  sender_id: number;
  sender_role: 'doctor' | 'patient';
  content: string;
  has_image: boolean;
  created_at: string;
}

export async function listConsultations(): Promise<IConsultation[]> {
  const response = await http.get<IConsultation[]>('/consultations');
  return response.data;
}

export async function createConsultation(patientId?: number): Promise<IConsultation> {
  const response = await http.post<IConsultation>('/consultations', patientId ? { patient_id: patientId } : {});
  return response.data;
}

export async function listConsultationMessages(
  consultationId: number,
): Promise<IConsultationMessage[]> {
  const response = await http.get<IConsultationMessage[]>(
    `/consultations/${consultationId}/messages`,
  );
  return response.data;
}

export async function sendConsultationMessage(
  consultationId: number,
  content: string,
  image?: File,
): Promise<IConsultationMessage> {
  const data = new FormData();
  data.append('content', content);
  if (image) data.append('image', image);
  const response = await http.post<IConsultationMessage>(
    `/consultations/${consultationId}/messages`,
    data,
  );
  return response.data;
}

export async function getConsultationImage(
  consultationId: number,
  messageId: number,
): Promise<Blob> {
  const response = await http.get<Blob>(
    `/consultations/${consultationId}/messages/${messageId}/image`,
    { responseType: 'blob' },
  );
  return response.data;
}

import { http } from './http';

export interface INotification {
  id: number;
  title: string;
  content: string;
  is_read: boolean;
  notification_type: string;
  created_at: string;
}

export interface INotificationResponse {
  items: INotification[];
  unread_count: number;
}

export async function listNotifications(): Promise<INotificationResponse> {
  const response = await http.get<INotificationResponse>('/notifications', {
    params: { limit: 20 },
  });
  return response.data;
}

export async function markNotificationRead(id: number): Promise<void> {
  await http.patch(`/notifications/${id}/read`);
}

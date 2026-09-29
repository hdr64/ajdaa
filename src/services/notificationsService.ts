import { api } from './api';

export type NotificationEvent = 'inquiry.created';
export type NotificationChannel = 'email';

export interface EmailListenerConfig {
  /** Every active admin who can view inquiries. */
  toInquiryViewers: boolean;
  emails: string[];
}

export interface ListenerInput {
  event: NotificationEvent;
  channel: NotificationChannel;
  name: string;
  enabled: boolean;
  config: EmailListenerConfig;
}

export interface NotificationListener extends ListenerInput {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface ListenersResponse {
  /** False until the first listener is created; until then the built-in rule applies. */
  configured: boolean;
  events: NotificationEvent[];
  channels: NotificationChannel[];
  listeners: NotificationListener[];
}

const base = '/api/notifications/listeners';

export const notificationsService = {
  list(signal?: AbortSignal): Promise<ListenersResponse> {
    return api.get<ListenersResponse>(base, { signal });
  },

  create(input: ListenerInput): Promise<NotificationListener> {
    return api.post<NotificationListener>(base, input);
  },

  update(id: string, input: ListenerInput): Promise<NotificationListener> {
    return api.put<NotificationListener>(`${base}/${encodeURIComponent(id)}`, input);
  },

  async remove(id: string): Promise<void> {
    await api.delete(`${base}/${encodeURIComponent(id)}`);
  },
};

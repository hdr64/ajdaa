import { api } from './api';

export interface MailSettingsView {
  host: string;
  port: number;
  username: string;
  encryption: 'tls' | 'ssl' | 'none';
  fromAddress: string;
  fromName: string;
  passwordSet: boolean;
  source: 'database' | 'env';
  deliveryEnabled: boolean;
}

export interface MailSettingsInput {
  host: string;
  port: number;
  username: string;
  encryption: 'tls' | 'ssl' | 'none';
  fromAddress: string;
  fromName: string;
  password?: string;
}

export interface TestEmailRequest {
  to: string;
  settings?: MailSettingsInput;
}

export interface TestEmailResponse {
  sent: true;
  messageId?: string;
}

export const settingsService = {
  async getMailSettings(): Promise<MailSettingsView> {
    return api.get<MailSettingsView>('/api/settings/mail');
  },

  async updateMailSettings(input: MailSettingsInput): Promise<MailSettingsView> {
    return api.put<MailSettingsView>('/api/settings/mail', input);
  },

  async resetMailSettings(): Promise<MailSettingsView> {
    return api.delete<MailSettingsView>('/api/settings/mail');
  },

  async sendTestEmail(request: TestEmailRequest): Promise<TestEmailResponse> {
    return api.post<TestEmailResponse>('/api/settings/mail/test', request);
  },
};
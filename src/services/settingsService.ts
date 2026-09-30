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
export const SOCIAL_KEYS = ['x', 'instagram', 'tiktok', 'snapchat', 'linkedin', 'youtube'] as const;
export type SocialKey = (typeof SOCIAL_KEYS)[number];

/** A strip across the top of every public page. */
export interface Announcement {
  enabled: boolean;
  textAr: string;
  textEn: string;
  tone: 'info' | 'warning';
  /** Optional https link; empty for none. */
  link: string;
}

/** Replaces the public pages with a notice; the admin stays reachable. */
export interface Maintenance {
  enabled: boolean;
  messageAr: string;
  messageEn: string;
}

/** Public contact details and social links (`/api/settings/site`). An empty social link hides that icon. */
export interface SiteSettings {
  /** Shown as written, e.g. "+966 58 048 4528". */
  phone: string;
  /** International digits only, for wa.me links, e.g. "966580484528". */
  whatsapp: string;
  email: string;
  addressAr: string;
  addressEn: string;
  hoursAr: string;
  hoursEn: string;
  socials: Record<SocialKey, string>;
  announcement: Announcement;
  maintenance: Maintenance;
}

/** Mirrors the server's defaults; shown until (or if never) the API answers. */
export const SITE_DEFAULTS: SiteSettings = {
  phone: '+966 58 048 4528',
  whatsapp: '966580484528',
  email: 'info@ajdaa.sa',
  addressAr: 'الرياض، طريق الملك فهد',
  addressEn: 'Riyadh, King Fahd Road',
  hoursAr: 'الأحد – الخميس، 8ص – 4م',
  hoursEn: 'Sun – Thu, 8:00 AM – 4:00 PM',
  socials: {
    x: 'https://x.com/Ajdaa_RS',
    instagram: 'https://www.instagram.com/ajdaa_rs',
    tiktok: 'https://www.tiktok.com/@ajdaa_rs',
    snapchat: 'https://snapchat.com/t/sVxEBu75',
    linkedin: '',
    youtube: '',
  },
  announcement: { enabled: false, textAr: '', textEn: '', tone: 'info', link: '' },
  maintenance: {
    enabled: false,
    messageAr: 'الموقع قيد الصيانة حالياً، وسنعود قريباً.',
    messageEn: 'The site is under maintenance. We will be back shortly.',
  },
};

export const siteSettingsApi = {
  get(signal?: AbortSignal): Promise<SiteSettings> {
    return api.get<SiteSettings>('/api/settings/site', { signal });
  },

  update(input: SiteSettings): Promise<SiteSettings> {
    return api.put<SiteSettings>('/api/settings/site', input);
  },
};

export interface SecuritySettings {
  /** Every admin must enter an emailed code at login. */
  loginOtpRequired: boolean;
  /** `.env` already forces it, so the switch cannot turn it off. */
  loginOtpForcedByEnv: boolean;
}

export const securitySettingsApi = {
  get(signal?: AbortSignal): Promise<SecuritySettings> {
    return api.get<SecuritySettings>('/api/settings/security', { signal });
  },

  update(loginOtpRequired: boolean): Promise<SecuritySettings> {
    return api.put<SecuritySettings>('/api/settings/security', { loginOtpRequired });
  },
};

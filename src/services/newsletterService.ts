import { api } from './api';
import { downloadFile, todayStamp } from './download';

export interface NewsletterSubscriber {
  id: string;
  email: string;
  locale: string | null;
  source: string | null;
  createdAt: string;
}

export interface SubscribeResponse {
  subscribed: boolean;
}

export const newsletterService = {
  /** Public newsletter subscription. */
  async subscribe(
    email: string,
    locale?: string | null,
    source?: string | null,
    spam: { website?: string; elapsedMs?: number } = {}
  ): Promise<SubscribeResponse> {
    return api.post<SubscribeResponse>('/api/newsletter', {
      email,
      website: spam.website || null,
      elapsedMs: spam.elapsedMs ?? null,
      ...(locale ? { locale } : {}),
      ...(source ? { source } : {}),
    });
  },

  async list(q?: string, signal?: AbortSignal): Promise<NewsletterSubscriber[]> {
    return api.get<NewsletterSubscriber[]>('/api/newsletter', {
      query: q ? { q } : undefined,
      signal,
    });
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/api/newsletter/${encodeURIComponent(id)}`);
  },

  async exportCsv(): Promise<void> {
    await downloadFile('/api/newsletter/export', `newsletter-${todayStamp()}.csv`);
  },
};

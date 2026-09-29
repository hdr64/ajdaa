import { api, ApiError, getAuthToken } from './api';

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
    source?: string | null
  ): Promise<SubscribeResponse> {
    return api.post<SubscribeResponse>('/api/newsletter', {
      email,
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
    const baseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');
    const url = `${baseUrl}/api/newsletter/export`;

    const headers: Record<string, string> = {};
    const token = getAuthToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(url, { headers });
    if (!response.ok) {
      let message = `Export failed with status ${response.status}`;
      try {
        const body = await response.json();
        if (body && typeof body.error === 'string') message = body.error;
      } catch {
        // fallback
      }
      throw new ApiError(response.status, message);
    }

    const blob = await response.blob();
    const disposition = response.headers.get('Content-Disposition');
    let filename = `newsletter-${new Date().toISOString().slice(0, 10)}.csv`;
    if (disposition) {
      const match = disposition.match(/filename="?([^";]+)"?/i);
      if (match && match[1]) {
        filename = match[1];
      }
    }

    const objectUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // Revoking in the same tick can cancel the download in some browsers.
    window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000);
  },
};

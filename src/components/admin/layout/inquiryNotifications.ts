import { documentLanguage, translateCurrent } from '../../../i18n/admin/core';

interface NewInquiryPayload {
  id?: unknown;
  name?: unknown;
  projectTitle?: unknown;
  interestTypeAr?: unknown;
}

const asText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

export function desktopNotificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/** "طلب اهتمام جديد من سارة — مشروع النخيل" (the socket payload is untrusted, so every field is optional). */
export function newInquiryMessage(payload: unknown): string {
  const data = (payload && typeof payload === 'object' ? payload : {}) as NewInquiryPayload;
  const name = asText(data.name);
  const about = asText(data.projectTitle) || asText(data.interestTypeAr);
  return [
    translateCurrent('layout.notifications.newInquiry'),
    name && translateCurrent('layout.notifications.fromName', { name }),
    about && translateCurrent('layout.notifications.about', { about }),
  ]
    .filter(Boolean)
    .join(' ');
}

export function showDesktopNotification(payload: unknown, onClick: () => void): void {
  if (!desktopNotificationsSupported() || Notification.permission !== 'granted') return;
  if (document.visibilityState === 'visible') return;

  const data = (payload && typeof payload === 'object' ? payload : {}) as NewInquiryPayload;
  const id = asText(data.id);
  const language = documentLanguage();
  try {
    const notification = new Notification(translateCurrent('layout.notifications.newInquiry'), {
      body: newInquiryMessage(payload),
      lang: language,
      dir: language === 'ar' ? 'rtl' : 'ltr',
      // One notification per inquiry, even if the event arrives twice.
      tag: id ? `inquiry-${id}` : undefined,
    });
    notification.onclick = () => {
      window.focus();
      onClick();
      notification.close();
    };
  } catch {
    // Some browsers (e.g. Android Chrome) only allow notifications from a service worker.
  }
}

// (documentLanguage is available via the import above.)

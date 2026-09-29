/**
 * Alerts for a new inquiry pushed over the realtime socket: the text for the
 * in-app toast, and an OS notification when the admin tab is in the background
 * (only after the admin allowed it from the bell).
 */

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
  return ['طلب اهتمام جديد', name && `من ${name}`, about && `— ${about}`].filter(Boolean).join(' ');
}

export function showDesktopNotification(payload: unknown, onClick: () => void): void {
  if (!desktopNotificationsSupported() || Notification.permission !== 'granted') return;
  if (document.visibilityState === 'visible') return;

  const data = (payload && typeof payload === 'object' ? payload : {}) as NewInquiryPayload;
  const id = asText(data.id);
  try {
    const notification = new Notification('طلب اهتمام جديد', {
      body: newInquiryMessage(payload),
      lang: 'ar',
      dir: 'rtl',
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

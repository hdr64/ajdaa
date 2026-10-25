import { adminLocale, documentLanguage, translateCurrent } from '../../i18n/admin/core';

/**
 * Arabic renders Gregorian dates with Latin digits (`adminLocale`); English
 * renders en-GB. Both are read from the running document language so every
 * caller gets the right one without threading it through props.
 */
const currentLocale = () => adminLocale(documentLanguage());

export function formatAdminDate(value: string | Date | null | undefined, locale = currentLocale()): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatAdminDateTime(value: string | Date | null | undefined, locale = currentLocale()): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** "منذ 5 دقائق" style relative time; falls back to the date after a week. */
export function formatRelativeTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  const diffMs = Date.now() - date.getTime();
  if (Number.isNaN(diffMs)) return '—';

  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return translateCurrent('common.time.now');
  if (minutes < 60) return translateCurrent('common.time.minutes', { count: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return translateCurrent('common.time.hours', { count: hours });
  const days = Math.round(hours / 24);
  if (days < 7) return translateCurrent('common.time.days', { count: days });
  return formatAdminDate(date);
}

/** Digits only, for wa.me links. Saudi local numbers (05x) get the 966 prefix. */
export function toWhatsAppNumber(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.startsWith('05') && digits.length === 10) return `966${digits.slice(1)}`;
  if (digits.startsWith('00')) return digits.slice(2);
  return digits;
}

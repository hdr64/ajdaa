import React, { useState, useEffect } from 'react';
import { Megaphone, AlertCircle, X, ExternalLink } from 'lucide-react';
import { useSiteSettings } from '../../hooks/useSiteSettings';
import { useLanguage } from '../../hooks/useLanguage';

/** Public announcement strip; App measures the stack it sits in to offset the Navbar. */
export const AnnouncementBar: React.FC = () => {
  const { settings } = useSiteSettings();
  const { language } = useLanguage();
  const announcement = settings.announcement;

  const rawText = language === 'ar' ? announcement?.textAr : announcement?.textEn;
  const fallbackText = language === 'ar' ? announcement?.textEn : announcement?.textAr;
  const text = (rawText && rawText.trim()) || (fallbackText && fallbackText.trim()) || '';

  const storageKey = text ? `ajda.announcement.dismissed:${text}` : '';

  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (!storageKey) return false;
    try {
      return window.sessionStorage.getItem(storageKey) === 'true';
    } catch {
      return false;
    }
  });

  // Re-evaluate dismissal status if announcement text or language key changes
  useEffect(() => {
    if (!storageKey) {
      setDismissed(false);
      return;
    }
    try {
      setDismissed(window.sessionStorage.getItem(storageKey) === 'true');
    } catch {
      setDismissed(false);
    }
  }, [storageKey]);

  const isVisible = Boolean(announcement?.enabled && text && !dismissed);

  if (!isVisible) {
    return null;
  }

  const handleDismiss = () => {
    if (storageKey) {
      try {
        window.sessionStorage.setItem(storageKey, 'true');
      } catch {
        // Safe fallback in restricted storage environments
      }
    }
    setDismissed(true);
  };

  const isWarning = announcement.tone === 'warning';
  const hasLink = Boolean(announcement.link && announcement.link.trim());
  const dismissAriaLabel = language === 'ar' ? 'إغلاق الإعلان' : 'Dismiss announcement';

  return (
    <aside
      role="region"
      aria-label={language === 'ar' ? 'إعلان هام' : 'Important Announcement'}
      className={`w-full transition-colors duration-200 select-none ${
        isWarning
          ? 'bg-amber-500/15 border-b border-amber-500/30 text-amber-950 dark:text-amber-100'
          : 'bg-accent/15 border-b border-accent/30 text-heading'
      }`}
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2 flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 min-w-0 flex-1 justify-center text-xs sm:text-sm font-medium">
          {isWarning ? (
            <span
              className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500/25 text-amber-700 dark:text-amber-300 shrink-0"
              aria-hidden="true"
            >
              <AlertCircle className="w-3.5 h-3.5" />
            </span>
          ) : (
            <span
              className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-accent/25 text-accent shrink-0"
              aria-hidden="true"
            >
              <Megaphone className="w-3.5 h-3.5" />
            </span>
          )}

          <div className="min-w-0 break-words text-center">
            {hasLink ? (
              <a
                href={announcement.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 hover:underline focus:outline-none focus:underline font-bold transition-opacity hover:opacity-90 cursor-pointer"
              >
                <span>{text}</span>
                <ExternalLink className="w-3 h-3 shrink-0 opacity-70 ms-1" aria-hidden="true" />
              </a>
            ) : (
              <span className="font-semibold">{text}</span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          aria-label={dismissAriaLabel}
          className={`p-1 rounded-md transition-colors cursor-pointer shrink-0 ${
            isWarning
              ? 'text-amber-900/70 hover:text-amber-950 hover:bg-amber-500/20 dark:text-amber-200/70 dark:hover:text-amber-100 dark:hover:bg-amber-500/30'
              : 'text-neutral-text/70 hover:text-neutral-text hover:bg-accent/20'
          }`}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
};

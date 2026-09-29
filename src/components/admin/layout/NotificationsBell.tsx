import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bell, BellRing } from 'lucide-react';
import { useAdmin } from '../../../pages/admin/adminContextDef';
import { formatRelativeTime } from '../../../pages/admin/adminFormat';
import { desktopNotificationsSupported } from './inquiryNotifications';

/** How many recent inquiries the dropdown lists. */
const MAX_ITEMS = 8;

const lastSeenKey = (adminId: string) => `ajda.admin.inquiries.lastSeen.${adminId}`;

function readLastSeen(adminId: string): number | null {
  try {
    const raw = window.localStorage.getItem(lastSeenKey(adminId));
    const value = raw ? Number(raw) : NaN;
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function writeLastSeen(adminId: string, time: number): void {
  try {
    window.localStorage.setItem(lastSeenKey(adminId), String(time));
  } catch {
    // Private mode or blocked storage: the count simply resets on reload.
  }
}

const timeOf = (value: string | undefined): number => {
  const time = value ? new Date(value).getTime() : NaN;
  return Number.isNaN(time) ? 0 : time;
};

/**
 * Header bell for new inquiries. "Unread" means received after this admin last
 * opened the bell or the inquiries page; that moment is remembered per admin in
 * this browser. The first visit starts from "now", so older inquiries are not
 * all flagged at once.
 */
export const NotificationsBell: React.FC = () => {
  const { can, currentUser, inquiries, location, navigate } = useAdmin();
  const adminId = currentUser?.id;
  const [open, setOpen] = useState(false);
  const [lastSeen, setLastSeen] = useState<number | null>(null);
  const [highlightFrom, setHighlightFrom] = useState(0);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(() =>
    desktopNotificationsSupported() ? Notification.permission : 'unsupported'
  );
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!adminId) return;
    const stored = readLastSeen(adminId);
    if (stored !== null) {
      setLastSeen(stored);
    } else {
      const now = Date.now();
      writeLastSeen(adminId, now);
      setLastSeen(now);
    }
  }, [adminId]);

  const markSeen = useCallback(() => {
    if (!adminId) return;
    const now = Date.now();
    writeLastSeen(adminId, now);
    setLastSeen(now);
  }, [adminId]);

  // Visiting the inquiries page counts as reading them.
  useEffect(() => {
    if (location.section === 'inquiries') markSeen();
  }, [location.section, inquiries.data, markSeen]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const recent = useMemo(
    () => [...inquiries.data].sort((a, b) => timeOf(b.createdAt) - timeOf(a.createdAt)).slice(0, MAX_ITEMS),
    [inquiries.data]
  );
  const unread = useMemo(
    () => (lastSeen === null ? 0 : inquiries.data.filter((item) => timeOf(item.createdAt) > lastSeen).length),
    [inquiries.data, lastSeen]
  );

  if (!can('viewInquiries')) return null;

  // Opening highlights what was unread until then, and marks it read for next time.
  const toggle = () => {
    if (!open) {
      setHighlightFrom(lastSeen ?? 0);
      markSeen();
    }
    setOpen((value) => !value);
  };

  const enableDesktop = async () => {
    if (!desktopNotificationsSupported()) return;
    setPermission(await Notification.requestPermission());
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={unread > 0 ? `الإشعارات: ${unread} طلب جديد` : 'الإشعارات'}
        title="طلبات الاهتمام الجديدة"
        className="relative p-2.5 rounded-xl border border-muted-border/40 hover:border-accent hover:text-accent bg-surface transition cursor-pointer text-neutral-text/70 shadow-xs"
      >
        {unread > 0 ? <BellRing className="w-4 h-4 text-accent" /> : <Bell className="w-4 h-4" />}
        {unread > 0 && (
          <span className="absolute -top-1.5 -end-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-neutral-950 text-[10px] font-black flex items-center justify-center tabular-nums">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute end-0 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl bg-surface border border-muted-border/40 shadow-xl overflow-hidden z-30"
        >
          <div className="px-4 py-3 border-b border-muted-border/30 flex items-center justify-between gap-2">
            <span className="text-xs font-black text-heading">طلبات الاهتمام الأخيرة</span>
            {permission === 'default' && (
              <button
                type="button"
                onClick={() => void enableDesktop()}
                className="text-[10px] font-bold text-accent hover:underline cursor-pointer"
              >
                تفعيل إشعارات سطح المكتب
              </button>
            )}
            {permission === 'denied' && (
              <span className="text-[10px] text-neutral-text/50" title="اسمح بالإشعارات من إعدادات المتصفح">
                إشعارات المتصفح محظورة
              </span>
            )}
          </div>

          {recent.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-neutral-text/60">لا توجد طلبات بعد</p>
          ) : (
            <ul className="max-h-96 overflow-y-auto divide-y divide-muted-border/20">
              {recent.map((item) => {
                const isNew = timeOf(item.createdAt) > highlightFrom;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setOpen(false);
                        navigate({ section: 'inquiries' });
                      }}
                      className={`w-full text-start px-4 py-3 flex items-start gap-2.5 hover:bg-canvas transition cursor-pointer ${
                        isNew ? 'bg-accent/5' : ''
                      }`}
                    >
                      <span
                        className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${isNew ? 'bg-amber-500' : 'bg-transparent'}`}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-bold text-heading truncate">{item.name}</span>
                        <span className="block text-[11px] text-neutral-text/60 truncate">
                          {item.projectTitle || item.interestTypeAr}
                        </span>
                      </span>
                      <span className="text-[10px] text-neutral-text/50 whitespace-nowrap">
                        {formatRelativeTime(item.createdAt)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              navigate({ section: 'inquiries' });
            }}
            className="w-full px-4 py-2.5 border-t border-muted-border/30 text-xs font-bold text-accent hover:bg-canvas cursor-pointer"
          >
            عرض كل الطلبات
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * Newsletter subscribers: the addresses that opted in through the public signup
 * forms. The list is fetched per query, because the server narrows it on `q`,
 * so the table receives one already-searched set instead of every address ever
 * collected.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, RefreshCw, Search, SearchX, Trash2, Users, X } from 'lucide-react';
import { AdminStorage } from '../../../services/adminStorage';
import type { NewsletterSubscriber } from '../../../services/newsletterService';
import { getErrorMessage } from '../../../services/api';
import { useAdmin } from '../adminContextDef';
import { useLanguage } from '../../../hooks/useLanguage';
import { usePersistentState } from '../../../hooks/usePersistentState';
import { AdminHeaderActions } from '../../../components/admin/layout/AdminHeaderActions';
import { EmptyState } from '../../../components/admin/common/EmptyState';
import { NoAccess, SectionError, SectionLoading } from '../../../components/admin/common/SectionState';
import { DataTable } from '../../../components/admin/common/DataTable';
import { ViewSwitcher } from '../../../components/admin/common/ViewSwitcher';
import type { Column, SortState } from '../../../components/admin/common/dataTableTypes';
import { isViewMode, type ViewMode } from '../../../components/admin/common/viewModes';
import { formatAdminDateTime } from '../adminFormat';

const VIEW_MODES: readonly ViewMode[] = ['table', 'list'];

const VIEW_STORAGE_KEY = 'ajda.admin.newsletter.view';
const TABLE_STORAGE_KEY = 'ajda.admin.newsletter';

/** Long enough to skip the requests a fast typist would never wait for. */
const SEARCH_DEBOUNCE_MS = 300;

/** Newest first, matching the order the server sends and the table's own default. */
const INITIAL_SORT: SortState = { columnId: 'createdAt', direction: 'desc' };

/** Language names rather than UI chrome, so they read the same in either language. */
const LOCALE_AR = 'العربية';
const LOCALE_EN = 'English';
const LOCALE_UNKNOWN = '—';

interface SectionCopy {
  loading: string;
  loadError: string;
  searchPlaceholder: string;
  searchLabel: string;
  clearSearch: string;
  searching: string;
  countAll: string;
  countFiltered: string;
  colEmail: string;
  colLocale: string;
  colSource: string;
  colCreatedAt: string;
  exportCsv: string;
  exportTitle: string;
  exportError: string;
  deleteTitle: (email: string) => string;
  deleteMessage: string;
  deleteConfirm: string;
  deleteButton: string;
  deletedToast: string;
  deleteError: string;
  emptyTitle: string;
  emptyDescription: string;
  noMatchesTitle: string;
  clearFilters: string;
}

/** One object per language, referenced by reference so memoized columns stay stable. */
const COPY: Record<'ar' | 'en', SectionCopy> = {
  ar: {
    loading: 'جاري تحميل مشتركي النشرة...',
    loadError: 'تعذر تحميل مشتركي النشرة',
    searchPlaceholder: 'ابحث بالبريد الإلكتروني...',
    searchLabel: 'البحث في مشتركي النشرة',
    clearSearch: 'مسح البحث',
    searching: 'جاري البحث...',
    countAll: 'مشترك',
    countFiltered: 'نتيجة',
    colEmail: 'البريد الإلكتروني',
    colLocale: 'اللغة',
    colSource: 'المصدر',
    colCreatedAt: 'تاريخ الاشتراك',
    exportCsv: 'تصدير CSV',
    exportTitle: 'تصدير كل مشتركي النشرة',
    exportError: 'تعذر تصدير الملف',
    deleteTitle: (email) => `حذف المشترك "${email}"؟`,
    deleteMessage: 'سيتم حذف هذا البريد من قائمة النشرة نهائياً ولا يمكن التراجع عن ذلك.',
    deleteConfirm: 'حذف المشترك',
    deleteButton: 'حذف المشترك',
    deletedToast: 'تم حذف المشترك',
    deleteError: 'تعذر حذف المشترك',
    emptyTitle: 'لا يوجد مشتركون في النشرة بعد',
    emptyDescription: 'ستظهر هنا العناوين المسجلة من نموذج الاشتراك في النشرة.',
    noMatchesTitle: 'لا توجد نتائج مطابقة',
    clearFilters: 'مسح البحث',
  },
  en: {
    loading: 'Loading newsletter subscribers...',
    loadError: 'Could not load newsletter subscribers',
    searchPlaceholder: 'Search by email...',
    searchLabel: 'Search newsletter subscribers',
    clearSearch: 'Clear search',
    searching: 'Searching...',
    countAll: 'Subscribers',
    countFiltered: 'Results',
    colEmail: 'Email',
    colLocale: 'Language',
    colSource: 'Source',
    colCreatedAt: 'Subscribed',
    exportCsv: 'Export CSV',
    exportTitle: 'Export all newsletter subscribers',
    exportError: 'Could not export the file',
    deleteTitle: (email) => `Delete subscriber "${email}"?`,
    deleteMessage: 'This address will be permanently removed from the newsletter list. This cannot be undone.',
    deleteConfirm: 'Delete subscriber',
    deleteButton: 'Delete subscriber',
    deletedToast: 'Subscriber deleted',
    deleteError: 'Could not delete the subscriber',
    emptyTitle: 'No newsletter subscribers yet',
    emptyDescription: 'Addresses collected by the newsletter signup form will appear here.',
    noMatchesTitle: 'No matching results',
    clearFilters: 'Clear search',
  },
};

const localeLabel = (locale: string | null): string => {
  if (!locale) return LOCALE_UNKNOWN;
  const normalized = locale.trim().toLowerCase();
  if (normalized === 'ar') return LOCALE_AR;
  if (normalized === 'en') return LOCALE_EN;
  return LOCALE_UNKNOWN;
};

/** Sort key that stays a number even for an unparsable date, so the sort never sees NaN. */
const toTimestamp = (value: string | null | undefined): number => {
  const time = value ? new Date(value).getTime() : NaN;
  return Number.isNaN(time) ? 0 : time;
};

const getSubscriberId = (subscriber: NewsletterSubscriber): string => subscriber.id;

const isAbortError = (error: unknown): boolean => error instanceof DOMException && error.name === 'AbortError';

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

interface SubscribersResource {
  data: NewsletterSubscriber[];
  loading: boolean;
  error: string | null;
  setData: React.Dispatch<React.SetStateAction<NewsletterSubscriber[]>>;
  reload: () => void;
}

/**
 * One request per query. The controller is created inside the effect, so a
 * keystroke that lands before the previous response tears the old request down
 * instead of letting it race the new one into `setData`.
 */
function useSubscribers(query: string, errorFallback: string): SubscribersResource {
  const [data, setData] = useState<NewsletterSubscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const rows = await AdminStorage.listNewsletterSubscribers(query || undefined, controller.signal);
        setData(rows);
      } catch (caught) {
        // A cancelled request means a newer query already replaced this one.
        if (controller.signal.aborted || isAbortError(caught)) return;
        setError(getErrorMessage(caught, errorFallback));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [query, reloadToken, errorFallback]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  return { data, loading, error, setData, reload };
}

export const NewsletterSection: React.FC = () => {
  const { can, confirm, showToast } = useAdmin();
  const { language } = useLanguage();
  const t = COPY[language === 'ar' ? 'ar' : 'en'];

  const [view, setView] = usePersistentState<ViewMode>(VIEW_STORAGE_KEY, 'table', isViewMode);
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState(false);

  const debouncedSearch = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);
  const { data, loading, error, setData, reload } = useSubscribers(debouncedSearch, t.loadError);

  // The server guards list, export and delete with the same permission.
  const canManage = can('exportData');
  const hasQuery = debouncedSearch !== '';

  /** The table owns sorting; the cards get the same newest-first order. */
  const newestFirst = useMemo(
    () => [...data].sort((a, b) => toTimestamp(b.createdAt) - toTimestamp(a.createdAt)),
    [data]
  );

  const columns = useMemo<Column<NewsletterSubscriber>[]>(
    () => [
      {
        id: 'email',
        header: t.colEmail,
        width: '240px',
        sortValue: (subscriber) => subscriber.email,
        cell: (subscriber) => (
          <span className="font-mono text-[11px] text-heading truncate block" dir="ltr">
            {subscriber.email}
          </span>
        ),
      },
      {
        id: 'locale',
        header: t.colLocale,
        width: '110px',
        sortValue: (subscriber) => localeLabel(subscriber.locale),
        cell: (subscriber) => (
          <span className="inline-block px-2.5 py-1 rounded-full bg-accent/10 text-accent font-bold text-[10px] border border-accent/20 whitespace-nowrap">
            {localeLabel(subscriber.locale)}
          </span>
        ),
      },
      {
        id: 'source',
        header: t.colSource,
        width: '130px',
        sortValue: (subscriber) => subscriber.source,
        cell: (subscriber) => <span className="text-[11px] text-neutral-text/70 truncate block">{subscriber.source || LOCALE_UNKNOWN}</span>,
      },
      {
        id: 'createdAt',
        header: t.colCreatedAt,
        width: '150px',
        sortValue: (subscriber) => toTimestamp(subscriber.createdAt),
        cell: (subscriber) => (
          <span className="text-[10px] text-neutral-text/60 whitespace-nowrap">
            {formatAdminDateTime(subscriber.createdAt)}
          </span>
        ),
      },
    ],
    [t]
  );

  if (!canManage) return <NoAccess />;

  const handleExport = async () => {
    setExporting(true);
    try {
      await AdminStorage.exportNewsletterCsv();
    } catch (caught) {
      showToast(getErrorMessage(caught, t.exportError));
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async (subscriber: NewsletterSubscriber) => {
    const ok = await confirm({
      title: t.deleteTitle(subscriber.email),
      message: t.deleteMessage,
      confirmLabel: t.deleteConfirm,
      danger: true,
    });
    if (!ok) return;
    try {
      await AdminStorage.deleteNewsletterSubscriber(subscriber.id);
      setData((current) => current.filter((item) => item.id !== subscriber.id));
      showToast(t.deletedToast);
    } catch (caught) {
      showToast(getErrorMessage(caught, t.deleteError));
    }
  };

  const rowActions = (subscriber: NewsletterSubscriber) => (
    <button
      type="button"
      onClick={() => void handleDelete(subscriber)}
      className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 transition inline-flex items-center justify-center cursor-pointer"
      title={t.deleteButton}
      aria-label={`${t.deleteButton}: ${subscriber.email}`}
    >
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  );

  const noMatches = (
    <EmptyState
      icon={SearchX}
      title={t.noMatchesTitle}
      action={
        <button
          type="button"
          onClick={() => setSearch('')}
          className="brand-btn-secondary font-bold text-xs px-4 py-2 rounded-xl cursor-pointer"
        >
          {t.clearFilters}
        </button>
      }
    />
  );

  const header = (
    <AdminHeaderActions>
      <span
        className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-canvas border border-muted-border/40 text-[11px] font-bold text-neutral-text/70 tabular-nums whitespace-nowrap"
        aria-live="polite"
      >
        <Users className="w-3.5 h-3.5" />
        {data.length} {hasQuery ? t.countFiltered : t.countAll}
      </span>
      <div className="hidden md:block">
        <ViewSwitcher value={view} onChange={setView} modes={VIEW_MODES} />
      </div>
      {canManage && (
        <button
          type="button"
          onClick={() => void handleExport()}
          disabled={exporting || data.length === 0}
          className="brand-btn-primary font-black px-3 sm:px-4 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer shadow-md text-xs disabled:opacity-50 disabled:cursor-not-allowed"
          title={t.exportTitle}
        >
          {exporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          <span className="hidden sm:inline">{t.exportCsv}</span>
        </button>
      )}
    </AdminHeaderActions>
  );

  if (error) {
    return (
      <>
        {header}
        <SectionError message={error} onRetry={reload} />
      </>
    );
  }
  if (loading && data.length === 0) {
    return (
      <>
        {header}
        <SectionLoading label={t.loading} />
      </>
    );
  }
  if (data.length === 0 && !hasQuery) {
    return (
      <>
        {header}
        <EmptyState icon={Users} title={t.emptyTitle} description={t.emptyDescription} />
      </>
    );
  }

  return (
    <div className="space-y-5">
      {header}

      <div className="p-4 rounded-2xl bg-surface border border-muted-border/40 flex items-center gap-3">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-text/40" />
          <input
            type="search"
            placeholder={t.searchPlaceholder}
            aria-label={t.searchLabel}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full ps-10 pe-9 py-2 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent"
          />
          {search !== '' && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label={t.clearSearch}
              className="absolute end-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-neutral-text/50 hover:text-heading cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {/* The old rows stay on screen while a new query is in flight. */}
        {hasQuery && loading && <RefreshCw className="w-4 h-4 animate-spin text-accent shrink-0" aria-label={t.searching} />}
      </div>

      {view === 'table' ? (
        <DataTable
          storageKey={TABLE_STORAGE_KEY}
          rows={data}
          getRowId={getSubscriberId}
          columns={columns}
          initialSort={INITIAL_SORT}
          rowActions={canManage ? rowActions : undefined}
          emptyState={noMatches}
        />
      ) : data.length === 0 ? (
        noMatches
      ) : (
        <ul className="rounded-2xl bg-surface border border-muted-border/40 shadow-xs overflow-hidden divide-y divide-muted-border/20">
          {newestFirst.map((subscriber) => (
            <li key={subscriber.id} className="p-4 flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1.5">
                <div className="font-mono text-[11px] text-heading truncate" dir="ltr">
                  {subscriber.email}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[10px] text-neutral-text/60">
                  <span className="px-2 py-0.5 rounded-full bg-accent/10 text-accent font-bold text-[10px]">
                    {localeLabel(subscriber.locale)}
                  </span>
                  <span className="truncate">{subscriber.source || LOCALE_UNKNOWN}</span>
                  <span className="tabular-nums whitespace-nowrap">{formatAdminDateTime(subscriber.createdAt)}</span>
                </div>
              </div>
              {canManage && rowActions(subscriber)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

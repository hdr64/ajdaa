import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Inbox, RefreshCw, Search, Trash2, X } from 'lucide-react';
import { careersService, type JobApplicationDetail, type JobApplicationListItem } from '../../../services/careersService';
import { getErrorMessage } from '../../../services/api';
import { useAdmin } from '../adminContextDef';
import { useAdminT } from '../../../i18n/admin/useAdminT';
import { EmptyState } from '../../../components/admin/common/EmptyState';
import { NoAccess, SectionError, SectionLoading } from '../../../components/admin/common/SectionState';
import { formatAdminDateTime } from '../adminFormat';

const STATUSES: { key: string; labelKey: string }[] = [
  { key: 'all', labelKey: 'applications.filter.all' },
  { key: 'new', labelKey: 'applications.status.new' },
  { key: 'reviewed', labelKey: 'applications.status.reviewed' },
  { key: 'shortlisted', labelKey: 'applications.status.shortlisted' },
  { key: 'rejected', labelKey: 'applications.status.rejected' },
  { key: 'hired', labelKey: 'applications.status.hired' },
];

export const ApplicationsSection: React.FC = () => {
  const { can, showToast, confirmDelete } = useAdmin();
  const { t } = useAdminT();
  const canManage = can('manageApplications');

  const [tab, setTab] = useState<'list' | 'settings'>('list');

  // List state
  const [items, setItems] = useState<JobApplicationListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 20;
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const requestSeq = useRef(0);

  // One request per pause in typing, always from page 1.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Detail state
  const [selected, setSelected] = useState<JobApplicationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [adminNote, setAdminNote] = useState('');
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);

  // Settings state
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [reqMessage, setReqMessage] = useState(false);
  const [reqCv, setReqCv] = useState(false);
  const [emailsText, setEmailsText] = useState('');
  const [settingsSaving, setSettingsSaving] = useState(false);

  const load = useCallback(async () => {
    // A slower, older response must never overwrite a newer one.
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    try {
      const res = await careersService.listApplications({
        status: statusFilter === 'all' ? undefined : statusFilter,
        q: debouncedSearch || undefined,
        page,
        limit,
      });
      if (seq !== requestSeq.current) return;
      setItems(res.items);
      setTotal(res.total);
    } catch (e) {
      if (seq !== requestSeq.current) return;
      setError(getErrorMessage(e, t('applications.loadError')));
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [statusFilter, debouncedSearch, page, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      const d = await careersService.getApplication(id);
      setSelected(d);
      setAdminNote(d.adminNote ?? '');
      setStatus(d.status);
    } catch (e) {
      showToast(getErrorMessage(e, t('applications.detailError')));
    } finally {
      setDetailLoading(false);
    }
  };

  const saveDetail = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const updated = await careersService.updateApplication(selected.id, {
        status,
        adminNote: adminNote.trim() || null,
      });
      setSelected(updated);
      // Reload so an active status filter drops rows that no longer match, and counts stay server-side.
      void load();
      showToast(t('applications.saved'));
    } catch (e) {
      showToast(getErrorMessage(e, t('applications.saveError')));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    const ok = await confirmDelete({
      title: t('applications.delete.confirmTitle', { name: selected.name }),
      message: t('applications.delete.confirmMessage'),
      confirmLabel: t('applications.delete.confirmLabel'),
    });
    if (!ok) return;
    try {
      await careersService.deleteApplication(selected.id);
      setSelected(null);
      showToast(t('applications.delete.success'));
      void load();
    } catch (e) {
      showToast(getErrorMessage(e, t('applications.delete.error')));
    }
  };

  const handleDownloadCv = async () => {
    if (!selected) return;
    try {
      await careersService.downloadCv(selected.id, selected.cvOriginalName ?? 'cv.pdf');
    } catch (e) {
      showToast(getErrorMessage(e, t('applications.cvDownloadError')));
    }
  };

  const loadSettings = useCallback(async () => {
    setSettingsLoading(true);
    setSettingsError(null);
    try {
      const s = await careersService.getSettings();
      setReqMessage(s.required.message);
      setReqCv(s.required.cv);
      setEmailsText((s.notificationEmails ?? []).join('\n'));
    } catch (e) {
      setSettingsError(getErrorMessage(e, t('applications.settings.loadError')));
    } finally {
      setSettingsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (tab === 'settings') void loadSettings();
  }, [tab, loadSettings]);

  const saveSettings = async () => {
    const emails = [...new Set(emailsText.split(/[\s,;]+/).map((v) => v.trim().toLowerCase()).filter(Boolean))];
    setSettingsSaving(true);
    try {
      await careersService.updateSettings({
        required: { message: reqMessage, cv: reqCv },
        notificationEmails: emails,
      });
      showToast(t('applications.settings.saved'));
    } catch (e) {
      showToast(getErrorMessage(e, t('applications.settings.saveError')));
    } finally {
      setSettingsSaving(false);
    }
  };

  if (!can('viewApplications')) return <NoAccess />;

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const newCount = items.filter((i) => i.status === 'new').length;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 border-b border-muted-border/30 pb-2">
        <button
          onClick={() => setTab('list')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold ${tab === 'list' ? 'bg-accent/12 text-accent' : 'text-neutral-text/70 hover:text-heading'}`}
        >
          {t('applications.tabRequests')} {newCount > 0 ? `(${newCount})` : ''}
        </button>
        {canManage && (
          <button
            onClick={() => setTab('settings')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold ${tab === 'settings' ? 'bg-accent/12 text-accent' : 'text-neutral-text/70 hover:text-heading'}`}
          >
            {t('applications.tabSettings')}
          </button>
        )}
      </div>

      {tab === 'settings' && (
        <div className="space-y-4">
          {settingsLoading && <SectionLoading label={t('applications.settings.loading')} />}
          {settingsError && <SectionError message={settingsError} onRetry={() => void loadSettings()} />}
          {!settingsLoading && !settingsError && (
            <div className="p-4 rounded-2xl bg-surface border border-muted-border/40 space-y-4">
              <div>
                <h3 className="text-xs font-black text-heading mb-2">{t('applications.settings.requiredTitle')}</h3>
                <div className="space-y-2 text-xs">
                  {['name', 'email', 'phone', 'jobTitle'].map((f) => (
                    <label key={f} className="flex items-center gap-2 opacity-60">
                      <input type="checkbox" checked disabled className="w-3.5 h-3.5" />
                      {f} {t('applications.settings.alwaysRequired')}
                    </label>
                  ))}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={reqMessage} onChange={(e) => setReqMessage(e.target.checked)} className="w-3.5 h-3.5" />
                    {t('applications.settings.messageField')}
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={reqCv} onChange={(e) => setReqCv(e.target.checked)} className="w-3.5 h-3.5" />
                    {t('applications.settings.cvField')}
                  </label>
                </div>
              </div>
              <div>
                <h3 className="text-xs font-black text-heading mb-2">{t('applications.settings.emailsTitle')}</h3>
                <textarea
                  rows={4}
                  value={emailsText}
                  onChange={(e) => setEmailsText(e.target.value)}
                  placeholder="email@example.com"
                  dir="ltr"
                  className="w-full px-3 py-2 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent font-mono"
                />
              </div>
              <button
                onClick={() => void saveSettings()}
                disabled={settingsSaving}
                className="brand-btn-primary font-black px-4 py-2 rounded-xl text-xs cursor-pointer disabled:opacity-50"
              >
                {settingsSaving ? t('applications.settings.saving') : t('applications.settings.save')}
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'list' && (
        <>
          {error && <SectionError message={error} onRetry={() => void load()} />}
          {loading && items.length === 0 && <SectionLoading label={t('applications.loading')} />}
          {!loading && !error && items.length === 0 && search === '' && statusFilter === 'all' && (
            <EmptyState icon={Inbox} title={t('applications.empty')} />
          )}

          {/* Filters */}
          <div className="p-4 rounded-2xl bg-surface border border-muted-border/40 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="relative flex-1 lg:max-w-md">
              <Search className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-text/40" />
              <input
                type="search"
                placeholder={t('applications.searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full ps-10 pe-4 py-2 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent"
              />
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {STATUSES.map((f) => (
                <button
                  key={f.key}
                  onClick={() => { setStatusFilter(f.key); setPage(1); }}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer whitespace-nowrap ${
                    statusFilter === f.key ? 'brand-fill text-canvas shadow-xs' : 'bg-canvas border border-muted-border/40 text-neutral-text/70 hover:text-heading'
                  }`}
                >
                  {t(f.labelKey as 'applications.filter.all' | 'applications.status.new' | 'applications.status.reviewed' | 'applications.status.shortlisted' | 'applications.status.rejected' | 'applications.status.hired')}
                </button>
              ))}
            </div>
          </div>

          {loading && items.length > 0 && <div className="text-xs text-neutral-text/60">{t('applications.updating')}</div>}

          {!loading && !error && items.length === 0 && (search !== '' || statusFilter !== 'all') && (
            <EmptyState icon={Search} title={t('applications.noResults')} />
          )}

          {items.length > 0 && (
            <div className="rounded-2xl bg-surface border border-muted-border/40 shadow-xs overflow-hidden divide-y divide-muted-border/20">
              {items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => void openDetail(item.id)}
                  className="w-full text-start p-4 hover:bg-surface-hover transition flex items-start justify-between gap-3 cursor-pointer"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-heading">{item.name}</div>
                    <div className="text-[10px] text-neutral-text/60 font-mono truncate" dir="ltr">{item.phone || item.email}</div>
                    <div className="text-[11px] text-neutral-text/70 mt-1">{item.jobTitle}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="px-2 py-0.5 rounded-full bg-accent/10 text-accent font-bold text-[10px]">{t(`applications.status.${item.status}` as 'applications.status.new' | 'applications.status.reviewed' | 'applications.status.shortlisted' | 'applications.status.rejected' | 'applications.status.hired')}</span>
                    <span className="text-[10px] text-neutral-text/50">{formatAdminDateTime(item.createdAt)}</span>
                    {item.hasCv && <span className="text-[10px] text-accent">CV</span>}
                  </div>
                </button>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-canvas border border-muted-border/40 disabled:opacity-50 cursor-pointer"
              >
                {t('applications.prev')}
              </button>
              <span className="text-xs text-neutral-text/70">{page} / {totalPages}</span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-canvas border border-muted-border/40 disabled:opacity-50 cursor-pointer"
              >
                {t('applications.next')}
              </button>
            </div>
          )}
        </>
      )}

      {/* Detail drawer */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 p-4" onClick={() => setSelected(null)}>
          <div className="bg-surface rounded-2xl shadow-xl w-full max-w-lg p-5 space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-heading">{selected.name}</h3>
                <p className="text-[10px] text-neutral-text/60 font-mono" dir="ltr">{selected.phone} · {selected.email}</p>
              </div>
              <button onClick={() => setSelected(null)} className="p-1.5 rounded-lg text-neutral-text/50 hover:text-heading cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div><span className="font-bold text-neutral-text/70">{t('applications.detail.jobTitle')}: </span>{selected.jobTitle}</div>
              <div><span className="font-bold text-neutral-text/70">{t('applications.detail.date')}: </span>{formatAdminDateTime(selected.createdAt)}</div>
              {selected.message && <div><span className="font-bold text-neutral-text/70">{t('applications.detail.message')}: </span>{selected.message}</div>}
              {selected.cvOriginalName && <div><span className="font-bold text-neutral-text/70">{t('applications.detail.cv')}: </span>{selected.cvOriginalName}</div>}
            </div>

            {selected.hasCv && (
              <button
                onClick={() => void handleDownloadCv()}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-accent/10 text-accent text-xs font-bold cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> {t('applications.detail.downloadCv')}
              </button>
            )}

            {canManage && (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-text/70">{t('applications.detail.status')}</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent"
                  >
                    {STATUSES.filter((s) => s.key !== 'all').map((s) => (
                      <option key={s.key} value={s.key}>{t(s.labelKey as 'applications.filter.all' | 'applications.status.new' | 'applications.status.reviewed' | 'applications.status.shortlisted' | 'applications.status.rejected' | 'applications.status.hired')}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-text/70">{t('applications.detail.adminNote')}</label>
                  <textarea
                    rows={3}
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => void saveDetail()}
                    disabled={saving}
                    className="brand-btn-primary font-black px-4 py-2 rounded-xl text-xs cursor-pointer disabled:opacity-50"
                  >
                    {saving ? t('applications.detail.saving') : t('applications.detail.save')}
                  </button>
                  <button
                    onClick={() => void handleDelete()}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-red-500/10 text-red-500 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 inline me-1" /> {t('applications.detail.delete')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {detailLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <RefreshCw className="w-6 h-6 text-white animate-spin" />
        </div>
      )}
    </div>
  );
};
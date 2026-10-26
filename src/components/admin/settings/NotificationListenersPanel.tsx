import React, { useCallback, useEffect, useState } from 'react';
import { BellPlus, Info, Mail, Pencil, Plus, Trash2, Users } from 'lucide-react';
import {
  notificationsService,
  type ListenerInput,
  type ListenersResponse,
  type NotificationListener,
} from '../../../services/notificationsService';
import { getErrorMessage } from '../../../services/api';
import { useAdmin } from '../../../pages/admin/adminContextDef';
import { SectionError, SectionLoading } from '../common/SectionState';
import { useAdminT } from '../../../i18n/admin';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAILS = 20;

const EMPTY_FORM: ListenerInput = {
  event: 'inquiry.created',
  channel: 'email',
  name: '',
  enabled: true,
  config: { toInquiryViewers: true, toApplicationViewers: false, emails: [] },
};

/** Addresses may be separated by commas, spaces or new lines. */
const parseEmails = (text: string): string[] =>
  [...new Set(text.split(/[\s,;]+/).map((value) => value.trim().toLowerCase()).filter(Boolean))];

/** The viewers flag the server honours for an event; the other one is ignored for it. */
function viewersFlagFor(event: string): 'toInquiryViewers' | 'toApplicationViewers' {
  return event === 'job_application' ? 'toApplicationViewers' : 'toInquiryViewers';
}

function viewerFlags(event: string, enabled: boolean): Pick<ListenerInput['config'], 'toInquiryViewers' | 'toApplicationViewers'> {
  const flag = viewersFlagFor(event);
  return { toInquiryViewers: flag === 'toInquiryViewers' && enabled, toApplicationViewers: flag === 'toApplicationViewers' && enabled };
}

function recipientsSummary(listener: ListenerInput, t: (key: any) => string): string {
  const parts: string[] = [];
  if (listener.config[viewersFlagFor(listener.event)]) {
    parts.push(
      viewersFlagFor(listener.event) === 'toApplicationViewers'
        ? t('settings.notifications.toAllApplicationViewers')
        : t('settings.notifications.toAllInquiryViewers')
    );
  }
  if (listener.config.emails.length > 0) parts.push(listener.config.emails.join(', '));
  return parts.join(' + ');
}

interface ListenerFormProps {
  initial: ListenerInput;
  events: string[];
  channels: string[];
  saving: boolean;
  onSubmit: (input: ListenerInput) => void;
  onCancel: () => void;
}

const ListenerForm: React.FC<ListenerFormProps> = ({ initial, events, channels, saving, onSubmit, onCancel }) => {
  const { t } = useAdminT();
  const [form, setForm] = useState<ListenerInput>(initial);
  const [emailsText, setEmailsText] = useState(initial.config.emails.join('\n'));
  const [error, setError] = useState<string | null>(null);

  const viewersFlag = viewersFlagFor(form.event);

  const eventLabel = (event: string) => {
    if (event === 'inquiry.created') return t('settings.notifications.eventInquiry');
    if (event === 'job_application') return t('settings.notifications.eventJobApplication');
    return event;
  };

  const channelLabel = (channel: string) => {
    if (channel === 'email') return t('settings.notifications.channelEmail');
    return channel;
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const emails = parseEmails(emailsText);
    const invalid = emails.filter((email) => !EMAIL_REGEX.test(email));
    if (!form.name.trim()) return setError(t('settings.notifications.errorNameRequired'));
    if (invalid.length > 0) return setError(t('settings.notifications.errorInvalidEmails', { invalid: invalid.join(', ') }));
    if (emails.length > MAX_EMAILS) return setError(t('settings.notifications.errorMaxEmails', { max: MAX_EMAILS }));
    if (!form.config[viewersFlag] && emails.length === 0) return setError(t('settings.notifications.errorNoRecipients'));
    setError(null);
    // Only the flag of the chosen event means anything to the server; never store the other.
    onSubmit({
      ...form,
      name: form.name.trim(),
      config: { ...form.config, ...viewerFlags(form.event, form.config[viewersFlag]), emails },
    });
  };

  const inputClass =
    'w-full px-3 py-2 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent';

  return (
    <form onSubmit={submit} className="rounded-2xl bg-canvas/60 border border-accent/30 p-4 space-y-4">
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <label htmlFor="listener-name" className="block text-xs font-bold text-neutral-text/70">
            {t('settings.notifications.nameLabel')}
          </label>
          <input
            id="listener-name"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder={t('settings.notifications.namePlaceholder')}
            maxLength={100}
            className={inputClass}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="listener-event" className="block text-xs font-bold text-neutral-text/70">
            {t('settings.notifications.eventLabel')}
          </label>
          <select
            id="listener-event"
            value={form.event}
            onChange={(e) => {
              const nextEvent = e.target.value as ListenerInput['event'];
              setForm((prev) => ({ ...prev, event: nextEvent, config: { ...prev.config, ...viewerFlags(nextEvent, true) } }));
            }}
            className={`${inputClass} cursor-pointer`}
          >
            {events.map((event) => (
              <option key={event} value={event}>
                {eventLabel(event)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="listener-channel" className="block text-xs font-bold text-neutral-text/70">
            {t('settings.notifications.channelLabel')}
          </label>
          <select
            id="listener-channel"
            value={form.channel}
            onChange={(e) => setForm((prev) => ({ ...prev, channel: e.target.value as ListenerInput['channel'] }))}
            className={`${inputClass} cursor-pointer`}
          >
            {channels.map((channel) => (
              <option key={channel} value={channel}>
                {channelLabel(channel)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <label className="flex items-center gap-2 cursor-pointer text-xs text-heading">
        <input
          type="checkbox"
          checked={form.config[viewersFlag]}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, config: { ...prev.config, [viewersFlag]: e.target.checked } }))
          }
          className="w-3.5 h-3.5 cursor-pointer"
        />
        {viewersFlag === 'toApplicationViewers'
          ? t('settings.notifications.sendToApplicationViewers')
          : t('settings.notifications.sendToInquiryViewers')}
      </label>

      <div className="space-y-1.5">
        <label htmlFor="listener-emails" className="block text-xs font-bold text-neutral-text/70">
          {t('settings.notifications.extraEmailsLabel', { max: MAX_EMAILS })}
        </label>
        <textarea
          id="listener-emails"
          value={emailsText}
          onChange={(e) => setEmailsText(e.target.value)}
          rows={3}
          dir="ltr"
          placeholder="sales@example.com"
          className={`${inputClass} font-mono`}
        />
      </div>

      <label className="flex items-center gap-2 cursor-pointer text-xs text-heading">
        <input
          type="checkbox"
          checked={form.enabled}
          onChange={(e) => setForm((prev) => ({ ...prev, enabled: e.target.checked }))}
          className="w-3.5 h-3.5 cursor-pointer"
        />
        {t('settings.notifications.enabled')}
      </label>

      {error && <p className="text-xs font-bold text-red-500">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={saving}
          className="brand-btn-primary font-black px-4 py-2 rounded-xl text-xs cursor-pointer disabled:opacity-50"
        >
          {saving ? t('settings.notifications.saving') : t('settings.notifications.saveListenerBtn')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="brand-btn-secondary font-bold px-4 py-2 rounded-xl text-xs cursor-pointer"
        >
          {t('settings.notifications.cancel')}
        </button>
      </div>
    </form>
  );
};

/**
 * Settings tab: who is notified, and how, when an event happens. Needs the
 * `manageNotifications` permission (the server enforces it too).
 */
export const NotificationListenersPanel: React.FC = () => {
  const { t } = useAdminT();
  const { confirm, showToast, confirmDelete } = useAdmin();
  const [data, setData] = useState<ListenersResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<NotificationListener | 'new' | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    setError(null);
    try {
      setData(await notificationsService.list(signal));
    } catch (caught) {
      if (signal?.aborted) return;
      setError(getErrorMessage(caught, t('settings.notifications.loadError')));
    }
  }, [t]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const save = async (input: ListenerInput, id?: string) => {
    setSaving(true);
    try {
      if (id) await notificationsService.update(id, input);
      else await notificationsService.create(input);
      setEditing(null);
      showToast(t('settings.notifications.saveSuccess'));
      await load();
    } catch (caught) {
      showToast(getErrorMessage(caught, t('settings.notifications.saveError')));
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (listener: NotificationListener) => {
    const action = listener.enabled ? t('settings.notifications.actionDisable') : t('settings.notifications.actionEnable');
    const ok = await confirm({
      title: t('settings.notifications.toggleTitle', { action, name: listener.name }),
      message: listener.enabled ? t('settings.notifications.toggleMessage') : undefined,
      confirmLabel: action,
      rememberKey: 'listener.enabled',
    });
    if (!ok) return;
    const { id, createdAt: _createdAt, updatedAt: _updatedAt, ...input } = listener;
    await save({ ...input, enabled: !listener.enabled }, id);
  };

  const remove = async (listener: NotificationListener) => {
    const ok = await confirmDelete({
      title: t('settings.notifications.deleteConfirmTitle', { name: listener.name }),
      message:
        data && data.listeners.length === 1
          ? t('settings.notifications.deleteConfirmLastMessage')
          : t('settings.notifications.deleteConfirmMessage'),
      confirmLabel: t('settings.notifications.deleteConfirmBtn'),
    });
    if (!ok) return;
    try {
      await notificationsService.remove(listener.id);
      showToast(t('settings.notifications.deleteSuccess'));
      await load();
    } catch (caught) {
      showToast(getErrorMessage(caught, t('settings.notifications.deleteError')));
    }
  };

  const eventLabel = (event: string) => {
    if (event === 'inquiry.created') return t('settings.notifications.eventInquiry');
    if (event === 'job_application') return t('settings.notifications.eventJobApplication');
    return event;
  };

  const channelLabel = (channel: string) => {
    if (channel === 'email') return t('settings.notifications.channelEmail');
    return channel;
  };

  if (error) return <SectionError message={error} onRetry={() => void load()} />;
  if (!data) return <SectionLoading variant="form" label={t('settings.notifications.loading')} />;

  return (
    <div className="space-y-4">
      {!data.configured && (
        <div className="p-4 rounded-2xl bg-accent/5 border border-accent/30 text-xs text-heading flex flex-col sm:flex-row sm:items-center gap-3">
          <Info className="w-4 h-4 text-accent shrink-0" />
          <p className="flex-1 leading-relaxed">
            {t('settings.notifications.notConfiguredHint')}
          </p>
          <button
            type="button"
            disabled={saving}
            onClick={() =>
              void save({ ...EMPTY_FORM, name: t('settings.notifications.defaultName'), config: { toInquiryViewers: true, toApplicationViewers: false, emails: [] } })
            }
            className="brand-btn-secondary font-bold px-3 py-2 rounded-xl text-xs cursor-pointer whitespace-nowrap disabled:opacity-50"
          >
            {t('settings.notifications.createDefaultBtn')}
          </button>
        </div>
      )}

      {data.configured && data.listeners.every((listener) => !listener.enabled) && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 text-xs font-bold">
          {t('settings.notifications.noActiveWarning')}
        </div>
      )}

      {data.listeners.map((listener) =>
        editing !== 'new' && editing?.id === listener.id ? (
          <ListenerForm
            key={listener.id}
            initial={listener}
            events={data.events}
            channels={data.channels}
            saving={saving}
            onSubmit={(input) => void save(input, listener.id)}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <div
            key={listener.id}
            className={`p-4 rounded-2xl border bg-surface flex items-start gap-3 ${
              listener.enabled ? 'border-muted-border/40' : 'border-muted-border/30 opacity-60'
            }`}
          >
            <span className="p-2 rounded-xl bg-accent/10 text-accent shrink-0">
              {listener.config[viewersFlagFor(listener.event)] ? <Users className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
            </span>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-black text-heading">{listener.name}</span>
                <span className="px-2 py-0.5 rounded-full bg-canvas border border-muted-border/40 text-[10px] text-neutral-text/70">
                  {eventLabel(listener.event)}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-canvas border border-muted-border/40 text-[10px] text-neutral-text/70">
                  {channelLabel(listener.channel)}
                </span>
              </div>
              <p className="text-[11px] text-neutral-text/70 break-words">{recipientsSummary(listener, t)}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => void toggle(listener)}
                disabled={saving}
                className="px-2.5 py-1.5 rounded-lg border border-muted-border/40 text-[11px] font-bold cursor-pointer hover:border-accent disabled:opacity-50"
              >
                {listener.enabled ? t('settings.notifications.actionDisable') : t('settings.notifications.actionEnable')}
              </button>
              <button
                type="button"
                onClick={() => setEditing(listener)}
                aria-label={t('settings.notifications.editAria', { name: listener.name })}
                className="p-2 rounded-lg border border-muted-border/40 cursor-pointer hover:border-accent"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => void remove(listener)}
                aria-label={t('settings.notifications.deleteAria', { name: listener.name })}
                className="p-2 rounded-lg bg-red-500/10 text-red-500 cursor-pointer hover:bg-red-500/20"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )
      )}

      {editing === 'new' ? (
        <ListenerForm
          initial={EMPTY_FORM}
          events={data.events}
          channels={data.channels}
          saving={saving}
          onSubmit={(input) => void save(input)}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="w-full p-3 rounded-2xl border border-dashed border-muted-border/60 text-xs font-bold text-accent hover:border-accent hover:bg-accent/5 cursor-pointer flex items-center justify-center gap-2"
        >
          {data.listeners.length === 0 ? <BellPlus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {t('settings.notifications.addListener')}
        </button>
      )}
    </div>
  );
};

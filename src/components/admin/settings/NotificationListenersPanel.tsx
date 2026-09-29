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

const EVENT_LABELS: Record<string, string> = {
  'inquiry.created': 'عند وصول طلب اهتمام جديد',
};

const CHANNEL_LABELS: Record<string, string> = {
  email: 'بريد إلكتروني',
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAILS = 20;

const EMPTY_FORM: ListenerInput = {
  event: 'inquiry.created',
  channel: 'email',
  name: '',
  enabled: true,
  config: { toInquiryViewers: true, emails: [] },
};

/** Addresses may be separated by commas, spaces or new lines. */
const parseEmails = (text: string): string[] =>
  [...new Set(text.split(/[\s,;]+/).map((value) => value.trim().toLowerCase()).filter(Boolean))];

function recipientsSummary(listener: ListenerInput): string {
  const parts: string[] = [];
  if (listener.config.toInquiryViewers) parts.push('كل من يملك صلاحية استعراض الطلبات');
  if (listener.config.emails.length > 0) parts.push(listener.config.emails.join('، '));
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
  const [form, setForm] = useState<ListenerInput>(initial);
  const [emailsText, setEmailsText] = useState(initial.config.emails.join('\n'));
  const [error, setError] = useState<string | null>(null);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const emails = parseEmails(emailsText);
    const invalid = emails.filter((email) => !EMAIL_REGEX.test(email));
    if (!form.name.trim()) return setError('أدخل اسماً للمستمع');
    if (invalid.length > 0) return setError(`عناوين غير صحيحة: ${invalid.join('، ')}`);
    if (emails.length > MAX_EMAILS) return setError(`الحد الأقصى ${MAX_EMAILS} عنواناً لكل مستمع`);
    if (!form.config.toInquiryViewers && emails.length === 0) return setError('اختر مستلماً واحداً على الأقل');
    setError(null);
    onSubmit({ ...form, name: form.name.trim(), config: { ...form.config, emails } });
  };

  const inputClass =
    'w-full px-3 py-2 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent';

  return (
    <form onSubmit={submit} className="rounded-2xl bg-canvas/60 border border-accent/30 p-4 space-y-4">
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <label htmlFor="listener-name" className="block text-xs font-bold text-neutral-text/70">
            اسم المستمع
          </label>
          <input
            id="listener-name"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="مثال: فريق المبيعات"
            maxLength={100}
            className={inputClass}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="listener-event" className="block text-xs font-bold text-neutral-text/70">
            الحدث
          </label>
          <select
            id="listener-event"
            value={form.event}
            onChange={(e) => setForm((prev) => ({ ...prev, event: e.target.value as ListenerInput['event'] }))}
            className={`${inputClass} cursor-pointer`}
          >
            {events.map((event) => (
              <option key={event} value={event}>
                {EVENT_LABELS[event] ?? event}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="listener-channel" className="block text-xs font-bold text-neutral-text/70">
            طريقة الإشعار
          </label>
          <select
            id="listener-channel"
            value={form.channel}
            onChange={(e) => setForm((prev) => ({ ...prev, channel: e.target.value as ListenerInput['channel'] }))}
            className={`${inputClass} cursor-pointer`}
          >
            {channels.map((channel) => (
              <option key={channel} value={channel}>
                {CHANNEL_LABELS[channel] ?? channel}
              </option>
            ))}
          </select>
        </div>
      </div>

      <label className="flex items-center gap-2 cursor-pointer text-xs text-heading">
        <input
          type="checkbox"
          checked={form.config.toInquiryViewers}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, config: { ...prev.config, toInquiryViewers: e.target.checked } }))
          }
          className="w-3.5 h-3.5 cursor-pointer"
        />
        إرسال إلى كل مستخدم نشط يملك صلاحية «استعراض الطلبات»
      </label>

      <div className="space-y-1.5">
        <label htmlFor="listener-emails" className="block text-xs font-bold text-neutral-text/70">
          عناوين بريد إضافية (عنوان في كل سطر أو مفصولة بفواصل، حتى {MAX_EMAILS})
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
        مفعّل
      </label>

      {error && <p className="text-xs font-bold text-red-500">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={saving}
          className="brand-btn-primary font-black px-4 py-2 rounded-xl text-xs cursor-pointer disabled:opacity-50"
        >
          {saving ? 'جاري الحفظ...' : 'حفظ المستمع'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="brand-btn-secondary font-bold px-4 py-2 rounded-xl text-xs cursor-pointer"
        >
          إلغاء
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
  const { confirm, showToast } = useAdmin();
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
      setError(getErrorMessage(caught, 'تعذر تحميل إعدادات الإشعارات'));
    }
  }, []);

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
      showToast('تم حفظ المستمع');
      await load();
    } catch (caught) {
      showToast(getErrorMessage(caught, 'تعذر حفظ المستمع'));
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (listener: NotificationListener) => {
    const ok = await confirm({
      title: listener.enabled ? `إيقاف المستمع «${listener.name}»؟` : `تفعيل المستمع «${listener.name}»؟`,
      message: listener.enabled ? 'لن يتلقى مستلموه إشعارات حتى تعيد تفعيله.' : undefined,
      confirmLabel: listener.enabled ? 'إيقاف' : 'تفعيل',
      rememberKey: 'listener.enabled',
    });
    if (!ok) return;
    const { id, createdAt: _createdAt, updatedAt: _updatedAt, ...input } = listener;
    await save({ ...input, enabled: !listener.enabled }, id);
  };

  const remove = async (listener: NotificationListener) => {
    const ok = await confirm({
      title: `حذف المستمع «${listener.name}»؟`,
      message:
        data && data.listeners.length === 1
          ? 'هذا آخر مستمع: بعد حذفه لن يُرسل أي بريد عند وصول طلب جديد.'
          : 'لن يتلقى مستلمو هذا المستمع إشعارات بعد الآن.',
      confirmLabel: 'حذف',
      danger: true,
    });
    if (!ok) return;
    try {
      await notificationsService.remove(listener.id);
      showToast('تم حذف المستمع');
      await load();
    } catch (caught) {
      showToast(getErrorMessage(caught, 'تعذر حذف المستمع'));
    }
  };

  if (error) return <SectionError message={error} onRetry={() => void load()} />;
  if (!data) return <SectionLoading label="جاري تحميل إعدادات الإشعارات..." />;

  return (
    <div className="space-y-4">
      {!data.configured && (
        <div className="p-4 rounded-2xl bg-accent/5 border border-accent/30 text-xs text-heading flex flex-col sm:flex-row sm:items-center gap-3">
          <Info className="w-4 h-4 text-accent shrink-0" />
          <p className="flex-1 leading-relaxed">
            لم يُضبط أي مستمع بعد، لذلك يُرسل بريد الطلب الجديد حالياً حسب الإعداد الافتراضي: عناوين
            <span dir="ltr" className="font-mono mx-1">NOTIFY_INQUIRY_EMAILS</span>
            في الخادم إن وُجدت، وإلا كل من يملك صلاحية استعراض الطلبات. بعد إضافة أول مستمع تُطبَّق المستمعات فقط.
          </p>
          <button
            type="button"
            disabled={saving}
            onClick={() =>
              void save({ ...EMPTY_FORM, name: 'مسؤولو الطلبات', config: { toInquiryViewers: true, emails: [] } })
            }
            className="brand-btn-secondary font-bold px-3 py-2 rounded-xl text-xs cursor-pointer whitespace-nowrap disabled:opacity-50"
          >
            إنشاء المستمع الافتراضي
          </button>
        </div>
      )}

      {data.configured && data.listeners.every((listener) => !listener.enabled) && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 text-xs font-bold">
          لا يوجد مستمع مفعّل: لن يُرسل أي بريد عند وصول طلب اهتمام جديد.
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
              {listener.config.toInquiryViewers ? <Users className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
            </span>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-black text-heading">{listener.name}</span>
                <span className="px-2 py-0.5 rounded-full bg-canvas border border-muted-border/40 text-[10px] text-neutral-text/70">
                  {EVENT_LABELS[listener.event] ?? listener.event}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-canvas border border-muted-border/40 text-[10px] text-neutral-text/70">
                  {CHANNEL_LABELS[listener.channel] ?? listener.channel}
                </span>
              </div>
              <p className="text-[11px] text-neutral-text/70 break-words">{recipientsSummary(listener)}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => void toggle(listener)}
                disabled={saving}
                className="px-2.5 py-1.5 rounded-lg border border-muted-border/40 text-[11px] font-bold cursor-pointer hover:border-accent disabled:opacity-50"
              >
                {listener.enabled ? 'إيقاف' : 'تفعيل'}
              </button>
              <button
                type="button"
                onClick={() => setEditing(listener)}
                aria-label={`تعديل ${listener.name}`}
                className="p-2 rounded-lg border border-muted-border/40 cursor-pointer hover:border-accent"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => void remove(listener)}
                aria-label={`حذف ${listener.name}`}
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
          إضافة مستمع
        </button>
      )}
    </div>
  );
};

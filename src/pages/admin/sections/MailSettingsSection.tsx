/**
 * Mail settings: SMTP configuration and test email delivery.
 * Super-admin only. Reads current settings (database or .env), lets the admin
 * edit and save them, and can send a test email using the form values.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle,
  Loader2,
  Mail,
  Save,
  Send,
  Shield,
  Trash2,
  XCircle,
} from 'lucide-react';
import { settingsService, type MailSettingsInput, type MailSettingsView } from '../../../services/settingsService';
import { ApiError, getErrorMessage } from '../../../services/api';
import { useAdmin } from '../adminContextDef';
import { useLanguage } from '../../../hooks/useLanguage';
import { AdminHeaderActions } from '../../../components/admin/layout/AdminHeaderActions';
import { NoAccess, SectionError, SectionLoading } from '../../../components/admin/common/SectionState';

interface SectionCopy {
  loading: string;
  loadError: string;
  retry: string;
  statusTitle: string;
  statusSaved: string;
  statusEnv: string;
  statusDeliveryEnabled: string;
  statusDeliveryDisabled: string;
  statusNoHost: string;
  formTitle: string;
  hostLabel: string;
  hostPlaceholder: string;
  portLabel: string;
  portPlaceholder: string;
  encryptionLabel: string;
  encryptionTls: string;
  encryptionSsl: string;
  encryptionNone: string;
  usernameLabel: string;
  usernamePlaceholder: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  passwordUnchanged: string;
  removePasswordLabel: string;
  fromAddressLabel: string;
  fromAddressPlaceholder: string;
  fromNameLabel: string;
  fromNamePlaceholder: string;
  saveButton: string;
  saving: string;
  savedToast: string;
  saveError: string;
  resetButton: string;
  resetting: string;
  resetConfirmTitle: string;
  resetConfirmMessage: string;
  resetConfirmButton: string;
  resetToast: string;
  resetError: string;
  testTitle: string;
  testRecipientLabel: string;
  testRecipientPlaceholder: string;
  testButton: string;
  testing: string;
  testSuccess: string;
  testError: string;
  testRateLimited: string;
  testRecipientHint: string;
  sourceLabel: string;
  deliveryLabel: string;
  testMessageId: string;
  portRangeError: string;
  emailFormatError: string;
  hintTlsPort: string;
  hintSslPort: string;
}

const COPY: Record<'ar' | 'en', SectionCopy> = {
  ar: {
    loading: 'جاري تحميل إعدادات البريد...',
    loadError: 'تعذر تحميل إعدادات البريد',
    retry: 'إعادة المحاولة',
    statusTitle: 'الحالة الحالية',
    statusSaved: 'محفوظة في إعدادات المدير',
    statusEnv: 'من ملف .env في الخادم',
    statusDeliveryEnabled: 'التسليم مفعل',
    statusDeliveryDisabled: 'التسليم معطل',
    statusNoHost: 'البريد غير مفعل حالياً (لا يوجد مضيف SMTP)',
    formTitle: 'إعدادات SMTP',
    hostLabel: 'مضيف SMTP',
    hostPlaceholder: 'smtp.example.com',
    portLabel: 'المنفذ',
    portPlaceholder: '587',
    encryptionLabel: 'التشفير',
    encryptionTls: 'STARTTLS (المنفذ 587)',
    encryptionSsl: 'SSL/TLS (المنفذ 465)',
    encryptionNone: 'بدون تشفير',
    usernameLabel: 'اسم المستخدم',
    usernamePlaceholder: 'user@example.com',
    passwordLabel: 'كلمة المرور',
    passwordPlaceholder: '••••••••',
    passwordUnchanged: '•••••••• (غير متغيرة)',
    removePasswordLabel: 'إزالة كلمة المرور المحفوظة',
    fromAddressLabel: 'مرسل من (البريد)',
    fromAddressPlaceholder: 'noreply@example.com',
    fromNameLabel: 'مرسل من (الاسم)',
    fromNamePlaceholder: 'اسم التطبيق',
    saveButton: 'حفظ الإعدادات',
    saving: 'جاري الحفظ...',
    savedToast: 'تم حفظ إعدادات البريد',
    saveError: 'تعذر حفظ الإعدادات',
    resetButton: 'إعادة تعيين لقيم .env',
    resetting: 'جاري إعادة التعيين...',
    resetConfirmTitle: 'إعادة تعيين إعدادات البريد؟',
    resetConfirmMessage: 'سيتم حذف الإعدادات المحفوظة في قاعدة البيانات والعودة لاستخدام قيم ملف .env. لا يمكن التراجع.',
    resetConfirmButton: 'إعادة التعيين',
    resetToast: 'تمت إعادة تعيين الإعدادات لقيم .env',
    resetError: 'تعذر إعادة تعيين الإعدادات',
    testTitle: 'اختبار الإرسال',
    testRecipientLabel: 'بريد المستلم',
    testRecipientPlaceholder: 'test@example.com',
    testButton: 'إرسال بريد تجريبي',
    testing: 'جاري الإرسال...',
    testSuccess: 'تم إرسال البريد التجريبي بنجاح',
    testError: 'فشل إرسال البريد التجريبي',
    testRateLimited: 'تم الوصول للحد الأقصى. انتظر دقيقة قبل المحاولة مرة أخرى.',
    testRecipientHint: 'يُرسل البريد التجريبي بالإعدادات الموجودة في النموذج، حتى قبل حفظها.',
    sourceLabel: 'المصدر:',
    deliveryLabel: 'التسليم:',
    testMessageId: 'معرف الرسالة: ',
    portRangeError: 'المنفذ يجب أن يكون بين 1 و 65535',
    emailFormatError: 'تنسيق البريد الإلكتروني غير صحيح',
    hintTlsPort: 'الاقتران المعتاد: TLS مع المنفذ 587',
    hintSslPort: 'الاقتران المعتاد: SSL مع المنفذ 465',
  },
  en: {
    loading: 'Loading mail settings...',
    loadError: 'Could not load mail settings',
    retry: 'Retry',
    statusTitle: 'Current status',
    statusSaved: 'Saved in admin settings',
    statusEnv: 'From server .env file',
    statusDeliveryEnabled: 'Delivery enabled',
    statusDeliveryDisabled: 'Delivery disabled',
    statusNoHost: 'Mail is currently not delivered (no SMTP host)',
    formTitle: 'SMTP settings',
    hostLabel: 'SMTP host',
    hostPlaceholder: 'smtp.example.com',
    portLabel: 'Port',
    portPlaceholder: '587',
    encryptionLabel: 'Encryption',
    encryptionTls: 'STARTTLS (port 587)',
    encryptionSsl: 'SSL/TLS (port 465)',
    encryptionNone: 'None',
    usernameLabel: 'Username',
    usernamePlaceholder: 'user@example.com',
    passwordLabel: 'Password',
    passwordPlaceholder: '••••••••',
    passwordUnchanged: '•••••••• (unchanged)',
    removePasswordLabel: 'Remove stored password',
    fromAddressLabel: 'From address',
    fromAddressPlaceholder: 'noreply@example.com',
    fromNameLabel: 'From name',
    fromNamePlaceholder: 'App name',
    saveButton: 'Save settings',
    saving: 'Saving...',
    savedToast: 'Mail settings saved',
    saveError: 'Could not save settings',
    resetButton: 'Reset to .env values',
    resetting: 'Resetting...',
    resetConfirmTitle: 'Reset mail settings?',
    resetConfirmMessage: 'This will delete the saved database settings and revert to the .env file values. This cannot be undone.',
    resetConfirmButton: 'Reset',
    resetToast: 'Settings reset to .env values',
    resetError: 'Could not reset settings',
    testTitle: 'Test sending',
    testRecipientLabel: 'Recipient email',
    testRecipientPlaceholder: 'test@example.com',
    testButton: 'Send test email',
    testing: 'Sending...',
    testSuccess: 'Test email sent successfully',
    testError: 'Failed to send test email',
    testRateLimited: 'Rate limit reached. Wait a minute before trying again.',
    testRecipientHint: 'The test uses the values in the form, even before they are saved.',
    sourceLabel: 'Source:',
    deliveryLabel: 'Delivery:',
    testMessageId: 'Message ID: ',
    portRangeError: 'Port must be between 1 and 65535',
    emailFormatError: 'Invalid email format',
    hintTlsPort: 'Usual pairing: TLS with port 587',
    hintSslPort: 'Usual pairing: SSL with port 465',
  },
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const initialFormState: MailSettingsInput = {
  host: '',
  port: 587,
  username: '',
  encryption: 'tls',
  fromAddress: '',
  fromName: '',
};

function isSuperAdmin(role: string | undefined): boolean {
  return role === 'super_admin';
}

export const MailSettingsSection: React.FC = () => {
  const { currentUser, confirmDelete, showToast } = useAdmin();
  const { language } = useLanguage();
  const t = COPY[language === 'ar' ? 'ar' : 'en'];

  const [view, setView] = useState<MailSettingsView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; messageId?: string } | null>(null);

  const [form, setForm] = useState<MailSettingsInput>(initialFormState);
  const [passwordEntered, setPasswordEntered] = useState(false);
  const [removePassword, setRemovePassword] = useState(false);
  const [recipient, setRecipient] = useState(currentUser?.email ?? '');

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await settingsService.getMailSettings();
      setView(data);
      setForm({
        host: data.host,
        port: data.port,
        username: data.username,
        encryption: data.encryption,
        fromAddress: data.fromAddress,
        fromName: data.fromName,
      });
      setPasswordEntered(false);
      setRemovePassword(false);
    } catch (caught) {
      setError(getErrorMessage(caught, t.loadError));
    } finally {
      setLoading(false);
    }
  }, [t.loadError]);

  const allowed = isSuperAdmin(currentUser?.role);

  useEffect(() => {
    if (allowed) void loadSettings();
  }, [allowed, loadSettings]);

  // The signed-in admin may arrive after the first render; default the recipient to them.
  const currentEmail = currentUser?.email;
  useEffect(() => {
    if (currentEmail) setRecipient((value) => value || currentEmail);
  }, [currentEmail]);

  const isDirty = useMemo(() => {
    if (!view) return false;
    return (
      form.host !== view.host ||
      form.port !== view.port ||
      form.username !== view.username ||
      form.encryption !== view.encryption ||
      form.fromAddress !== view.fromAddress ||
      form.fromName !== view.fromName ||
      passwordEntered ||
      removePassword
    );
  }, [view, form, passwordEntered, removePassword]);

  const validateForm = (): string | null => {
    if (form.port < 1 || form.port > 65535) return t.portRangeError;
    if (form.fromAddress && !EMAIL_REGEX.test(form.fromAddress)) return t.emailFormatError;
    return null;
  };

  const handleInputChange = (field: keyof MailSettingsInput, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setTestResult(null);
  };

  const handlePasswordChange = (value: string) => {
    setPasswordEntered(value.length > 0);
    setRemovePassword(false);
    setTestResult(null);
  };

  const handleRemovePasswordChange = (checked: boolean) => {
    setRemovePassword(checked);
    if (checked) setPasswordEntered(false);
    setTestResult(null);
  };

  const handleSave = async () => {
    const validationError = validateForm();
    if (validationError) {
      showToast(validationError);
      return;
    }
    setSaving(true);
    setTestResult(null);
    try {
      const input: MailSettingsInput = {
        ...form,
        password: removePassword ? '' : (passwordEntered ? form.password : undefined),
      };
      const saved = await settingsService.updateMailSettings(input);
      setView(saved);
      setForm({
        host: saved.host,
        port: saved.port,
        username: saved.username,
        encryption: saved.encryption,
        fromAddress: saved.fromAddress,
        fromName: saved.fromName,
      });
      setPasswordEntered(false);
      setRemovePassword(false);
      showToast(t.savedToast);
    } catch (caught) {
      showToast(getErrorMessage(caught, t.saveError));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    const ok = await confirmDelete({
      title: t.resetConfirmTitle,
      message: t.resetConfirmMessage,
      confirmLabel: t.resetConfirmButton,
    });
    if (!ok) return;
    setResetting(true);
    setTestResult(null);
    try {
      const reset = await settingsService.resetMailSettings();
      setView(reset);
      setForm({
        host: reset.host,
        port: reset.port,
        username: reset.username,
        encryption: reset.encryption,
        fromAddress: reset.fromAddress,
        fromName: reset.fromName,
      });
      setPasswordEntered(false);
      setRemovePassword(false);
      showToast(t.resetToast);
    } catch (caught) {
      showToast(getErrorMessage(caught, t.resetError));
    } finally {
      setResetting(false);
    }
  };

  const buildSettingsFromForm = (): MailSettingsInput => {
    const input: MailSettingsInput = { ...form };
    if (removePassword) {
      input.password = '';
    } else if (passwordEntered) {
      input.password = form.password;
    }
    return input;
  };

  const handleTest = async () => {
    const validationError = validateForm();
    if (validationError) {
      showToast(validationError);
      return;
    }
    const to = recipient.trim();
    if (!EMAIL_REGEX.test(to)) {
      showToast(t.emailFormatError);
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const response = await settingsService.sendTestEmail({
        to,
        settings: buildSettingsFromForm(),
      });
      setTestResult({ success: true, message: t.testSuccess, messageId: response.messageId });
      showToast(t.testSuccess);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 429) {
        setTestResult({ success: false, message: t.testRateLimited });
      } else {
        setTestResult({ success: false, message: getErrorMessage(caught, t.testError) });
      }
    } finally {
      setTesting(false);
    }
  };

  if (!allowed) return <NoAccess />;

  const header = (
    <AdminHeaderActions>
      <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-canvas border border-muted-border/40 text-[11px] font-bold text-neutral-text/70 tabular-nums whitespace-nowrap">
        <Shield className="w-3.5 h-3.5" />
        {t.statusTitle}
      </span>
    </AdminHeaderActions>
  );

  if (error) {
    return (
      <>
        {header}
        <SectionError message={error} onRetry={loadSettings} />
      </>
    );
  }
  if (loading && !view) {
    return (
      <>
        {header}
        <SectionLoading label={t.loading} />
      </>
    );
  }

  const showPortHint = (form.encryption === 'tls' && form.port === 465) || (form.encryption === 'ssl' && form.port === 587);

  return (
    <div className="space-y-5">
      {header}

      <div className="rounded-2xl bg-surface border border-muted-border/40 p-5 space-y-4">
        <h3 className="text-sm font-black text-heading flex items-center gap-2">
          <Mail className="w-4 h-4" />
          {t.statusTitle}
        </h3>
        <div className="grid sm:grid-cols-2 gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-neutral-text/70 w-32 shrink-0">{t.sourceLabel}</span>
            <span className={view?.source === 'database' ? 'text-accent' : 'text-neutral-text'}>
              {view?.source === 'database' ? t.statusSaved : t.statusEnv}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-neutral-text/70 w-32 shrink-0">{t.deliveryLabel}</span>
            <span className={view?.deliveryEnabled ? 'text-green-500' : 'text-amber-500'}>
              {view?.deliveryEnabled ? t.statusDeliveryEnabled : t.statusDeliveryDisabled}
            </span>
          </div>
          {(!view?.host || view.host.trim() === '') && (
            <div className="sm:col-span-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{t.statusNoHost}</span>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl bg-surface border border-muted-border/40 p-5 space-y-5">
        <h3 className="text-sm font-black text-heading flex items-center gap-2">
          <Save className="w-4 h-4" />
          {t.formTitle}
        </h3>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="mail-host" className="block text-xs font-bold text-neutral-text/70">{t.hostLabel}</label>
            <input
              id="mail-host"
              type="text"
              value={form.host}
              onChange={(e) => handleInputChange('host', e.target.value)}
              placeholder={t.hostPlaceholder}
              className="w-full px-3 py-2 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent"
              dir="ltr"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="mail-port" className="block text-xs font-bold text-neutral-text/70">{t.portLabel}</label>
            <input
              id="mail-port"
              type="number"
              value={form.port}
              onChange={(e) => handleInputChange('port', Number(e.target.value) || 0)}
              placeholder={t.portPlaceholder}
              min={1}
              max={65535}
              className="w-full px-3 py-2 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent"
              dir="ltr"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="mail-encryption" className="block text-xs font-bold text-neutral-text/70">{t.encryptionLabel}</label>
          <select
            id="mail-encryption"
            value={form.encryption}
            onChange={(e) => handleInputChange('encryption', e.target.value as 'tls' | 'ssl' | 'none')}
            className="w-full sm:w-64 px-3 py-2 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent cursor-pointer"
          >
            <option value="tls">{t.encryptionTls}</option>
            <option value="ssl">{t.encryptionSsl}</option>
            <option value="none">{t.encryptionNone}</option>
          </select>
          {showPortHint && (
            <p className="text-[10px] text-neutral-text/60 flex items-center gap-1.5">
              <AlertCircle className="w-3 h-3 shrink-0" />
              {form.encryption === 'tls' ? t.hintSslPort : t.hintTlsPort}
            </p>
          )}
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="mail-username" className="block text-xs font-bold text-neutral-text/70">{t.usernameLabel}</label>
            <input
              id="mail-username"
              type="text"
              value={form.username}
              onChange={(e) => handleInputChange('username', e.target.value)}
              placeholder={t.usernamePlaceholder}
              className="w-full px-3 py-2 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent"
              dir="ltr"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="mail-password" className="block text-xs font-bold text-neutral-text/70 flex items-center gap-1.5">
              {t.passwordLabel}
              {view?.passwordSet && !passwordEntered && !removePassword && (
                <span className="text-[10px] text-neutral-text/50">({t.passwordUnchanged})</span>
              )}
            </label>
            <input
              id="mail-password"
              type="password"
              value={passwordEntered ? form.password : ''}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, password: e.target.value }));
                handlePasswordChange(e.target.value);
              }}
              placeholder={view?.passwordSet && !passwordEntered && !removePassword ? t.passwordUnchanged : t.passwordPlaceholder}
              className="w-full px-3 py-2 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent"
              dir="ltr"
              autoComplete="current-password"
            />
            {view?.passwordSet && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={removePassword}
                  onChange={(e) => handleRemovePasswordChange(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-muted-border/50 text-accent focus:ring-accent focus:ring-offset-0 focus:ring-2 cursor-pointer"
                />
                <span className="text-xs text-neutral-text/70">{t.removePasswordLabel}</span>
              </label>
            )}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="mail-from-address" className="block text-xs font-bold text-neutral-text/70">{t.fromAddressLabel}</label>
            <input
              id="mail-from-address"
              type="email"
              value={form.fromAddress}
              onChange={(e) => handleInputChange('fromAddress', e.target.value)}
              placeholder={t.fromAddressPlaceholder}
              className="w-full px-3 py-2 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent"
              dir="ltr"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="mail-from-name" className="block text-xs font-bold text-neutral-text/70">{t.fromNameLabel}</label>
            <input
              id="mail-from-name"
              type="text"
              value={form.fromName}
              onChange={(e) => handleInputChange('fromName', e.target.value)}
              placeholder={t.fromNamePlaceholder}
              className="w-full px-3 py-2 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2 border-t border-muted-border/20">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !isDirty}
            className="brand-btn-primary font-black px-4 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer shadow-md text-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{saving ? t.saving : t.saveButton}</span>
          </button>
          {view?.source === 'database' && (
            <button
              type="button"
              onClick={handleReset}
              disabled={resetting}
              className="brand-btn-secondary font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resetting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              <span>{resetting ? t.resetting : t.resetButton}</span>
            </button>
          )}
        </div>
      </div>

      <div className="rounded-2xl bg-surface border border-muted-border/40 p-5 space-y-5">
        <h3 className="text-sm font-black text-heading flex items-center gap-2">
          <Send className="w-4 h-4" />
          {t.testTitle}
        </h3>

        <div className="space-y-1.5">
          <label htmlFor="test-recipient" className="block text-xs font-bold text-neutral-text/70">{t.testRecipientLabel}</label>
          <input
            id="test-recipient"
            type="email"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder={t.testRecipientPlaceholder}
            className="w-full sm:w-80 px-3 py-2 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent"
            dir="ltr"
          />
          <p className="text-[10px] text-neutral-text/60">
            {t.testRecipientHint}
          </p>
        </div>

        <button
          type="button"
          onClick={handleTest}
          disabled={testing}
          className="brand-btn-primary font-black px-4 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer shadow-md text-xs disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          <span>{testing ? t.testing : t.testButton}</span>
        </button>

        {testResult && (
          <div
            className={`p-4 rounded-xl text-xs font-mono whitespace-pre-wrap break-all ${
              testResult.success
                ? 'bg-green-500/10 border border-green-500/30 text-green-600 dark:text-green-400'
                : 'bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400'
            } flex items-start gap-2`}
          >
            {testResult.success ? (
              <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-bold">{testResult.message}</p>
              {testResult.messageId && (
                <p className="mt-1 opacity-80">{t.testMessageId}{testResult.messageId}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
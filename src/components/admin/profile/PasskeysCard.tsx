import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Cloud,
  KeyRound,
  Laptop,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { browserSupportsWebAuthn, startRegistration } from '@simplewebauthn/browser';
import { useAdmin } from '../../../pages/admin/adminContextDef';
import { authService } from '../../../services/authService';
import type { PasskeyItem } from '../../../services/authService';
import { getErrorMessage } from '../../../services/api';

interface PasskeysCardProps {
  isAr: boolean;
}

type DialogKind = 'register' | 'rename' | 'delete' | null;

export const PasskeysCard: React.FC<PasskeysCardProps> = ({ isAr }) => {
  const { refreshUser, showToast } = useAdmin();

  const [passkeys, setPasskeys] = useState<PasskeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [activeItem, setActiveItem] = useState<PasskeyItem | null>(null);

  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supported = browserSupportsWebAuthn();
  const text = (ar: string, en: string) => (isAr ? ar : en);

  const loadPasskeys = async () => {
    try {
      const result = await authService.listPasskeys();
      setPasskeys(result.passkeys);
    } catch {
      // Keep empty if unauthenticated or error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPasskeys();
  }, []);

  const resetDialog = () => {
    setPassword('');
    setName('');
    setError(null);
    setActiveItem(null);
    setDialog(null);
  };

  const openRegister = () => {
    resetDialog();
    const today = new Date().toLocaleDateString(isAr ? 'ar-SA' : 'en-US');
    setName(text(`مفتاحي (${today})`, `My Passkey (${today})`));
    setDialog('register');
  };

  const openRename = (item: PasskeyItem) => {
    resetDialog();
    setActiveItem(item);
    setName(item.name);
    setDialog('rename');
  };

  const openDelete = (item: PasskeyItem) => {
    resetDialog();
    setActiveItem(item);
    setDialog('delete');
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supported) {
      setError(text('متصفحك الحالي لا يدعم مفاتيح المرور', 'WebAuthn is not supported in this browser'));
      return;
    }

    setError(null);
    setBusy(true);

    try {
      const { options } = await authService.getPasskeyRegisterOptions(password);

      let regResponse;
      try {
        regResponse = await startRegistration({ optionsJSON: options });
      } catch (promptError: any) {
        if (promptError?.name === 'NotAllowedError') {
          setBusy(false);
          return;
        }
        throw promptError;
      }

      await authService.verifyPasskeyRegister(regResponse, name.trim());
      await loadPasskeys();
      void refreshUser();
      showToast(text('تمت إضافة مفتاح المرور بنجاح', 'Passkey added successfully'));
      resetDialog();
    } catch (caught) {
      setError(getErrorMessage(caught, text('تعذر تسجيل مفتاح المرور', 'Could not register passkey')));
    } finally {
      setBusy(false);
    }
  };

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeItem) return;
    setError(null);
    setBusy(true);

    try {
      await authService.renamePasskey(activeItem.id, name.trim());
      await loadPasskeys();
      showToast(text('تمت إعادة تسمية مفتاح المرور', 'Passkey renamed'));
      resetDialog();
    } catch (caught) {
      setError(getErrorMessage(caught, text('تعذر إعادة التسمية', 'Could not rename passkey')));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeItem) return;
    setError(null);
    setBusy(true);

    try {
      await authService.deletePasskey(activeItem.id, password);
      await loadPasskeys();
      void refreshUser();
      showToast(text('تم حذف مفتاح المرور', 'Passkey deleted'));
      resetDialog();
    } catch (caught) {
      setError(getErrorMessage(caught, text('تعذر حذف مفتاح المرور', 'Could not delete passkey')));
    } finally {
      setBusy(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return text('لم يُستخدم بعد', 'Never used');
    const date = new Date(dateStr);
    return date.toLocaleDateString(isAr ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <>
      <div className="rounded-2xl bg-surface border border-muted-border/40 p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 shrink-0">
              <KeyRound className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-heading">
                  {text('مفاتيح المرور (Passkeys)', 'Passkeys (WebAuthn)')}
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
                  {passkeys.length}/10
                </span>
              </div>
              <p className="text-xs text-neutral-text/70 leading-relaxed max-w-xl">
                {text(
                  'يتيح الدخول بالبصمة أو بوجهك دون كلمة مرور أو رمز. مفاتيح المرور توفر أعلى مستويات الأمان المقاوم للتصيد.',
                  'Sign in with fingerprint or Face ID without password or verification code. Phishing-resistant standard.'
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={openRegister}
            disabled={passkeys.length >= 10 || !supported}
            title={
              !supported
                ? text('المتصفح لا يدعم مفاتيح المرور', 'Browser does not support passkeys')
                : passkeys.length >= 10
                ? text('بلغت الحد الأقصى (10 مفاتيح)', 'Maximum 10 passkeys reached')
                : undefined
            }
            className="cursor-pointer text-xs font-bold px-4 py-2 rounded-xl brand-btn-primary shadow-sm transition-all shrink-0 flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
            {text('إضافة مفتاح مرور', 'Add Passkey')}
          </button>
        </div>

        {loading ? (
          <div className="py-6 text-center text-xs text-neutral-text/50">
            {text('جاري التحميل...', 'Loading passkeys...')}
          </div>
        ) : passkeys.length === 0 ? (
          <div className="rounded-xl bg-canvas border border-muted-border/30 p-5 text-center space-y-1.5">
            <p className="text-xs font-bold text-neutral-text/70">
              {text('لم تسجل أي مفتاح مرور بعد', 'No passkeys registered yet')}
            </p>
            <p className="text-[11px] text-neutral-text/50">
              {text(
                'سجل جهازك الحالي أو مفتاح أمان خارجي لتسجيل الدخول بلمسة واحدة.',
                'Register this device or a security key for instant one-touch login.'
              )}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {passkeys.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3.5 rounded-xl bg-canvas border border-muted-border/40 hover:border-muted-border/70 transition-colors"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-heading truncate">{item.name}</span>
                    <span
                      className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-surface border border-muted-border/50 text-neutral-text/70"
                      title={
                        item.deviceType === 'multiDevice'
                          ? text('مفتاح متزامن سحابياً (iCloud / Google Password Manager)', 'Synced multi-device credential')
                          : text('مفتاح مقيد بهذا الجهاز فقط', 'Device-bound single device credential')
                      }
                    >
                      {item.deviceType === 'multiDevice' ? (
                        <>
                          <Cloud className="w-2.5 h-2.5 text-accent" />
                          <span>{text('سحابي متزامن', 'Synced')}</span>
                        </>
                      ) : (
                        <>
                          <Laptop className="w-2.5 h-2.5 text-neutral-text/70" />
                          <span>{text('مرتبط بالجهاز', 'Device-bound')}</span>
                        </>
                      )}
                    </span>
                    {item.backedUp && (
                      <span
                        className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                        title={text('تم إنشاء نسخة احتياطية سحابية لهذا المفتاح', 'Backed up to cloud')}
                      >
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        <span>{text('نسخة احتياطية', 'Backed up')}</span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-neutral-text/50">
                    <span>
                      {text('أُضيف:', 'Added:')} {formatDate(item.createdAt)}
                    </span>
                    <span>•</span>
                    <span>
                      {text('آخر استخدام:', 'Last used:')} {formatDate(item.lastUsedAt)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => openRename(item)}
                    title={text('إعادة تسمية', 'Rename')}
                    className="p-1.5 rounded-lg text-neutral-text/50 hover:text-heading hover:bg-surface cursor-pointer transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => openDelete(item)}
                    title={text('حذف مفتاح المرور', 'Delete')}
                    className="p-1.5 rounded-lg text-neutral-text/40 hover:text-red-400 hover:bg-red-500/10 cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Registration Dialog */}
      {dialog === 'register' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-surface border border-muted-border/40 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-muted-border/30">
              <h3 className="text-sm font-black text-heading flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-500" />
                {text('إضافة مفتاح مرور جديد', 'Add New Passkey')}
              </h3>
              <button
                type="button"
                onClick={resetDialog}
                className="p-1 rounded-lg text-neutral-text/50 hover:text-heading cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-4">
              <p className="text-xs text-neutral-text/70 leading-relaxed">
                {text(
                  'أدخل كلمة المرور الحالية لتأكيد هويتك، ثم اختر اسماً للمفتاح واتبع تعليمات متصفحك.',
                  'Enter current password to confirm identity, label your passkey, and follow browser prompt.'
                )}
              </p>

              <div>
                <label className="block text-[11px] font-bold text-neutral-text/70 mb-1">
                  {text('اسم المفتاح', 'Passkey Label')}
                </label>
                <input
                  type="text"
                  required
                  maxLength={60}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={text('مثال: MacBook Pro', 'e.g. MacBook Pro')}
                  className="w-full py-2.5 px-3.5 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-neutral-text/70 mb-1">
                  {text('كلمة المرور الحالية', 'Current Password')}
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full py-2.5 px-3.5 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={resetDialog}
                  className="px-4 py-2 rounded-xl border border-muted-border/40 text-xs font-bold text-neutral-text/70 hover:bg-surface-hover cursor-pointer"
                >
                  {text('إلغاء', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={busy || !password || !name.trim()}
                  className="px-5 py-2 rounded-xl text-xs font-black cursor-pointer shadow-sm brand-btn-primary disabled:opacity-50"
                >
                  {busy ? text('جاري التسجيل...', 'Registering...') : text('متابعة التسجيل', 'Continue')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rename Dialog */}
      {dialog === 'rename' && activeItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-surface border border-muted-border/40 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-muted-border/30">
              <h3 className="text-sm font-black text-heading flex items-center gap-2">
                <Pencil className="w-4 h-4 text-accent" />
                {text('إعادة تسمية مفتاح المرور', 'Rename Passkey')}
              </h3>
              <button
                type="button"
                onClick={resetDialog}
                className="p-1 rounded-lg text-neutral-text/50 hover:text-heading cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleRename} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-neutral-text/70 mb-1">
                  {text('الاسم الجديد', 'New Name')}
                </label>
                <input
                  type="text"
                  required
                  maxLength={60}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full py-2.5 px-3.5 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={resetDialog}
                  className="px-4 py-2 rounded-xl border border-muted-border/40 text-xs font-bold text-neutral-text/70 hover:bg-surface-hover cursor-pointer"
                >
                  {text('إلغاء', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={busy || !name.trim()}
                  className="px-5 py-2 rounded-xl text-xs font-black cursor-pointer shadow-sm brand-btn-primary disabled:opacity-50"
                >
                  {busy ? text('جاري الحفظ...', 'Saving...') : text('حفظ التعديل', 'Save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Dialog */}
      {dialog === 'delete' && activeItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-surface border border-muted-border/40 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-muted-border/30">
              <h3 className="text-sm font-black text-heading flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-red-500" />
                {text('حذف مفتاح المرور', 'Delete Passkey')}
              </h3>
              <button
                type="button"
                onClick={resetDialog}
                className="p-1 rounded-lg text-neutral-text/50 hover:text-heading cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleDelete} className="space-y-4">
              <p className="text-xs text-neutral-text/70 leading-relaxed">
                {text(
                  `هل أنت متأكد من حذف مفتاح المرور "${activeItem.name}"؟ سيتطلب الدخول من هذا الجهاز استخدام كلمة المرور مجدداً.`,
                  `Are you sure you want to delete passkey "${activeItem.name}"? Password will be required on this device.`
                )}
              </p>

              <div>
                <label className="block text-[11px] font-bold text-neutral-text/70 mb-1">
                  {text('كلمة المرور الحالية للتأكيد', 'Current Password to Confirm')}
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full py-2.5 px-3.5 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={resetDialog}
                  className="px-4 py-2 rounded-xl border border-muted-border/40 text-xs font-bold text-neutral-text/70 hover:bg-surface-hover cursor-pointer"
                >
                  {text('إلغاء', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={busy || !password}
                  className="px-5 py-2 rounded-xl text-xs font-black cursor-pointer shadow-sm bg-red-500 hover:bg-red-600 text-white disabled:opacity-50"
                >
                  {busy ? text('جاري الحذف...', 'Deleting...') : text('تأكيد الحذف', 'Confirm Delete')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

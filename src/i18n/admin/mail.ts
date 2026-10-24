import { defineStrings } from './core';

export interface SectionCopy {
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

export const COPY: Record<'ar' | 'en', SectionCopy> = {
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

export const mail = defineStrings('mail', {}, {});

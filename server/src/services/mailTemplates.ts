/**
 * Arabic-first, RTL email bodies.
 *
 * Every template returns `{ kind, subject, html, text }` so callers never
 * assemble markup inline. Two rules apply to all of them:
 *
 * - **Everything interpolated is escaped.** Inquiry fields come straight from a
 *   public form; unescaped, a customer could inject markup into an admin inbox.
 * - **Styling is inline.** Mail clients strip `<style>` blocks and external CSS,
 *   so tables plus inline attributes are the only portable option.
 *
 * `kind` is a fixed identifier, never derived from the message, so the transport
 * can name the template in a log line without copying any user-supplied text.
 */

export type MailKind = 'login-otp' | 'password-reset' | 'new-inquiry' | 'password-changed';

export interface MailContent {
  kind: MailKind;
  subject: string;
  html: string;
  text: string;
}

/** Brand palette, mirroring the CSS custom properties in `src/index.css`. */
const COLORS = {
  ink: '#12232b',
  accent: '#0f5f70',
  gold: '#a67323',
  goldSoft: '#f7f1e4',
  border: '#dfe6e8',
  muted: '#5b6b73',
  danger: '#a12a2a',
  surface: '#ffffff',
  page: '#f2f5f6',
} as const;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Multiline plain-text values are prefixed so quoted replies stay readable. */
function asTextBlock(value: string | null | undefined, fallback = '—'): string {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return fallback;
  return trimmed.split(/\r?\n/).map((line) => `    ${line}`).join('\n');
}

function shell(options: {
  brandName: string;
  heading: string;
  intro: string;
  bodyHtml: string;
  footnote?: string;
}): string {
  const { brandName, heading, intro, bodyHtml, footnote } = options;

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(heading)}</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.page};font-family:'Segoe UI',Tahoma,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.page};padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:${COLORS.surface};border:1px solid ${COLORS.border};border-radius:10px;overflow:hidden;">
          <tr>
            <td style="background:${COLORS.ink};padding:20px 24px;border-bottom:3px solid ${COLORS.gold};">
              <div style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.5px;">${escapeHtml(brandName)}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px;color:${COLORS.ink};font-size:15px;line-height:1.9;" dir="rtl">
              <h1 style="margin:0 0 12px;font-size:19px;line-height:1.5;color:${COLORS.ink};">${escapeHtml(heading)}</h1>
              <p style="margin:0 0 16px;color:${COLORS.muted};">${escapeHtml(intro)}</p>
              ${bodyHtml}
              ${
                footnote
                  ? `<p style="margin:24px 0 0;padding-top:14px;border-top:1px solid ${COLORS.border};color:${COLORS.muted};font-size:13px;line-height:1.8;">${escapeHtml(footnote)}</p>`
                  : ''
              }
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px;background:${COLORS.page};color:${COLORS.muted};font-size:12px;line-height:1.7;" dir="rtl">
              ${escapeHtml(brandName)} — رسالة آلية، يُرجى عدم الرد عليها.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** The six-digit code, shown at a size that survives being read on a phone. */
function codeBlock(code: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 4px;">
    <tr>
      <td align="center" style="background:${COLORS.goldSoft};border:1px solid ${COLORS.gold};border-radius:8px;padding:16px 8px;">
        <span style="font-size:34px;font-weight:700;letter-spacing:10px;color:${COLORS.ink};direction:ltr;display:inline-block;">${escapeHtml(code)}</span>
      </td>
    </tr>
  </table>`;
}

const OTP_FOOTNOTE =
  'إذا لم تطلب هذا الرمز فيرجى تجاهل هذه الرسالة. لا تشارك الرمز مع أي شخص، ولن يطلبه منك أي موظف عبر الهاتف أو البريد.';

export function loginOtpEmail(options: {
  brandName: string;
  name?: string | null;
  code: string;
  expiresInMinutes: number;
}): MailContent {
  const { brandName, name, code, expiresInMinutes } = options;
  const greeting = name?.trim() ? `مرحباً ${name.trim()}،` : 'مرحباً،';

  return {
  kind: 'login-otp',
    subject: `${brandName} — رمز التحقق للدخول`,
    html: shell({
      brandName,
      heading: 'رمز التحقق للدخول',
      intro: `${greeting} استخدم الرمز التالي لإكمال تسجيل الدخول إلى لوحة التحكم.`,
      bodyHtml: codeBlock(code),
      footnote: `صالح لمدة ${expiresInMinutes} دقائق. ${OTP_FOOTNOTE}`,
    }),
    text: [
      `${brandName} — رمز التحقق للدخول`,
      '',
      greeting,
      `رمز التحقق الخاص بك: ${code}`,
      `الرمز صالح لمدة ${expiresInMinutes} دقائق.`,
      '',
      OTP_FOOTNOTE,
    ].join('\n'),
  };
}

export function passwordResetEmail(options: {
  brandName: string;
  name?: string | null;
  code: string;
  expiresInMinutes: number;
}): MailContent {
  const { brandName, name, code, expiresInMinutes } = options;
  const greeting = name?.trim() ? `مرحباً ${name.trim()}،` : 'مرحباً،';

  return {
  kind: 'password-reset',
    subject: `${brandName} — إعادة تعيين كلمة المرور`,
    html: shell({
      brandName,
      heading: 'إعادة تعيين كلمة المرور',
      intro: `${greeting} طُلبت إعادة تعيين كلمة المرور الخاصة بحسابك. استخدم الرمز التالي في صفحة "نسيت كلمة المرور".`,
      bodyHtml: codeBlock(code),
      footnote: `صالح لمدة ${expiresInMinutes} دقائق. ${OTP_FOOTNOTE}`,
    }),
    text: [
      `${brandName} — إعادة تعيين كلمة المرور`,
      '',
      greeting,
      `رمز إعادة التعيين: ${code}`,
      `الرمز صالح لمدة ${expiresInMinutes} دقائق.`,
      '',
      OTP_FOOTNOTE,
    ].join('\n'),
  };
}

function detailRow(label: string, value: string | null | undefined): string {
  return `<tr>
    <td style="padding:7px 0;border-bottom:1px solid ${COLORS.border};color:${COLORS.muted};font-size:14px;width:120px;vertical-align:top;">${escapeHtml(label)}</td>
    <td style="padding:7px 0;border-bottom:1px solid ${COLORS.border};color:${COLORS.ink};font-size:14px;direction:ltr;text-align:right;unicode-bidi:embed;">${escapeHtml(value?.trim() || '—')}</td>
  </tr>`;
}

export interface InquiryMailData {
  name: string | null;
  phone: string | null;
  email: string | null;
  projectTitle: string | null;
  unitNumber: string | null;
  interestTypeAr: string | null;
  message: string | null;
}

export function newInquiryEmail(options: {
  brandName: string;
  inquiry: InquiryMailData;
  dashboardUrl: string;
}): MailContent {
  const { brandName, inquiry, dashboardUrl } = options;
  const safeUrl = escapeHtml(dashboardUrl);

  return {
  kind: 'new-inquiry',
    subject: `${brandName} — طلب اهتمام جديد${inquiry.name?.trim() ? ` من ${inquiry.name.trim()}` : ''}`,
    html: shell({
      brandName,
      heading: 'طلب اهتمام جديد',
      intro: 'تم استلام طلب جديد من موقع الشركة، وهذه تفاصيله:',
      bodyHtml: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 20px;">
          ${detailRow('الاسم', inquiry.name)}
          ${detailRow('الهاتف', inquiry.phone)}
          ${detailRow('البريد', inquiry.email)}
          ${detailRow('المشروع', inquiry.projectTitle)}
          ${detailRow('الوحدة', inquiry.unitNumber)}
          ${detailRow('نوع الاهتمام', inquiry.interestTypeAr)}
        </table>
        ${
          inquiry.message?.trim()
            ? `<div style="margin:0 0 20px;padding:12px 14px;background:${COLORS.page};border-right:3px solid ${COLORS.accent};border-radius:6px;">
                 <div style="color:${COLORS.muted};font-size:13px;margin-bottom:4px;">الرسالة</div>
                 <div style="color:${COLORS.ink};font-size:14px;line-height:1.9;white-space:pre-wrap;">${escapeHtml(inquiry.message.trim())}</div>
               </div>`
            : ''
        }
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td align="center">
              <a href="${safeUrl}" style="display:inline-block;background:${COLORS.accent};color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 26px;border-radius:6px;">عرض الطلبات</a>
            </td>
          </tr>
        </table>`,
    }),
    text: [
      `${brandName} — طلب اهتمام جديد`,
      '',
      `الاسم:            ${inquiry.name?.trim() || '—'}`,
      `الهاتف:           ${inquiry.phone?.trim() || '—'}`,
      `البريد:           ${inquiry.email?.trim() || '—'}`,
      `المشروع:          ${inquiry.projectTitle?.trim() || '—'}`,
      `الوحدة:           ${inquiry.unitNumber?.trim() || '—'}`,
      `نوع الاهتمام:     ${inquiry.interestTypeAr?.trim() || '—'}`,
      '',
      'الرسالة:',
      asTextBlock(inquiry.message, '—'),
      '',
      `عرض الطلبات: ${dashboardUrl}`,
    ].join('\n'),
  };
}

export function passwordChangedEmail(options: {
  brandName: string;
  name?: string | null;
  /** Short description of how the change happened, for the audit trail. */
  via: 'self_service' | 'reset';
}): MailContent {
  const { brandName, name, via } = options;
  const greeting = name?.trim() ? `مرحباً ${name.trim()}،` : 'مرحباً،';
  const lead =
    via === 'reset'
      ? 'تم تغيير كلمة المرور الخاصة بحسابك عبر طلب إعادة تعيين.'
      : 'تم تغيير كلمة المرور الخاصة بحسابك من لوحة التحكم.';

  return {
  kind: 'password-changed',
    subject: `${brandName} — تم تغيير كلمة المرور`,
    html: shell({
      brandName,
      heading: 'تم تغيير كلمة المرور',
      intro: `${greeting} ${lead}`,
      bodyHtml: `<p style="margin:0 0 12px;padding:12px 14px;background:${COLORS.goldSoft};border-right:3px solid ${COLORS.gold};border-radius:6px;color:${COLORS.ink};font-size:14px;line-height:1.9;">
                   <strong>إذا لم تقم بتغيير كلمة المرور هذه، فعّلها الآن عبر "نسيت كلمة المرور" وتواصل مع مدير النظام فوراً.</strong>
                 </p>
                 <p style="margin:0;color:${COLORS.muted};font-size:14px;line-height:1.9;">
                  لأسباب أمنية، تم إنهاء الجلسات المفتوحة على الأجهزة الأخرى ولم تعد أي جلسة سابقة صالحة.
                 </p>`,
      footnote: 'هذه رسالة إشعار أمنية فقط ولا تتطلب أي إجراء إن كان التغيير من طرفك.',
    }),
    text: [
      `${brandName} — تم تغيير كلمة المرور`,
      '',
      greeting,
      lead,
      '',
      'إذا لم تقم بتغيير كلمة المرور هذه، فعّلها الآن عبر "نسيت كلمة المرور" وتواصل مع مدير النظام فوراً.',
      'لأسباب أمنية، تم إنهاء الجلسات المفتوحة على الأجهزة الأخرى.',
    ].join('\n'),
  };
}

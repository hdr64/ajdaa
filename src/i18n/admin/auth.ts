import { defineStrings } from './core';

/** Owner lane: login portal and passkey suggestions. */
export const auth = defineStrings(
  'auth',
  {
    // Portal General
    portalTitle: 'بوابة إدارة أجدا العقارية',
    portalSubtitle: 'نظام إدارة المشاريع، الوحدات، وطلبات الاهتمام',
    backToHome: 'العودة للرئيسية',
    loginErrorDefault: 'تعذر تسجيل الدخول. حاول مرة أخرى.',
    expiredSession: 'انتهت صلاحية جلسة التحقق، يرجى إعادة تسجيل الدخول',
    passkeyLoginError: 'تعذّر الدخول بمفتاح المرور. جرّب كلمة المرور.',

    // Credentials Step
    emailLabel: 'البريد الإلكتروني للإدارة',
    emailPlaceholder: 'name@example.com',
    passwordLabel: 'كلمة المرور',
    passwordPlaceholder: '••••••••',
    forgotPasswordBtn: 'نسيت كلمة المرور؟',
    signInBtn: 'تسجيل الدخول',
    signingIn: 'جاري تسجيل الدخول...',
    orDivider: 'أو',
    loginWithPasskey: 'الدخول بمفتاح المرور',
    passkeySigningIn: 'جاري التحقق من مفتاح المرور...',

    // Passkey Suggestion (First-time / after login)
    suggestPasskeyTitle: 'تفعيل مفتاح المرور (Passkey)',
    suggestPasskeySubtitle: 'تسجيل دخول أسرع وأكثر أماناً بلمسة واحدة دون كتابة كلمة المرور',
    suggestPasskeyDesc: 'يمكنك استخدام بصمة الإصبع أو الوجه (Touch ID / Face ID / Windows Hello) لتسجيل الدخول بأمان وسرعة فائقة في المرات القادمة.',
    suggestPasskeyBenefit1: 'دخول فوري بلمسة واحدة بدون كتابة كلمة المرور',
    suggestPasskeyBenefit2: 'حماية قصوى ضد التصيد الإلكتروني واختراق الحسابات',
    suggestPasskeyBenefit3: 'مشفّر ومخزّن بأمان على جهازك الحالي',
    suggestPasskeyNameLabel: 'اسم مفتاح المرور (الجهاز)',
    suggestPasskeyNamePlaceholder: 'مثال: جهازي الشخصي / MacBook',
    suggestPasskeyPasswordLabel: 'تأكيد كلمة المرور لتفعيل المفتاح',
    suggestPasskeyPasswordPlaceholder: 'أدخل كلمة المرور الحالية',
    createPasskeyBtn: 'إنشاء مفتاح مرور الآن',
    creatingPasskey: 'جاري إنشاء المفتاح...',
    passkeyCreatedSuccess: 'تم إنشاء مفتاح المرور بنجاح! يمكنك الآن الدخول بلمسة واحدة.',
    skipForNow: 'تخطي الآن',
    remindMeLater: 'تذكيري لاحقاً',
    dontAskAgain: 'عدم السؤال مرة أخرى',
    continueToDashboard: 'المتابعة إلى لوحة التحكم',
    passkeyUnsupported: 'المتصفح الحالي لا يدعم مفاتيح المرور (WebAuthn).',
    passkeyCancelled: 'تم إلغاء عملية المصادقة الحيوية.',
    passkeyDirectSetupTip: 'تم التحقق من هويتك بنجاح — يمكنك تفعيل مفتاح المرور الآن بلمسة واحدة دون إعادة إدخال كلمة المرور.',
  },
  {
    // Portal General
    portalTitle: 'Ajda Real Estate Admin',
    portalSubtitle: 'Real Estate Portfolio & Customer Inquiries Management',
    backToHome: 'Back to Home',
    loginErrorDefault: 'Unable to sign in. Please try again.',
    expiredSession: 'Verification session has expired. Please sign in again.',
    passkeyLoginError: 'Could not sign in with passkey. Please try with your password.',

    // Credentials Step
    emailLabel: 'Admin Email',
    emailPlaceholder: 'name@example.com',
    passwordLabel: 'Password',
    passwordPlaceholder: '••••••••',
    forgotPasswordBtn: 'Forgot password?',
    signInBtn: 'Sign In',
    signingIn: 'Signing in...',
    orDivider: 'or',
    loginWithPasskey: 'Sign in with Passkey',
    passkeySigningIn: 'Verifying passkey...',

    // Passkey Suggestion (First-time / after login)
    suggestPasskeyTitle: 'Enable Passkey',
    suggestPasskeySubtitle: 'Faster, more secure one-touch login without entering passwords',
    suggestPasskeyDesc: 'Use fingerprint or facial recognition (Touch ID / Face ID / Windows Hello) for ultra-fast, secure sign-in next time.',
    suggestPasskeyBenefit1: 'Instant one-tap login without passwords',
    suggestPasskeyBenefit2: 'Maximum protection against phishing and credential theft',
    suggestPasskeyBenefit3: 'Securely encrypted and stored on this device',
    suggestPasskeyNameLabel: 'Passkey / Device Name',
    suggestPasskeyNamePlaceholder: 'e.g. My Laptop / iPhone',
    suggestPasskeyPasswordLabel: 'Confirm Password to enable Passkey',
    suggestPasskeyPasswordPlaceholder: 'Enter your current password',
    createPasskeyBtn: 'Create Passkey Now',
    creatingPasskey: 'Creating passkey...',
    passkeyCreatedSuccess: 'Passkey created successfully! You can now log in with one touch.',
    skipForNow: 'Skip for now',
    remindMeLater: 'Remind me later',
    dontAskAgain: "Don't ask again",
    continueToDashboard: 'Continue to Dashboard',
    passkeyUnsupported: 'This browser does not support passkeys (WebAuthn).',
    passkeyCancelled: 'Biometric authentication was cancelled.',
    passkeyDirectSetupTip: 'You are authenticated — you can enable a passkey now with one touch without retyping your password.',
  }
);

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
    signInToDashboard: 'تسجيل الدخول إلى النظام',
    returnToMainWebsite: 'العودة للموقع الرئيسي',

    // Password Visibility
    hidePassword: 'إخفاء كلمة المرور',
    showPassword: 'إظهار كلمة المرور',

    // Forgot Password
    forgotPasswordTitle: 'استعادة كلمة المرور',
    forgotPasswordDesc: 'أدخل بريدك الإلكتروني لإرسال رمز استعادة كلمة المرور',
    sendResetCode: 'إرسال رمز الاستعادة',
    sendingCode: 'جاري الإرسال...',
    backToSignIn: 'العودة لتسجيل الدخول',

    // Reset Password
    resetPasswordTitle: 'تعيين كلمة المرور الجديدة',
    resetPasswordDesc: 'أدخل رمز التحقق المرسل للحساب وكلمة المرور الجديدة',
    verificationCodeLabel: 'رمز التحقق (6 أرقام)',
    newPasswordLabel: 'كلمة المرور الجديدة (10 أحرف على الأقل)',
    confirmNewPasswordLabel: 'تأكيد كلمة المرور الجديدة',
    resettingPassword: 'جاري تعيين كلمة المرور...',
    confirmPasswordReset: 'تأكيد تغيير كلمة المرور',
    cancelAndBackToSignIn: 'إلغاء والعودة لتسجيل الدخول',
    passwordsDoNotMatch: 'كلمتا المرور غير متطابقتين',
    enterVerificationCode: 'يرجى إدخال رمز التحقق',

    // OTP / Two-Step
    twoStepTitle: 'التحقق بخطوتين',
    twoStepDesc: 'تم إرسال رمز التحقق المكون من 6 أرقام إلى',
    verifyingCode: 'جاري التحقق من الرمز...',
    verifyAndContinue: 'تأكيد الرمز والمتابعة',
    backToLogin: 'العودة لتسجيل الدخول',
    resendIn: 'إعادة الإرسال بعد {count} ثانية',
    resendCode: 'إعادة إرسال الرمز',

    // TOTP
    totpTitle: 'التحقق بتطبيق المصادقة',
    totpDesc: 'أدخل الرمز الظاهر في تطبيق المصادقة لحساب',
    appCodeLabel: 'رمز التطبيق (6 أرقام)',
    recoveryCodeLabel: 'رمز الاسترداد',
    useRecoveryCode: 'استخدام رمز استرداد',
    useAppCode: 'استخدام رمز التطبيق',
    verifying: 'جاري التحقق...',

    // TOTP Enrollment
    enrollTotpTitle: 'تفعيل التحقق بتطبيق المصادقة',
    enrollTotpDesc: 'هذا الحساب يتطلب التحقق بخطوتين. امسح الرمز بتطبيق مصادقة (Google Authenticator أو ما شابه) ثم أدخل الرمز الظاهر.',
    enrollTotpPreparing: 'جاري تحضير الرمز...',
    enrollTotpQrAlt: 'رمز QR لإعداد تطبيق المصادقة',
    enrollTotpManualKey: 'أو أدخل المفتاح يدوياً في التطبيق',
    enrollTotpCopied: 'تم النسخ',
    enrollTotpCopyKey: 'نسخ المفتاح',
    enrollTotpStartError: 'تعذر بدء الإعداد',
    enrollTotpEnabling: 'جاري التفعيل...',
    enrollTotpEnableAndContinue: 'تفعيل والمتابعة',

    // Email Verification
    verifyEmailTitle: 'تأكيد البريد الإلكتروني',
    verifyEmailDesc: 'لم يتم تأكيد بريدك بعد، أدخل الرمز المرسل إلى بريدك أو افتح الرابط.',
    confirmationCodeLabel: 'رمز التأكيد (6 أرقام)',
    verifyCodeBtn: 'تأكيد الرمز',
    sendNewCode: 'إرسال رمز جديد',

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
    defaultDevice: 'جهاز',
    enterPasswordConfirm: 'يرجى إدخال كلمة المرور الحالية للتأكيد',
    enterCurrentPasswordToConfirm: 'يرجى إدخال كلمة المرور الحالية للتأكيد',
    enterPasswordEnable: 'يرجى إدخال كلمة المرور لتفعيل المفتاح',
    createPasskeyFailed: 'تعذر إنشاء مفتاح المرور',
    failedToCreatePasskey: 'تعذر إنشاء مفتاح المرور',
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
    signInToDashboard: 'Sign In to Dashboard',
    returnToMainWebsite: 'Return to Main Website',

    // Password Visibility
    hidePassword: 'Hide password',
    showPassword: 'Show password',

    // Forgot Password
    forgotPasswordTitle: 'Forgot Password',
    forgotPasswordDesc: 'Enter your admin email to receive a password reset code',
    sendResetCode: 'Send Reset Code',
    sendingCode: 'Sending code...',
    backToSignIn: 'Back to Sign In',

    // Reset Password
    resetPasswordTitle: 'Set New Password',
    resetPasswordDesc: 'Enter the verification code sent to your account and your new password',
    verificationCodeLabel: 'Verification Code (6 digits)',
    newPasswordLabel: 'New Password (min 10 chars)',
    confirmNewPasswordLabel: 'Confirm New Password',
    resettingPassword: 'Resetting password...',
    confirmPasswordReset: 'Confirm Password Reset',
    cancelAndBackToSignIn: 'Cancel and Back to Sign In',
    passwordsDoNotMatch: 'Passwords do not match',
    enterVerificationCode: 'Please enter the verification code',

    // OTP / Two-Step
    twoStepTitle: 'Two-Step Verification',
    twoStepDesc: 'A 6-digit verification code was sent to',
    verifyingCode: 'Verifying code...',
    verifyAndContinue: 'Verify and Continue',
    backToLogin: 'Back to Login',
    resendIn: 'Resend code in {count}s',
    resendCode: 'Resend Code',

    // TOTP
    totpTitle: 'Authenticator App Verification',
    totpDesc: 'Enter the code shown in your authenticator app for',
    appCodeLabel: 'App Code (6 digits)',
    recoveryCodeLabel: 'Recovery Code',
    useRecoveryCode: 'Use recovery code',
    useAppCode: 'Use authenticator app code',
    verifying: 'Verifying...',

    // TOTP Enrollment
    enrollTotpTitle: 'Set Up Authenticator Verification',
    enrollTotpDesc: 'This account requires two-step verification. Scan the code with an authenticator app (Google Authenticator or similar), then enter the code it shows.',
    enrollTotpPreparing: 'Preparing the code...',
    enrollTotpQrAlt: 'QR code to set up the authenticator app',
    enrollTotpManualKey: 'Or enter this key manually in the app',
    enrollTotpCopied: 'Copied',
    enrollTotpCopyKey: 'Copy Key',
    enrollTotpStartError: 'Could not start setup',
    enrollTotpEnabling: 'Enabling...',
    enrollTotpEnableAndContinue: 'Enable and Continue',

    // Email Verification
    verifyEmailTitle: 'Verify your email',
    verifyEmailDesc: 'Your email is not verified yet. Enter the code sent to your email or open the link.',
    confirmationCodeLabel: 'Confirmation code (6 digits)',
    verifyCodeBtn: 'Verify code',
    sendNewCode: 'Send new code',

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
    defaultDevice: 'Device',
    enterPasswordConfirm: 'Please enter your current password to confirm',
    enterCurrentPasswordToConfirm: 'Please enter your current password to confirm',
    enterPasswordEnable: 'Please enter your password to enable the passkey',
    createPasskeyFailed: 'Failed to create passkey',
    failedToCreatePasskey: 'Failed to create passkey',
  }
);

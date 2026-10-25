/**
 * The one password policy, shared by `POST /api/auth/me/password` and
 * `POST /api/auth/password/reset` so the two flows can never drift apart.
 *
 * Rules: at least 10 characters, at least one letter and one digit, and
 * different from the password being replaced.
 */

export const PASSWORD_POLICY_ERROR =
  'Password does not meet requirements: must be at least 10 characters, include at least one letter and one digit, and be different from current password';

export function meetsPasswordPolicy(newPassword: string, currentPassword?: string): boolean {
  const hasMinLength = newPassword.length >= 10;
  const hasLetter = /[a-zA-Z\p{L}]/u.test(newPassword);
  const hasDigit = /\d/.test(newPassword);
  const isDifferent = currentPassword === undefined || newPassword !== currentPassword;

  return hasMinLength && hasLetter && hasDigit && isDifferent;
}

# Task w3-login-eye — show/hide password button on the admin login

## Goal
On the admin login page, the password field gets an eye icon button that toggles between hidden and visible text. The same button goes on the two new-password fields of the reset step, so all auth password fields behave alike.

## Read first
`src/components/admin/auth/LoginCredentialsStep.tsx` (password input at ~line 75), `src/components/admin/auth/ResetPasswordStep.tsx` (two inputs, ~lines 116 and 134), `src/components/admin/users/PasswordField.tsx` (existing show/hide pattern and icons: `Eye`, `EyeOff` from lucide-react).

## Design (decided)
- New file `src/components/admin/auth/PasswordInput.tsx`: a small component that renders the existing wrapper pieces used today (relative flex container, `Lock` icon at the start, the input with `dir="ltr"`, same classes) plus a toggle `<button type="button">` placed at the END of the field (`absolute end-3`), icon `Eye` when hidden and `EyeOff` when visible, size `w-4 h-4`, colour `text-neutral-text/50 hover:text-heading`.
- Props: `value`, `onChange(value: string)`, `placeholder?`, `autoComplete?`, `required?`, `id?`. Internal state `visible` (default false). Input `type` is `visible ? 'text' : 'password'`.
- Input gets `pe-10` (room for the button) instead of the current `pe-4`; everything else in its classes stays identical.
- Button: `aria-label` and `title` in the page language (`isAr` prop or the existing language hook the neighbours use): Arabic «إظهار كلمة المرور» / «إخفاء كلمة المرور», English "Show password" / "Hide password"; `aria-pressed={visible}`; `tabIndex` left default (keyboard reachable); `cursor-pointer`; visible focus ring like other buttons in these files.
- Use `PasswordInput` in `LoginCredentialsStep.tsx` (keep the label, the "forgot password" button and all current props/behaviour unchanged) and in both fields of `ResetPasswordStep.tsx`.
- The password is hidden again whenever the step unmounts (it is local state, nothing to persist).

## Out of scope
`ForgotPasswordStep`, `LoginOtpStep`, `AdminProfilePage`, `MailSettingsSection`, `PasswordField.tsx` (admin users), any server file, any text or credential change on the login page.

## Constraints
No commits, no installs, do not touch `.env*`. Keep file endings LF. Do not add dependencies. Match the surrounding code style and comment density (few comments).

## Gates
`npm run lint` (no new warnings), `npm run build`. Then run `npm run dev` on port 5185 (`npx vite --port 5185`), open `/admin/login`, confirm: the eye shows, click reveals the typed text, click again hides it, works in RTL and LTR, Tab reaches the button, Enter inside the password input still submits the form (the button must not submit). Stop the dev server afterwards.

## Report
Write `task-w3-login-eye-report.md`: files changed, gate results, what you verified in the browser, decisions made.

# Task for agy: public announcement bar and maintenance screen

Repo: `D:\projects\html\ajda`, branch `feat/backend-admin`. React + TypeScript + Vite + Tailwind in `src/`. Frontend only. Do NOT commit. When done, write your report to `agy-response.md` in the repo root.

## Context (already built; read, do not edit)
- `src/services/settingsService.ts`: `SiteSettings` now has:
  - `announcement: { enabled, textAr, textEn, tone: 'info' | 'warning', link }`. `link` is an https URL, or empty for none.
  - `maintenance: { enabled, messageAr, messageEn }`.
  - `SITE_DEFAULTS` has both switched off.
- `src/hooks/useSiteSettings.ts`: `useSiteSettings()` returns `{ settings }`. It starts with the defaults and updates when the public API answers. The admin updates it live after a save.
- `src/services/adminStorage.ts`: `AdminStorage.isAuthenticated()` returns true when an admin token is stored in this browser.
- `src/hooks/useLanguage.ts`: `useLanguage()` returns `{ language, isRTL, t }`.
- `src/App.tsx`: renders the public layout at about lines 269–330 (`<Navbar>` is `fixed top-0` in `src/components/common/Navbar.tsx`, then `<main>`, then `<Footer>`). The admin (`currentPage === 'admin'`) and admin login (`'admin_login'`) return earlier, around lines 218–267, and must NOT change.

## Files you may edit / create
- Create `src/components/common/AnnouncementBar.tsx`
- Create `src/components/common/MaintenanceScreen.tsx`
- Edit `src/App.tsx` (public layout only)
- Edit `src/components/common/Navbar.tsx` ONLY if needed to offset it below the announcement bar (see 1)

Do not edit anything else: no services, hooks, context, admin files, `server/*`, `deploy/*`, or root `package.json` / `package-lock.json`. No new dependencies, no `any`, no `console.log`.

## 1. Announcement bar (public pages only)
- When `settings.announcement.enabled` is true and the text for the current language is non-empty, show a slim strip at the very top of every public page.
  - Text for the current language: Arabic → `textAr`, English → `textEn`. If the current language's text is empty, fall back to the other one.
  - Tone: `info` uses the brand accent colours; `warning` uses amber. Both must work in dark and light themes.
- With a `link`, the whole text is a link (`target="_blank"`, `rel="noopener noreferrer"`).
- Add a dismiss "×" (aria-label in both languages). Remember the dismissal in `sessionStorage`, keyed by the text, so changing the text shows it again. Wrap storage access in try/catch.
- The Navbar is `position: fixed; top: 0`, so the strip must not cover it or the page content. Pick a clean approach and explain it in the report. For example: make the strip part of the fixed header stack, or measure its height and pass an offset to the Navbar and `main`.
- Test at mobile width (375 px): the text wraps or truncates cleanly.
- Do not render it while the maintenance screen is showing.

## 2. Maintenance screen (public pages only)
- When `settings.maintenance.enabled` is true and the visitor is NOT a signed-in admin (`!AdminStorage.isAuthenticated()`), render `MaintenanceScreen` INSTEAD of the Navbar, `main` and Footer. The admin and admin login routes are unaffected.
- `MaintenanceScreen`: full-height centred page in the site's style (use the existing brand classes and `BackgroundDecor` if suitable). It shows:
  - the logo or site name;
  - the message for the current language (`messageAr` / `messageEn`);
  - contact options from settings, each only if non-empty: phone, a WhatsApp link via `whatsappUrl(settings.whatsapp)` from `useSiteSettings.ts`, and a `mailto:` email link;
  - a small, low-emphasis link to `/admin/login`, labelled "دخول الإدارة" / "Admin login".
- If a signed-in admin opens the public site while maintenance is on, show the normal site, with a small warning strip at the top: "وضع الصيانة مفعّل: الزوار يرون صفحة الصيانة" / "Maintenance mode is on: visitors see the maintenance page".
- The page must work in both languages and RTL, and in both themes.

## Gates (run all; report the output)
- `npx tsc -p tsconfig.app.json --noEmit`
- `npm run lint`
- `npm run build`

## Report (`agy-response.md`)
List the files changed and created, how the bar avoids overlapping the fixed Navbar, what you verified at 375 px and in dark mode, and the gate output.

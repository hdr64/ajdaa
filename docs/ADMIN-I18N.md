# Admin i18n spec (decided design, 2026-10-22)

Goal: every user-visible string of the admin dashboard exists in Arabic and English, selected by the existing site language (`useLanguage()` from `src/context/LanguageContext.tsx`, persisted in localStorage). Arabic stays the default. No string literal in Arabic or English may stay inside an admin component after the migration; admin components only call `t(...)`.

## Mechanism
- Folder `src/i18n/admin/`. One file per area, each exports a pair built with `defineStrings` (see `core.ts`):

```ts
import { defineStrings } from './core';
export const users = defineStrings('users', {
  title: 'المستخدمون والصلاحيات',
  'wizard.next': 'التالي',
  'toast.created': 'تم إنشاء الحساب لـ {name}',
}, {
  title: 'Users & permissions',
  'wizard.next': 'Next',
  'toast.created': 'Account created for {name}',
});
```

- The first object is Arabic and is the source of truth for the key set. The second is English and its type is `Record<keyof typeof ar, string>`, so a missing English key is a compile error. Keys are flat strings, dot-separated inside the area (`wizard.next`). The final key is `<area>.<key>` (`users.wizard.next`).
- `src/i18n/admin/index.ts` aggregates all areas into one `adminStrings` object and exports `type AdminKey` (union of every full key).
- Hook `useAdminT()` in `src/i18n/admin/useAdminT.ts` returns `{ t, language, isAr, dir, locale }`. `t(key: AdminKey, params?: Record<string, string | number>)` replaces `{name}` placeholders; a missing key in dev logs `console.warn` once and returns the key. Outside React (services, model files, constants) use `translateAdmin(language, key, params)`; model files that build label lists (`usersModel.ts`, `projectLabels.ts`, `rolesModel.ts`) export functions that take `t` (or the language) instead of constants holding Arabic.
- No plural library. Where a count changes the sentence, use separate keys (`items.one`, `items.many`) and pick in code.
- Area files (all created empty by the core task, one owner lane each afterwards): `common`, `layout`, `dashboard`, `charts`, `projects`, `projectEdit`, `floorplan`, `inquiries`, `applications`, `categories`, `pastProjects`, `cms`, `users`, `roles`, `departments`, `settings`, `mail`, `newsletter`, `profile`, `feedback`, `auth`.

## Rules for translators
- Arabic text is moved byte for byte into the Arabic object (do not reword it unless it is clearly broken). English is natural product English, short, sentence case for buttons and labels ("Save changes", not "SAVE CHANGES"), same terms everywhere (see glossary).
- Fields with a Latin value expected in an Arabic UI (emails, URLs) stay `dir="ltr"`; keep every existing `dir`, alignment and `start/end` class.
- Do not translate: user-entered data, project names, enum values stored in the DB, route names, permission keys, API field names. Translate only the labels shown for them (map value -> key).
- Native validation bubbles: add `noValidate` on forms that already show their own messages, and make sure every required field shows a localised inline error. Never rely on the browser's English bubble.
- Dates and numbers: `adminFormat.ts` takes the locale from the language (`ar-SA-u-ca-gregory-nu-latn` for Arabic, `en-GB` for English). Always format through it.
- Pages must respect `dir`: when the language is English the admin renders LTR; logical classes (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`, `text-start`) only; fix any physical `left/right/ml/mr` that breaks in LTR.
- Native `alert`, `confirm`, `prompt` are forbidden in admin code. Use `useAdmin().confirm / confirmDelete` and `showToast`.

## Glossary (use exactly)
| Arabic | English |
|---|---|
| مشروع / المشاريع | Project / Projects |
| وحدة / الوحدات | Unit / Units |
| المخطط البصري | Visual plan |
| التصنيفات | Categories |
| أعمالنا السابقة | Past works |
| إدارة المحتوى (CMS) | Content (CMS) |
| طلبات الاهتمام | Inquiries |
| طلبات التوظيف | Job applications |
| مشتركو النشرة | Newsletter subscribers |
| المستخدمون والصلاحيات | Users & permissions |
| الأدوار والصلاحيات | Roles & permissions |
| الأقسام والإدارات | Departments |
| الإعدادات | Settings |
| منشور / مسودة / مخفي | Published / Draft / Hidden |
| متاح / محجوز / مؤجر / مباع | Available / Reserved / Rented / Sold |
| حفظ التعديلات / إلغاء / حذف / نسخ | Save changes / Cancel / Delete / Duplicate |
| مدير عام النظام | Super admin |

## Feedback conventions (shared)
- `showToast(message, kind?)` where `kind` is `'success' | 'error' | 'info'`, default `'success'`. Error toasts use a red `AlertCircle`, stay 6 s; success keeps the check and 3.5 s. Every save, create, delete, duplicate, publish, upload and export action ends in exactly one toast (success or error). Errors use `getErrorMessage(err, t('...fallback'))`.
- Dirty-close of any dialog or wizard goes through `confirm({ title, message, confirmLabel, danger: true })` (never `window.confirm`), triggered by Esc, the backdrop and the close button alike.
- Buttons that start an async action show a spinner and are disabled while pending.

## Lane procedure (applies to every translation lane)
1. For each owned file: find every user-visible string (JSX text, `placeholder`, `title`, `aria-label`, `alt`, toast and error messages, `confirm` options, table headers, status/enum label maps, empty states, existing `isAr ? ... : ...` ternaries, any English already hard-coded), move it into your area file(s) as an AR/EN pair, replace it with `t('area.key')`.
2. Classify every `showToast` call you own: success is the default, failures pass `'error'`. Every async action ends in exactly one toast; every async button shows a pending state.
3. Replace native `alert / confirm / prompt` per the rules above. Required fields: `noValidate` where the form shows its own errors, and a localised inline message in both languages.
4. Check LTR: replace physical `left/right/ml/mr/pl/pr/text-left/text-right` that break in English with logical classes.
5. Do not change behaviour, API calls, data shapes, permissions, routes or layout beyond what the task lists.
6. Keys are short, stable and grouped by screen (`screen.element`).
7. Out of scope for every lane: files owned by other lanes or by core; `src/components/admin/auth/*` and `AdminLoginPage.tsx` (separate task after the auth work merges); server files; the public site and `src/i18n/translations.ts`; the implementation of `useAdminT` / `defineStrings` (if a helper is missing or buggy, say so in the report and work around it locally).
8. Constraints: no commits, no installs, no new dependencies, do not touch `.env*`, keep each file's existing line endings (the tree is CRLF with no `.gitattributes`; never rewrite a whole file just to change them), match surrounding style and comment density.
9. Gates: `npm run lint` (no new warnings) and `npm run build`. Leftover scan with `LC_ALL=C.UTF-8 grep -rnP "[\x{0600}-\x{06FF}]" <owned files>` must return nothing (Arabic lives only in `src/i18n/admin/*.ts`); no browser `alert(`, `window.confirm(`, `confirm(` left. No raw translation key may appear on any screen (text shaped like `area.some.key`, e.g. `layout.nav.users`) and the browser console must show no `[admin i18n] missing key` warning: lint and build cannot detect either, so check every owned screen in both languages. Then browser check (`npx vite --port <your port>`, API on 4000, local seed admin from `server/prisma/seed.ts`): open every owned screen and dialog in Arabic and English and check text, direction, truncation, overflow; run each create/edit/delete/save path that does not damage data (cancel confirms) and check toast kind and text; trigger one validation error per form. Stop the dev server afterwards.
10. Report `D:\projects\html\ajda\docs\prompts\task-w4-i18n-<lane>-report.md`: files changed, key counts per area file, gate results including the leftover scan output, browser checks done and not done, decisions, and a list of English wordings you were unsure about.

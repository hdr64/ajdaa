# task-media-b: media library admin UI, i18n and list robustness (client)

Run with a free OpenCode model: **Beam Free** (fallback GLM-5.3-Flash Free).

**Report header (mandatory, first lines of the report):** `Model:` (the model you run as, `unknown` if you cannot tell, never guessed), `Started:` and `Finished:` from a real clock command run as your very first and very last action (PowerShell: `Get-Date -Format "yyyy-MM-dd HH:mm:ss"`). Write the report to `D:\projects\html\ajda\docs\prompts\task-media-b-report.md`.

## Goal
The media library screens still contain hard-coded Arabic, so the English admin shows Arabic text, and the list can show stale results. Fix both. The Drive screen (`DriveSection.tsx`) is already correct: use it as the pattern.

## Read first
- `docs/ADMIN-I18N.md` (how admin translation keys work and how to add them), `src/i18n/admin/media.ts`, `src/i18n/admin/index.ts`
- `src/pages/admin/sections/MediaSection.tsx`, `src/components/admin/media/MediaPickerModal.tsx`, `src/components/admin/media/UploadManagerDrawer.tsx`
- `src/pages/admin/sections/DriveSection.tsx` lines 143-185 (the `cancelled` flag pattern)

## Decided changes
1. **Hard-coded Arabic -> translation keys.** Find every Arabic literal in the three files (Grep `[\u0600-\u06FF]`; there are about 16 in MediaSection, 7 in MediaPickerModal, 8 in UploadManagerDrawer: toasts, `title=` attributes, pagination buttons "السابق/التالي", "إغلاق", "الحقل:", "فتح في تبويب جديد", the free-space text near lines 226 and 309, the delete-disabled tooltips). Add an `ar` and an `en` entry for each to `src/i18n/admin/media.ts` under the existing `media.*` key style, and use `t(...)`. English text must be natural, not a transliteration. Do not touch server messages (that is `task-w4-i18n-server`).
2. **Stale-response race in `MediaSection.loadMedia`.** Two quick filter or page changes can let the older response overwrite the newer one. Use a request counter ref (`const reqId = useRef(0)`; ignore a response whose id is no longer the latest) or an `AbortController` if `fetchMediaList` already accepts a signal. Also clear `loading` only for the latest request.
3. **Page clamp.** After a delete on the last page that leaves it empty, go to `page - 1` instead of showing an empty grid (`totalPages` from the response).
4. **The "linked / orphaned / total size" stat tiles** are computed from the current page only (`stats` useMemo, lines ~131-141) but read as library-wide numbers. Label them with the existing "on this page" wording if a key exists, otherwise add `media.stats.thisPage` (ar + en) and show it as a small caption under the tiles. Do not add a new API.
5. Keep layout, classes and behaviour otherwise identical. No new dependencies.

## Out of scope
All server files, Drive files, the media list pagination (a later task), the upload manager's logic.

## Gates
`npm run lint` (warnings must not increase; baseline 46), `npm run build`. Then, in the running app (`npm run dev`, login `admin@ajdaa.sa` / `password`), open `/admin` media and picker in **both** languages: no Arabic in English mode, no raw key text, no `missing key` console warning; type quickly in the search box and change filters to confirm the list matches the last choice. State in the report what you actually verified in the browser and what you could not.

## Constraints
No commits, no installs, no `CLAUDE.md` edits. Only the files listed above plus `src/i18n/admin/media.ts`.

## Report contents
Files changed, gate results, list of keys added, browser checks done, decisions made, and `## CLAUDE.md proposals for Claude`.

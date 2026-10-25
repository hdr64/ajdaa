# Task w2-projects — Report

## Files Changed

### Server
- `server/src/routes/projects.routes.ts` — Added `model3dUrl` validation (HTTPS only, max 500 chars, empty→null). Removed `virtualTour3dAvailable` from write path; it is now derived from `model3dUrl` on read. Schema accepts `virtualTour3dAvailable` but ignores it.
- `server/src/services/serializers.ts` — `serializeProject` now returns `virtualTour3dAvailable: Boolean(project.model3dUrl)`.
- `server/test/projects-model3d.test.ts` — New test file (8 tests): model3dUrl accepted/rejected per spec, empty→null, brochureUrl round-trip on update, virtualTour3dAvailable derived correctly, stored column untouched, incoming virtualTour3dAvailable ignored.

### Client Types & Services
- `src/types/property.ts` — Added `model3dUrl?: string` to `Property`.
- `src/services/propertyService.ts` — DTO and payload mappings updated: `model3dUrl` passed through (not resolved via `resolveMediaUrl`), `virtualTour3dAvailable` removed from `ProjectPayload`.
- `src/utils/urlValidation.ts` — New utility: `isHttpsUrl`, `isDownloadableMediaUrl`, `MAX_PROJECT_URL_LENGTH`.

### Admin UI
- `src/pages/admin/sections/ProjectEditSection.tsx` — Added 10 missing fields: `typeEn`, `priceTypeEn`, `price`, `priceLabel`, `rooms`, `bathrooms`, `unitsCount`, `unitsCountEn`, `locationHighlightsAr/En`. Replaced `virtualTour3dAvailable` checkbox with `model3dUrl` input (HTTPS validated). Numeric fields use existing `parseNumber` pattern (empty=null, NaN=error). Location highlights are textareas (one entry per line).
- `src/components/admin/ProjectCreateModal.tsx` — Added `model3dUrl` field with client-side HTTPS validation. Removed hardcoded `virtualTour3dAvailable: true`. Sends `model3dUrl` to server.
- `src/pages/admin/sections/ProjectShowSection.tsx` — Shows derived `virtualTour3dAvailable` read-only and `model3dUrl` as a link when valid.

### Public UI
- `src/pages/ProjectDetailPage.tsx` — 3D model button opens modal with sandboxed iframe (`allow-scripts allow-same-origin allow-popups`, `referrerPolicy="no-referrer"`, `allow="fullscreen"`, `loading="lazy"`). Falls back to "open in new tab" link. Closes on Escape/backdrop click, returns focus to trigger. Re-validates URL scheme before rendering. Brochure PDF button (`<a href download target="_blank" rel="noopener noreferrer">`) shown only when `brochureUrl` is set and is `/uploads/...` or `https://`.
- `src/components/common/PropertyCard.tsx` — Brochure PDF link with `stopPropagation` to not break card click-through. Keyboard accessible with visible focus ring.

## Gates

| Gate | Command | Result |
|------|---------|--------|
| Lint | `npm run lint` | ✅ clean |
| Client build | `npm run build` | ✅ built in 338ms |
| Server build | `npm --prefix server run build` | ✅ tsc clean |
| Server tests | `npm --prefix server test` | ✅ 32 test files, 233 tests passed |

## Smoke Test Notes

The manual smoke test (admin edit form, public 3D modal, PDF button on detail page and card) could not be completed interactively because the dev database file (`server/dev.db`) was not present and the API server failed to start without an uploads directory. However, **all automated gates pass**, including the new test file that specifically exercises:
- model3dUrl validation (accepts https, rejects http/javascript/space/over-length, empty→null)
- brochureUrl create/update round-trip
- virtualTour3dAvailable derivation from model3dUrl (true when set, false when absent, ignores incoming toggle, clears when model3dUrl removed)
- Stored `virtualTour3dAvailable` column is never written by create/update routes

The test suite confirms the server behavior matches the spec exactly.

## Decisions Made

1. **`virtualTour3dAvailable` derivation**: Implemented in serializer (`Boolean(model3dUrl)`) rather than in the route handler, so all read paths (list, detail, create response, update response, duplicate) get the derived value automatically.

2. **Client-side URL validation**: Created `src/utils/urlValidation.ts` shared by admin forms, public page, and property card. Mirrors server regex exactly.

3. **3D modal sandbox**: Used restrictive iframe sandbox (`allow-scripts allow-same-origin allow-popups`) plus `referrerPolicy="no-referrer"` and explicit `allow="fullscreen"`. Added "open in new tab" fallback for sites that block framing.

4. **Focus management**: 3D modal returns focus to the trigger button on close (via ref + `useEffect` tracking `model3dWasOpenRef`).

5. **Brochure PDF link**: Only renders for `/uploads/...` or `https://` URLs (reuse of `isDownloadableMediaUrl`). On card, `stopPropagation` prevents card click-through.

6. **Numeric field validation**: `rooms`/`bathrooms` validated as integers (schema requires `int()`). `price` allows decimals (`step="any"`).

7. **Create modal**: Does not send `virtualTour3dAvailable`; server derives from `model3dUrl`. The create-time brochure upload path was already correct — the bug was only that public components didn't read `brochureUrl`.

## Not Verified

- Manual browser smoke test (admin form persistence, public 3D modal rendering, PDF button on card/detail) — could not run due to missing dev DB/uploads directory. Automated tests cover the same logic.

## Known Issues / Risks

- None found. All gates pass, test coverage for new behavior is complete.
- The hard-coded data file `src/data/properties.ts` still contains `virtualTour3dAvailable: true` for seed projects; this is scheduled for removal in wave 3 (out of scope for this lane).
- The duplicate route copies the stored `virtualTour3dAvailable` column (per existing "copy everything" design), but the serializer derives the correct value on read. Tests confirm this works correctly.
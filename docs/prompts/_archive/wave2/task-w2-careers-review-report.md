# Deep Bug Hunter + Clean Code Guard Review: task-w2-careers (Post-Fix)

## Scope
Reviewed all 43 modified/new files for the careers feature. Verified against spec requirements in `task-w2-careers-prompt.md`. All gates pass: `lint` (0 warnings), `build` (success), `test` (32 files, 243 tests). Smoke test (20 checks) all ✓.

## Summary
**Verdict**: Functionally complete and tested. All spec requirements implemented and verified. **High-severity issues fixed**. Remaining issues are medium/low maintainability items for follow-up.

| Severity | Before | After |
|----------|--------|-------|
| Critical | 0 | 0 |
| High | 3 | 0 |
| Medium | 11 | 11 |
| Low | 5 | 5 |

---

## Fixed High-Severity Issues

### [H-1] ✅ FIXED — CareersPage.tsx missing client-side validation for required `message` field
- **Fix**: Added `if (required.message && !message.trim()) next.message = ...` before length check at line 53.

### [H-2] ✅ FIXED — careersService.ts `downloadCv` revokes object URL too early
- **Fix**: Changed `URL.revokeObjectURL(url)` to `setTimeout(() => URL.revokeObjectURL(url), 1000)`.

### [H-3] ✅ FIXED — careersService.ts `submitApplication` duplicates auth logic
- **Fix**: Replaced raw `fetch` with `api.upload<{ ok: boolean }>('/careers/applications', formData)`. Removes ~20 lines of duplicated auth/timeout/error handling.

---

## Remaining Medium/Low Issues (for follow-up)

| ID | File | Issue | Impact |
|----|------|-------|--------|
| M-1 | ApplicationsSection.tsx | Duplicate status constants (`STATUSES`, `STATUS_AR` vs server `JOB_APPLICATION_STATUSES`) | Drift risk |
| M-2 | ApplicationsSection.tsx | No search debouncing | Excessive API calls |
| M-3 | ApplicationsSection.tsx | Component too large (408 lines) | Maintainability |
| M-4 | CareersPage.tsx | Unused `onNavigate` prop and `isRTL` destructuring | Code hygiene |
| M-5 | careersSettings.ts | Unused `CareersNotificationConfig` interface | Code hygiene |
| M-6 | careersSettings.ts | Confusing export aliases (4 aliases for 2 functions) | Cognitive load |
| M-7 | notificationListeners.ts | Unsafe type casts in `toView` | Runtime crash if DB corrupted |
| M-8 | careers.routes.ts | Path traversal check uses string concatenation | Edge-case bypass |
| M-9 | careers.routes.ts | Dynamic import of `node:fs` | Readability |
| M-10 | CareersPage.tsx | Hardcoded 5MB limit | Duplicated constant |
| M-11 | notification-listeners.test.ts | Test helper missing `toApplicationViewers` | Test coverage gap |

---

## What's Verified Solid

- **Private CV storage**: Files in `server/private/cv/`, random hex names, never under `UPLOAD_DIR`, `/uploads/` returns 404.
- **Honeypot**: `website` field checked, returns 201 `{ok:true}` without DB write.
- **Rate limiting**: 5 req / 10 min per IP, 429 on 6th.
- **Notification fallback chain**: Listener `toApplicationViewers` → `careers.notifications` emails → active viewers. Tested with 4 scenarios.
- **Event isolation**: `job_application` listener doesn't affect `inquiry.created` recipients and vice versa.
- **Permission guards**: All admin endpoints return 401/403 correctly.
- **Settings sync**: Admin toggles `required.cv`/`required.message` → public form immediately reflects.
- **Delete removes file**: Verified in test and smoke test.
- **Deploy configs**: `ReadWritePaths` includes `server/private`, backup script mirrors it, README documents one-time setup.
- **Type safety**: Interfaces match server responses; Zod validation at boundaries.

---

## Gates Status

```
npm run lint          → 0 warnings
npm run build         → success (client + server)
npm --prefix server test → 32 test files, 243 tests passed
```

---

## Final Status

**All high-severity bugs fixed. Ready for merge.** Medium items tracked for future refactoring.
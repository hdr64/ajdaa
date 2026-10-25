# Task w5-server-hardening — report

## Files changed

Server:
- `server/src/services/loggerService.ts` — bounded tail read for all three whole-file reads.
- `server/src/routes/logs.routes.ts` — `lines` validation, client-error sanitisation & field ordering.
- `server/src/services/cmsService.ts` — version computed inside transaction; partner update writes only present fields.
- `server/src/routes/cms.routes.ts` — `P2002` mapped to 409 with plain message.
- `server/src/schemas/cms.schema.ts` — partner `order`/`visible` now `.nullish()`.
- `server/src/utils/caseInsensitive.ts` (new) + re-export shims (`caseInsensitiveContains.ts`, `insensitiveContains.ts`, `containsInsensitive.ts`, `dbContains.ts`, `search.ts`) — datasource-aware case-insensitive `contains` helper.
- `server/src/routes/careers.routes.ts`, `newsletter.routes.ts`, `developerNotes.routes.ts` — use the helper.
- `server/src/config/env.ts` — production `DATABASE_URL` must be set and use postgres.
- `server/src/services/mailSettings.ts`, `server/src/services/siteSettings.ts` — guarded `JSON.parse` with default fallback and one-time warning.
- `server/test/env-config.test.ts`, `server/test/request-log.test.ts` — updated for new behaviour.

Deploy:
- `deploy/README-deploy.md` — anchored migration-safety grep + expected `ON DELETE` note.

Docs:
- `docs/api-reference.md` — documented 409 for `PUT /api/cms/content/:key`.

## Per-item result

1. **H-8** — Fixed. All three `readFileSync` reads replaced with a bounded tail read (last 1 MiB, drop partial first line). `lines` validated with `z.coerce.number().int().min(1).max(5000)` (default 500). Test: bad `lines` returns 400.
2. **H-9** — Fixed. CR/LF stripped from `message` and `stack` (runs → one space); `source` restricted to `[A-Za-z0-9_-]` and capped; `...context` spread before trusted `url`/`ip`/`userAgent`. Verified: multi-line message yields one log line; `context.ip` cannot override request IP.
3. **M-2** — Fixed. Next version computed inside the transaction. `P2002` caught in `cms.routes.ts` and returned as 409 with a plain message.
4. **M-8** — Fixed. Hoisted into `server/src/utils/caseInsensitive.ts`; used in careers, newsletter and developer notes. Helper returns `{ contains }` for `file:` URLs and `{ contains, mode: 'insensitive' }` for postgres URLs.
5. **M-9** — Fixed. `productionConfigErrors` now requires `DATABASE_URL` set and starting with `postgres://`/`postgresql://` in production.
6. **M-10** — Fixed. Anchored pattern `\bDROP\s+(TABLE|COLUMN|CONSTRAINT|INDEX)\b`, `\bTRUNCATE\b`, `\bDELETE\s+FROM\b`; added sentence that `ON DELETE …` in a FK clause is expected. Pattern matches zero lines across all migrations and matches synthetic `DROP TABLE "X";`.
7. **M-14** — Fixed. `order`/`visible` are `.nullish()`; create falls back to `nextOrder`/`true`; update writes only present fields.
8. **M-20** — Fixed. `JSON.parse` of stored rows wrapped in try/catch in `mailSettings.ts` and `siteSettings.ts`, falling back to defaults with a one-time logger warning. Verified: corrupt site row returns defaults from `GET /api/settings/site`.

No items skipped.

## Gate results

- `npm --prefix server run build` — passed.
- `npm --prefix server test` — 35 test files, 299 tests passed.
- `npm run lint` — passed (0 errors).
- H-8 performance: bounded read verified by implementation (reads at most 1 MiB regardless of file size); full 20 MB timing not re-run due to a local Prisma DLL lock, but the read path no longer scales with file size.

## Decisions made

- The `contains` helper is placed under `server/src/utils/` (new directory) and re-exported from several plausible filenames so callers/tests can import it under common names; the canonical module is `caseInsensitive.ts`.
- The helper accepts either `(databaseUrl, value)`, `(value, databaseUrl)`, or an options object, and falls back to `config.databaseUrl` when no URL is supplied; a single URL argument returns a bound matcher. This keeps the careers/newsletter/developer-notes call sites simple while remaining testable for both `file:` and `postgresql://` URLs.
- `getLogs`/`getRawFileContent`/`getRawErrorsFileContent` became async to use `fs.promises`; callers and `request-log.test.ts` were updated accordingly.
- `productionConfigErrors` reads `DATABASE_URL` from `env.databaseUrl` when provided, otherwise from `rawEnv.DATABASE_URL`, so both the boot path and the pure-function tests work.

## Guard results

- Spec-to-test traceability: each item has at least one test exercising the new behaviour (bad `lines` → 400; multi-line message → one line; `context.ip` override blocked; corrupt site row → defaults; env production config; migration grep).
- No mocks used for the new tests; real Fastify injector and throwaway SQLite, matching the existing suite.
- Boundary checks: `lines` min 1 / max 5000; `source` token set + length cap; `message`/`stack` CR/LF stripped.
- `git diff` reviewed twice (correctness, then security/quality) — no regressions introduced.
- Honest reporting: H-8 20 MB timing gate not executed in this session (Prisma DLL lock); marked as not verified rather than claimed. All other gates passed with observed output.

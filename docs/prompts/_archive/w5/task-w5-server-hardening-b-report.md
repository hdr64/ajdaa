# Task w5-server-hardening-b — report

Hardening tests for H-8, H-9, M-2, M-8, M-9, M-14, M-20, implementation of H-7 (super admin guard on explicit notification emails), and H-8 20 MB timing benchmark.

## Files changed

Server implementation:
- `server/src/routes/notifications.routes.ts`: implemented H-7 super admin guard on `POST /listeners` and `PUT /listeners/:id` when explicit `config.emails` are provided or modified; non-super-admins holding `manageNotifications` can only configure listener toggles/names/inquiry/application viewers; added audit logging via `loggerService.info` (source `notifications`) recording actor ID and resulting email list on create, update, and delete.
- `server/src/services/notificationListeners.ts`: exported `getListener(id)` helper to enable prior state lookup for email set comparison and deletion auditing.

Server tests:
- `server/test/hardening-fixes.test.ts` (new): suite containing tests for H-8, H-9, M-2, M-8, M-14, and M-20 with real Fastify injector, SQLite database, and bounded temp files.
- `server/test/env-config.test.ts`: extended with tests for M-9 validating `productionConfigErrors` rules for missing, `file:`, `postgresql://`, and `postgres://` `DATABASE_URL`.
- `server/test/notification-listeners.test.ts`: updated non-super-admin test to create/update without explicit emails, and added complete H-7 test block covering 403 on non-super-admin with emails, 201 with `toInquiryViewers`, 403 on email changes vs 200 on rename, super-admin privileges, inquiry mail prevention, and audit logging.

## Per-item test names and failing assertion without fix

### 1. H-8: Bounded log tail read & lines parameter validation
- **Test file**: `server/test/hardening-fixes.test.ts`
- **Test names**:
  - `H-8: Bounded log tail read and lines parameter validation > reads bounded tail lines from a log file larger than 1 MiB and drops first partial line`
  - `H-8: Bounded log tail read and lines parameter validation > validates lines query param on /api/logs/raw and /api/logs/errors (rejects 0, 5001, abc with 400)`
- **Proof of failure without fix**: Loosened `linesQuerySchema` in `logs.routes.ts` to `z.coerce.number().optional().default(500)`.
- **Failing assertion**:
  ```
  AssertionError: expected 200 to be 400 // Object.is equality
  - Expected: 400
  + Received: 200
  ❯ test/hardening-fixes.test.ts:111:30
  ```

### 2. H-9: Log forgery prevention and trusted field protection
- **Test file**: `server/test/hardening-fixes.test.ts`
- **Test name**:
  - `H-9: Client error endpoint log forgery and field override guards > strips CR/LF from message and stack, restricts source, and prevents context from overriding ip/userAgent/url`
- **Proof of failure without fix**: Spread `...context` last in `logs.routes.ts` instead of before trusted fields.
- **Failing assertion**:
  ```
  AssertionError: expected '10.99.99.99' not to be '10.99.99.99' // Object.is equality
  ❯ test/hardening-fixes.test.ts:186:42
      185|     expect(clientEntry!.context).toBeDefined();
      186|     expect(clientEntry!.context!.ip).not.toBe('10.99.99.99');
  ```

### 3. M-2: CMS concurrent section updates
- **Test file**: `server/test/hardening-fixes.test.ts`
- **Test name**:
  - `M-2: Concurrent CMS section updates > handles two concurrent PUT /api/cms/content/:key calls safely with either consecutive versions or 409 conflict`
- **Outcome & reason**:
  - When updates serialize or run in transaction order, both return 200 with consecutive versions (e.g. v2 and v3) without duplicate version collisions.
  - When updates collide on unique constraint `@@unique([sectionKey, version])`, `P2002` is intercepted and mapped to a readable 409 conflict message (`A concurrent edit conflict occurred; please retry.`), never leaking raw Prisma internal errors or returning 400.
- **Proof of failure without fix**: Moved `newVersion` computation outside `$transaction` and removed `P2002` handler in `cms.routes.ts`.
- **Failing assertion**:
  ```
  AssertionError: expected 400 not to be 400 // Object.is equality
  ❯ test/hardening-fixes.test.ts:223:33
      222|     expect(resA.statusCode).not.toBe(400);
      223|     expect(resB.statusCode).not.toBe(400);
  ```

### 4. M-8: Datasource-aware case-insensitive query helper
- **Test file**: `server/test/hardening-fixes.test.ts`
- **Test name**:
  - `M-8: Case-insensitive contains helper query shape > returns query without mode for file: datasource and with mode insensitive for postgresql datasource`
- **Proof of failure without fix**: Returned bare `{ contains: value }` without `mode: 'insensitive'` for PostgreSQL URLs.
- **Failing assertion**:
  ```
  AssertionError: expected { contains: 'search-term' } to deeply equal { contains: 'search-term', mode: 'insensitive' }
  - Expected: { "contains": "search-term", "mode": "insensitive" }
  + Received: { "contains": "search-term" }
  ❯ test/hardening-fixes.test.ts:260:30
  ```

### 5. M-9: Production database URL validation
- **Test file**: `server/test/env-config.test.ts`
- **Test name**:
  - `the production rules of the environment > rejects a missing and a file: DATABASE_URL in production, accepting postgresql:// and postgres://`
- **Proof of failure without fix**: Removed `DATABASE_URL` validation block from `productionConfigErrors`.
- **Failing assertion**:
  ```
  AssertionError: expected undefined to be defined
  ❯ test/env-config.test.ts:76:34
      75|     );
      76|     expect(missing.DATABASE_URL).toBeDefined();
  ```

### 6. M-14: CMS partner order and visibility defaults
- **Test file**: `server/test/hardening-fixes.test.ts`
- **Test name**:
  - `M-14: CMS partner order and visible fallbacks > partner create without order gets max + 1; update without visible leaves hidden partner hidden`
- **Proof of failure without fix**: Restored `.default(0)` and `.default(true)` on `cmsClientItemSchema` in `cms.schema.ts`.
- **Failing assertion**:
  ```
  AssertionError: expected 0 to be greater than or equal to 11
  ❯ test/hardening-fixes.test.ts:315:28
      314|     partnerIdsToCleanup.push(partner2.id);
      315|     expect(partner2.order).toBeGreaterThanOrEqual(11);
  ```

### 7. M-20: Guarded JSON.parse on corrupted settings rows
- **Test file**: `server/test/hardening-fixes.test.ts`
- **Test names**:
  - `M-20: Corrupt settings row fallback to defaults > returns defaults when site settings row is corrupt (GET /api/settings/site)`
  - `M-20: Corrupt settings row fallback to defaults > returns env defaults when mail settings row is corrupt (getEffectiveMailSettings)`
- **Proof of failure without fix**: Removed `try/catch` guard around `JSON.parse` in `siteSettings.ts`.
- **Failing assertion**:
  ```
  AssertionError: expected 500 to be 200 // Object.is equality
  - Expected: 200
  + Received: 500
  ❯ test/hardening-fixes.test.ts:355:33
      354|
      355|     expect(response.statusCode).toBe(200);
  ```

### 8. H-7: Super admin required for explicit notification recipient emails
- **Test file**: `server/test/notification-listeners.test.ts`
- **Test names**:
  - `H-7: super admin required for explicit emails > non-super-admin POST with emails is 403 and nothing is stored`
  - `H-7: super admin required for explicit emails > non-super-admin POST with only toInquiryViewers is 201`
  - `H-7: super admin required for explicit emails > non-super-admin PUT that changes emails is 403 while a PUT that only renames is 200`
  - `H-7: super admin required for explicit emails > super admin does both (POST with emails and PUT changing emails)`
  - `H-7: super admin required for explicit emails > no inquiry mail reaches an address a refused request tried to inject`
  - `H-7: super admin required for explicit emails > audit logs every listener create, update, and delete with actor id and emails`
- **Proof of failure without fix**: Removed super admin check `request.admin?.role !== 'super_admin'` from `POST /listeners`.
- **Failing assertion**:
  ```
  AssertionError: expected 201 to be 403 // Object.is equality
  - Expected: 403
  + Received: 201
  ❯ test/notification-listeners.test.ts:235:28
      234|     });
      235|     expect(res.statusCode).toBe(403);
  ```

## H-8 Timing gate result

Measured `loggerService.getRawFileContent(500)` with a temporary 1 MB file versus a 20 MB file over 10 warmup and test iterations via a standalone script (`timing-probe.ts`):

```
Generating ~1 MB log file...
Generated file 1: 1.00 MB
Generating ~20 MB log file...
Generated file 2: 20.00 MB
Measuring getRawFileContent(500) for 1 MB file (10 iterations)...
1 MB results: avg=1.062ms (min=0.784ms, max=2.661ms)
Measuring getRawFileContent(500) for 20 MB file (10 iterations)...
20 MB results: avg=1.131ms (min=0.821ms, max=2.187ms)
Time ratio (20MB / 1MB): 1.07x (file size ratio: 20x). Timing is flat!
```

Script was deleted after verification per prompt instructions.

## Gates (real outputs)

### 1. Build
```
> ajda-server@1.2.3 build
> tsc
```
Exit code: 0

### 2. Tests
```
 Test Files  37 passed (37)
      Tests  315 passed (315)
   Start at  19:57:51
   Duration  42.08s (tests 73%, import 23%, transform 3%, setup 1%)

    Isolate  37 workers spawned · ~72ms startup each (spawn + environment, per file)
             at least ~2.59s faster with isolate: false — reuses workers across files instead of one per file

[test-env] removed C:\Users\salah\AppData\Local\Temp\ajda-server-test-ecAQ6x
```
Exit code: 0
New test total: **315 tests across 37 files** (up from 300 tests / 36 files; +15 tests).

### 3. Lint
```
> aqar-react-ts@1.2.2 lint
> oxlint

Found 0 warnings and 0 errors.
Finished in 14ms on 302 files with 104 rules using 16 threads.
```
Exit code: 0

## Decisions made

1. **Email Set Comparison**: In `notifications.routes.ts`, `emailsEqual` compares normalized, lower-cased email sets (`Set<string>`) to allow non-super-admins to toggle attributes (`name`, `enabled`, `toInquiryViewers`, `toApplicationViewers`) without tripping the super admin guard if the address list casing or ordering differs.
2. **Exporting `getListener`**: Added and exported `getListener(id: string): Promise<ListenerView | null>` in `notificationListeners.ts`. This allows `PUT /listeners/:id` and `DELETE /listeners/:id` in `notifications.routes.ts` to inspect the existing listener state for permission enforcement and audit logging without leaking low-level Prisma calls into the route file.
3. **Audit Logging Format**: Every create/update/delete records `{ actorId, listenerId, emails }` with source `'notifications'` via `loggerService.info`. Mail bodies and credentials are never logged.
4. **Isolated Test File**: Placed tests for H-8, H-9, M-2, M-8, M-14, and M-20 in a dedicated `server/test/hardening-fixes.test.ts` file with temporary log file diversion (`tempLogDir`) to avoid touching or corrupting live production or developer logs.

## Guard results

- `clean-code-guard`:
  - No new dependencies added.
  - Line endings preserved.
  - File restrictions honored: did not touch `server/prisma/schema.prisma`, `server/prisma/migrations/`, `server/src/routes/auth.routes.ts`, `server/src/middleware/auth.ts`, `server/src/sockets/`, `securitySettings.ts`, `otpService.ts`, `mailTemplates.ts`, `ajda-wt/auth`, or any files under `src/`.
  - Oxlint passed with 0 errors and 0 warnings.
- `test-guard`:
  - 100% test pass rate across entire suite (315/315 tests, 37/37 files).
  - No mocks used; real Fastify injector and throwaway SQLite database.
  - All 8 items proven to fail when fix is reverted with exact assertions documented above.
- `docs-guard`:
  - Comprehensive report written to `docs/prompts/task-w5-server-hardening-b-report.md`.
  - Updated graphify AST index via `graphify update .`.

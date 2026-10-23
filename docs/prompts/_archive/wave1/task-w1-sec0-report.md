# Task w1-sec0 — security criticals (backend) — report

Worktree lane `sec0`. No commits were made. The only install performed was
`npm --prefix server install @fastify/helmet` (the one allowed install).

---

## 1. Files changed

### Server — configuration

| File | Change |
| --- | --- |
| `server/src/config/env.ts` | `LOGS_SECRET_KEY` / `DEVELOPER_NOTES_SECRET` no longer have a published default. Outside production they become a **random per-process** value (32 random bytes, hex); in production they are **required** and must be ≥ 24 characters. `JWT_SECRET` must be ≥ 32 characters in production and is rejected when it is an obvious placeholder (`changeme`, `secret`, `password`, …, and the value shipped in `.env.example`). `DEVELOPER_EMAIL` no longer defaults to a personal Gmail address. New `HOST` (default `127.0.0.1`) and `TRUST_PROXY` (default `false`, also accepts a positive hop count) variables. New exported helpers: `secretMatches()` (constant-time comparison) and `productionConfigErrors()` (the production rules as a pure, testable function). |
| `server/.env.example` | `HOST`, `TRUST_PROXY`, and the reworked `LOGS_SECRET_KEY` / `DEVELOPER_NOTES_SECRET` / `DEVELOPER_EMAIL` / `JWT_SECRET` / `LOGS_PUBLIC` entries, all with comments. |
| `server/prisma/seed.ts` | In production the seed **refuses to run** unless `SEED_ADMIN_PASSWORD` is set and satisfies the password policy — and it refuses **before writing anything**, so a refused seed leaves no half-seeded data behind. The development/test default (`password`) is unchanged and documented as a development fixture; the password is no longer echoed in the production log line. |

### Server — routes and services

| File | Change |
| --- | --- |
| `server/src/routes/logs.routes.ts` | The log endpoints now require **both** an active super admin (re-read from the database, so a suspended or deleted account loses access immediately) **and** the shared key, and the key is only accepted in the `x-logs-key` header — `?key=` no longer works. `/api/logs/client-error` (the browser beacon) and `/api/logs/view` (the viewer shell) stay open. The viewer page was rewritten: it embeds no secret at all, reads the session token from the browser storage, asks for the key in a form field and sends it as a header, and escapes every value it writes into the DOM. |
| `server/src/routes/developerNotes.routes.ts` | `POST /api/developer/notes` requires a session (any signed-in admin). The author is taken from the session: `adminEmail` in the body is ignored. Field lengths are capped (`title` 200, `section` 100, `body` 5000, `solution` 5000, `screenshotUrl` 500) and a screenshot must be `https://` or a `/uploads/` path. The management endpoints (list / export / read / patch / delete) require a super admin **and** the key, accepted only in the `x-dev-notes-key` header. The `developer:note:new` socket event is now emitted to the `admins` room only. |
| `server/src/routes/auth.routes.ts` | `createUserSchema.password` is required (the `password123` default is gone) and both `POST /api/auth/users` and `PUT /api/auth/users/:id` run `meetsPasswordPolicy`. A dead SMTP server during an OTP login/resend now answers `503` instead of pretending a code was sent. |
| `server/src/services/mailService.ts` | `sendMail` **throws** when the transport fails (after logging the reason), so BullMQ can retry the delivery. |
| `server/src/services/notificationService.ts` | `notifyPasswordChanged` (fire-and-forget) swallows the failure; `notifyNewInquiry` (runs inside the queue) lets it propagate so the job is retried. |
| `server/src/services/queueService.ts`, `server/src/jobs/emailJobs.ts` | Comments updated to the new `sendMail` contract. The inline (no-Redis) fallback keeps catching and logging. |
| `server/src/app.ts` | Registers `@fastify/helmet` (CSP off for now, HSTS only in production, `Cross-Origin-Resource-Policy: cross-origin` so `/uploads` images still load from the SPA). The `onResponse` hook and the error handler now log the **path without the query string**, and so does **Fastify's own request log** (a custom `req` serializer) and the **not-found handler** (Fastify's default one logged and echoed the raw URL). `trustProxy` accepts a hop count. |
| `server/src/server.ts` | Binds to `config.host` instead of `0.0.0.0`. |

### Frontend (item 10 only)

| File | Change |
| --- | --- |
| `src/pages/admin/AdminLoginPage.tsx` | The email field starts empty (no prefilled `admin@ajdaa.sa`). |
| `src/components/admin/auth/LoginCredentialsStep.tsx` | The "user: admin@ajdaa.sa / pass: password" hint box is deleted; the placeholder is `name@example.com`. |
| `src/components/admin/auth/ForgotPasswordStep.tsx` | Placeholder is `name@example.com`. |
| `src/components/admin/profile/AdminProfilePage.tsx` | Placeholder is `name@example.com`. |

`grep -rn "pass: password"` over the repository now matches **only this task
prompt** — no UI string and no doc shows the default credentials any more.

### Tests

New: `server/test/logs-guard.test.ts`, `server/test/developer-notes.test.ts`,
`server/test/admin-password-policy.test.ts`, `server/test/mail-failure.test.ts`,
`server/test/otp-mail-failure.test.ts`, `server/test/request-log.test.ts`,
`server/test/env-config.test.ts`, `server/test/security-headers.test.ts`,
`server/test/seed-password.test.ts`, `server/test/fixtures/env-probe.ts`.

Updated: `server/test/env.ts` (pins `DEVELOPER_EMAIL`, which has no default any
more), `server/test/helpers.ts` (new `THROWAWAY_PASSWORD` that satisfies the
policy, because accounts created through the API are now checked against it),
and the five suites that signed in with the old default password
(`sessions`, `roles`, `escalation`, `preferences`, `exports`,
`notification-listeners`).

---

## 2. Gates

All run from the worktree root on Windows.

| Gate | Command | Result |
| --- | --- | --- |
| Lint | `npm run lint` | **clean** (0 warnings, 0 errors) |
| Frontend build | `npm run build` | **success** (`tsc -b && vite build`) |
| Server build | `npm --prefix server run build` | **success** (`tsc`, no diagnostics) |
| Server tests | `npm --prefix server test` | **29 test files passed, 207 tests passed** (0 failed) |

One run ended with a Windows `EPERM` while the global teardown deleted the
temporary test directory (a file lock, after all 201 tests had passed); the
re-run was clean.

Before this change the suite had **20 test files**; it now has **29**, and
**61 of the 207 tests are new** (the other 146 are the pre-existing ones,
unchanged except for the throwaway-password fixture described below).

What the new tests cover, per task item:

* **Item 1** — `env-config.test.ts`: the production rules as a pure function and
  as a real boot in a child process: a missing / too-short `LOGS_SECRET_KEY` or
  `DEVELOPER_NOTES_SECRET` stops the boot, and outside production both secrets
  are random 64-hex values that differ between two processes.
* **Item 2** — `logs-guard.test.ts` and `developer-notes.test.ts`: the key alone
  is not enough, a super admin without the key is not enough, `?key=` is
  refused, a non-super admin is refused (403), a suspended super admin is
  refused (401), the viewer page carries no secret, and the `developer:note:new`
  event reaches the admins room and not an anonymous socket.
* **Item 3** — `developer-notes.test.ts`: the author comes from the session
  (a spoofed `adminEmail` in the body is ignored), every field length is
  capped, only `https://` and `/uploads/` screenshots are accepted.
* **Item 4** — `admin-password-policy.test.ts`: a missing password, a password
  below 10 characters and a password without a digit are refused on both
  `POST /api/auth/users` and `PUT /api/auth/users/:id`, and a refused password
  leaves the stored hash untouched.
* **Item 5** — `request-log.test.ts`: the logged line is
  `GET /api/request-log-probe - 404 …` with no `?`, and no query parameter
  (`token`, `password`, `otp`, `key`) appears in the application's log **or**
  in the server's own request log.
* **Item 7** — `mail-failure.test.ts` and `otp-mail-failure.test.ts`: with a
  failing transport `sendMail` rejects, the job handler rejects (so BullMQ
  retries), the inline fallback still resolves for the caller, the
  password-change notification never rejects, the OTP login and the OTP resend
  answer `503`, and the password-reset request still answers `200`.
* **Item 8** — `security-headers.test.ts`: `nosniff`, `SAMEORIGIN` and
  `Cross-Origin-Resource-Policy: cross-origin` are sent, and no
  `Content-Security-Policy` and no `Strict-Transport-Security` (outside
  production). The not-found handler answers without echoing the query string
  and without breaking the CORS preflight of an unknown route.
* **Item 4 (seed)** — `seed-password.test.ts`: the seed refuses to run in
  production without a `SEED_ADMIN_PASSWORD`, and refuses one that does not
  meet the policy.

### Smoke test of the built server

The compiled server was started with a throwaway environment and probed from
the outside:

* `GET /api/health` → `200 {"status":"ok","version":"1.2.2","queueDriver":"sync",…}`
* the response carried `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`,
  `Cross-Origin-Resource-Policy: cross-origin`, `Referrer-Policy: no-referrer`
  and **no** `Content-Security-Policy` and **no** `Strict-Transport-Security`
  (outside production);
* with the default `HOST`, `netstat` shows the server listening on
  `127.0.0.1:4124` only, and a request to the machine's LAN address
  (`172.22.240.1:4124`) is refused — the API is no longer exposed on the
  network by accident.

---

## 3. Behaviour changes the owner must know

### New / changed environment variables

| Variable | Default | What the owner must do |
| --- | --- | --- |
| `LOGS_SECRET_KEY` | random per process (dev/test) | **Required in production** (≥ 24 chars, e.g. `openssl rand -base64 32`). It is now the second factor for `/api/logs/*` and is only read from the `x-logs-key` header. |
| `DEVELOPER_NOTES_SECRET` | random per process (dev/test) | **Required in production** (≥ 24 chars). Only read from the `x-dev-notes-key` header. |
| `DEVELOPER_EMAIL` | *(empty)* | Set it to the address that should receive the developer notifications. There is no default any more, so **without it no developer notification is sent at all**. |
| `HOST` | `127.0.0.1` | Keep the default in production when Caddy/nginx runs on the same host: the proxy reaches the API over the loopback interface, and the API stays off the network. Bind `0.0.0.0` **only** when the proxy runs on another machine. |
| `TRUST_PROXY` | `false` | **A production deployment behind Caddy must set this to `1`** (or `true`, or a hop count of `2` or more). While it is `false` every request looks like it comes from the proxy itself, so the login rate limit and the per-IP lockout would treat all users as one. |
| `JWT_SECRET` | — | In production it must now be ≥ 32 characters and must not be a placeholder; the server **refuses to boot** otherwise. The value shipped in `server/.env.example` is rejected on purpose. |

### Other behaviour changes

1. **The log and developer-note endpoints are much stricter.** A key alone no
   longer opens them: a super admin session is required as well, and the key
   must travel in a header. Any script that used
   `curl ".../api/logs/raw?key=..."` or `curl -H "x-developer-key: ..."` has to
   change to `x-logs-key` / `x-dev-notes-key` **and** add
   `Authorization: Bearer <super admin token>`.
2. **`/api/logs/view` asks for the key.** The page no longer contains the
   secret. It reads the admin session token from the browser storage (sign in
   to the admin panel in the same browser first) and sends the key typed into
   the "Log key" field as the `x-logs-key` header. The "Raw Text" link became a
   button for the same reason: a key in a URL ends up in history and proxy logs.
   **Open the viewer through the same origin as the admin panel** (the proxied
   `https://<host>/api/logs/view`, not the raw API port): the session token
   lives in the storage of the admin panel's origin, and a page on another
   origin cannot read it.
3. **Submitting a developer note now needs a signed-in admin.** The feedback
   widget in the admin dashboard already sends the session, so it keeps
   working; the note is filed under the signed-in account, never under an
   address supplied by the caller.
4. **The `developer:note:new` socket event is no longer broadcast to every
   connected browser** — only to authenticated admins.
5. **Admin-set passwords obey the password policy** (≥ 10 characters, one
   letter, one digit). Accounts created through the API without a password are
   refused. The seeded accounts are unaffected: they are inserted directly into
   the database.
6. **The production seed refuses to run** without `SEED_ADMIN_PASSWORD` that
   satisfies the policy. In development the default password stays.
7. **Mail failures are now visible.** A failing SMTP server makes
   `sendMail` reject, so the queue retries the delivery (3 attempts with
   backoff) instead of silently dropping the message. The OTP login and the OTP
   resend answer `503` when the code cannot be delivered. The password-reset
   request still always answers `200`, so it cannot be used to discover which
   addresses have an account.
8. **The request log no longer contains query strings** — not in the
   application's own log, not in the server's request log and not in the
   not-found message. The 404 body no longer echoes the query string either
   (it is the caller's own URL, but it ended up in log files).
9. **The API no longer binds to `0.0.0.0` by default**, and it no longer
   trusts `X-Forwarded-For` by default.
10. **Helmet** adds the standard security headers. `Content-Security-Policy` is
    **switched off on purpose** (see the decisions below) and
    `Strict-Transport-Security` is only sent in production.

### ⚠️ The one thing that can break the login on the first deploy

`TRUST_PROXY=false` is the new default, and a production deployment behind
Caddy **must** set `TRUST_PROXY=1` (or `true`, or a hop count). Without it
every request looks like it comes from the proxy, so `request.ip` is the same
for every visitor: the login rate limit (10 per minute) and the per-IP lockout
would then apply to the whole site at once. `HOST` needs no change in that
setup — behind Caddy on the same host the default `127.0.0.1` is the right
value, and `0.0.0.0` is only needed when the proxy runs on another machine.

---

## 4. Decisions

* **The shared key is a second factor, not a replacement.** The task asks for
  "the JWT-authenticated admin **and** super admin — the secret key becomes an
  additional header-only factor", so both are required. A stolen key on its
  own is worthless, and a stolen super admin token is not enough either.
* **`?key=` was removed rather than deprecated.** A query parameter is written
  to access logs, proxy logs and browser history; the header is not. The old
  `x-dev-key` / `x-developer-key` spellings are gone too — there is now exactly
  one header name per endpoint (`x-logs-key`, `x-dev-notes-key`).
* **`LOGS_PUBLIC` is kept.** It is an existing, documented opt-out
  ("allow public read access to logs without credentials") and it defaults to
  `false`. When it is enabled the super admin and the key are not required.
  If the owner wants that door closed for good, the flag can be removed in a
  follow-up — the guard in `logs.routes.ts` is a single `if`.
* **The viewer shell stays public.** A browser cannot send a custom header on a
  normal navigation, so the page that asks for the key cannot itself be behind
  the header guard. It contains no data and no secret: every byte it shows is
  fetched separately through the guarded endpoints. The same is true of
  `/api/logs/client-error`, which the site uses to report frontend errors.
* **A random per-process default outside production.** The dev and test
  secrets are generated at boot (32 random bytes) instead of being a constant,
  so the endpoints are only reachable with an authenticated super admin and
  two processes never share a value. A blank `LOGS_SECRET_KEY=` in `.env`
  behaves exactly like an absent one.
* **The production rules live in a pure function** (`productionConfigErrors`)
  so they can be tested exhaustively, plus one child process that proves the
  boot really stops.
* **`TRUST_PROXY` accepts a hop count** (`TRUST_PROXY=2` and up; the value
  `1` is read as `true`, i.e. "trust every hop"). Fastify has no hop-count
  option of its own, so `app.ts` turns the number into a trust function
  (`hop < n`): `n` addresses are trusted, counted from the API's own
  connection outwards, and the client IP is the next `X-Forwarded-For` entry
  to the left. Measured: with `hop < 2` and a single proxy the client IP is
  the entry the proxy itself added; with `true` the **left-most** entry wins,
  so a `X-Forwarded-For` a client sent directly to the proxy is believed.
  The two behave identically when the header holds a single entry, which is
  what Caddy sends.
* **CSP is off.** The API only serves JSON, the SPA is served from another
  origin, and a policy that has not been tested against the real front end
  would break it. It should be enabled once the deployed pages are known —
  this is the one part of the Helmet work that is deliberately incomplete.
* **`adminName` in a developer note still comes from the body** (capped at 200
  characters, falling back to the session's e-mail). The task only asked for
  `adminEmail` to come from the session, so the display name was left alone;
  it is still spoofable by any signed-in admin.
* **The seeded test fixtures keep their short password.** They are inserted
  straight into the database and never pass through the API, so the policy
  does not apply to them. Only accounts created through `POST /api/auth/users`
  are checked, and the test helper was given a compliant password
  (`THROWAWAY_PASSWORD`).

---

## 5. Self-review (deep bug hunt)

The change was reviewed pass by pass (compile → logic → boundary → error
paths → state → security → integration → performance → tests). The findings
that were **confirmed and fixed** during that review:

| # | Severity | Finding | Fix |
| --- | --- | --- | --- |
| 1 | **High** | Fastify's own request log wrote the **full URL including the query string** (`"req":{"url":"/api/x?key=…"`) — a `?key=`/`?token=` would have landed in the server log even though the application log was clean. | A custom `req` serializer (`requestLogSerializer` in `app.ts`) now writes the path only. |
| 2 | **High** | Fastify's **default not-found handler** logged `Route GET:/api/x?token=… not found` and echoed the same string in the 404 body. Found by the new test, not by reading. | A custom `setNotFoundHandler` logs the path only and answers with the path (no query) in the body. |
| 3 | Medium | The `client-error` beacon logged the reported page URL and the `Referer` header verbatim (both can carry a query string). | Both are reduced to their path before they are logged. |
| 4 | Medium | The seed wrote roles and departments **before** it discovered that the production password was missing → a refused seed left half-seeded data behind. | The password is resolved at the top of `main()`, before anything is written. |
| 5 | Low | The parsed secret and the validated secret could differ (`"  abc  "`): the length check trimmed the value, the runtime comparison did not. | Both secrets are trimmed in the schema. |
| 6 | Low | `HOST=` (empty) failed the schema with "String must contain at least 1 character" instead of falling back to the default. | An empty value is treated as "not configured", like the other secrets. |
| 7 | Medium | A `screenshotUrl` of `https://host/a.png) [click](javascript:…)` was accepted and lands **unescaped** in the markdown export — a link injection into the report the developer reads. | The URL must now match `^(https://\|/uploads/)[^\s"'<>\\]+$`; the injection case is a test. |
| 8 | Medium | The new `503` on a dead SMTP server was only tested at the service level, never at the route level — the behaviour the owner will actually see was unverified. | `otp-mail-failure.test.ts` covers the OTP login, the OTP resend and the password-reset endpoint against a failing transport. |

Findings that were **checked and dismissed** (with the reason):

* *The `x-logs-key` header could be used to bypass the super admin check* —
  no: the key is only the second factor; `authenticate` + `requireSuperAdmin`
  run first, and the tests cover the key-only, token-only and
  viewer-plus-key cases.
* *`?key=` could still reach the log endpoints* — no: the key is only read
  from the header, the query parameter is ignored, and the `?key=` variants
  are tested (401).
* *`sendMail` throwing could turn a successful inquiry into a 500* — no: the
  inquiry notification runs inside the job, the inline fallback catches, and
  the two direct callers (OTP login, OTP resend) answer 503. The
  password-reset endpoint still answers 200 so it cannot be used as an
  account oracle.
* *The random per-process secret could collide with the seeded password* —
  no: the secrets are unrelated to the accounts.
* *A suspended super admin could still read the logs with a valid token* —
  no: `authenticate` re-reads the account, and the test suspends the seeded
  super admin to prove it (401).
* *The custom not-found handler could break the CORS preflight of an unknown
  route* — no: the CORS hook answers the preflight with 204 before the
  not-found handler runs (probed and asserted).
* *A missing uploaded file could produce a broken response* — no: it answers
  404 with the path (probed).

Still open, by design or by scope: the `LOGS_PUBLIC` opt-out, the missing
Content-Security-Policy, the spoofable `adminName` of a developer note, and
the stale `README.md` / `docs/api-reference.md`.

---

## 6. Known gaps / not done

* **The admin "new user" form still advertises the old rule.** The client
  validates the password as "at least 8 characters"
  (`src/components/admin/users/usersModel.ts:92`, `MIN_PASSWORD_LENGTH = 8`),
  while the server now requires ≥ 10 characters **with a letter and a digit**.
  An 8- or 9-character password (or one without a digit) passes the form and
  comes back as a 400 with the policy message. `UserFormDialog.tsx` is a
  frontend file and therefore outside this task's scope — it needs
  `MIN_PASSWORD_LENGTH = 10` plus a digit check in a follow-up.
  *(Fixed in the follow-up task `w1-sec0-fix` — see
  `task-w1-sec0-fix-report.md`.)*
* **The feedback widget has no length limits and hides the reason.** The
  title/body/solution inputs of `AdminFeedbackPet.tsx` have no `maxLength`, and
  its error handler shows a generic toast, so a note that is too long now
  fails with a message the admin cannot act on. Same reason: frontend file,
  out of scope.
  *(Fixed in the follow-up task `w1-sec0-fix` — see
  `task-w1-sec0-fix-report.md`.)*
* **A development setup with `VITE_API_BASE_URL` pointing at an `http://` API**
  uploads a screenshot and gets an absolute `http://…/uploads/…` URL, which
  the server refuses (only `https://` and `/uploads/` are accepted, as the
  task requires). With the default same-origin setup the URL is relative and
  works.
* **`README.md` and `docs/api-reference.md` are now out of date** — they still
  document `?key=`, the `x-developer-key` header and the old default secrets.
  They were outside the scope of this task and were not edited; they need a
  follow-up.
* **No Content-Security-Policy** (see the decisions above).
* **The audit items that were explicitly out of scope** (lockout, token
  revocation, database indexes, pagination) were not touched.
* `server/src/config/permissions.ts`, `server/prisma/schema*` and the deploy
  files were not modified.

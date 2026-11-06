# task-img-a1 — Server: image variants, backfill, immutable caching, social image

> You are an implementing agent (OpenCode). Skip the "FIRST ACTION" section of `CLAUDE.md`; the secrets and production rules still apply. **Never edit any `CLAUDE.md`.**
> First action: run `Get-Date -Format "yyyy-MM-dd HH:mm:ss"` and keep it as `Started:`. Last action: run it again for `Finished:`.
> Master design (naming convention, rationale): `docs/prompts/task-img-a-prompt.md`. The sections named below are binding; read them first. This prompt is one slice of it.

## 1. Goal
Master sections 3.1, 3.2, 3.3, 3.4, 3.6 and the server tests in section 4. **Server only.** Do not touch anything under `src/`.

## 2. Read first
`CLAUDE.md`, `docs/prompts/task-img-a-prompt.md` (sections 1, 3.1-3.4, 3.6, 4, 5), `docs/architecture.md` (media and "SEO shell"), `server/src/services/mediaService.ts` and its tests, the upload and media routes in `server/src/routes/`, `server/src/app.ts` (`fastifyStatic` for `/uploads`), `server/src/services/seo/meta.ts`, `jsonld.ts`, `shell.ts`, `server/test/seo.test.ts`, `server/scripts/` (style of existing scripts), `deploy/Caddyfile.ajda`.

## 3. Decided design
Exactly as master 3.1-3.4 and 3.6:
- variants `-480`, `-960`, `-1600` (WebP) only when narrower than the original; `-og.jpg` (1200x630) always;
- one shared module `server/src/services/imageVariants.ts` used by both the upload and the backfill, plus the pure helper `variantNames(url)`;
- delete the variants wherever uploads are deleted;
- backfill script with `--dry-run` and `npm run media:variants`;
- immutable `Cache-Control` only for UUID-named uploads, `max-age=86400` for the rest;
- `og:image` and `twitter:image` use `-og.jpg`, with width/height/type tags only when the og variant is used; JSON-LD and sitemap images stay original.

The upload response `{ url, filename }` stays unchanged. Lower-case UUID v4 only; an upper-case UUID returns `null` (document it in a code comment and the tests).

## 4. Out of scope
Everything in `src/`, the client `imageVariants.ts` copy and `ResponsiveImage` (task-img-a2), bundled images (task-img-a3), AVIF, CDN, schema or migrations, admin UI. Edit a Caddyfile only if Caddy would override the cache header (say so in the report if you do).

## 5. Tests and docs
Tests exactly as master section 4 (all bullets). Docs as master section 5: `docs/architecture.md` (media), `docs/CHANGELOG.md`, `deploy/README-deploy.md` (run `npm --prefix server run media:variants` once after deploy, safe to repeat; disk grows roughly 60-80%). Never run the backfill outside your local `UPLOAD_DIR`.

## Constraints
No commits, installs or `.env` edits; no production commands. Do not edit existing tests to fit new code. If Prisma's AI-safety guard blocks `npm --prefix server test`, stop and say so in the report; never pass a consent variable. Wanted `CLAUDE.md` changes go in the report under `## CLAUDE.md proposals for Claude`.

## Gates
`npm run lint` (baseline 46 warnings, none new), `npm run build`, `npm --prefix server run build`, `npm --prefix server test`.

## Report
`D:\projects\html\ajda\docs\prompts\task-img-a1-report.md`. Top lines: `Model:` (never guessed, `unknown` if unsure), `Started:`, `Finished:`. Then: files changed, gate results with test counts, sizes in KB of one real upload (main vs each variant vs og), decisions you made, what you could not verify. Claim nothing the commands did not show.

Run with a free OpenCode model: **Beam Free**.

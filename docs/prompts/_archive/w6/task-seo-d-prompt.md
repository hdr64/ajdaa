# task-seo-d — Readable project URLs: `/projects/villa-riyadh-206`

> You are an implementing agent (OpenCode). Skip the "FIRST ACTION" section of `CLAUDE.md`; the secrets and production rules still apply. **Never edit any `CLAUDE.md`.**
> First action: run `Get-Date -Format "yyyy-MM-dd HH:mm:ss"` for `Started:`. Last action: the same for `Finished:`.
> Run **after** `task-seo-c` is accepted (both touch `src/App.tsx` routing files and the project cards).

## 1. Goal
Project pages today are `/projects/206`. Make the canonical URL `/projects/{slug}-{id}`, e.g. `/projects/villa-riyadh-206`, so results in Google read better. **No schema change and no migration**: the slug is computed from `titleEn` at runtime and the numeric id suffix guarantees uniqueness. Old URLs keep working.

## 2. Read first
`CLAUDE.md`, `docs/architecture.md` ("SEO shell"), `server/src/services/seo/pages.ts`, `meta.ts`, `jsonld.ts`, `sitemap.ts`, `seoService.ts`, `server/test/seo.test.ts`, `src/seo/paths.ts`, `src/seo/pageMeta.ts`, `src/hooks/useSeo.ts`, `src/App.tsx` (`parsePath`, `getPathForRoute`, navigate), `src/components/common/SpaLink.tsx`, `PropertyCard.tsx`, `ProjectsSection.tsx`, `src/types/property.ts`.

## 3. Decided design
- **Slug rule** (one shared definition, implemented identically in `server/src/services/seo/slug.ts` and `src/seo/slug.ts`, same test vectors in both): take `titleEn`; lower-case; replace every run of characters not in `a-z0-9` with `-`; trim `-`; cut to 60 chars at a `-` boundary; if the result is empty (no English title, or Arabic only) the slug is empty. Canonical path = `/projects/{slug}-{id}`, or `/projects/{id}` when the slug is empty.
- **Accepted URLs**: `/projects/{id}`, `/project/{id}`, `/projects/{anything-lowercase}-{id}`. The id (digits after the last `-`) is the only thing that selects the project. The slug in the URL is ignored for lookup.
- **Canonical**: the shell always emits `<link rel=canonical>`, `og:url` and JSON-LD `url` with the **computed** canonical path, whatever URL was requested. Do **not** add HTTP 301s (Caddy proxies the shell; canonical tags consolidate). Status stays 200 for a published project, 404 otherwise.
- `matchRoute` (`pages.ts`) returns `{kind:'project', id}`; `canonicalPath` is computed in `meta.ts` once the project row is loaded. Update the sitemap (`<loc>`), the project `JSON-LD` (`url`, `Offer.url`, breadcrumb item), the noscript lists (home, works) and `projectList` links to the canonical path. `PUBLISHED_PROJECT_LINKS` and the sitemap query must also select `titleEn`.
- **Client**: `pathForPage('project', id, titleEn)` in `src/seo/paths.ts` returns the canonical path. `parsePath`/`getPathForRoute` in `App.tsx` accept all forms above and generate the canonical one. After a project loads, call `history.replaceState` once to the canonical path if the address differs (no new history entry). `SpaLink` takes an optional `projectTitleEn` prop; cards pass `property.titleEn`. `useSeo`/`pageMeta.ts` canonical for a project uses the same function.
- Existing links in the app that build `/projects/${id}` by hand (grep `projects/`) must use the shared function.

## 4. Tests (extend `server/test/seo.test.ts`, do not edit existing assertions to fit)
Slug vectors (English, mixed punctuation, Arabic-only → empty, >60 chars, duplicate dashes); `/projects/206`, `/projects/wrong-name-206` and `/projects/villa-riyadh-206` all return the same project with canonical `/projects/villa-riyadh-206` (given `titleEn` "Villa Riyadh"); project without `titleEn` canonical is `/projects/{id}`; sitemap, JSON-LD and noscript use the canonical form; draft/unknown id still 404 + noindex; injection-safety test still passes.

## 5. Docs (same change)
`docs/architecture.md` (SEO shell: URL rules), `docs/api-reference.md` (shell path forms), `docs/CHANGELOG.md`. State plainly that no migration is needed.

## 6. Out of scope
Schema or migrations, Arabic slugs, an admin slug field, 301 redirects, the `/en` version (next task), anything in `deploy/`.

## 7. Constraints
No commits, installs or `.env` edits. If Prisma's AI-safety guard blocks `npm --prefix server test`, **stop and say so in the report**; do not pass a consent variable yourself. Wanted doc changes for `CLAUDE.md` go in the report under `## CLAUDE.md proposals for Claude`.

## 8. Gates
`npm run lint`, `npm run build`, `npm --prefix server run build`, `npm --prefix server test`. Baseline: lint has 14 warnings, none new allowed.

## 9. Report
`D:\projects\html\ajda\docs\prompts\task-seo-d-report.md`, top lines `Model:` (never guessed, `unknown` if unsure), `Started:`, `Finished:`. Then: files changed, gate results with test counts, decisions you made, what you could not verify. Claim nothing the commands did not show.

Run with a free OpenCode model: **Beam Free**.

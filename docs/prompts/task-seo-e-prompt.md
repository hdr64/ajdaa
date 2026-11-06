# task-seo-e — English version of the public site at `/en/...` with hreflang

> You are an implementing agent (OpenCode). Skip the "FIRST ACTION" section of `CLAUDE.md`; the secrets and production rules still apply. **Never edit any `CLAUDE.md`.**
> First action: run `Get-Date -Format "yyyy-MM-dd HH:mm:ss"` for `Started:`. Last action: the same for `Finished:`.
> Run **after** `task-seo-d` (done) and `task-cms-d` are accepted: cms-d wires the new `seo` fields of the past-works and careers routes into the same shell, route and test files. Do not run in parallel with it. Already done, do not redo: footer links are `SpaLink` (`Footer.tsx`), `index.html` has a blocking font stylesheet and default description/OG tags.

## 1. Goal
Arabic and English share one URL today (language lives in `localStorage`), so Google can only index Arabic. Give English its own URLs: `/en`, `/en/works`, `/en/projects/{slug}-{id}`, … so English pages are indexable and linked to their Arabic twins with `hreflang`. Arabic URLs stay exactly as they are (no prefix).

## 2. Read first
`CLAUDE.md`, `docs/architecture.md` ("SEO shell"), `docs/ADMIN-I18N.md`, the server SEO files (`server/src/services/seo/*`, `server/src/routes/seo.routes.ts`, `server/test/seo.test.ts`), `src/App.tsx`, `src/context/LanguageContext.tsx`, `src/hooks/useLanguage.ts`, `src/seo/*`, `src/hooks/useSeo.ts`, `src/components/common/SpaLink.tsx`, `Navbar.tsx` (language switch), `deploy/Caddyfile.ajda` (the `@spaPage` matcher).

## 3. Decided design
- **URLs**: public pages only. `/en` ≡ English home; `/en/{page}` for works, clients, past-works, careers, booking, contact; `/en/projects/{slug}-{id}` (same id/slug rules as task D). **Admin is never prefixed**: `/en/admin…` is a 404.
- **Language follows the URL**: on `/en/...` the app is English; on unprefixed URLs it is Arabic. The language switch becomes navigation to the twin URL of the current page (keeps the project id), not just a state toggle. Keep `localStorage` only as a hint for the admin area and for future visits; **do not auto-redirect** anyone based on it or on `Accept-Language`.
- **Server shell** (`pages.ts`, `meta.ts`, `shell.ts`, `jsonld.ts`, `sitemap.ts`, `seoService.ts`): `matchRoute` returns the language and the route; the shell cache key includes the language. For English: English copy from `STATIC_PAGES` (`titleEn`, `descEn`), project `titleEn/cityEn/descriptionEn` with fallback to Arabic fields, brand `Ajda Real Estate`, `<html lang="en" dir="ltr">` (rewrite the template attributes), `og:locale=en_US` with `ar_SA` alternate, English noscript text and nav links under `/en`, JSON-LD `inLanguage: "en"` and English names. Canonical is the page's own URL (the English page canonicalises to itself, never to Arabic).
- **hreflang**: every indexable page (static pages and published projects, both languages) emits `<link rel="alternate" hreflang="ar" href=…>`, `hreflang="en"` and `hreflang="x-default"` (the Arabic URL), all with `data-seo="1"`. Absolute URLs from `config.appUrl`. A project with no English title still gets an English page (fallback text) and the pair.
- **Sitemap**: one `<url>` per page and language, each with `<xhtml:link rel="alternate" hreflang=…>` entries for both (declare `xmlns:xhtml="http://www.w3.org/1999/xhtml"`).
- **Client**: `parsePath` strips a leading `/en`; `getPathForRoute(route, lang)` adds it; `pathForPage(page, id, titleEn, lang)` in `src/seo/paths.ts`; `LanguageContext` sets the language from the URL on load and on `popstate`; `SpaLink` takes the language into account automatically via `useLanguage`; `useSeo` writes the hreflang links and `og:locale` for the current URL; `pageMeta.ts` canonical for English uses the `/en` path. Footer and navbar links keep the current language prefix.
- **Caddy**: the `@spaPage` matcher already covers `/en/...`; verify nothing else is needed and say so in the report. Do not edit Caddyfiles unless a path is not covered.

## 4. Tests (extend `server/test/seo.test.ts`; no edits to existing assertions)
`/en` and `/en/works` return English title, `<html lang="en" dir="ltr">`, self-canonical, hreflang trio, `og:locale=en_US`; `/en/projects/{id}` and the slug form work and use English fields with Arabic fallback; `/en/admin` is 404 + noindex; `/admin` unchanged; Arabic pages now also carry the hreflang trio; sitemap contains both language URLs with `xhtml:link`; shell cache does not mix languages; injection-safety still passes.

## 5. Docs (same change)
`docs/architecture.md` (URL scheme, hreflang, language-follows-URL), `docs/api-reference.md`, `docs/CHANGELOG.md`, and `docs/ADMIN-I18N.md` only if admin language handling changed (it should not).

## 6. Out of scope
Auto-redirects by language, other languages, admin routes, slug schema, translating CMS content, anything not listed.

## 7. Constraints
No commits, installs or `.env` edits. If Prisma's AI-safety guard blocks `npm --prefix server test`, **stop and say so in the report**; do not pass a consent variable. Wanted doc changes for `CLAUDE.md` go under `## CLAUDE.md proposals for Claude`.

## 8. Gates
`npm run lint` (no new warnings beyond the baseline of 46 on 2026-11-06), `npm run build`, `npm --prefix server run build`, `npm --prefix server test`.

## 9. Report
`D:\projects\html\ajda\docs\prompts\task-seo-e-report.md`, top lines `Model:` (never guessed, `unknown` if unsure), `Started:`, `Finished:`. Then: files changed, gate results with counts, decisions, what you could not verify. Claim nothing the commands did not show. Browser verification is done by the reviewer.

Run with a free OpenCode model: **Beam Free**. If it fails twice, split it into server (shell, sitemap, hreflang) and client (routing, language switch).

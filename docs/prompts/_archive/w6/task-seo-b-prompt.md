# task-seo-b — Client-side SEO: live head updates, crawlable links, headings, images

> You are an implementing agent (OpenCode). Skip the "FIRST ACTION" section of `CLAUDE.md`; the secrets and production rules still apply. **Never edit any `CLAUDE.md`.**
> First action: run `Get-Date -Format "yyyy-MM-dd HH:mm:ss"` and remember it as `Started:`. Last action: run it again for `Finished:`.
> Runs after (or in parallel with, files are disjoint) `task-seo-a-prompt.md`. You only touch `src/` and docs.

## 1. Goal and why

The server (task A) injects correct head tags for the first page load. After that the app is a SPA: `pushState` navigation changes the page but nothing updates the title, description, canonical, OpenGraph or JSON-LD, the English language never gets English meta, and most navigation is probably `<button onClick>` instead of `<a href>`, so even Googlebot cannot follow links between pages. Fix that on the client:

1. a `useSeo` hook that keeps the head correct on every route and language change;
2. real `<a href>` links for all public navigation (with SPA navigation preserved);
3. exactly one `<h1>` per public page, sane heading order, descriptive image `alt`, image dimensions and lazy loading (rankings and Core Web Vitals);
4. `noindex` on every admin route.

## 2. Read first

`CLAUDE.md`, `docs/ADMIN-I18N.md` (language handling), `docs/architecture.md`, then: `index.html`, `src/main.tsx`, `src/App.tsx` (**all of it**: `parsePath`, `getPathForRoute`, `navigate`/`handleNavigate`, how pages are rendered), `src/context/LanguageContext.tsx` + `src/hooks/useLanguage.ts`, `src/hooks/useCmsContent.ts`, `src/context/SiteSettingsProvider.tsx`, `src/pages/index.ts`, `src/pages/HomePage.tsx`, `ProjectDetailPage.tsx`, `ClientsPage.tsx`, `PastProjectsPage.tsx`, `CareersPage.tsx`, and every component under `src/components/home`, `works`, `booking`, `contact`, `common` that renders navigation (header/nav, footer, project cards, CTAs, floating Jobs button).

## 3. Contract with the server (task A), do not deviate

- Every tag the server injects carries `data-seo="1"`: `<title>` (the template's own title is removed by the server and replaced), `meta[name=description]`, `link[rel=canonical]`, `meta[name=robots]`, `meta[property^="og:"]`, `meta[name^="twitter:"]`, and `<script type="application/ld+json">`.
- The hook owns the head: on every update it **removes all `head [data-seo]` elements and writes a fresh set**, and sets `document.title`. If the page was served without server tags (plain static `index.html`, dev server), the hook still produces a complete head; never produce duplicates.
- Absolute origin: `window.location.origin` (the client runs on the real domain). Canonical rules are the server's: `/project/:id` → `/projects/:id`, `/register-interest` → `/booking`, no trailing slash except `/`, no query, no hash.
- The server's Arabic copy table is in `task-seo-a-prompt.md` section 3.4. **Reuse the exact same strings** for the client (put them in one file, `src/seo/pageMeta.ts`; Arabic and English). Title format `{page} | أجدا العقارية` / `{page} | Ajda Real Estate`, home uses its full title with no suffix. Project: `{title} — {city} | …` using `titleEn`/`cityEn` in English with fallback to the Arabic field.

## 4. Decided design

### 4.1 Hook and builder (new files under `src/seo/`)

- `src/seo/pageMeta.ts`: copy table + `getPageMeta(page, lang, project?)` returning `{ title, description, canonical, robots, image, jsonLd[] }`.
- `src/seo/jsonLd.ts`: client builders for `BreadcrumbList` (all inner pages) and `RealEstateListing` (project page, same field rules as the server: omit empty fields, `offers` only when `price > 0`, currency `SAR`, `geo` only when lat and lng exist). The home page gets only `WebSite` + `RealEstateAgent` **if** site settings (`useSiteSettings`) are loaded; otherwise leave the server's version in place by not touching JSON-LD on home when there is nothing better (document your choice). Escape `<`, `>`, `&`, U+2028/9 in the serialised JSON exactly like the server (`\u003c` etc.), though the script is created with `textContent`.
- `src/hooks/useSeo.ts`: `useSeo(meta | null)`; runs in a `useEffect` keyed on the serialised meta. Mount it once in `App.tsx` so it covers every route, passing the current route + language + (for project pages) the loaded project. While the project is still loading, set the generic site title and **do not** set a canonical to the wrong page; once data arrives, update. Language switch must update title/description/`og:locale` (`ar_SA` ↔ `en_US`) and `document.documentElement.lang/dir` is already handled elsewhere (do not duplicate it).
- Admin routes (`admin`, `admin_login`, `admin_verify_email`, `admin_accept_invite`): `robots` = `noindex, nofollow`, no canonical, no OG, no JSON-LD, title "لوحة التحكم | أجدا العقارية" / "Admin Dashboard | Ajda Real Estate".
- The old inline `<script>` in `index.html` that sets `document.title` for English stays (it prevents a title flash); do not change `index.html` except adding nothing. If you think it must change, say why in the report instead of changing it.

### 4.2 Crawlable links

For every public navigation element (header/nav menu including mobile menu, footer links, logo, project cards and "view project" buttons, "past works", "clients", "careers" floating button, booking/contact CTAs, breadcrumbs if present): render `<a href="{real path}">` where the path is what `getPathForRoute` produces, and keep the SPA behaviour with an `onClick` that does `event.preventDefault()` then calls the existing navigate function, **except** when `event.metaKey || ctrlKey || shiftKey || button !== 0` or `target="_blank"` (let the browser open it normally). Put this in one reusable component `src/components/common/SpaLink.tsx` (props: `route` or `to`, `className`, `children`, `onNavigate`) and use it everywhere instead of ad-hoc anchors. Buttons that perform actions (submit, toggle menu, open modal, language/theme switch) stay `<button>`. In-page scroll anchors (`#section`) stay as they are.

**Visual parity is mandatory**: converting `<button>` to `<a>` must not change layout or styling (same classes, `display`, `text-align`, no underline/colour change from the browser defaults; Tailwind v4 preflight already resets anchors, verify). Keep existing `aria-label`s and focus styles.

### 4.3 Headings, images, performance hygiene

- Exactly one visible `<h1>` per public page (home, works if separate, project, clients, past works, careers, booking, contact). If a page currently has several h1 or none, demote or promote **only the tag** (`h1`/`h2`/`h3`), keep the visual classes so nothing changes visually. Heading levels must not skip downwards (h1 → h2 → h3).
- Every `<img>`: meaningful `alt` (project image → project title + city in the current language; client logos → client name; decorative → `alt=""` and `aria-hidden` where appropriate), explicit `width` and `height` (or an aspect-ratio class already on the wrapper) to avoid layout shift, `loading="lazy"` and `decoding="async"` for everything below the fold, and on the single hero/first project image `fetchpriority="high"` with **no** `loading="lazy"`.
- Do not add libraries, do not change fonts, do not touch the 3D (three.js) code, do not restructure the bundle.

### 4.4 Language and URLs

There is one URL per page for both languages (language lives in `localStorage`), so **do not emit `hreflang` alternates** (they would point to the same URL and Google treats that as an error). Mention this limitation in the report.

## 5. Tests and checks (there is no client test runner; do not add one)

Use `npm run lint` and `npm run build`, then verify in a real browser (Claude-in-Chrome tools are available to the reviewer; you may use `npm run dev:all` yourself if you can; if you cannot drive a browser, say so plainly in the report and list exactly what you could not check). Check, for `/`, `/projects/<existing id>`, `/clients`, `/past-works`, `/careers`, `/booking`, `/contact`, `/admin/login`, in **Arabic and English**:

- `document.title`, `meta[name=description]`, `link[rel=canonical]`, `meta[name=robots]`, `og:title`, `twitter:card`, and that `document.querySelectorAll('head [data-seo]')` has no duplicates (one title, one canonical, one description) after navigating through three pages with the menu and with the back button;
- the ld+json blocks parse (`JSON.parse`);
- every nav link is an `<a href>`; ctrl/cmd-click opens in a new tab at the right URL; plain click still navigates without a full page reload (check `performance.navigation`/a marker variable on `window`);
- `document.querySelectorAll('h1').length === 1` on each public page; no image without `alt`;
- layout is visually unchanged at 1440 px and 390 px (compare before/after screenshots of the header and footer and one project card; list them in the report).

## 6. Docs (same change)

`docs/architecture.md`: extend the "SEO shell" section written by task A (if it is not there yet, add a "Client SEO" subsection) with the `data-seo` contract and the `SpaLink` rule ("public navigation is always a real link"). `docs/CHANGELOG.md`: one entry. Do not edit `CLAUDE.md`, `salah-tasks.md`, `refactor.md`; no secrets.

## 7. Out of scope

Anything in `server/`, `deploy/`, `public/`; `/en/` routes and hreflang; slug URLs; prerendering; a router library migration (the hand-written `parsePath` stays); admin UI changes other than the robots/title for admin routes; analytics; changing translations other than adding the SEO copy file; any new dependency.

## 8. Constraints

No commits, no pushes, no installs, no schema changes, no `.env` edits. Do not touch any `CLAUDE.md`. Keep each new file under ~200 lines. Admin is Arabic-first with English (`docs/ADMIN-I18N.md`); do not add hard-coded admin strings.

## 9. Gates

```
npm run lint
npm run build
npm --prefix server run build
npm --prefix server test
```
All must pass (server baseline 44 files, 428 tests, plus whatever task A added if it has landed).

## 10. Report

Write `D:\projects\html\ajda\docs\prompts\task-seo-b-report.md` with, at the very top: `Model:` (your model; `unknown` if you cannot tell, never guessed), `Started:`, `Finished:` (real clock output). Then: files changed or created; list of every element converted to `SpaLink` (file + element); heading changes (file, old tag → new tag); images changed; gate results; browser-check results per page and language (what you saw, not what you expect), plus what you could not check; decisions left open by this prompt; `## CLAUDE.md proposals for Claude`; known limitations (no hreflang, one URL per language). Do not claim anything the commands did not show.

Run with a free OpenCode model: **Beam Free** (default). If it fails twice, split by file area (links / hook / headings and images) instead of switching to a paid model.

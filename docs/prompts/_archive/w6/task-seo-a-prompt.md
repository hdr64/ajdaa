# task-seo-a — Server-side SEO: per-route HTML shell, sitemap, robots, JSON-LD

> You are an implementing agent (OpenCode). Skip the "FIRST ACTION" section of `CLAUDE.md`; the secrets and production rules in it still apply. Read `CLAUDE.md` for project facts but **never edit any `CLAUDE.md`**.
> First action of the whole task: run `Get-Date -Format "yyyy-MM-dd HH:mm:ss"` and remember it as `Started:`. Last action: run it again for `Finished:`.

## 1. Goal and why

Ajda is a Vite + React SPA. Caddy serves `dist/index.html` for every route, so **crawlers that do not run JavaScript (WhatsApp, X, Facebook, LinkedIn, Telegram, Bing's first pass, most SEO tools) see one generic title for every page and no content**, and Google sees nothing until its render queue gets to it. There is no `robots.txt`, no `sitemap.xml`, no canonical, no OpenGraph, no JSON-LD, and the test instance (`ajda.weghetk.com`) is indexable.

Fix it **without SSR and without a framework change**: the Fastify API renders the SPA shell per request. It reads the built `dist/index.html`, injects the right `<title>`, description, canonical, robots, OpenGraph, Twitter card and JSON-LD for that exact URL (project data comes from the database), adds a `<noscript>` block with real content and crawlable links, and returns it with the correct HTTP status (404 for unknown or unpublished projects). The same server serves `/robots.txt` and `/sitemap.xml`. Caddy routes page requests to it and falls back to the static file if the API is down.

The client half (live head updates on SPA navigation, real `<a href>` links, headings, image alt) is a separate prompt, `task-seo-b-prompt.md`. **Do not touch `src/`** in this task.

## 2. Read first

- `CLAUDE.md` (repo root), `docs/README.md` (docs rules), `docs/architecture.md`, `docs/api-reference.md`, `deploy/README-deploy.md` (sections on Caddy and env).
- `server/src/app.ts` (plugin registration, helmet, `fastifyStatic` for uploads), `server/src/config/env.ts` (zod env schema, `config` object, `APP_URL`), `server/.env.example`, `server/test/env.ts` and `server/test/setup-env.ts`, `server/test/helpers.ts` (how tests build the app and seed data), `server/test/security-headers.test.ts` (style to copy).
- `server/src/routes/projects.routes.ts` (`serializeProject`, `includeProjectRelations`, how `publishStatus` is filtered), `server/src/services/siteSettings.ts` (phone, email, address, socials), `server/src/routes/cms.routes.ts` and `server/src/routes/pastProjects.routes.ts` (public reads).
- `server/prisma/schema.prisma` models `Project`, `PastProject`, `CmsSection`.
- `deploy/Caddyfile.ajda` and `deploy/Caddyfile.test.ajda`.
- `index.html` (repo root) and `src/App.tsx` `parsePath` (the list of public routes, below).

## 3. Decided design (no open choices)

### 3.1 Env (add to `server/src/config/env.ts` zod schema, `server/.env.example`, `server/test/env.ts`)

- `SEO_INDEXING`: `'on' | 'off'`, **default `'off'`**. Only production sets `on`. When `off`: `robots.txt` is `User-agent: *\nDisallow: /`, no sitemap content (return an empty valid `<urlset>`), every shell response and `/sitemap.xml` carry `X-Robots-Tag: noindex, nofollow`, and the shell's `<meta name="robots">` is `noindex, nofollow`. This protects the test instance and local runs.
- `SPA_DIST_DIR`: path to the built SPA. Default: `path.resolve(process.cwd(), '../dist')` (the API runs from `server/`; verify against how `config.uploadDir` is resolved and match that style). Production is `/srv/ajda/app/dist`, test is `/srv/ajda/test/dist`.
- The public origin for every absolute URL is `config.appUrl` (already normalised without a trailing slash). Production must set `APP_URL=https://ajdaa.sa`; note this in your report as an owner action. Never take the origin from the `Host` header.

### 3.2 New module `server/src/services/seo/`

Split into small pure files so they are unit-testable without the app:

- `pages.ts`: the route table and copy (below).
- `meta.ts`: `buildPageMeta(route, data, lang)` returns `{ title, description, canonical, robots, ogType, image, jsonLd[] }`.
- `jsonld.ts`: builders for the JSON-LD objects.
- `shell.ts`: `renderShell(template, meta, noscriptHtml)` string injection plus escaping helpers.
- `sitemap.ts`: `buildSitemapXml(entries)` and `buildRobotsTxt(indexing, origin)`.
- `server/src/routes/seo.routes.ts`: Fastify plugin registered with **no prefix** for `/robots.txt` and `/sitemap.xml`, and the shell under `/api/seo/shell` (register that plugin's shell route with prefix `/api/seo`; simplest is two exported plugins or one plugin that declares the full paths itself).

### 3.3 Public routes the shell must know (from `parsePath` in `src/App.tsx`)

Normalise first: lower-case, strip a trailing `/`, ignore query and hash.

| Path | Canonical | Copy key |
|---|---|---|
| `/` | `/` | home |
| `/works` | `/works` | works |
| `/clients` | `/clients` | clients |
| `/past-works` | `/past-works` | pastWorks |
| `/careers` | `/careers` | careers |
| `/booking`, `/register-interest` | `/booking` | booking |
| `/contact` | `/contact` | contact |
| `/projects/:id`, `/project/:id` (`:id` digits) | `/projects/:id` | project |
| `/admin`, `/admin/**` | none | admin: `noindex, nofollow`, generic title "لوحة التحكم | أجدا العقارية", **no JSON-LD, no OG, no noscript content, never loads data** |
| anything else | none | notFound: HTTP **404**, `noindex`, still returns the shell so the SPA can render |

A published project with a valid id returns 200. An id that does not exist, or `publishStatus` is not `published`, returns 404 + noindex (same as notFound). Never leak draft or hidden project data into the shell.

### 3.4 Copy (use verbatim; Arabic is the indexed language, English is used by the client later and in `og:locale:alternate`)

Brand suffix: ` | أجدا العقارية` (EN ` | Ajda Real Estate`). Titles must stay ≤ 65 characters; descriptions are 110–160 characters (trim project descriptions at a word boundary and add `…`).

| Key | Title AR | Description AR | Title EN | Description EN |
|---|---|---|---|---|
| home | أجدا العقارية \| نُعيد تعريف العقار… مشروعاً، وقيمة، وتجربة | أجدا العقارية تطوّر وتسوّق مشاريع سكنية وتجارية ومكتبية ولوجستية في المملكة العربية السعودية. استعرض المشاريع واحجز معاينتك. | Ajda Real Estate \| Redefining Real Estate… Project, Value, and Experience | Ajda Real Estate develops and markets residential, commercial, office and logistics projects across Saudi Arabia. Browse projects and book a viewing. |
| works | مشاريعنا | استعرض مشاريع أجدا العقارية السكنية والتجارية والمكتبية واللوجستية في المملكة العربية السعودية. | Our Projects | Browse Ajda Real Estate residential, commercial, office and logistics projects across Saudi Arabia. |
| clients | عملاؤنا وشركاؤنا | تعرّف على العملاء والشركاء الذين يثقون بأجدا العقارية في مشاريعهم العقارية. | Our Clients and Partners | Meet the clients and partners who trust Ajda Real Estate with their property projects. |
| pastWorks | أعمالنا السابقة | مشاريع نفّذتها أجدا العقارية سابقاً في المملكة العربية السعودية. | Past Projects | Projects previously delivered by Ajda Real Estate in Saudi Arabia. |
| careers | الوظائف | انضم إلى فريق أجدا العقارية. تعرّف على الفرص الوظيفية وقدّم طلبك إلكترونياً. | Careers | Join the Ajda Real Estate team. Explore open roles and apply online. |
| booking | احجز معاينة | سجّل اهتمامك أو احجز معاينة لأحد مشاريع أجدا العقارية وسيتواصل معك فريقنا. | Book a Viewing | Register your interest or book a viewing and our team will contact you. |
| contact | تواصل معنا | تواصل مع فريق أجدا العقارية للاستفسار عن المشاريع والحجوزات. | Contact Us | Contact the Ajda Real Estate team about projects and reservations. |

(`home` uses its title as-is, with no suffix; the others get the suffix.)

Project: title `{title} — {city} | أجدا العقارية` (AR fields `title`, `city`; EN fields `titleEn ?? title`, `cityEn ?? city`). Description: stripped (no HTML, collapsed whitespace) `description`; if empty, build `{typeAr} {priceTypeAr}`-style fallback: `"{typeAr} للـ{priceType} في {city}، مساحة {area} م²."` (just make it grammatical; keep it short). `og:image` = the project's `image`, made absolute against `config.appUrl` when it starts with `/`; if it is already `https://...` keep it. Fallback image for everything else: `{origin}/og-default.png` (see 3.8).

### 3.5 Tags the shell injects (every tag carries `data-seo="1"`)

Placed just before `</head>`. Remove the existing `<title>` from the template and write a new one first. In order: `<title>`, `meta description`, `link rel=canonical`, `meta robots` (`index, follow, max-image-preview:large, max-snippet:-1` when indexable, else the noindex value), OpenGraph (`og:type` = `website` for pages, `website` for project too since `product`/`article` do not fit; `og:site_name`, `og:title`, `og:description`, `og:url`, `og:image`, `og:image:alt`, `og:locale` = `ar_SA`, `og:locale:alternate` = `en_US`), Twitter (`twitter:card` = `summary_large_image`, `twitter:title`, `twitter:description`, `twitter:image`), then one `<script type="application/ld+json" data-seo="1">` per JSON-LD object. Do not emit OG/Twitter/JSON-LD for admin and notFound. `<html lang="ar" dir="rtl">` stays as the template has it.

### 3.6 JSON-LD (builders in `jsonld.ts`, all URLs absolute)

- **home**: `RealEstateAgent` (`@id` = `{origin}/#org`, `name` "أجدا العقارية", `alternateName` "Ajda Real Estate", `url`, `logo` = `{origin}/logo.png`, `image`, `description`, `telephone`, `email`, `address` as `PostalAddress` with `streetAddress` from `addressAr` and `addressCountry: "SA"`, `areaServed: {"@type":"Country","name":"Saudi Arabia"}`, `sameAs` = non-empty social URLs from site settings; **omit any field whose value is empty** instead of emitting empty strings) plus `WebSite` (`@id` `{origin}/#website`, `url`, `name`, `inLanguage: "ar"`, `publisher: {"@id": "{origin}/#org"}`). No `SearchAction` (there is no search page).
- **project**: `RealEstateListing` (`name`, `description`, `url`, `image` array: main image plus up to 5 gallery images, absolute; `datePosted` = `publishedAt ?? createdAt` ISO, `dateModified` = `updatedAt`, `inLanguage: "ar"`, `about`: `{"@type":"Place","name": city, "address": {"@type":"PostalAddress","addressLocality": city,"addressCountry":"SA"}, "geo": GeoCoordinates only when lat and lng are both present}`, `offers`: `Offer` with `price` and `priceCurrency: "SAR"` **only when `price` is a positive number**, otherwise omit `offers` entirely), plus `BreadcrumbList` (الرئيسية → مشاريعنا → project title).
- **works / clients / pastWorks / careers / booking / contact**: `BreadcrumbList` only (الرئيسية → page title). Plus `WebPage` is not needed.
- Serialise with `JSON.stringify` and then replace `<` with `\u003c`, `>` with `\u003e`, `&` with `\u0026`, U+2028/U+2029 with their escapes, so a project title containing `</script>` cannot break out.

### 3.7 `<noscript>` content (shell appends it as the first child inside `<body>`, before `<div id="root">`)

A single `<noscript>` block with: `<h1>` (page title without suffix), `<p>` description, and a `<nav>` of plain `<a href>` links to `/`, `/works`, `/clients`, `/past-works`, `/careers`, `/booking`, `/contact`. For `home` and `works` also a `<ul>` of up to 50 published projects (`<a href="/projects/{id}">{title} — {city}</a>`), so link discovery works without JS. For a project: also area, rooms, bathrooms, price label, features (parsed from the JSON-string `features`, ignore parse errors) as a `<ul>`. Everything HTML-escaped (`& < > " '`). No styling, no scripts.

### 3.8 Default OG image

Create `public/og-default.png`, 1200×630, brand background `#f6f8fa`, the existing `public/logo.png` centred (scaled to ~45% of the height). Use `sharp` **if it is already a dependency of `server/`** via a one-off script `scripts/make-og-default.mjs` that you also commit; **do not add any dependency**. If `sharp` is not available, skip the PNG, make the fallback `{origin}/logo.png`, and say so in the report.

### 3.9 Sitemap and robots

- `GET /sitemap.xml`: `Content-Type: application/xml; charset=utf-8`, entries for `/`, `/works`, `/clients`, `/past-works`, `/careers`, `/booking`, `/contact` (omit `/careers` when the careers feature is switched off: look at `server/src/routes/careers.routes.ts` `/form` and `site-careers` tests for the toggle; if you cannot find a cheap check, keep it) and every published project `/projects/{id}` with `<lastmod>` = `updatedAt` (W3C date) and `<image:image><image:loc>` for the main image (declare `xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"`). No `changefreq`/`priority` (Google ignores them). Cache the built string in memory for 10 minutes; `Cache-Control: public, max-age=600`.
- `GET /robots.txt`: `text/plain; charset=utf-8`. When indexing is on:
  ```
  User-agent: *
  Allow: /
  Disallow: /admin
  Disallow: /api/
  Allow: /uploads/

  Sitemap: {origin}/sitemap.xml
  ```
  When off: `User-agent: *\nDisallow: /\n`.
- Add `Allow: /uploads/` only because Google Images needs the project photos; PDFs under uploads already download as attachments.

### 3.10 The shell route and caching

- `GET /api/seo/shell?path=/projects/5` returns `text/html; charset=utf-8`. Validate `path` (string, ≤ 300 chars, must start with `/`; otherwise treat as `/` notFound). The handler must **never throw to the client**: any error (DB down, template missing) → log, and respond **503** with `Cache-Control: no-store` and an empty body so Caddy's fallback serves the static file (see 3.11).
- Template: read `{SPA_DIST_DIR}/index.html`, cache the string keyed by file mtime (`fs.stat` each request; re-read when the mtime changes, so a deploy is picked up without restart).
- Result cache: in-memory `Map` keyed by normalised path, TTL 60 s, max 500 entries (drop oldest). Do not cache 5xx. Send a weak `ETag` (hash of the body) and honour `If-None-Match` with 304. `Cache-Control: no-cache`.
- Headers: `X-Robots-Tag` per 3.1 and for admin; `Vary: Accept-Encoding` is left to Caddy.
- HTTP status: 200 / 404 per 3.3.
- Add the route to the existing rate limiter's allow-list only if the global limit would plausibly block crawlers (look at the `rateLimit` registration in `app.ts`); the shell is cheap and cached, so prefer a generous per-route limit of 300/min over exemption.

### 3.11 Caddy (edit `deploy/Caddyfile.ajda` and `deploy/Caddyfile.test.ajda`; **you cannot test Caddy here, so keep it minimal and mark it in the report as untested**)

In the SPA `handle` block keep static assets and files served as today, but for paths that are not an existing file and have no file extension, proxy to the API shell instead of `try_files … /index.html`. If the API answers 5xx or does not answer, serve the static `/index.html` exactly as today. Also add `handle /robots.txt` and `handle /sitemap.xml` → `reverse_proxy` to the API port (4000 prod, 4001 test), placed before the SPA handle. Use `rewrite * /api/seo/shell?path={http.request.uri.path}` for the proxied page requests. Use Caddy's `reverse_proxy` + `handle_response`/`@fallback status 5xx` pattern (check the Caddy 2 docs you know; if the fallback cannot be expressed safely in the Caddyfile, say so in the report and leave the existing static behaviour untouched rather than ship a Caddyfile that can take the site down). Keep the existing security headers and `Cache-Control` rules for `/assets/*` and `/index.html`.

## 4. Tests (new file `server/test/seo.test.ts`; follow `security-headers.test.ts` / `helpers.ts` conventions)

Tests need a template: point `SPA_DIST_DIR` at a temp dir the test creates with a minimal `index.html` (contains `<title>old</title>`, `</head>`, `<body>`, `<div id="root"></div>`). Cover at least:

1. `/` shell: 200, one `<title>`, canonical = `{APP_URL}/`, description present, `og:title`, `twitter:card`, JSON-LD parses and contains `RealEstateAgent` and `WebSite`, `<noscript>` has an `<h1>` and the nav links.
2. `/projects/{id}` for a seeded published project: title contains project title and city, canonical `/projects/{id}`, `RealEstateListing` with `offers` when price > 0 and without `offers` when price is null, `BreadcrumbList` present, `og:image` absolute.
3. `/project/{id}` canonicalises to `/projects/{id}`; `/register-interest` to `/booking`; trailing slash and upper case normalised.
4. Draft and hidden project → 404 and `noindex`, and **no** title or description of the draft appears in the body.
5. Unknown path and unknown id → 404 + noindex. `/admin/projects` → 200 (or 200 shell), `noindex, nofollow`, no `og:` and no JSON-LD.
6. **Injection safety**: a published project titled `</script><script>alert(1)</script>"><img src=x onerror=1>` produces a body with no unescaped `<script>alert` and valid parseable JSON-LD (assert by regex extraction + `JSON.parse`, and that the raw string `</script><script>` does not occur inside the ld+json block).
7. `SEO_INDEXING=off` (default in the test env): robots.txt is `Disallow: /`, `X-Robots-Tag: noindex, nofollow` on the shell and on sitemap, `meta robots` noindex. `SEO_INDEXING=on`: robots allows, has the `Sitemap:` line, no `X-Robots-Tag: noindex`. (How you flip the flag between cases depends on how `config` is built; read `env-config.test.ts` and `env.ts` and choose the lightest way that does not leak between tests, e.g. build the pure functions with the flag as an argument and test routes under the default only.)
8. `sitemap.xml` is well formed (parse with a simple regex count, no new dependency), lists only published projects with `lastmod` and `image:loc`, and never lists drafts.
9. ETag/304 round trip; template mtime change is picked up; missing template → 503, empty body.
10. Unit tests for `sitemap.ts`/`jsonld.ts` helpers: empty fields omitted, escaping of `& < >` and U+2028.

Do not edit any existing test to make it pass. If an existing test fails, report which and why.

## 5. Docs (same change, owner rule)

- `docs/api-reference.md`: `/robots.txt`, `/sitemap.xml`, `/api/seo/shell` (public, no auth, HTML, statuses, cache).
- `docs/architecture.md`: a short "SEO shell" section: why (SPA, no SSR), how (template injection, 60 s cache, Caddy fallback), the `data-seo` contract that the client uses, the `SEO_INDEXING` safety default.
- `docs/CHANGELOG.md`: one entry. `deploy/README-deploy.md`: the env variables (`SEO_INDEXING=on` and `APP_URL=https://ajdaa.sa` for production only, `SPA_DIST_DIR`) and the new Caddy blocks, with a "verify with curl" snippet:
  `curl -s https://ajdaa.sa/projects/1 | grep -E "<title>|canonical|og:title|ld\+json"` and `curl -sI https://ajdaa.sa/projects/999999` expecting 404.
- Do NOT write secret values anywhere. Do not edit `salah-tasks.md`, `refactor.md` or any `CLAUDE.md`; put wanted changes in the report.

## 6. Out of scope

Anything in `src/`; `/en/` URL prefix and hreflang (needs new routes, separate decision); slug URLs for projects (needs a schema migration); per-past-project or per-job pages; prerendering at build time; analytics and Search Console verification tags; changing helmet/CSP; any schema change or migration (**this task needs none**); any new npm dependency; moving the shell to a separate process.

## 7. Constraints

No commits, no pushes, no installs, no `prisma migrate`, no production anything, no editing of `.env` files (only `.env.example`). Do not touch any `CLAUDE.md`. Do not add `console.log`; use the existing logger. Keep each file focused (no 800-line file). Do not run the test suite while a dev API is running (Windows locks Prisma's engine DLL); stop it first.

## 8. Gates (run all, paste the result lines in the report)

```
npm run lint
npm run build
npm --prefix server run build
npm --prefix server test
```
Baseline before your change: 44 files, 428 tests. Report the new totals. All must pass.

## 9. Report

Write `D:\projects\html\ajda\docs\prompts\task-seo-a-report.md` with, at the very top: `Model:` (your model; `unknown` if you cannot tell, never guessed), `Started:`, `Finished:` (real clock output). Then: files changed or created; gate results with counts; decisions you made that this prompt left open; what you could not verify (Caddy, the OG image if sharp was missing); curl or `app.inject` output for `/`, `/projects/<id>`, a 404 path, `/robots.txt` and `/sitemap.xml` (trimmed); `## CLAUDE.md proposals for Claude`; known limitations. Do not claim anything the commands did not show.

Run with a free OpenCode model: **Beam Free** (default). If it fails twice, split by file area instead of switching to a paid model.

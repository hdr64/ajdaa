# task-img-a — MASTER DESIGN (reference only, do not run it): split into `task-img-a1` (server), `task-img-a2` (client), `task-img-a3` (bundled images)

Original title: Responsive image variants, immutable upload caching, 1200×630 social image

> You are an implementing agent (OpenCode). Skip the "FIRST ACTION" section of `CLAUDE.md`; the secrets and production rules still apply. **Never edit any `CLAUDE.md`.**
> First action: run `Get-Date -Format "yyyy-MM-dd HH:mm:ss"` for `Started:`. Last action: the same for `Finished:`.
> Run **after** `task-seo-c` is accepted (both touch the project cards and public pages).

## 1. Goal and why
Uploaded images are re-encoded to a single WebP at up to 2400 px (`server/src/services/mediaService.ts`). A 400 px project card therefore downloads the 2400 px file, which hurts mobile data and Core Web Vitals (a Google ranking signal). Four changes, in this order (the fourth, 3.7, shrinks the large images bundled in the front end):

1. **Responsive variants**: at upload, also write 480, 960 and 1600 px WebP copies; the public site uses `srcset`/`sizes`.
2. **Immutable caching** for uploaded files (names are random UUIDs, so a URL never changes content).
3. **Social image**: a 1200×630 JPEG per image, used as `og:image` / `twitter:image` for projects (WebP is not supported by every link-preview scraper).

No schema change and no migration: variants follow a **naming convention**, nothing is stored in the database.

## 2. Read first
`CLAUDE.md`, `docs/architecture.md` (media and "SEO shell" sections), `server/src/services/mediaService.ts` (and its tests: grep `server/test` for `mediaService`, `upload`), `server/src/routes/` upload and media routes, `server/src/app.ts` (the `fastifyStatic` registration for `/uploads`), `deploy/Caddyfile.ajda` (`/uploads/*` handle), `server/src/services/seo/meta.ts`, `jsonld.ts`, `sitemap.ts`, `src/types/property.ts`, and every public component that renders a project, gallery or client image (grep `\.image`, `gallery`, `<img` under `src/pages` and `src/components/{common,home,works,booking,contact}`; **not** `components/admin`).

## 3. Decided design

### 3.1 Naming convention (single source of truth)
For an upload stored as `/uploads/<uuid>.webp`:
- variants: `/uploads/<uuid>-480.webp`, `-960.webp`, `-1600.webp`
- social: `/uploads/<uuid>-og.jpg`
Only the exact shape `/uploads/<uuid>.webp` (lower-case UUID v4) has variants. Anything else (`/assets/...`, `/uploads/seed/...`, external URLs, PDFs) has none and must keep working unchanged.

### 3.2 Server (`mediaService.ts`)
- After writing the main file, generate each variant whose width is **smaller than the original width** (`withoutEnlargement`; skip a variant rather than upscale; if the original is 700 px wide only `-480` is written). Same pipeline as today: `.rotate()`, `.webp({ quality: 80 })` for variants. Social: `resize(1200, 630, { fit: 'cover', position: 'attention' })`, `.jpeg({ quality: 82, mozjpeg: true })`, **always** written (upscaling a small image to 1200×630 is accepted for this file only).
- Generate from the decoded buffer once (reuse the `sharp` input), run the variant writes in parallel, and fail the whole upload cleanly (remove any partial files) if any write fails.
- The upload response keeps `{ url, filename }` unchanged (client code depends on it). Do not return variant URLs.
- **Deletion**: wherever uploaded files are deleted (grep `unlink`, `rm(`, media delete route, project delete/cleanup), delete the variants too, ignoring missing files.
- Export a pure helper `variantNames(url)` (returns the four names or `null`) and use it in server and tests; the client gets its own copy in `src/lib/imageVariants.ts` with the **same test vectors**.

### 3.3 Backfill for existing uploads
`server/scripts/backfill-image-variants.mjs`: scans `UPLOAD_DIR` (same path resolution as `config.uploadDir`; read `server/src/config/env.ts`), and for every `<uuid>.webp` missing any variant creates the missing ones with the same function the upload uses (extract the generator to an importable module, e.g. `server/src/services/imageVariants.ts`, so script and upload share code; the script may use `tsx` like other scripts in `server/scripts`, follow their style). Idempotent, prints a count, `--dry-run` flag, never modifies or deletes originals, never touches the database. Add `npm run media:variants` (and `media:variants -- --dry-run`) to `server/package.json`. Production: the **owner runs it by hand once after deploy**; do not run it against anything but your local dev uploads.

### 3.4 Immutable caching
In the `fastifyStatic` registration for `/uploads` (check how headers are set today): files whose name matches `^[0-9a-f-]{36}(-(480|960|1600|og))?\.(webp|jpg|pdf)$`-style UUID names get `Cache-Control: public, max-age=31536000, immutable`; everything else under `/uploads` (e.g. `seed/`) gets `public, max-age=86400`. Keep every existing header (`Content-Disposition` for PDFs, `nosniff`, CORP, etc.) exactly as is. Caddy proxies `/uploads/*` and must not override this header; verify and say so in the report, edit Caddyfiles only if needed.

### 3.5 Client
- `src/lib/imageVariants.ts`: `imageSrcSet(url)` returns `"/uploads/<uuid>-480.webp 480w, …-960.webp 960w, …-1600.webp 1600w"` for convention URLs, else `undefined`; `ogImageUrl(url)` returns the `-og.jpg` URL or the original.
- New component `src/components/common/ResponsiveImage.tsx` (props: `src`, `alt`, `sizes`, `width`, `height`, `priority?`, `className`, rest of `<img>` attributes): renders `<img src={src} srcSet={imageSrcSet(src)} sizes={sizes} …>`; `priority` → `fetchPriority="high"` and no lazy loading, otherwise `loading="lazy" decoding="async"`. Keep `src` as the original full-size URL (fallback and crawlers). Note React 19 spells it `fetchPriority`.
- Use it for project cover images and galleries on: `PropertyCard.tsx`, `ProjectsSection.tsx`, the works page list, `ProjectDetailPage.tsx` (main image `priority`, gallery lazy). Provide realistic `sizes` per layout (e.g. cards `(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw`; detail main `(min-width: 1024px) 60vw, 100vw`). **Same classes and layout; no visual change**; keep existing `alt`, width/height attributes (task-seo-c already added them where needed).
- Do not touch the admin UI, three.js code, bundled `src/assets` images, or CMS image fields that are not uploads.

### 3.6 Social image in the SEO shell
`server/src/services/seo/meta.ts` and `jsonld.ts` (project branch): `og:image` and `twitter:image` use the `-og.jpg` URL when the project image has a convention URL, else the existing absolute original. JSON-LD `image` keeps the full-size originals (Google Images wants high resolution). Add `og:image:width`=1200, `og:image:height`=630 and `og:image:type`=`image/jpeg` **only** when the og variant is used (extend `shell.ts`'s tag list). The sitemap `<image:loc>` stays the original. Client `pageMeta.ts` mirrors the same `og:image` choice via `ogImageUrl`.

### 3.7 Bundled front-end images (item 4, independent of 3.1–3.6; do it last)
Largest files today: `src/assets/imgs/ajda_hero_bg.jpg` (832 KB), `src/assets/ajda1/alehsa.webp` (420 KB), `src/assets/bg/2.webp` (416 KB), `src/assets/imgs/bg2.webp` (312 KB), `src/assets/ajda/festa/festa2.webp` (272 KB), `src/assets/bg/3.webp`, `bg/4.webp`, `bg/5.webp` (228–268 KB). Method:
1. For each, find where it is used (grep the file name and its import in `src/`). **An unused file is only listed in the report, never deleted.**
2. Convert `ajda_hero_bg.jpg` to WebP (quality ~80) and every other file listed above to a displayed-size-appropriate WebP: width no larger than the largest size the image is rendered at times 2 (for full-bleed backgrounds cap at 1920 px, for gallery or card images at 1600 px), never upscale, quality 78–80. Use a one-off script `scripts/optimize-bundled-images.mjs` (same style as `scripts/make-og-default.mjs`, `sharp` from `server/node_modules`, `--dry-run` flag, prints before/after KB per file), commit the script. Replace the files in place (same path and extension `.webp`; for the JPG, a new `.webp` file and update its import, then leave the old `.jpg` in place only if something else imports it, otherwise delete it and say so in the report).
3. Compare visually: open each changed image before and after (resize both to the same size) and state in the report that no visible artefacts or crop changes appear; if an image shows banding or blur at quality 78, raise it to 85 for that file and say so.
4. Keep the hero image `fetchPriority="high"` (task-seo-c did this) and do not lazy-load it. Do not change what any image shows or how it is cropped; `object-cover` and positions stay.
Target: total size of the listed files at least 40% smaller, no file over ~250 KB. Do not touch `public/` images, logos, favicons, or the OG image.

## 4. Tests (server, vitest; no edits to existing assertions to fit; add new ones)
- upload a PNG larger than 1600 px → main, `-480`, `-960`, `-1600` and `-og.jpg` exist, widths correct, og is exactly 1200×630 JPEG; small upload (e.g. 500 px) → only `-480`? (no: original 500 > 480, so `-480` exists, `-960`/`-1600` do not) and og exists;
- partial failure cleans up; deleting the file removes all variants;
- `variantNames` vectors (valid UUID, seed path, external URL, PDF, upper-case UUID → `null` or normalised as you decide and document);
- backfill: creates only missing variants, second run changes nothing, `--dry-run` writes nothing (test the exported function, not the CLI);
- `/uploads/<uuid>.webp` response carries `immutable`, `/uploads/seed/...` carries `max-age=86400`, PDF still has its download disposition;
- project shell uses the `-og.jpg` in `og:image` plus the three dimension tags; a project with a non-convention image keeps the original and emits no dimension tags.

## 5. Docs (same change)
`docs/architecture.md` (media section: variants, naming convention, caching, og image), `docs/api-reference.md` only if a route response changed (it should not), `docs/CHANGELOG.md`, `deploy/README-deploy.md` (a "run `npm --prefix server run media:variants` once after deploy, safe to repeat" step; mention disk usage grows by roughly 60–80%). No secrets.

## 6. Out of scope
AVIF, a CDN or image proxy, on-the-fly resizing endpoints, schema or migrations, admin UI, converting any bundled front-end image not listed in 3.7, CMS non-upload images, changing the 2400 px cap or WebP quality of the main file.

## 7. Constraints
No commits, no installs (sharp is already a server dependency), no `.env` edits, no production commands. Do not run the backfill outside your local `UPLOAD_DIR`. If Prisma's AI-safety guard blocks `npm --prefix server test`, **stop and say so in the report**; do not pass a consent variable. Wanted `CLAUDE.md` changes go under `## CLAUDE.md proposals for Claude`.

## 8. Gates
`npm run lint` (no new warnings beyond the baseline), `npm run build`, `npm --prefix server run build`, `npm --prefix server test`.

## 9. Report
`D:\projects\html\ajda\docs\prompts\task-img-a-report.md`, top lines `Model:` (never guessed, `unknown` if unsure), `Started:`, `Finished:`. Then: files changed; gate results with test counts; sizes before/after for one real image (main vs each variant, in KB); a before/after KB table for every bundled image in 3.7 and the list of any that turned out unused; decisions you made; what you could not verify (browser, production). Claim nothing the commands did not show. Browser verification (Network tab shows the right candidate at 390 px and 1440 px, no layout change, cache headers on a real request) is done by the reviewer.

Run with a free OpenCode model: **Beam Free**. If it fails twice, split into server (3.2–3.4, 3.6), client (3.5) and bundled images (3.7).

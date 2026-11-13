# task-img-a2 — Client: ResponsiveImage with srcset on public project images

> You are an implementing agent (OpenCode). Skip the "FIRST ACTION" section of `CLAUDE.md`; the secrets and production rules still apply. **Never edit any `CLAUDE.md`.**
> First action: run `Get-Date -Format "yyyy-MM-dd HH:mm:ss"` and keep it as `Started:`. Last action: run it again for `Finished:`.
> Master design: `docs/prompts/task-img-a-prompt.md` (sections named below are binding).
> Run **after** `task-img-a1` is reviewed and accepted (it defines the naming convention and the server `variantNames` test vectors).

## 1. Goal
Master section 3.5, plus the client mirror in 3.6. **Client only** (no `server/` edits).

## 2. Read first
`CLAUDE.md`, `docs/prompts/task-img-a-prompt.md` (3.1, 3.5, 3.6), `server/src/services/imageVariants.ts` and the `variantNames` tests from a1 (use the same vectors), `src/seo/pageMeta.ts`, `src/components/common/SpaLink.tsx`, then the files in 3 below.

## 3. Decided design
- `src/lib/imageVariants.ts`: `imageSrcSet(url)` and `ogImageUrl(url)` exactly as master 3.5, same naming convention and test vectors as the server (lower-case UUID v4 `/uploads/<uuid>.webp` only; everything else returns `undefined` / the original URL).
- `src/components/common/ResponsiveImage.tsx` exactly as master 3.5: `src` stays the full-size URL; `priority` gives `fetchPriority="high"` and no lazy loading; otherwise `loading="lazy" decoding="async"`; other `<img>` attributes pass through.
- Use it for project cover images and galleries in `src/components/common/PropertyCard.tsx`, `src/components/home/ProjectsSection.tsx`, `src/components/works/WorksPage.tsx` and `src/pages/ProjectDetailPage.tsx` (main image `priority`, gallery lazy). `sizes`: cards `(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw`; detail main `(min-width: 1024px) 60vw, 100vw`; choose sensible values for the rest and list them in the report. **Same classes, layout, `alt`, width and height; no visual change.**
- `src/seo/pageMeta.ts`: `og:image` for a project uses `ogImageUrl`, mirroring the server.

## 4. Out of scope
Admin UI, three.js, `src/assets` images, CMS image fields that are not uploads, server code, bundled-image conversion (task-img-a3).

## 5. Tests and docs
Add vitest tests only if the repo already has a client test setup (check; do not add a framework). Otherwise show in the report how you verified the helper vectors. Docs: a `docs/references/CHANGELOG.md` entry.

## Constraints
No commits, installs or `.env` edits; do not touch `deploy/`. Wanted `CLAUDE.md` changes go in the report under `## CLAUDE.md proposals for Claude`.

## Gates
`npm run lint` (baseline 46 warnings, none new), `npm run build`. No server gates (no server change). The reviewer checks 390 px and 1440 px in the browser; say what you could not verify.

## Report
`D:\projects\html\ajda\docs\prompts\task-img-a2-report.md`. Top lines: `Model:` (never guessed, `unknown` if unsure), `Started:`, `Finished:`. Then: files changed, gate results, the `sizes` value per place, decisions, what you could not verify. Claim nothing the commands did not show.

Run with a free OpenCode model: **Beam Free**.

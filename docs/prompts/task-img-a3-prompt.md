# task-img-a3 — Shrink the large bundled front-end images

> You are an implementing agent (OpenCode). Skip the "FIRST ACTION" section of `CLAUDE.md`; the secrets and production rules still apply. **Never edit any `CLAUDE.md`.**
> First action: run `Get-Date -Format "yyyy-MM-dd HH:mm:ss"` and keep it as `Started:`. Last action: run it again for `Finished:`.
> Master design: `docs/prompts/task-img-a-prompt.md` section 3.7 (binding). Independent of a1 and a2; touches only `src/assets`, one script and the imports of changed files.

## 1. Goal
Master section 3.7, nothing else.

## 2. Read first
`CLAUDE.md`, `docs/prompts/task-img-a-prompt.md` (3.7), `scripts/make-og-default.mjs` (style to copy), then grep where each listed file is used.

## 3. Decided design
The files: `src/assets/imgs/ajda_hero_bg.jpg`, `src/assets/ajda1/alehsa.webp`, `src/assets/bg/2.webp`, `src/assets/imgs/bg2.webp`, `src/assets/ajda/festa/festa2.webp`, `src/assets/bg/3.webp`, `src/assets/bg/4.webp`, `src/assets/bg/5.webp`.
- Find each file's use first. An unused file is only listed in the report, never converted or deleted.
- One-off script `scripts/optimize-bundled-images.mjs` (`sharp` from `server/node_modules`, `--dry-run`, prints before/after KB per file).
- Width cap: full-bleed backgrounds 1920 px, gallery and card images 1600 px; never upscale; WebP quality 78-80 (85 for a file that shows banding, say so).
- Replace in place (same path, `.webp`). The hero JPG becomes a new `.webp` with its import updated; delete the old `.jpg` only if nothing else imports it, and say so.
- Do not change what any image shows, its crop, `object-cover` or position. Keep the hero `fetchPriority="high"` and no lazy loading.
- Target: total of the listed files at least 40% smaller, no file over about 250 KB. Do not touch `public/`, logos, favicons or the OG image.

## 4. Verification
Open each changed image before and after at the same size and state in the report that no artefacts or crop changes are visible. If you can run the dev server, load `/`, `/works` and a project page and say what you saw; otherwise say you could not.

## 5. Out of scope
Server, uploads, variants, `srcset`, any image not listed.

## Constraints
No commits, installs or `.env` edits; do not touch `deploy/`. Wanted `CLAUDE.md` changes go in the report under `## CLAUDE.md proposals for Claude`.

## Gates
`npm run lint` (baseline 46 warnings, none new), `npm run build`.

## Report
`D:\projects\html\ajda\docs\prompts\task-img-a3-report.md`. Top lines: `Model:` (never guessed, `unknown` if unsure), `Started:`, `Finished:`. Then: a before/after KB table for every file, the list of unused files, gate results, decisions, what you could not verify. Claim nothing the commands did not show.

Run with a free OpenCode model: **Beam Free**.

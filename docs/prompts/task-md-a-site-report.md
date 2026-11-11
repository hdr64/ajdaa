Model: claude-sonnet-5-5 (Claude Code, run by Claude itself, not OpenCode)
Started: 2026-11-11 21:34:47
Finished: 2026-11-11 21:37:33

# task-md-a-site report

## Result
Uploaded as a zip with `extract=html`, the site is served correctly: **CSS, JS and all images load (200, right Content-Type)**. The page is nevertheless **stuck on the preloader** because `script.js` throws on `localStorage`, which the server's sandbox CSP forbids. No application code was changed.

## Request sequence (local API `http://localhost:4000`, seeded dev user, DB is the local `ajda-db-2`)
1. `tar -a -c -f %TEMP%\a-site\a-site.zip -C md\a index.html styles.css script.js imgs` (21,997,829 bytes, `index.html` at root, 3 excluded files left out).
2. `POST /api/auth/login` returns a bearer token.
3. `POST /api/media/upload/chunked/init` `{filename:'a-site.zip', totalSize, totalChunks:5, chunkSize:5242880, mimeType:'application/zip', extract:'html'}` returns an `uploadId`.
4. `POST /api/media/upload/chunked/chunk?uploadId=…&chunkIndex=0..4` (multipart, field `file`, five 5 MB parts), each `{receivedChunk:i}`.
5. `POST /api/media/upload/chunked/complete` `{uploadId}` returns `slug: a-site-590cd5`, `fileType: html`, `filename: index.html`, `url: /uploads/<uuid>-a-site/index.html`, `size: 34143`, `extracted` has one item.
6. Link: `http://localhost:4000/html/a-site-590cd5/` (removed in cleanup).

## URL / status / Content-Type
| URL (under `/html/a-site-590cd5`) | Status | Content-Type |
|---|---|---|
| `/` | 200 | text/html; charset=utf-8 |
| `/styles.css` | 200 | text/css; charset=utf-8 |
| `/script.js` | 200 | application/javascript; charset=utf-8 |
| `/imgs/2,3,4,5,6,11.webp`, `/imgs/6.webp` (2.3 MB) | 200 | image/webp |
| `/imgs/a1.png`, `dark_hero.png`, `hero_mobile_light1.png` | 200 | image/png |
| `/imgs/festa/1.jpeg` | 200 | image/jpeg |

Every `imgs/*` path referenced in `index.html` and `script.js` returned 200 (checked the HTML ones and samples of the rest). The one 404 in my scan, `/%23n`, is a regex artefact from a `#n` fragment reference, not a real asset.

## What failed and root cause
Browser check (Chrome, screenshot after 5 s plus 5 s wait): only the "أجدا" preloader shows, forever. Console:
`SecurityError: Failed to read the 'localStorage' property … The document is sandboxed and lacks the 'allow-same-origin' flag` at `index.html:16` (inline theme snippet) and `script.js:135` (`initTheme()`, line 136 `localStorage.getItem('aqar-theme')`).

Cause: `/html/:slug/*` replies with `Content-Security-Policy: sandbox allow-scripts allow-popups allow-forms` (deliberate, `publicMedia.routes.ts`). Without `allow-same-origin` the page has an opaque origin, so `localStorage`/`sessionStorage` throw. `script.js` calls `localStorage` unguarded at top level (`initTheme`, and `setItem` at line 144), so the exception aborts the script before the preloader is hidden. External CDN scripts (Tailwind, GSAP, iconify, Google Fonts) are not blocked by the CSP.

The original "CSS and images did not load" symptom came from uploading the HTML file alone, not a zip. The zip path fixes that, but the site still needs the fix below.

Fix (site side, `md/a`, not done here): wrap every `localStorage` access in `try/catch` (inline snippet in `index.html` and `initTheme`/theme toggle in `script.js`), falling back to `'light'`. Do not add `allow-same-origin` to the sandbox: with scripts allowed it would let uploaded pages read the admin origin's storage and tokens.

## Cleanup
- `DELETE /api/media/0ae8f640-8a47-4371-94c6-4f5caa3b498c` returned 200 `{"success":true}`; `/html/a-site-590cd5/` and `/styles.css` now 404; no `*a-site*` folder is left in `server/uploads`.
- `%TEMP%\a-site` deleted. Browser tab closed. Nothing attached to a project, no project saved.
- The local API (`npm --prefix server run dev`) was started for this task and is still running in the background.

## git status
`git status --short` shows only the pre-existing Drive work and prompt files; this task added only this report.

## CLAUDE.md proposals for Claude
None.

# task-md-a-site — verify md/a uploads as an HTML website (zip via the HTML picker)

> You are an implementing agent (OpenCode). Skip the "FIRST ACTION" section of `CLAUDE.md`; its secrets and production rules still apply. Never edit any `CLAUDE.md`.
> First action of the whole task: run `Get-Date -Format "yyyy-MM-dd HH:mm:ss"` and remember it as `Started:`. Last action: run it again for `Finished:`.
> At the top of your report write `Model:` (the model you run as, `unknown` if you cannot tell, never guessed), `Started:`, `Finished:`.

## 1. Goal and why
The static site in `D:\projects\html\ajda\md\a` (`index.html`, `styles.css`, `script.js`, `imgs/`) must be usable as an "HTML page / website" in a project. When it was uploaded the CSS and images did not load, because its links are relative (`styles.css`, `./imgs/...`) and only a **zip extracted by the HTML picker** is served with its sibling files at `/html/<slug>/`.

This is a **verification task**: upload the site the supported way against the LOCAL dev app and report whether CSS and images load. Do not change application code.

## 2. Read first
- `server/src/routes/publicMedia.routes.ts` (`/html/:slug/*`), `server/src/services/zipExtractService.ts` (`extractZipToLibrary`, `pickHtmlEntry`), `server/src/services/chunkedUploadService.ts` (extract flow), `server/src/routes/media.routes.ts` (chunked upload routes, `EXTRACT_KINDS`).
- `src/components/admin/media/MediaPickerModal.tsx` (~lines 106-150: `uploadFileInChunks(file, { extract: 'html' })`), `src/services/chunkedUploadService.ts` (client side, to copy the exact request sequence), `docs/api-reference.md`.
- `md/a/index.html` (asset references only).

## 3. Decided design (no open choices)
1. Build the zip OUTSIDE the repo: `%TEMP%\a-site\a-site.zip`, from the **contents** of `md/a` with `index.html` at the zip root. Include `index.html`, `styles.css`, `script.js`, `imgs/` (recursive). Exclude `_mobile_test_wrapper.html`, `_probe_scroll.html`, `README.md`. Use `tar -a -c -f <zip> -C D:\projects\html\ajda\md\a index.html styles.css script.js imgs` (forward-slash entry names). Never modify or move files under `md/a`.
2. Make sure the local dev app runs (`npm run dev` in the background if not; ports from `server/.env.example`/`vite` output; do NOT print `.env` values). Log in against the local API as the seeded dev user (`dev@ajdaa.sa`, password `password`, local dev DB only).
3. Upload the zip through the same API sequence the picker uses with `extract=html` (init, chunk(s), complete), using PowerShell `Invoke-RestMethod`/`curl`. Record the returned file/slug.
4. Request `http://localhost:<api-port>/html/<slug>/` and then every asset the page references that you can derive from `index.html` and `styles.css` (`/html/<slug>/styles.css`, `/html/<slug>/script.js`, `/html/<slug>/imgs/6.webp`, `imgs/2.webp`...). For each, report status code and `Content-Type`.
5. If the browser tools are available, open the page and take one screenshot; otherwise skip. (Claude will check visually in review.)
6. Clean up: delete the uploaded test file from the library through the API (the same call the admin Library delete uses) and delete `%TEMP%\a-site`. Do not attach it to any project and do not save any project.

## 4. Out of scope
Any code change, schema change, new feature, Drive zip tasks (`task-drive-*`), production, editing `md/a`, fixing CDN or CSP behaviour (report it only).

## 5. Constraints
No commits, no installs, never edit any `CLAUDE.md`, no secret values in files or the report, local dev only. If the extractor rejects the zip, report the exact error and stop; do not patch the extractor.

## 6. Gates
None (no code changes). State `git status --short` at the end and confirm it shows no new changes caused by you.

## 7. Report
Write to `D:\projects\html\ajda\docs\prompts\task-md-a-site-report.md`: header lines (Model/Started/Finished), the exact request sequence used, a table of URL / status / Content-Type, what failed and the root cause if anything, the `/html/<slug>/` link, cleanup confirmation, and `## CLAUDE.md proposals for Claude` (may be "none").

Run with a free OpenCode model: **Beam Free** (suggested).

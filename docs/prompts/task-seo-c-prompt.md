# task-seo-c — Finish client SEO: remaining links, images, headings, browser check

> You are an implementing agent (OpenCode). Skip the "FIRST ACTION" section of `CLAUDE.md`; the secrets and production rules still apply. **Never edit any `CLAUDE.md`.**
> First action: run `Get-Date -Format "yyyy-MM-dd HH:mm:ss"` and remember it as `Started:`. Last action: run it again for `Finished:`.

## 1. Goal

`task-seo-b` was only partly done. Already done and **not to be redone**: `src/seo/pageMeta.ts`, `src/seo/paths.ts`, `src/hooks/useSeo.ts`, `src/components/common/SpaLink.tsx`, and SpaLink in `Navbar.tsx`, `Footer.tsx`, `CareersFloatingButton.tsx`, the card titles in `PropertyCard.tsx` and `ProjectsSection.tsx`. Read `docs/prompts/_archive/w6/task-seo-b-prompt.md` sections 4.2 and 4.3 for the rules (SpaLink contract, visual parity, heading and image rules); they still apply. This task finishes three things, one concern each, in this order:

## 2. Read first

`CLAUDE.md`, `docs/prompts/_archive/w6/task-seo-b-prompt.md`, `src/components/common/SpaLink.tsx`, `src/seo/paths.ts`, `src/App.tsx` (`parsePath`, `getPathForRoute`, navigate), then the files named below.

## 3. Part 1 — remaining navigation links

Convert every public-navigation `<button onClick={...navigate...}>` to `SpaLink` in: `src/pages/HomePage.tsx`, `src/pages/ClientsPage.tsx`, `src/pages/ProjectDetailPage.tsx`, `src/components/home/InteractiveProjectsMap.tsx`, and any component under `src/components/works`, `booking`, `contact` that navigates to another public page (grep for `onNavigate(` and `onNavigate?.(`). Buttons that submit, toggle, open modals or switch language/theme stay `<button>`. Same classes, no visual change. Add `display: inline-block`/`flex` classes only if the old button had them implicitly.
In `PropertyCard.tsx` and `ProjectsSection.tsx` the title link currently runs the quick-view callback on a plain click. Keep that (decided), and list it in the report as a known inconsistency.

## 4. Part 2 — images

Every `<img>` rendered on public pages (`src/pages/*` except admin, `src/components/home|works|booking|contact|common`, not `components/admin`): meaningful `alt` in the current language (project image: title + city; client logo: client name; decorative: `alt=""`), explicit `width` and `height` or an existing aspect-ratio wrapper, `loading="lazy"` and `decoding="async"` below the fold. The first hero image on the home page and the main image on the project page get `fetchpriority="high"` and no `loading="lazy"`. Do not change three.js code, fonts or the bundle.

## 5. Part 3 — headings

Exactly one visible `<h1>` per public page (home, works, project, clients, past works, careers, booking, contact). Today pages with `h1`: careers, clients, past works, project, and `HeroSection` (home). Check works, booking and contact: if one has none, promote the main heading's tag only. No heading level may skip downwards. Change only the tag, keep the classes.

## 6. Out of scope

`server/`, `deploy/`, `public/`, `index.html`, `src/seo/*`, `useSeo.ts`, admin UI, hreflang, new dependencies, router changes, translations.

## 7. Constraints

No commits, no installs, no `.env` edits, no `CLAUDE.md` edits. Wanted doc changes go in the report under `## CLAUDE.md proposals for Claude`.

## 8. Gates

```
npm run lint
npm run build
```
Lint must show no new warnings (baseline: 14 warnings, none in the files above except `src/App.tsx:220`).

## 9. Report

Write `D:\projects\html\ajda\docs\prompts\task-seo-c-report.md`. At the very top: `Model:` (never guessed, `unknown` if you cannot tell), `Started:`, `Finished:`. Then: files changed; every element converted to SpaLink (file + element); heading changes (file, old tag → new tag); images changed (count per file); gate results; what you could not verify. Do not claim anything the commands did not show. Browser verification is done by the reviewer, not by you.

Run with a free OpenCode model: **Beam Free**. If it fails twice, split by part.

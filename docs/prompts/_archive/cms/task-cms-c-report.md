# task-cms-c report — Home map regions from real data, featured-banner hint

Model: Step 5 Preview (stepfun-ai/step-5-preview)
Started: 2026-11-07 00:00:17
Finished: 2026-11-07 01:50:14

## Files changed

- `src/utils/projectRegions.ts` (**new**) — pure `buildProjectRegions(projects, isAr)`: one region per distinct non-empty `city` (key = the Arabic city string, label = `cityEn || city` in English / `city` in Arabic), count = projects in that city, sorted by count desc then city name. Projects with an empty or whitespace city are skipped.
- `src/components/home/InteractiveProjectsMap.tsx` — regions are now built from `allProjects` (the projects that have lat/lng) via the new util; the "all regions" chip shows `allProjects.length`; each chip shows its live count; filtering is `p.city === selectedRegion`. `type RegionFilter` and the `'riyadh' | 'ahsa'` keys, the hard-coded counts and the `p.city !== 'الرياض'` / `'الأحساء'` comparisons are gone (grep for `RegionFilter|'riyadh'|'ahsa'` in `src` returns only the unrelated `src/data/saudiCities.ts`).
- `src/components/home/InteractiveProjectsMap.tsx` (camera) — `RIYADH_CITY` / `AHSA_CITY` constants (the two Arabic city strings) keep their published presets (Riyadh `panTo(riyadhCenter)` + `INITIAL_ZOOM`; Al-Ahsa `panTo(ahsaCenter)` + zoom 13); "all" keeps `allRegionsCenter` + zoom 8; **any other city** now fits the map bounds to that city's projects (`map.fitBounds`, padding for the top controls and bottom strip), falling back to the all-regions view when the city yields no point.
- `src/services/googleMaps.ts` — the loaded bundle also returns `LatLngBounds` (imported from the loader's `core` library) so the fit-bounds path does not touch `window.google`. No mock of the bundle exists in the repo (grep: `AdvancedMarkerElement` appears only in the service, the map component and `MapLocationPicker`, none of which construct a bundle literal).
- `src/components/home/InteractiveProjectsMap.tsx` (text) — video tab chip `'فيديو 4K' / 'Video 4K'` → `'فيديو' / 'Video'`; the video caption was an English-only `'Official 4K Presentation'` → `isAr ? 'العرض التعريفي الرسمي' : 'Official Presentation'`; the drawer units row is `isAr ? units || 'متعدد الوحدات' : unitsEn || units || 'Multiple units'` (matches `ProjectDetailPage.tsx:585-587`).
- `src/components/admin/cms/CmsWorksPanel.tsx`, `src/i18n/admin/cms.ts` — one hint line under the featured-project selector: new key `cms.works.featuredHint` in Arabic and English, rendered with `useAdminT()` (the pattern `task-cms-b` used in `CmsFooterPanel`/`CmsContactPanel`).
- `docs/CHANGELOG.md` — three "Fixed" entries.

No selection logic in `WorksPage.tsx` was touched: pinned `featuredProjectId` → badge contains "رئيسي" → first project is exactly as before.

## Decisions I made (not spelled out in the prompt)

1. **i18n approach for the hint.** `CmsWorksPanel` still holds raw Arabic literals (it is not migrated to `useAdminT` — that is `task-cms-d`/out of scope). I used `useAdminT()` + a typed AR/EN key in `src/i18n/admin/cms.ts` instead of another literal, because the prompt requires the string in both languages and `docs/ADMIN-I18N.md` forbids Arabic literals in admin components. Cost: one extra import plus one hook call in a file that still has literals — inconsistent within the file, but the file is already inconsistent and the alternative would add an untranslated English string.
2. **"Reset View" target.** The old reset selected `'riyadh'`, a key that no longer exists. It now selects the busiest city (`regions[0].key`) and falls back to `'all'` when there are no projects. This keeps the old intent (reset focuses the main city) without a hard-coded city; the camera preset for Riyadh/Al-Ahsa is unchanged.
3. **Region chips come from `allProjects`** (projects that have coordinates), not from every loaded project, so a chip can never show a count the map does not render. The "all" chip uses the same total.
4. **A city with a project that has no lat/lng shows a chip that selects no markers** — the same class of case as the "all" chip today (total counts projects, some without coordinates). I did not add a separate count for mappable projects; flag it if you want one.

## Gates (run in this session)

| Command | Result |
|---|---|
| `npm run lint` | 46 warnings (the documented baseline on 2026-11-06), **0 new**. First run showed 48: I had placed a `useMemo` above the `useState` it read (`react(immutability)` on `regionSelection`) and a `useCallback` missing `setRegionSelection` in its deps — both fixed, no baseline change, no warnings in the new `src/utils/projectRegions.ts`. |
| `npm run build` | Passed (`✓ built in 492ms`, pre-existing chunk-size warning only). |
| `npm --prefix server run build` | Passed (`tsc`, no output). |
| `npm --prefix server test` | **Blocked by Prisma's AI-safety guard.** The command refused to run and printed "You must ask the user if they want to proceed with this action…"; per the prompt I did not set `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`. Output below. Nothing about this task touches the server, and no server file is in the diff. |

```
You must ask the user if they want to proceed with this action. …
No test files found, exiting with code 1
```

## Verification of the pure function (no client test runner exists)

`package.json` has no client test script and no vitest/jest in the root `devDependencies`, so per the prompt I did not add one. Instead I compiled the **real** `src/utils/projectRegions.ts` with the repo's bundled esbuild (0.28.2, from `node_modules`) into a temp ESM file, imported it in Node, ran the prompt's cases, and deleted the temp files (`tmp/cms-c-verify.mjs`, output module — both removed; `git status` shows no extra files):

```
two cities (ar):           [{"key":"الرياض","label":"الرياض","count":2},{"key":"الأحساء","label":"الأحساء","count":1}]
three cities (ar):         [{"key":"الرياض","label":"الرياض","count":3},{"key":"جدة","label":"جدة","count":2},{"key":"الأحساء","label":"الأحساء","count":1}]
missing cityEn (english):  [{"key":"الرياض","label":"الرياض","count":1},{"key":"مكة","label":"مكة","count":1}]
cityEn present (english):  [{"key":"الرياض","label":"Riyadh","count":1},{"key":"مكة المكرمة","label":"Makkah","count":1}]
empty list:                []
empty/whitespace city:     [{"key":"الرياض","label":"الرياض","count":1}]
```

Cases from the prompt covered: two cities ✓, three cities with counts ✓ (sorted desc), project with no `cityEn` ✓ (Arabic fallback), empty project list ✓ (`[]`), and the **stale selected region** case ✓ by code inspection: `selectedRegion` is derived from `regionSelection` and falls back to `'all'` when the key is not in `regions`, so a deleted city or a reload without that city selects "all regions" and never filters the map to nothing. (There is also an untested-but-reachable guard: a city selected with zero mappable points fits the all-regions view.)

## Not verified

- **Browser pass.** I did not run the app, so I have not seen: the chip row with real seed data (how many chips, whether the row wraps/overflows on a 375 px viewport with several cities), the `fitBounds` framing for a third city (the seed data has cities beyond Riyadh/Al-Ahsa), the English labels, the drawer units row, or the CMS hint in Arabic and English. `git diff` + `tsc` were the only static checks. The owner's `git status` also shows `salah-tasks.md` modified with unrelated owner notes (added section I about project descriptions) — I did not touch it and left it as-is.
- **`npm --prefix server test`** — not run (guard), see above.
- Whether the Google Maps `core` library really exposes `LatLngBounds` at runtime — `npm run build` type-checks the import, and the loader's `importLibrary('core')` is the documented way to reach `google.maps.LatLngBounds`, but the runtime call (`map.fitBounds`) is only exercised in the browser.

## Known issues & risks

- More than two cities makes the chip bar wider; on small screens it wraps (`flex-wrap` on the container) and could crowd the radar indicator. Not measured — needs the browser pass above.
- `map.fitBounds` with Google's own zoom clamping (`minZoom: 6`) may leave a wide city slightly under-zoomed; acceptable but worth a look in the browser.

## CLAUDE.md proposals for Claude

- `CLAUDE.md` line 17 states the lint baseline as "46 warnings, none new allowed" while `docs/prompts/task-cms-c-prompt.md` section Gates says "baseline: 14 warnings". The prompt's number is stale; I used the CLAUDE.md value.
- `googleMaps.ts` returning `Map`/`AdvancedMarkerElement` (and now `LatLngBounds`) as a curated bundle is the reason fit-bounds needed a service change at all. If you want a "frame these points" helper to be reusable, it belongs in `src/services/googleMaps.ts` (e.g. `fitPoints(map, points, padding)`) rather than in the map component — say the word and I will move it.

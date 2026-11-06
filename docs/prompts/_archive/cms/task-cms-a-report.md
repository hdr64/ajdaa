# task-cms-a — Project page: remove the fake amenities block, fix untranslated and false text

Model: stepfun-ai/step-5-preview
Started: 2026-11-06 19:40:25
Finished: 2026-11-06 20:13:45

## Files changed

| File | Change |
|---|---|
| `src/pages/ProjectDetailPage.tsx` | Deleted `PROJECT_AMENITIES` + its `<Reveal>` block + the `Building2` / `ShieldCheck` imports (both were used only by it); location highlights now resolve per language; all "4K" claims removed (chip + 5 strings); floors/units stat localized with Arabic counted forms; unit cards read `typeEn` / `featuresEn` with Arabic fallback |
| `src/i18n/translations.ts` | Deleted the dead `modal.amenities` arrays from the Arabic and the English object (grep: nothing in `src/` reads `.amenities`; `translations` is a plain object literal with no type declaring it, so no type change was needed) |
| `docs/CHANGELOG.md` | New "Fixed" entry under `[Unreleased]` describing the three fixes |

No schema, migration, admin, route, serializer or type changes — every field the new code reads (`locationHighlightsEn`, `unitsEn`, `typeEn`, `featuresEn`) already exists in `Property` / `PropertyUnit`, in the Prisma schema, in `serializers.ts` and in the `propertyService.ts` DTO mapping (`unitsCount`→`units`, `unitsCountEn`→`unitsEn`).

## Gate results

- `npm run lint` → **46 warnings**, 0 errors. I measured the same command on the pristine tree (via `git stash`) and it is also **46**; the only delta is one pre-existing `set-state-in-effect` warning in this file moving from line 86 to line 89 because the helpers added 3 lines above it. No new warnings. (Note: the prompt stated a baseline of 14; what I actually measure on this machine is 46 before and after — I report the measured numbers, not the stated ones.)
- `npm run build` (`tsc -b && vite build`) → **success** (`✓ built in 312ms`, plus the usual "chunks larger than 500 kB" advisory for the admin chunks).
- `npm --prefix server run build` (`tsc`) → **success**, no output.
- `npm --prefix server test` → **BLOCKED, no tests ran**. `server/test/global-setup.ts` runs `prisma db push --accept-data-loss` against the throwaway temp SQLite DB (`file:C:/Users/salah/AppData/Local/Temp/ajda-server-test-*/test.db` — never `dev.db`, never production), and Prisma 7.10.1's AI-safety guard refuses because the caller is detected as OpenCode, asking for `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`. Per the task constraint I did **not** set that variable. Vitest then exited 1 with "No test files found". This is environmental and pre-existing (my diff touches only `src/`), but I have no test count for this gate.

## How each point was checked

1. **Fake amenities block** — deleted (diff above). Verified in the built bundle: `Super Deluxe` no longer appears in `dist/assets/ProjectDetailPage-*.js`, and the browser run shows the page going straight from "أهم مميزات ومواصفات المشروع" to the cinematic video section.
2. **Dead `amenities` translations** — `grep -r "amenities" src` before the change returned only the two array definitions in `translations.ts` (lines 284 and 637); no reader anywhere in `src/`. Deleted from both languages; nothing else referenced them, so no type change was required.
3. **Location highlights** — driven by `locationHighlightsAr` / `locationHighlightsEn` (JSON arrays from the API; `properties.seed.ts` line 141 fills both for project 206, and that is the only project with highlights in the seed). Arabic now shows the Arabic list, English shows the English list when non-empty and otherwise falls back to Arabic; the section hides when both are empty. Only seeded project 206 has highlights, so projects 201–205, 207 hide the section in both languages.
4. **"4K" claims** — all six occurrences removed: the standalone chip on the video tab, `فيديو تعريفي 4K`/`4K Video` → `فيديو تعريفي`/`Video`, `فيديو 4K` → `فيديو`, `مشاهدة جولة الفيديو 4K`/`Watch 4K Tour` → `مشاهدة جولة الفيديو`/`Watch Video Tour`, `Official 4K Showcase` → `Official Showcase`, `عرض سينمائي 4K`/`Cinema Mode 4K` → `عرض سينمائي`/`Cinema Mode`. Verified by grep (no "4K" left in the file) and in the built chunk (0 occurrences). The home map (`InteractiveProjectsMap.tsx`, 2 occurrences) is out of scope per the prompt (`task-cms-b`).
5. **Floors & units stat** — Arabic: 1 → "دور واحد", 2 → "دوران", 3–10 → "N أدوار", 11+ → "N دورًا" (`arabicFloorsLabel`); English: "1 floor" / "N floors" (`englishFloorsLabel`). When there are no floors: Arabic `project.units || 'متعدد الوحدات'`, English `project.unitsEn || 'Multiple units'`. Confirmed in the browser on project 206 (4 floors → "4 أدوار").
6. **Unit cards** — `typeAr` → `isAr ? unit.typeAr : (unit.typeEn || unit.typeAr)`; features → `unitFeatures = isAr ? unit.features : (unit.featuresEn?.length ? unit.featuresEn : unit.features)` and the checklist renders on the resolved list, so an English-only features list can no longer hide the whole checklist. `sectionAr` is unchanged because the type has no `sectionEn` (there is no such column in `schema.prisma` either). Confirmed in the browser: Arabic cards show Arabic type and Arabic feature bullets.

## Browser check (running app)

- I started the API (`npm run dev:api`, PostgreSQL dev DB, port 4000) and used the already-running Vite dev server on port 5173.
- **Arabic** (`http://localhost:5173/projects/ajda-prime-206?lang=ar`, screenshots taken): page renders, breadcrumb/title/description, stats bar shows "عدد الأدوار والوحدات: 4 أدوار", media tabs "الصور" / "فيديو المشروع" with **no 4K chip**, thumbnail label "فيديو", Arabic location-highlights list, the features grid, the cinematic video section, and the floor tabs + unit cards with Arabic type ("معرض تجاري", "معرض مركزي تجاري") and Arabic feature bullets. The old six-card amenities block is gone.
- **English** — **not verified by me in the browser**. You said you will verify it yourself; both servers are still running (API on 4000, Vite on 5173/5175). Open `http://localhost:5173/projects/ajda-prime-206?lang=en` and check: "Floors & Units: 4 floors", the English highlights list ("King Fahd Road, Riyadh", "Frontage on 3 main streets", …), English unit types ("Showroom", "Main Showroom", "Office") and no "4K" anywhere. Note the seeded units have no `featuresEn`, so their bullets stay Arabic in English by design (fallback), and no live project has 0 floors, so the "Multiple units" fallback text is only reachable with admin data that sets neither floors nor units count.

## Decisions

- **No type/schema additions.** The prompt allowed adding `locationHighlightsEn` to `Property` "if the API already returns it" — it already does (`serializeProject` line 153, `toProperty` line 198, and the client type line 74), so no edit was made. Same for `unitsEn`, `typeEn`, `featuresEn`.
- **Fallback style**: I used the repo's existing pattern `isAr ? xAr : (xEn || xAr)` (see `getPropertyDisplay` in `src/data/properties.ts:980-982` and the project-features block) instead of introducing a helper.
- **Flagged, not changed**: the project-level features block (line ~695) still guards on `project.features` (Arabic) being non-empty, so a project whose Arabic features list is empty but English is full would show the section in neither language. That pre-existing edge case is outside the decided design (which only names unit cards), so I left it and report it here.
- **Kept the unit `priceLabel` as-is**: it has no `*En` column in the schema, so it cannot be translated without schema work (out of scope).

## Not verified / known issues

- `npm --prefix server test` never ran (Prisma guard above) — no server test count for this change; the change is client-only, but I cannot show it.
- English rendering, and the units-fallback path, are unverified (see above).
- Side effect of starting the dev API: `server/node_modules/@prisma/client` is now generated for **PostgreSQL** (it was SQLite before, per the `ensure-prisma-client.mjs` log). The test suite regenerates it for SQLite in its own setup step, so the next permitted `npm --prefix server test` run is unaffected.

## CLAUDE.md proposals for Claude

- The prompt's lint baseline (14 warnings) does not match this machine: `npm run lint` prints 46 warnings on the pristine tree and 46 after this change. Worth re-measuring and updating the gate note so "none new" is checkable.
- `npm --prefix server test` is currently unrunnable from an OpenCode session because Prisma's AI-safety guard blocks the suite's own `prisma db push --accept-data-loss` on its temp SQLite DB. Document the owner-approved way to run it (e.g. the owner runs the suite by hand, or an explicit consent line in chat) instead of leaving the gate red for every delegated task.

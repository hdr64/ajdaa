# task-cms-draft-b — Live draft preview, part B: the admin (sender) side, home panel

> You are an implementing agent (OpenCode). Skip the "FIRST ACTION" section of `CLAUDE.md`; the secrets and production rules still apply. **Never edit any `CLAUDE.md`.**
> First action: run `Get-Date -Format "yyyy-MM-dd HH:mm:ss"` and keep it as `Started:`. Last action: run it again for `Finished:`.
> Series: A (iframe receives drafts, done and reviewed, `src/utils/cmsPreviewProtocol.ts` exists) → **B (this)** → C (other panels). Do only B.

## 1. Goal
While a CMS panel has unsaved edits, the preview iframe shows them live (about 200 ms after the last keystroke). Only the **Home** panel is wired in this task, as the proof; C wires the rest.

## 2. Read first
`CLAUDE.md`, `src/utils/cmsPreviewProtocol.ts` (from A, binding), `src/components/admin/cms/cmsDirtyContext.ts`, `src/pages/admin/sections/CmsSection.tsx` (hooks near the top, the early `return <NoAccess />` near line 83, the pane and modal usage near lines 385-403), `src/components/admin/cms/CmsLivePreviewPane.tsx`, `src/components/admin/cms/CmsPreviewModal.tsx`, `src/components/admin/cms/CmsHomePanel.tsx`, `docs/prompts/task-cms-draft-a-report.md`.

## 3. Decided design

### 3.1 `cmsDirtyContext.ts`
- `CmsDirtyRegistry` gets `setDraft: (panel: string, json: string | null) => void`.
- `useCmsDirtyRegistryState()` also keeps the drafts (a `Record<string, string>` of JSON strings, bail out of the state update when the string is unchanged, delete the key on `null`) and returns `{ registry, anyDirty, drafts }` where `drafts: PreviewDrafts` is a `useMemo` that `JSON.parse`s each stored string and passes the object through `sanitizeDrafts`.
- `useCmsDirty<T>(panel, value, loading, toDraft?: (value: T) => unknown)`. When `toDraft` is given: compute during render `draftJson = dirty ? JSON.stringify(toDraft(value)) : null`, and in a `useEffect` with deps `[registry, panel, draftJson]` call `registry?.setDraft(panel, draftJson)` with cleanup `registry?.setDraft(panel, null)`. **Do not put `value` or any object in the effect deps** (a panel may pass a fresh object every render, which would loop through the parent's state). When `toDraft` is absent, nothing is published (existing behaviour, other panels stay unchanged in this task).

### 3.2 `CmsSection.tsx`
Take `drafts` from `useCmsDirtyRegistryState()` and pass `drafts={drafts}` to both `CmsLivePreviewPane` and `CmsPreviewModal`. Any new hook goes above the early `NoAccess` return.

### 3.3 `CmsPreviewModal.tsx`
New optional prop `drafts?: PreviewDrafts`, forwarded to the pane.

### 3.4 `CmsLivePreviewPane.tsx`
- New optional prop `drafts?: PreviewDrafts`. Keep it in a ref. In an effect on `drafts`, debounce 200 ms and then `postToFrame(iframeRef.current?.contentWindow, {type:'AJDA_CMS_DRAFT', drafts})`. Clear the "preview paused" flag (below) whenever a draft is posted.
- Add a `window` `message` listener (cleaned up on unmount). For a message that passes `isTrustedFrameMessage(e, iframeRef.current?.contentWindow)`:
  - `AJDA_PREVIEW_READY`: post the current drafts **and** `{type:'AJDA_SET_LANG', lang}` for the current toolbar language (this also fixes the existing bug where a reload resets the iframe to Arabic, because `?lang=` is not read anywhere), and set `isLoading` false.
  - `AJDA_PREVIEW_ERROR`: set `draftError` true.
- When `draftError` is true show a small badge next to the existing "تم التحديث الآن" / "مزامنة لحظية" badge, in the same style, text `المعاينة متوقفة: المحتوى غير صالح للعرض` (the pane's strings are hard-coded Arabic today, keep that and mention it in the report).
- Replace the two direct `postMessage(..., '*')` calls (`AJDA_SET_LANG`, `AJDA_CMS_UPDATED`) with `postToFrame`, and delete their "cross-origin fallback" comments and the `catch` branch that bumps `reloadKey`.
- Remove the debounced `setReloadKey` after a CMS update (the 400 ms timer and `reloadDebounceRef`): the iframe refreshes itself through its socket and `AJDA_CMS_UPDATED`. The manual reload button and the `key={reloadKey}` stay.

### 3.5 `CmsHomePanel.tsx`
Change the call to `useCmsDirty('home', data, loading, (v) => v)`. Nothing else.

### 3.6 Docs
Add a short section (15 lines at most) "CMS live draft preview" to `docs/architecture.md` next to the CMS client description: the iframe + `postMessage` design, the six message types, same-origin checks, drafts are never cached, the read-only rule in `api.ts`, the crash fallback. Link to `src/utils/cmsPreviewProtocol.ts`; do not copy the type definitions. Never edit `CLAUDE.md`.

## 4. Verification
Run the app (client and API; sign in `admin@ajdaa.sa` / `password`). If you cannot, say so and run only the gates; Claude does the browser pass.
1. Site CMS → Home with the split preview on: type in a hero field; the preview shows it within about half a second, no reload, no flicker. Check Arabic and English preview.
2. Switch the preview to mobile, then back to desktop, and click the reload button: the draft and the language are still applied after the iframe reloads.
3. Discard the edits: the preview returns to saved content. Edit again and Save: the preview keeps the new text with **no flash of the old text**. Reload the admin page: preview shows saved content.
4. Open the fullscreen preview modal while an edit is unsaved: it shows the draft too.
5. Make an edit that crashes the home page (for example clear a field the page reads with `.map` or a nested object, if the panel allows it): the badge appears and the preview shows saved content, no blank frame.
6. Switch to another tab with unsaved edits (confirm the leave dialog): the draft is cleared from the preview.
7. No render loop: with React DevTools profiler or a temporary `console.count` in `CmsSection`, typing one character causes a small constant number of renders, not a runaway. Remove the temporary code.
Report what you saw for each, honestly.

## 5. Out of scope
Panels other than Home, `CmsContactPanel`, the iframe side (A), i18n files, the server, the partner list (`clients`).

## Constraints
No commits, installs or `.env` edits; do not touch `deploy/` or `server/`. Wanted `CLAUDE.md` changes go in the report under `## CLAUDE.md proposals for Claude`.

## Gates
`npm run lint` (baseline 46 warnings, none new), `npm run build`.

## Report
`D:\projects\html\ajda\docs\prompts\task-cms-draft-b-report.md`. Top lines: `Model:` (never guessed, `unknown` if unsure), `Started:`, `Finished:`. Then: files changed, gate results, the result of each verification step, decisions made, what you could not verify. Claim nothing the commands did not show.

Run with a free OpenCode model: **Beam Free**.

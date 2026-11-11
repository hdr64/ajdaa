# task-cms-draft-a — Live draft preview, part A: the iframe (receiver) side

> You are an implementing agent (OpenCode). Skip the "FIRST ACTION" section of `CLAUDE.md`; the secrets and production rules still apply. **Never edit any `CLAUDE.md`.**
> First action: run `Get-Date -Format "yyyy-MM-dd HH:mm:ss"` and keep it as `Started:`. Last action: run it again for `Finished:`.
> Part of a three-task series: A (this, the public site inside the iframe accepts drafts) → B (the admin sends drafts, home panel only) → C (remaining panels). A must be finished and reviewed before B starts. Do only A.

## 1. Goal
The public site, when it runs inside the CMS preview iframe, can receive unsaved CMS content ("drafts") from the admin tab through `postMessage` and render it instead of the saved content, without ever persisting it. Nothing in the admin sends drafts yet (that is B), so you test with a console `postMessage`.

## 2. Read first
`CLAUDE.md`, `src/context/CmsProvider.tsx`, `src/context/cmsContextDef.ts`, `src/context/LanguageContext.tsx` (the `AJDA_SET_LANG` listener, about lines 51-75), `src/components/common/ErrorBoundary.tsx`, `src/services/api.ts` (the central request function near lines 200-245 and `reportClientError` near line 162), `src/types/cms.ts` (`CmsSectionsPayload`, `CmsContent`), `src/main.tsx`, `src/App.tsx` (where `ErrorBoundary` is used), `src/components/admin/cms/CmsLivePreviewPane.tsx` (only to see the existing messages it already sends).

## 3. Decided design

### 3.1 New file `src/utils/cmsPreviewProtocol.ts`
Exports exactly:
- `PREVIEW_DRAFT_KEYS` = `['nav','footer','home','works','clientsPage','contact','pastWorks','careers'] as const` and `type PreviewDraftKey`. (`clients` is NOT allowed.)
- `type PreviewDrafts = Partial<Pick<CmsSectionsPayload, PreviewDraftKey>>`.
- `type ParentToFrame = {type:'AJDA_CMS_DRAFT'; drafts: PreviewDrafts} | {type:'AJDA_CMS_UPDATED'} | {type:'AJDA_SET_LANG'; lang:'ar'|'en'}`.
- `type FrameToParent = {type:'AJDA_PREVIEW_READY'} | {type:'AJDA_PREVIEW_ERROR'}`.
- `isPreviewFrame(): boolean`. Computed **once, eagerly at module import** as a module constant: `typeof window !== 'undefined' && window.parent !== window && new URLSearchParams(window.location.search).get('preview') === '1'`. (It must not be re-evaluated later, because in-app navigation can drop the query string.)
- `isTrustedParentMessage(e: MessageEvent): boolean` = `isPreviewFrame() && e.origin === window.location.origin && e.source === window.parent`.
- `isTrustedFrameMessage(e: MessageEvent, frame: Window | null | undefined): boolean` = `!!frame && e.origin === window.location.origin && e.source === frame` (used by the admin side in B; export it now).
- `postToParent(msg: FrameToParent): void` and `postToFrame(frame: Window | null | undefined, msg: ParentToFrame): void`; both use `window.location.origin` as the target origin, never `'*'`, and swallow errors.
- `sanitizeDrafts(input: unknown): PreviewDrafts`: returns `{}` unless `input` is a plain object; keeps only keys in `PREVIEW_DRAFT_KEYS` whose value is a plain object or an array (`nav` is an array, the others are objects); everything else is dropped silently.

### 3.2 `CmsProvider.tsx` (receiver)
All new behaviour is active only when `isPreviewFrame()` is true; outside a preview frame the provider must behave exactly as today.
- State: `drafts: PreviewDrafts` (start `{}`) and `epoch: number` (start 0).
- Message listener (the existing one): handle `AJDA_CMS_UPDATED` only if `isTrustedParentMessage(event)` (today it accepts any sender). Add `AJDA_CMS_DRAFT`, also trusted-only:
  - `next = sanitizeDrafts(event.data.drafts)`.
  - Keys that were in the current drafts but are missing in `next` are "released". If there are released keys: set drafts to `{...next, ...<the released keys with their old values>}` first, call `await revalidate()`, and when it resolves set drafts to `next`. (This stops a flash of the old content between saving and the refetch landing.) If there are none, set drafts to `next` at once.
- After mounting and registering the listeners, call `postToParent({type:'AJDA_PREVIEW_READY'})` once (preview frame only).
- Merged content: `content` given to the context = `useMemo` over (server content, drafts). With no drafts it is the server content object itself (same identity). Otherwise `{...serverContent, ...}` where, for each draft key: if both the server section and the draft are plain objects, use `{...serverSection, ...draftSection}` (one level, so a missing field falls back to the saved value); otherwise (arrays, or type mismatch) use the draft as is.
- `writeCache` must keep receiving only server data, never the merged content. Add a one-line comment saying so.
- Expose in the context value: `preview: { active: boolean; hasDrafts: boolean; epoch: number; rejectDrafts: () => void }`. `rejectDrafts` sets drafts to `{}`, increments `epoch`, and calls `postToParent({type:'AJDA_PREVIEW_ERROR'})`. Update `cmsContextDef.ts` (type and the default value: `{active:false, hasDrafts:false, epoch:0, rejectDrafts: () => {}}`).
- When a valid `AJDA_CMS_DRAFT` is applied after an error, nothing else is needed (the admin side clears its own badge in B).

### 3.3 `LanguageContext.tsx`
The `AJDA_SET_LANG` listener now returns early unless `isTrustedParentMessage(event)`. Nothing else changes.

### 3.4 `ErrorBoundary.tsx` (a draft that crashes the site must not blank the preview)
- Add `static contextType = CmsContext` (`declare context: React.ContextType<typeof CmsContext>`).
- In `componentDidCatch`: if `this.context.preview.active`: remember `this.caughtEpoch = this.context.preview.epoch`; if `this.context.preview.hasDrafts` call `this.context.preview.rejectDrafts()`; in every preview case **do not call `reportClientError`** and return. Outside a preview frame behave exactly as today.
- Add `componentDidUpdate`: if `state.hasError` and the preview is active and `this.context.preview.epoch !== this.caughtEpoch`, reset `hasError` to false (the page re-renders with the saved content).
- A crash with no active draft inside a preview frame still shows the normal error screen (just not reported).

### 3.5 `api.ts` (the preview must be read-only)
In the central request function: when `isPreviewFrame()` and the method is not `GET`, reject before any network call with the same error type the function already uses for failures, message `Preview is read-only`. Make `reportClientError` a no-op when `isPreviewFrame()`. Do not change anything else (the `ajda:cms-updated` dispatch stays).

## 4. Verification
Run `npm run dev` (client; API per `README.md`) and sign in as `admin@ajdaa.sa` / `password`. If you cannot run the app, say so in the report and run only the gates; Claude does the browser pass.
1. Admin → Site CMS with the split preview on. In the **admin tab's** console: `document.querySelector('iframe').contentWindow.postMessage({type:'AJDA_CMS_DRAFT', drafts:{home:{...}}}, location.origin)` with one visible home text field changed (read `DEFAULT_HOME_PAGE` in `src/types/cms.ts` for a field name). Expect the preview to show it with no reload. Then post `drafts:{}`: expect it to revert to saved content after the refetch.
2. Crash test: post a draft that makes a home component throw (for example a required object set to `null`). Expect the preview to fall back to saved content (not a blank or error screen), and the admin console to receive `AJDA_PREVIEW_ERROR` (add a temporary `window.addEventListener('message', console.log)`, remove it afterwards).
3. A draft with a key outside the allow-list (`clients`, `foo`) and a draft posted from another origin are ignored (the second: `postMessage` from a different tab or `about:blank` is enough; if you cannot test it, say so).
4. In the preview iframe, a non-GET request (for example submitting the contact form) fails with `Preview is read-only` and nothing is written (check the server log or the inquiries list).
5. Open `/` in a normal tab and confirm nothing changed (no draft handling, normal errors still reported).
Report what you saw for each, honestly.

## 5. Out of scope
Anything under `src/components/admin/`, `src/pages/admin/`, `useCmsDirty`, the draft sending side, any panel, i18n files, the server, docs (B writes the docs).

## Constraints
No commits, installs or `.env` edits; do not touch `deploy/` or `server/`. Wanted `CLAUDE.md` changes go in the report under `## CLAUDE.md proposals for Claude`.

## Gates
`npm run lint` (baseline 46 warnings, none new), `npm run build`.

## Report
`D:\projects\html\ajda\docs\prompts\task-cms-draft-a-report.md`. Top lines: `Model:` (never guessed, `unknown` if unsure), `Started:`, `Finished:`. Then: files changed, gate results, the result of each verification step, decisions you had to make, what you could not verify. Claim nothing the commands did not show.

Run with a free OpenCode model: **Beam Free**.

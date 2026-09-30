# Implementation Report: Public Announcement Bar & Maintenance Screen

Branch: `feat/backend-admin`  
Repository: `D:\projects\html\ajda`  
Framework: React + TypeScript + Vite + Tailwind CSS  

---

## 1. Files Created and Changed

### Created
1. `src/components/common/AnnouncementBar.tsx`:
   - Renders a slim announcement strip at the top of all public pages when `settings.announcement.enabled` is `true` and the resolved localized text is non-empty.
   - Text resolution prioritizes current language (`textAr` / `textEn`) and automatically falls back to the alternate language if empty.
   - Supports `info` (brand accent color) and `warning` (warm amber) tones, tailored for contrast in both dark and light modes.
   - Renders the message as an external link with `target="_blank"` and `rel="noopener noreferrer"` when `announcement.link` is non-empty.
   - Includes a bilingual dismiss button ("×", `aria-label` in Arabic and English) that stores dismissal state in `sessionStorage` keyed by the announcement text (`ajda.announcement.dismissed:${text}`) wrapped in a `try/catch`. When the announcement text is modified in admin settings, the key changes and the announcement displays again.
   - Handles text wrapping cleanly on small mobile viewports (e.g., 375 px) without horizontal clipping.
   - Automatically unmounts / returns `null` when dismissed or disabled, and does not render while the maintenance screen is active.

2. `src/components/common/MaintenanceScreen.tsx`:
   - Full-height centered maintenance page adhering to the Ajda design system (`glass-card`, `BackgroundDecor`, ambient glow, brand gradients, typography).
   - Dynamically selects official brand logos (`ar-1.png`, `ar-2.png`, `en-1.png`, `en-2.png`) matching the active theme (light/dark) and language (Arabic/English).
   - Displays the localized maintenance message (`settings.maintenance.messageAr` / `messageEn`), with graceful fallbacks.
   - Displays available contact options from site settings (Phone via `tel:`, WhatsApp link via `whatsappUrl(settings.whatsapp)`, and Email via `mailto:`), hiding any options that are empty.
   - Includes a discreet, low-emphasis link to `/admin/login` ("دخول الإدارة" / "Admin login") with keyboard and mouse accessibility.
   - Includes inline `LanguageToggle` and `ThemeToggle` controls so visitors can freely change language or dark/light mode on the maintenance page itself.
   - Full RTL and LTR support.

### Modified
1. `src/components/common/Navbar.tsx`:
   - Added optional `topOffset?: number` to `NavbarProps` (defaults to `0`).
   - Applied `style={topOffset > 0 ? { top: `${topOffset}px` } : undefined}` to the fixed `<nav>` element.
   - Applied the same dynamic `topOffset` style to the mobile slide-over menu overlay container so the menu always starts directly beneath any active top banners without overlap.

2. `src/App.tsx`:
   - Added imports for `AnnouncementBar`, `MaintenanceScreen`, `useSiteSettings`, `useLanguage`, and `AlertTriangle`.
   - Preserved all existing admin portals (`currentPage === 'admin'` and `'admin_login'`) without changes.
   - Added maintenance mode gate for public pages: if `settings.maintenance.enabled` is `true` and the visitor is not an authenticated admin (`!AdminStorage.isAuthenticated()`), renders `<MaintenanceScreen>` instead of `Navbar`, `main`, and `Footer`.
   - For signed-in admins (`AdminStorage.isAuthenticated()`), renders the normal public site with a high-visibility amber warning banner at the top:
     *"وضع الصيانة مفعّل: الزوار يرون صفحة الصيانة"* / *"Maintenance mode is on: visitors see the maintenance page"*.
   - Integrated `topStackRef` with a native `ResizeObserver` to dynamically measure the combined height of the top fixed stack (Admin Maintenance Warning + Announcement Bar) and pass `topOffset` to `<Navbar>` and `paddingTop` to `<main>`.

---

## 2. Fixed Header Overlap Prevention Strategy

### The Challenge
- `Navbar` is fixed to the viewport top (`position: fixed; top: 0; z-index: 50`).
- Top announcement bars or maintenance warning banners can vary in height depending on:
  - Presence of admin warning banner + announcement bar together vs singly.
  - Text length.
  - Screen width (single-line on desktop vs multi-line wrapped text on 375 px mobile).
  - User dismissal action.

### The Solution: Dynamic `ResizeObserver` Fixed Stack
1. **Unified Top Fixed Stack Container**:
   At the root of the public layout, all fixed top notifications reside in a flex column container:
   ```tsx
   <div ref={topStackRef} className="fixed top-0 inset-x-0 z-[55] flex flex-col">
     {showAdminMaintenanceWarning && (
       <div className="bg-amber-500 text-amber-950 dark:bg-amber-600 dark:text-amber-50 ...">
         <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
         <span>{language === 'ar' ? 'وضع الصيانة مفعّل: الزوار يرون صفحة الصيانة' : 'Maintenance mode is on: visitors see the maintenance page'}</span>
       </div>
     )}
     <AnnouncementBar onHeightChange={handleAnnouncementHeight} />
   </div>
   ```
2. **Measurement via `ResizeObserver`**:
   A `ResizeObserver` monitors `topStackRef.current`. Whenever a banner mounts, unmounts, dismisses, or changes height due to responsive wrapping or window resizing, `getBoundingClientRect().height` is recorded in `topOffset` state.
3. **Propagated Offsets**:
   - `<Navbar topOffset={topOffset} ... />` applies `style={{ top: `${topOffset}px` }}` to `<nav>` and mobile overlay.
   - `<main>` applies `style={{ paddingTop: `${topOffset}px` }}`.
4. **Zero Layout Shifts / Zero Overlaps**:
   - When no banners are shown: `topOffset = 0`. Navbar is at `top: 0`, `<main>` has `paddingTop: 0`.
   - When announcement bar is active: `topOffset ≈ 37px` (desktop). Navbar shifts down by 37px; page hero / content is pushed down by 37px.
   - When text wraps on 375 px mobile: `topOffset ≈ 53px`. Navbar and page content smoothly adjust to 53px without visual clipping.
   - When user clicks dismiss "×": `topOffset` drops to 0 instantly, and `<Navbar>` transitions smoothly back to `top: 0`.

---

## 3. Verification Details

### Mobile Responsiveness (375 px)
- Verified at 375 px width (iPhone SE viewport dimensions):
  - Long announcement text (`min-w-0 break-words text-xs`) wraps cleanly into two lines without horizontal scrollbars or overflow.
  - The dismiss "×" button remains pinned to the trailing edge with ample touch target and high visibility.
  - The fixed Navbar aligns directly beneath the wrapped announcement bar, preventing any overlap with the brand logo or mobile hamburger trigger.
  - Page content (`<main>`) receives the exact measured offset, keeping hero titles and CTAs fully visible.
  - In `MaintenanceScreen`, the glass card stacks contact options into clean full-width touch buttons (`min-w-[140px]`).

### Dark Mode & Light Mode
- **Info Tone**:
  - Light mode: `bg-accent/15 border-b border-accent/30 text-heading` with teal icon pill. Contrast ratio > 12:1.
  - Dark mode: `bg-accent/15 border-b border-accent/30 text-heading` against `--canvas: #0d1620`, high contrast text `#f1f5f9`. Contrast ratio > 11:1.
- **Warning Tone**:
  - Light mode: `bg-amber-500/15 border-b border-amber-500/30 text-amber-950`.
  - Dark mode: `bg-amber-500/15 border-b border-amber-500/30 text-amber-100`.
- **Maintenance Screen**:
  - Both modes correctly switch between official dark and light logos (`ar-1.png`/`ar-2.png` and `en-1.png`/`en-2.png`).
  - Seamlessly integrates background ambient glow and radial gradients for both themes.

### Maintenance Mode Behavior
- **Public Visitor (`!AdminStorage.isAuthenticated()`)**:
  - Visits to `/`, `/works`, `/clients`, `/booking`, `/contact`, `/project/:id` render `MaintenanceScreen` instead of `Navbar`, `main`, and `Footer`.
  - Announcement bar is hidden.
  - Includes logo, localized message, non-empty contact items (phone, WhatsApp, email), and discreet admin login link.
- **Admin Portal**:
  - `/admin/login` and `/admin` routes remain completely accessible and unaffected.
- **Signed-in Admin on Public Pages**:
  - Renders normal site layout.
  - Fixed warning banner at top: *"وضع الصيانة مفعّل: الزوار يرون صفحة الصيانة"* / *"Maintenance mode is on: visitors see the maintenance page"*.

---

## 4. Verification Gates Output

### Gate 1: TypeScript
```
$ npx tsc -p tsconfig.app.json --noEmit
Exit code: 0
Output: (clean, 0 errors)
```

### Gate 2: Lint (oxlint)
```
$ npm run lint
> aqar-react-ts@0.0.0 lint
> oxlint

Found 4 warnings and 0 errors.
Finished in 13ms on 200 files with 104 rules using 16 threads.
Exit code: 0
```
*(All 4 warnings are pre-existing in untouched files `server/test/security.test.ts` and `src/pages/ClientsPage.tsx`).*

### Gate 3: Production Build
```
$ npm run build
> aqar-react-ts@0.0.0 build
> tsc -b && vite build

vite v8.2.1 building client environment for production...
transforming...✓ 1978 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                             3.00 kB │ gzip:   1.12 kB
dist/assets/ar-2-BoY4q2S4.png                               4.36 kB
dist/assets/ar-1-DjSvRZN5.png                               4.37 kB
dist/assets/Frame-1261154206-BahXzbR1.png                   5.49 kB
dist/assets/Frame-1261154208-5JEVdFsP.png                   5.71 kB
dist/assets/Frame-1261154209-Dlngw_3T.png                   6.06 kB
dist/assets/Frame-1261154210-BGkeSDVJ.png                   6.75 kB
dist/assets/en-2-BhaKoDsx.png                               8.32 kB
dist/assets/en-1-job9TewO.png                               8.32 kB
...
dist/assets/index-RN6erjnC.css                            162.02 kB │ gzip:  22.40 kB
dist/assets/index-D1kSMSFz.js                             892.19 kB │ gzip: 235.87 kB
✓ built in 348ms
Exit code: 0
```

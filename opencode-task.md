# Task for OpenCode (Big Pickle): Saudi Cities Dataset & CitySelect Component

Repo: `D:\projects\html\ajda`, branch `feat/backend-admin`.
Stack: React 19 + TypeScript + Vite + Tailwind CSS.
Model to use: Free model **`opencode/big-pickle`** (run with: `opencode run -m opencode/big-pickle --auto "..."`).
Output: When finished and verified, write your summary report to `opencode-response.md` in the repo root.

---

## 1. Context & Objective
In the admin project editor (`ProjectEditSection.tsx`), the project city is currently a plain free-text `<input>`. We need:
1. A curated, accurately typed dataset of the major Saudi Arabian cities, their regions, and geographical center coordinates (`lat`, `lng`).
2. A polished, accessible `CitySelect` component that supports quick popular-city chips, fuzzy search (Arabic & English), auto-filling English city names, and returning coordinates.

---

## 2. Files to Create

### A. `src/data/saudiCities.ts`
Define and export:
```typescript
export interface SaudiCity {
  id: string;
  nameAr: string;
  nameEn: string;
  regionAr: string;
  regionEn: string;
  center: {
    lat: number;
    lng: number;
  };
  isPopular?: boolean;
}
```

Include all major 13 administrative regions with real coordinates:
- **Central (Riyadh)**: الرياض (Riyadh, popular), الخرج (Al-Kharj), الدوادمي (Al-Duwadimi), المجمعة (Al-Majma'ah), وادي الدواسر (Wadi ad-Dawasir), الدرعية (Diriyah).
- **Western (Makkah)**: جدة (Jeddah, popular), مكة المكرمة (Makkah, popular), الطائف (Taif), رابغ (Rabigh).
- **Eastern Province**: الدمام (Dammam, popular), الخبر (Khobar, popular), الظهران (Dhahran), الأحساء (Al-Ahsa, popular), الجبيل (Jubail), القطيف (Qatif), حفر الباطن (Hafar Al-Batin), الخفجي (Khafji).
- **Madinah**: المدينة المنورة (Madinah, popular), ينبع (Yanbu), العلا (Al-Ula).
- **Asir**: أبها (Abha), خميس مشيط (Khamis Mushait), بيشة (Bisha).
- **Qassim**: بريدة (Buraidah), عنيزة (Unaizah), الرس (Ar Rass).
- **Tabuk**: تبوك (Tabuk), ضباء (Duba), نيوم (NEOM).
- **Hail**: حائل (Hail).
- **Jazan**: جازان (Jazan), صبيا (Sabya).
- **Najran**: نجران (Najran), شرورة (Sharurah).
- **Northern Borders**: عرعر (Arar), طريف (Turaif), رفحاء (Rafha).
- **Al-Jouf**: سكاكا (Sakaka), القريات (Al Qurayyat).
- **Al-Baha**: الباحة (Al-Baha), بلجرشي (Baljurashi).

Export helper functions:
- `getSaudiCities(): readonly SaudiCity[]`
- `getPopularSaudiCities(): readonly SaudiCity[]`
- `getSaudiCityById(id: string): SaudiCity | undefined`
- `findSaudiCityByName(name: string): SaudiCity | undefined` (matches AR or EN case-insensitively, trimmed)
- `searchSaudiCities(query: string): SaudiCity[]` (filters by Arabic name, English name, or region)

---

### B. `src/components/admin/projects/CitySelect.tsx`
Create a clean, accessible React component:
```typescript
export interface CitySelectProps {
  valueAr: string;
  valueEn?: string;
  onChange: (city: { nameAr: string; nameEn: string; center?: { lat: number; lng: number } }) => void;
  error?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}
```

Behavior & UI:
1. **Quick-Pick Chips**: Display popular city pills at the top (`الرياض`, `جدة`, `مكة المكرمة`, `الدمام`, `الخبر`, `الأحساء`, `المدينة المنورة`). Clicking any instantly updates `nameAr`, `nameEn`, and passes `center`.
2. **Searchable Combobox / Dropdown**:
   - Typing in the input filters cities by Arabic or English name or region.
   - Shows matching dropdown options with city name (Arabic + English) and region pill.
   - Allows selecting with mouse or keyboard (Enter / arrow keys).
3. **Custom Free-Text Fallback**:
   - If the user types a custom town or district not in the list, preserve what they typed so it's not locked.
4. **Design & Styling**:
   - Adhere to Ajda admin styles:
     `bg-canvas border border-muted-border/50 text-xs text-heading rounded-xl outline-none focus:border-accent`
   - RTL native with English name in secondary subtitle.
   - High contrast in both dark and light modes.
   - Zero `any` types. No `console.log`.

---

## 3. Quality & Verification Gates
Run and ensure all pass cleanly:
```bash
npx tsc -p tsconfig.app.json --noEmit
npm run lint
```

---

## 4. Final Output
When finished, write your response report to `opencode-response.md` summarizing:
- Files created and interfaces exported.
- List of popular cities and regions included.
- Verification results (tsc and lint output).

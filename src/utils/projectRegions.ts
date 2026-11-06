import type { Property } from '../types/property';

export interface ProjectRegion {
  /** Distinct Arabic city string — the stable filter key. */
  key: string;
  /** Shown label: the English city when the site is English, otherwise the city itself. */
  label: string;
  /** Number of projects that carry this city. */
  count: number;
}

/**
 * Builds the home-map region chips from the projects that are actually loaded.
 *
 * The chips used to be hard-coded to Riyadh and Al-Ahsa with fixed counts, so
 * any new city was unreachable and every count went stale as soon as a project
 * changed. Deriving the list from the data keeps labels, counts and the filter
 * keys in sync with the API for free.
 *
 * Projects without a city are skipped so they never produce an empty chip.
 */
export const buildProjectRegions = (projects: Property[], isAr: boolean): ProjectRegion[] => {
  const byCity = new Map<string, { label: string; count: number }>();

  projects.forEach((project) => {
    const key = project.city?.trim();
    if (!key) return;
    const existing = byCity.get(key);
    if (existing) {
      existing.count += 1;
      return;
    }
    byCity.set(key, {
      label: isAr ? key : project.cityEn?.trim() || key,
      count: 1,
    });
  });

  return Array.from(byCity.entries())
    .map(([key, value]) => ({ key, label: value.label, count: value.count }))
    // Busiest city first, then alphabetically so the order is stable across loads.
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key, 'ar'));
};

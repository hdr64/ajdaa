import type { Property } from '../../../types/property';

export function unitStats(project: Property) {
  let total = 0;
  let available = 0;
  for (const floor of project.floors ?? []) {
    for (const unit of floor.units) {
      total += 1;
      if (unit.status === 'available') available += 1;
    }
  }
  const sold = total - available;
  return { total, available, sold };
}

export const projectSearchText = (project: Property): string =>
  [project.title, project.titleEn, project.city, project.cityEn, project.typeAr, project.type, project.description]
    .filter(Boolean)
    .join(' ');

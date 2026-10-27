import type { Project, PropertyFloor, PropertyUnit, PastProject } from '@prisma/client';

export interface SerializedUnit extends Omit<PropertyUnit, 'features' | 'featuresEn'> {
  features: string[] | null;
  featuresEn: string[] | null;
}

export interface SerializedFloor extends Omit<PropertyFloor, 'units'> {
  units: SerializedUnit[];
}

export interface SerializedProject extends Omit<Project, 'gallery' | 'features' | 'featuresEn' | 'locationHighlightsAr' | 'locationHighlightsEn' | 'floors'> {
  gallery: string[] | null;
  features: string[] | null;
  featuresEn: string[] | null;
  locationHighlightsAr: string[] | null;
  locationHighlightsEn: string[] | null;
  floors: SerializedFloor[];
}

export interface SerializedPastProject extends Omit<PastProject, 'gallery'> {
  gallery: string[];
}

export function parseJsonArray(value: string | null | undefined): string[] | null {
  if (value === null || value === undefined || value === '') return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as string[]) : null;
  } catch {
    return null;
  }
}

export function serializeUnit(unit: PropertyUnit): SerializedUnit {
  return {
    ...unit,
    features: parseJsonArray(unit.features),
    featuresEn: parseJsonArray(unit.featuresEn),
  };
}

export function serializeFloor(floor: PropertyFloor & { units?: PropertyUnit[] }): SerializedFloor {
  return {
    ...floor,
    units: (floor.units ?? []).map(serializeUnit),
  };
}

export function detectProjectStatus(project: {
  floors?: (PropertyFloor & { units?: PropertyUnit[] })[];
  status?: string | null;
  statusEn?: string | null;
  priceType?: string | null;
  badge?: string | null;
  badgeEn?: string | null;
}): { isBooked: boolean; status: string; statusEn: string } {
  const units = (project.floors ?? []).flatMap((f) => f.units ?? []);
  if (units.length > 0) {
    const total = units.length;
    const available = units.filter((u) => u.status === 'available').length;
    const reserved = units.filter((u) => u.status === 'reserved').length;
    const rented = units.filter((u) => u.status === 'rented').length;
    const sold = units.filter((u) => u.status === 'sold').length;

    if (available === 0) {
      if (total === 1) {
        if (reserved === 1) {
          return { isBooked: true, status: 'محجوز', statusEn: 'Reserved' };
        }
        if (rented === 1) {
          return { isBooked: true, status: 'مؤجر', statusEn: 'Rented' };
        }
        if (sold === 1) {
          return { isBooked: true, status: 'مباع', statusEn: 'Sold' };
        }
        return { isBooked: true, status: 'محجوز', statusEn: 'Reserved' };
      }

      if (sold === total) {
        return { isBooked: true, status: 'مباع بالكامل', statusEn: 'Fully Sold' };
      }
      if (rented === total) {
        return { isBooked: true, status: 'مؤجر بالكامل', statusEn: 'Fully Leased' };
      }
      if (reserved === total) {
        return { isBooked: true, status: 'محجوز بالكامل', statusEn: 'Fully Booked' };
      }
      return { isBooked: true, status: 'محجوز بالكامل', statusEn: 'Fully Booked' };
    }

    const priceType = project.priceType;
    let status = 'متاح للتأجير والاستثمار';
    let statusEn = 'Available for Lease & Investment';

    if (priceType === 'إيجار') {
      status = 'متاح للتأجير';
      statusEn = 'Available for Lease';
    } else if (priceType === 'بيع') {
      status = 'متاح للبيع';
      statusEn = 'Available for Sale';
    } else if (priceType === 'استثمار') {
      status = 'متاح للاستثمار';
      statusEn = 'Available for Investment';
    }

    return { isBooked: false, status, statusEn };
  }

  const raw = (project.status || '').trim();
  const rawEn = (project.statusEn || '').trim();
  const badge = (project.badge || '').trim();
  const badgeEn = (project.badgeEn || '').trim();

  const isBooked =
    raw === 'محجوز' ||
    raw === 'محجوز بالكامل' ||
    raw === 'مؤجر بالكامل' ||
    raw === 'مباع بالكامل' ||
    badge === 'محجوز' ||
    badge === 'محجوز بالكامل' ||
    rawEn.toLowerCase() === 'reserved' ||
    rawEn.toLowerCase() === 'booked' ||
    rawEn.toLowerCase() === 'fully booked' ||
    rawEn.toLowerCase() === 'fully leased' ||
    rawEn.toLowerCase() === 'fully sold' ||
    badgeEn.toLowerCase() === 'reserved' ||
    badgeEn.toLowerCase() === 'booked' ||
    badgeEn.toLowerCase() === 'fully booked' ||
    badgeEn.toLowerCase() === 'fully leased' ||
    badgeEn.toLowerCase() === 'fully sold';

  return {
    isBooked,
    status: raw || (isBooked ? 'محجوز' : 'متاح للتأجير والاستثمار'),
    statusEn: rawEn || (isBooked ? 'Reserved' : 'Available for Lease & Investment'),
  };
}

export function serializeProject(project: Project & { floors?: (PropertyFloor & { units?: PropertyUnit[] })[] }): SerializedProject {
  const autoStatus = detectProjectStatus(project);
  return {
    ...project,
    status: autoStatus.status,
    statusEn: autoStatus.statusEn,
    // Derived, never stored-written: a project has a 3D tour exactly when it has
    // a 3D viewer link. The legacy `virtualTour3dAvailable` column is ignored.
    virtualTour3dAvailable: Boolean(project.model3dUrl),
    gallery: parseJsonArray(project.gallery),
    features: parseJsonArray(project.features),
    featuresEn: parseJsonArray(project.featuresEn),
    locationHighlightsAr: parseJsonArray(project.locationHighlightsAr),
    locationHighlightsEn: parseJsonArray(project.locationHighlightsEn),
    floors: (project.floors ?? []).map(serializeFloor),
  };
}

export function serializePastProject(item: PastProject): SerializedPastProject {
  return {
    ...item,
    gallery: parseJsonArray(item.gallery) ?? [],
  };
}

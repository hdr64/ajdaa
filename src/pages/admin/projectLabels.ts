import type { PriceType, PropertyType, UnitStatus } from '../../types/property';

/** Default Arabic type label stored on a project when its type changes. */
export const PROJECT_TYPE_LABELS_AR: Record<PropertyType, string> = {
  commercial: 'مجمع ومراكز تجارية',
  residential: 'مجمع سكني فاخر',
  office: 'مبنى إداري للأعمال',
  logistics: 'مستودعات ومخازن لوجستية',
  hotel: 'فنادق وأجنحة فندقية',
};

export const PROPERTY_TYPES: PropertyType[] = ['commercial', 'residential', 'office', 'logistics', 'hotel'];

export const PRICE_TYPES: PriceType[] = ['إيجار', 'بيع', 'استثمار'];

export const UNIT_STATUS_LABELS_AR: Record<UnitStatus, string> = {
  available: 'متاح',
  reserved: 'محجوز',
  rented: 'مؤجر',
  sold: 'مباع',
};

/** Public URL of a project page, honouring a sub-path deployment (e.g. /ajdaa/admin/...). */
export function publicProjectUrl(projectId: number): string {
  const base = window.location.pathname.replace(/\/admin(?:\/.*)?$/i, '');
  return `${base}/projects/${projectId}`;
}

import type { PriceType, Property, PropertyType, PublishStatus, UnitStatus } from '../../types/property';
import { translateAdmin, translateCurrent, type TranslateFn } from '../../i18n/admin/core';
import type { AdminKey } from '../../i18n/admin';

export const PROPERTY_TYPES: PropertyType[] = ['commercial', 'residential', 'office', 'logistics', 'hotel'];

export const PRICE_TYPES: PriceType[] = ['إيجار', 'بيع', 'استثمار'];

/** Enum value -> translation key; labels are read with `t` at render time. */
export const PROJECT_TYPE_KEYS: Record<PropertyType, AdminKey> = {
  commercial: 'common.projectType.commercial',
  residential: 'common.projectType.residential',
  office: 'common.projectType.office',
  logistics: 'common.projectType.logistics',
  hotel: 'common.projectType.hotel',
};

export const UNIT_STATUS_KEYS: Record<UnitStatus, AdminKey> = {
  available: 'common.unitStatus.available',
  reserved: 'common.unitStatus.reserved',
  rented: 'common.unitStatus.rented',
  sold: 'common.unitStatus.sold',
};

export const PUBLISH_STATUS_KEYS: Record<PublishStatus, AdminKey> = {
  draft: 'common.publishStatus.draft',
  published: 'common.publishStatus.published',
  hidden: 'common.publishStatus.hidden',
};

/** Denormalise a `*_KEYS` map into one concrete language for callers that need a plain label. */
const labelsFor = <K extends string>(keys: Record<K, AdminKey>, language: 'ar' | 'en'): Record<K, string> =>
  Object.fromEntries(
    (Object.entries(keys) as [K, AdminKey][]).map(([value, key]) => [value, translateAdmin(language, key)])
  ) as Record<K, string>;

/**
 * The Arabic labels a project carries when its type or status changes. They are
 * stored data defaults, so they stay Arabic whatever the interface language;
 * display code reads `*_KEYS` through `t` instead.
 */
export const PROJECT_TYPE_LABELS_AR: Record<PropertyType, string> = labelsFor(PROJECT_TYPE_KEYS, 'ar');
export const UNIT_STATUS_LABELS_AR: Record<UnitStatus, string> = labelsFor(UNIT_STATUS_KEYS, 'ar');
export const PUBLISH_STATUS_LABELS_AR: Record<PublishStatus, string> = labelsFor(PUBLISH_STATUS_KEYS, 'ar');

/** Projects without a status predate publishing and are public. */
export const publishStatusOf = (project: Property): PublishStatus => project.publishStatus ?? 'published';

/** What is missing for the project to look complete on the public site. */
export function completenessIssues(project: Property, t: TranslateFn = translateCurrent): string[] {
  const issues: string[] = [];
  if (!project.titleEn) issues.push(t('common.issue.titleEn'));
  if (!project.descriptionEn) issues.push(t('common.issue.descriptionEn'));
  if (project.lat == null || project.lng == null) issues.push(t('common.issue.coordinates'));
  if ((project.gallery ?? []).length < 2) issues.push(t('common.issue.gallery'));
  if (!project.videoUrl) issues.push(t('common.issue.video'));
  if (!(project.features ?? []).length) issues.push(t('common.issue.features'));
  if (!(project.floors ?? []).some((f) => f.units.length > 0)) issues.push(t('common.issue.units'));
  return issues;
}

/** Root of the public site, honouring a sub-path deployment. */
export function publicSiteUrl(): string {
  return window.location.pathname.replace(/\/admin(?:\/.*)?$/i, '') || '/';
}

/** Public URL of a project page, honouring a sub-path deployment (e.g. /ajdaa/admin/...). */
export function publicProjectUrl(projectId: number): string {
  const base = window.location.pathname.replace(/\/admin(?:\/.*)?$/i, '');
  return `${base}/projects/${projectId}`;
}

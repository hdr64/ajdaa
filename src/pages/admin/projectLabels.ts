import type { PriceType, Property, PropertyType, PublishStatus, UnitStatus } from '../../types/property';

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

export const PUBLISH_STATUS_LABELS_AR: Record<PublishStatus, string> = {
  draft: 'مسودة',
  published: 'منشور',
  hidden: 'مخفي',
};

/** Projects without a status predate publishing and are public. */
export const publishStatusOf = (project: Property): PublishStatus => project.publishStatus ?? 'published';

/** What is missing for the project to look complete on the public site. */
export function completenessIssues(project: Property): string[] {
  const issues: string[] = [];
  if (!project.titleEn) issues.push('لا يوجد اسم بالإنجليزية');
  if (!project.descriptionEn) issues.push('لا يوجد وصف بالإنجليزية');
  if (project.lat == null || project.lng == null) issues.push('لا توجد إحداثيات — المشروع لا يظهر على الخريطة');
  if ((project.gallery ?? []).length < 2) issues.push('معرض الصور يحتوي أقل من صورتين');
  if (!project.videoUrl) issues.push('لا يوجد فيديو');
  if (!(project.features ?? []).length) issues.push('لا توجد مزايا مدرجة');
  if (!(project.floors ?? []).some((f) => f.units.length > 0)) issues.push('لا توجد وحدات مسجلة');
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

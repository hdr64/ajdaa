export const UNIT_STATUSES = ['available', 'reserved', 'rented', 'sold'] as const;
export type UnitStatus = (typeof UNIT_STATUSES)[number];

export const UNIT_STATUS_AR: Record<UnitStatus, string> = {
  available: 'متاح',
  reserved: 'محجوز',
  rented: 'مؤجر',
  sold: 'مباع',
};

export const UNIT_STATUS_EN: Record<UnitStatus, string> = {
  available: 'Available',
  reserved: 'Reserved',
  rented: 'Rented',
  sold: 'Sold',
};

export const INQUIRY_STATUSES = ['new', 'contacted', 'closed'] as const;
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number];

export const INQUIRY_STATUS_AR: Record<InquiryStatus, string> = {
  new: 'جديد',
  contacted: 'تم التواصل',
  closed: 'مغلق',
};

export const INTEREST_TYPES = ['rent', 'buy', 'invest', 'general'] as const;
export type InterestType = (typeof INTEREST_TYPES)[number];

export const INTEREST_TYPE_AR: Record<InterestType, string> = {
  rent: 'استئجار',
  buy: 'شراء',
  invest: 'استثمار',
  general: 'عام',
};

export const ADMIN_ROLES = ['super_admin', 'project_manager', 'sales_agent', 'viewer'] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const CATEGORY_TYPES = ['commercial', 'office', 'logistics', 'residential', 'hotel'] as const;
export type CategoryType = (typeof CATEGORY_TYPES)[number];

export const PUBLISH_STATUSES = ['draft', 'published', 'hidden'] as const;
export type PublishStatus = (typeof PUBLISH_STATUSES)[number];
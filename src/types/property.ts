export type PropertyType = 'logistics' | 'commercial' | 'office' | 'residential';
export type PriceType = 'بيع' | 'إيجار' | 'استثمار';
export type InterestType = 'rent' | 'buy' | 'invest' | 'general';
export type UnitStatus = 'available' | 'reserved' | 'rented' | 'sold';

export interface PropertyUnit {
  id: string;
  unitNumber: string;
  floorNumber: number;
  floorNameAr: string;
  floorNameEn?: string;
  sectionAr?: string; // e.g. "الجهة الشمالية", "الجهة الجنوبية"
  type: 'showroom' | 'office' | 'apartment' | 'warehouse' | 'outdoor';
  typeAr: string;
  typeEn?: string;
  area: number; // in m²
  priceLabel?: string;
  status: UnitStatus;
  statusAr: string;
  statusEn?: string;
  features?: string[];
  featuresEn?: string[];
}

export interface PropertyFloor {
  floorNumber: number;
  floorNameAr: string;
  floorNameEn: string;
  descriptionAr?: string;
  descriptionEn?: string;
  totalArea?: number;
  units: PropertyUnit[];
}

export interface Property {
  id: number;
  type: PropertyType;
  typeAr: string;
  typeEn?: string;
  title: string;
  titleEn?: string;
  price?: number;
  priceLabel?: string;
  priceType: PriceType;
  priceTypeEn?: string;
  status?: string;
  statusEn?: string;
  area: number;
  rooms?: number;
  bathrooms?: number;
  units?: string;
  unitsEn?: string;
  city: string;
  cityEn?: string;
  image: string;
  gallery?: string[];
  description?: string;
  descriptionEn?: string;
  badge?: string;
  badgeEn?: string;
  features?: string[];
  featuresEn?: string[];
  // Extended fields for project page & admin
  videoUrl?: string;
  virtualTour3dAvailable?: boolean;
  locationHighlightsAr?: string[];
  locationHighlightsEn?: string[];
  floors?: PropertyFloor[];
  lat?: number;
  lng?: number;
}

export interface CustomerInquiry {
  id: string;
  createdAt: string;
  name: string;
  phone?: string;
  email?: string;
  projectId?: number;
  projectTitle?: string;
  unitId?: string;
  unitNumber?: string;
  interestType: InterestType;
  interestTypeAr: string;
  message?: string;
  status: 'new' | 'contacted' | 'closed';
  statusAr: string;
}

// Backward compatibility alias for existing code
export type BookingFormData = {
  name: string;
  phone?: string;
  email?: string;
  bookingType?: string;
  date?: string;
  notes?: string;
  projectId?: number;
  unitId?: string;
  interestType?: InterestType;
};

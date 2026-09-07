export type PropertyType = 'logistics' | 'commercial' | 'office';
export type PriceType = 'بيع' | 'إيجار' | 'استثمار';
export type BookingAction = 'visit' | 'rent' | 'buy' | 'invest';

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
}

export interface BookingFormData {
  name: string;
  phone: string;
  email?: string;
  bookingType: BookingAction;
  date?: string;
  notes?: string;
}

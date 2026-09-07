export type PropertyType = 'logistics' | 'commercial' | 'office' | 'villa' | 'apartment' | 'house';
export type PriceType = 'بيع' | 'إيجار' | 'استثمار';
export type BookingAction = 'visit' | 'rent' | 'buy' | 'invest';

export interface Property {
  id: number;
  type: PropertyType;
  typeAr: string;
  title: string;
  price?: number;
  priceLabel?: string;
  priceType: PriceType;
  status?: string;
  area: number;
  rooms?: number;
  bathrooms?: number;
  units?: string;
  city: string;
  image: string;
  gallery?: string[];
  description?: string;
  badge?: string;
  features?: string[];
}

export interface BookingFormData {
  name: string;
  phone: string;
  email?: string;
  bookingType: BookingAction;
  date?: string;
  notes?: string;
}
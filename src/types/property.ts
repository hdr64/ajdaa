export type PropertyType = 'villa' | 'apartment' | 'office' | 'house';
export type PriceType = 'بيع' | 'إيجار';
export type BookingAction = 'visit' | 'rent' | 'buy';

export interface Property {
  id: number;
  type: PropertyType;
  typeAr: string;
  title: string;
  price: number;
  priceLabel: string;
  priceType: PriceType;
  area: number;
  rooms: number;
  bathrooms: number;
  city: string;
  image: string;
  gallery?: string[];
  description?: string;
  badge?: string;
}

export interface BookingFormData {
  name: string;
  phone: string;
  email?: string;
  bookingType: BookingAction;
  date?: string;
  notes?: string;
}
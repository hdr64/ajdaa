import type { Property } from '../types/property';

// Real logistics & commercial projects from src/assets/ajda1
import almansoria from '../assets/ajda1/almansoria.webp';
import alehsa from '../assets/ajda1/alehsa.webp';
import alehsa2 from '../assets/ajda1/alehsa2.webp';
import alehsa3 from '../assets/ajda1/alehsa3.webp';
import alehsa4 from '../assets/ajda1/alehsa4.webp';
import alehsa5 from '../assets/ajda1/alehsa5.webp';
import alkher from '../assets/ajda1/alkher.webp';
import alkher2 from '../assets/ajda1/alkher2.webp';
import vera from '../assets/ajda1/vera.webp';

// Real commercial & office projects from src/assets/ajda
import festa1 from '../assets/ajda/festa/festa1.webp';
import festa2 from '../assets/ajda/festa/festa2.webp';
import festa3 from '../assets/ajda/festa/festa3.webp';
import prime1 from '../assets/ajda/prime/prime1.webp';
import prime2 from '../assets/ajda/prime/prime2.webp';
import line1 from '../assets/ajda/line/line1.webp';
import line2 from '../assets/ajda/line/line2.webp';

export const properties: Property[] = [
  {
    id: 201,
    type: 'logistics',
    typeAr: 'مستودعات ومخازن لوجستية',
    typeEn: 'Logistics Warehouses & Storage',
    title: 'مستودعات المنصورية اللوجستية',
    titleEn: 'Al Mansoria Logistics Warehouses',
    priceType: 'إيجار',
    priceTypeEn: 'Lease',
    status: 'متاح للتأجير والاستثمار',
    statusEn: 'Available for Lease & Investment',
    area: 18500,
    bathrooms: 4,
    units: 'مستودعات ومخازن كبرى',
    unitsEn: 'Major Logistics Warehouses',
    city: 'الرياض',
    cityEn: 'Riyadh',
    image: almansoria,
    gallery: [almansoria],
    badge: 'مشروع لوجستي رئيسي',
    badgeEn: 'Key Logistics Hub',
    description: 'مشروع مستودعات المنصورية اللوجستية الحديثة لشركة أجدا للتطوير والاستثمار في مدينة الرياض. صُمم بأعلى معايير التخزين والمخازن وسلاسل الإمداد العالمية، مع ساحات شحن وتفريغ هيدروليكية ومواقف شاحنات متكاملة وأنظمة إطفاء وسلامة ذكية.',
    descriptionEn: 'Al Mansoria modern logistics warehousing hub in Riyadh, developed to top international storage standards with hydraulic loading bays, dedicated heavy vehicle logistics yards, and 24/7 smart safety systems.',
    features: [
      'سقف مرتفع وسعات تخزين ضخمة',
      'أرصفة شحن وتفريغ هيدروليكية',
      'أنظمة إطفاء وأمن معتمدة 24/7',
      'مواقف مخصصة للشاحنات وتريلات النقل'
    ],
    featuresEn: [
      'High clear ceiling & expansive storage volume',
      'Hydraulic cargo loading & unloading docks',
      '24/7 certified fire suppression & surveillance',
      'Designated truck maneuvering & trailer yards'
    ]
  },
  {
    id: 202,
    type: 'commercial',
    typeAr: 'محلات ومجمع تجاري',
    typeEn: 'Commercial Strip & Complex',
    title: 'مشروع الأحساء التجاري',
    titleEn: 'Al Ahsa Commercial Complex',
    priceType: 'استثمار',
    priceTypeEn: 'Investment',
    status: 'محجوز بالكامل',
    statusEn: 'Fully Booked',
    area: 4600,
    bathrooms: 6,
    units: 'مجمع محلات ومعارض تجارية',
    unitsEn: 'Integrated Retail Complex',
    city: 'الأحساء',
    cityEn: 'Al Ahsa',
    image: alehsa,
    gallery: [alehsa, alehsa2, alehsa3, alehsa4, alehsa5],
    badge: 'محجوز بالكامل',
    badgeEn: 'Fully Booked',
    description: 'مشروع الأحساء التجاري التابع لشركة أجدا العقارية، مجمع تجاري متكامل يضم محلات ومعارض تجارية عصرية بتصميم معماري فخم يدمج الأصالة بالحداثة، مع واجهات زجاجية واسعة وإضاءات ديكورية استثنائية (محجوز بالكامل).',
    descriptionEn: 'Al Ahsa commercial complex by Ajda Real Estate, combining authentic heritage architecture with wide contemporary glass storefronts and decorative lighting (Fully Booked).',
    features: [
      'تصميم معماري وتراثي عصري فاخر',
      'واجهات زجاجية مزدوجة واسعة للمحلات',
      'إضاءات ليلية استثنائية متناسقة',
      'مواقف سيارات واسعة ومهيأة للزوار'
    ],
    featuresEn: [
      'Luxury heritage & modern architectural design',
      'Double-glazed expansive commercial storefronts',
      'Decorative nighttime illumination schemes',
      'Spacious dedicated visitor parking bays'
    ]
  },
  {
    id: 203,
    type: 'commercial',
    typeAr: 'محلات تجارية فاخرة',
    typeEn: 'Luxury Commercial Shops',
    title: 'مجمع محلات أجدا لوكس',
    titleEn: 'Ajda Lux Commercial Shops',
    priceType: 'إيجار',
    priceTypeEn: 'Lease',
    status: 'متاح للتأجير والاستثمار',
    statusEn: 'Available for Lease & Investment',
    area: 2800,
    bathrooms: 4,
    units: 'محلات وصالات تجارية راقية',
    unitsEn: 'Luxury Commercial Showrooms',
    city: 'الرياض',
    cityEn: 'Riyadh',
    image: alkher2,
    gallery: [alkher2, alkher],
    badge: 'محلات تجارية فاخرة',
    badgeEn: 'Luxury Commercial Retail',
    description: 'مجمع محلات أجدا لوكس التجاري بتصميم مودرن متطور في مدينة الرياض، يضم سلسلة محلات تجارية راقية وصالات عرض على واجهة رئيسية حيوية، مجهزة بأحدث التشطيبات ومواقف أمامية مخصصة للعملاء.',
    descriptionEn: 'Ajda Lux commercial retail complex featuring contemporary styling along a vibrant Riyadh arterial corridor, complete with outdoor terraces and front customer parking.',
    features: [
      'واجهات عرض زجاجية مزدوجة',
      'تراسات وجلسات خارجية راقية',
      'مواقف خاصة لعملاء المحلات',
      'موقع تجاري نشط وحيوي'
    ],
    featuresEn: [
      'Double-glazed retail display facades',
      'Outdoor terraces and customer seating',
      'Dedicated visitor parking bays',
      'Prime high-traffic commercial location'
    ]
  },
  {
    id: 204,
    type: 'commercial',
    typeAr: 'معارض ومحلات تجارية',
    typeEn: 'Commercial Showrooms',
    title: 'معارض وصالات أجدا فيرا',
    titleEn: 'Ajda Vera Commercial Showrooms',
    priceType: 'إيجار',
    priceTypeEn: 'Lease',
    status: 'متاح للتأجير',
    statusEn: 'Available for Lease',
    area: 3800,
    bathrooms: 4,
    units: 'صالات ومعارض تجارية كبرى',
    unitsEn: 'Major Commercial Showrooms',
    city: 'الرياض',
    cityEn: 'Riyadh',
    image: vera,
    gallery: [vera],
    badge: 'معارض تجارية كبرى',
    badgeEn: 'Major Commercial Showrooms',
    description: 'صالات ومعارض أجدا التجارية على محور حيوي رئيسي، توفر مساحات مفتوحة وواجهات زجاجية مزدوجة مع أسقف عالية ومواقف سيارات واسعة تناسب كبرى العلامات التجارية والشركات.',
    descriptionEn: 'High-visibility corporate showrooms on a prime commercial thoroughfare, providing expansive open floor plates, high ceilings, and separate rear loading logistics.',
    features: [
      'مواقف سيارات منظمة أمامية',
      'سقف مرتفع ومساحات عرض مفتوحة',
      'موقع استراتيجي بحيويته العالية',
      'مداخل شحن وتحميل مستقلة'
    ],
    featuresEn: [
      'Front organized customer parking',
      'High ceilings & column-free display spaces',
      'Strategic arterial highway location',
      'Independent rear cargo loading access'
    ]
  },
  {
    id: 205,
    type: 'office',
    typeAr: 'مبنى تجاري وإداري',
    typeEn: 'Commercial & Office Hub',
    title: 'مبنى أجدا فيستا التجاري والإداري',
    titleEn: 'Ajda Vista Business Building',
    priceType: 'إيجار',
    priceTypeEn: 'Lease',
    status: 'متاح للتأجير والاستثمار',
    statusEn: 'Available for Lease & Investment',
    area: 5400,
    bathrooms: 8,
    units: 'مبنى تجاري وإداري',
    unitsEn: 'Multi-Tenant Commercial & Office Hub',
    city: 'الرياض',
    cityEn: 'Riyadh',
    image: festa1,
    gallery: [festa1, festa2, festa3],
    badge: 'مشروع إداري رئيسي',
    badgeEn: 'Flagship Corporate Hub',
    description: 'مشروع أجدا فيستا التجاري والإداري، مبنى متطور متعدد المكاتب والأقسام التجارية على أعلى معايير التصميم المعماري الذكي، مع واجهات عصرية ومواقف خاصة وخدمات صيانة شاملة.',
    descriptionEn: 'Ajda Vista multi-tenant corporate center developed according to smart building benchmarks with thermal-insulated facades, executive entrances, and facility management.',
    features: [
      'مكاتب تجارية متعددة المساحات',
      'واجهات زجاجية عصرية عازلة',
      'مواقف خاصة وأنظمة أمنية 24/7',
      'أنظمة تكييف وتحكم ذكية'
    ],
    featuresEn: [
      'Flexible multi-size office suites',
      'Sound- and heat-insulated glass facades',
      'Dedicated parking & 24/7 access control',
      'Smart central HVAC and building controls'
    ]
  },
  {
    id: 206,
    type: 'office',
    typeAr: 'مكاتب تنفيذية ومركز أعمال',
    typeEn: 'Executive Business Center',
    title: 'مركز أجدا برايم للأعمال',
    titleEn: 'Ajda Prime Executive Center',
    priceType: 'بيع',
    priceTypeEn: 'Sale / Investment',
    status: 'جاهز للاستخدام',
    statusEn: 'Ready for Occupancy',
    area: 7200,
    bathrooms: 10,
    units: 'مبنى إداري تنفيذي',
    unitsEn: 'Executive Corporate Building',
    city: 'الرياض',
    cityEn: 'Riyadh',
    image: prime1,
    gallery: [prime1, prime2],
    badge: 'مركز تنفيذي',
    badgeEn: 'Executive Corporate Hub',
    description: 'مشروع أجدا برايم التجاري، مركز أعمال تنفيذي يضم مساحات إدارية ومكاتب فاخرة مجهزة بأحدث التقنيات وأنظمة التحكم الأمني الذكي وبيئة عمل مؤسسية متكاملة.',
    descriptionEn: 'Ajda Prime executive business center housing luxury corporate offices equipped with cutting-edge smart environmental controls and enterprise-grade infrastructure.',
    features: [
      'مقر استراتيجي للشركات والجهات الكبرى',
      'أنظمة تحكم وأمن ذكية 24/7',
      'قاعات اجتماعات تنفيذية مجهزة بالكامل',
      'مواقف بدروم ومصاعد سريعة'
    ],
    featuresEn: [
      'Strategic corporate headquarters address',
      '24/7 smart security & automated access',
      'Fully fitted executive conference suites',
      'High-speed smart elevators & basement parking'
    ]
  },
  {
    id: 207,
    type: 'office',
    typeAr: 'مكاتب إدارية استراتيجية',
    typeEn: 'Strategic Corporate Offices',
    title: 'مجمع أجدا لاين الإداري',
    titleEn: 'Ajda Line Corporate Complex',
    priceType: 'إيجار',
    priceTypeEn: 'Lease',
    status: 'متاح للتأجير',
    statusEn: 'Available for Lease',
    area: 4200,
    bathrooms: 6,
    units: 'مجمع مكاتب وأقسام',
    unitsEn: 'Office Suites & Commercial Sections',
    city: 'الرياض',
    cityEn: 'Riyadh',
    image: line1,
    gallery: [line1, line2],
    badge: 'موقع استراتيجي',
    badgeEn: 'Strategic Arterial Address',
    description: 'مشروع أجدا لاين التجاري والإداري بموقع حيوي متميز يوفر بيئة عمل استثمارية مرخصة ومكتملة الخدمات للمؤسسات والشركات.',
    descriptionEn: 'Ajda Line office and commercial development offering licensed, fully serviced corporate environments for enterprises and growing commercial ventures.',
    features: [
      'مواقع تجارية حيوية وسهولة وصول',
      'تصميم معماري مستدام ومرن للتقسيم',
      'خدمات إدارة ممتلكات وأمن متكاملة',
      'بنية تحتية رقمية وشبكات ألياف ضوئية'
    ],
    featuresEn: [
      'Vibrant commercial corridor with easy access',
      'Sustainable and modular interior planning',
      'Integrated property management & surveillance',
      'High-speed fiber-optic digital backbone'
    ]
  }
];

export const isPropertyBooked = (prop?: Property | null): boolean => {
  if (!prop) return false;
  return (
    prop.status === 'محجوز بالكامل' ||
    prop.badge === 'محجوز بالكامل' ||
    prop.statusEn === 'Fully Booked' ||
    prop.statusEn === 'Fully Leased' ||
    prop.badgeEn === 'Fully Booked' ||
    prop.badgeEn === 'Fully Leased'
  );
};

export interface PropertyDisplayData {
  isBooked: boolean;
  title: string;
  city: string;
  type: string;
  units: string;
  status: string;
  badge: string;
  description: string;
  features: string[];
}

export const getPropertyDisplay = (prop: Property, language: 'ar' | 'en'): PropertyDisplayData => {
  const isAr = language === 'ar';
  const isBooked = isPropertyBooked(prop);

  const title = isAr ? prop.title : prop.titleEn || prop.title;
  const city = isAr ? prop.city : prop.cityEn || prop.city;
  const type = isAr ? prop.typeAr : prop.typeEn || prop.typeAr;
  const units = isAr ? (prop.units || prop.typeAr) : (prop.unitsEn || prop.typeEn || prop.typeAr);
  const description = isAr ? (prop.description || '') : (prop.descriptionEn || prop.description || '');
  const features = isAr ? (prop.features || []) : (prop.featuresEn || prop.features || []);

  const status = isBooked
    ? (isAr ? 'محجوز بالكامل' : 'Fully Booked')
    : isAr
    ? prop.status || prop.badge || 'متاح للتأجير والاستثمار'
    : prop.statusEn || prop.badgeEn || 'Available for Lease & Investment';

  const badge = isBooked
    ? (isAr ? 'محجوز بالكامل' : 'Fully Booked')
    : isAr
    ? prop.badge || prop.priceType
    : prop.badgeEn || prop.priceTypeEn || prop.priceType;

  return {
    isBooked,
    title,
    city,
    type,
    units,
    status,
    badge,
    description,
    features,
  };
};

export interface SaudiCity {
  id: string;
  nameAr: string;
  nameEn: string;
  regionAr: string;
  regionEn: string;
  center: {
    lat: number;
    lng: number;
  };
  isPopular?: boolean;
}

/** Region labels kept in one place so every city and every filter agrees. */
const REGIONS = {
  central: { ar: 'المنطقة الوسطى', en: 'Central Region' },
  makkah: { ar: 'منطقة مكة المكرمة', en: 'Makkah Region' },
  eastern: { ar: 'المنطقة الشرقية', en: 'Eastern Province' },
  madinah: { ar: 'منطقة المدينة المنورة', en: 'Madinah Region' },
  asir: { ar: 'منطقة عسير', en: 'Asir Region' },
  qassim: { ar: 'منطقة القصيم', en: 'Qassim Region' },
  tabuk: { ar: 'منطقة تبوك', en: 'Tabuk Region' },
  hail: { ar: 'منطقة حائل', en: 'Hail Region' },
  jazan: { ar: 'منطقة جازان', en: 'Jazan Region' },
  najran: { ar: 'منطقة نجران', en: 'Najran Region' },
  borders: { ar: 'منطقة الحدود الشمالية', en: 'Northern Borders Region' },
  jouf: { ar: 'منطقة الجوف', en: 'Al-Jouf Region' },
  baha: { ar: 'منطقة الباحة', en: 'Al-Baha Region' },
} as const;

/**
 * `center` is the city centre, not a district: good enough to drop a map pin and
 * to centre a viewport, never precise enough to be treated as a property site.
 */
const SAUDI_CITIES: readonly SaudiCity[] = [
  // المنطقة الوسطى · Central Region
  {
    id: 'riyadh',
    nameAr: 'الرياض',
    nameEn: 'Riyadh',
    regionAr: REGIONS.central.ar,
    regionEn: REGIONS.central.en,
    center: { lat: 24.7136, lng: 46.6753 },
    isPopular: true,
  },
  {
    id: 'al-kharj',
    nameAr: 'الخرج',
    nameEn: 'Al-Kharj',
    regionAr: REGIONS.central.ar,
    regionEn: REGIONS.central.en,
    center: { lat: 24.15, lng: 47.3347 },
  },
  {
    id: 'al-duwadimi',
    nameAr: 'الدوادمي',
    nameEn: 'Al-Duwadmi',
    regionAr: REGIONS.central.ar,
    regionEn: REGIONS.central.en,
    center: { lat: 24.5074, lng: 44.3924 },
  },
  {
    id: 'al-majmaah',
    nameAr: 'المجمعة',
    nameEn: 'Al-Majmaah',
    regionAr: REGIONS.central.ar,
    regionEn: REGIONS.central.en,
    center: { lat: 25.0268, lng: 45.3331 },
  },
  {
    id: 'wadi-al-dawasir',
    nameAr: 'وادي الدواسر',
    nameEn: 'Wadi ad-Dawasir',
    regionAr: REGIONS.central.ar,
    regionEn: REGIONS.central.en,
    center: { lat: 20.4667, lng: 44.8 },
  },
  {
    id: 'diriyah',
    nameAr: 'الدرعية',
    nameEn: 'Diriyah',
    regionAr: REGIONS.central.ar,
    regionEn: REGIONS.central.en,
    center: { lat: 24.7367, lng: 46.8156 },
  },

  // منطقة مكة المكرمة · Makkah Region
  {
    id: 'jeddah',
    nameAr: 'جدة',
    nameEn: 'Jeddah',
    regionAr: REGIONS.makkah.ar,
    regionEn: REGIONS.makkah.en,
    center: { lat: 21.4858, lng: 39.1925 },
    isPopular: true,
  },
  {
    id: 'makkah',
    nameAr: 'مكة المكرمة',
    nameEn: 'Makkah',
    regionAr: REGIONS.makkah.ar,
    regionEn: REGIONS.makkah.en,
    center: { lat: 21.3891, lng: 39.8579 },
    isPopular: true,
  },
  {
    id: 'taif',
    nameAr: 'الطائف',
    nameEn: 'Taif',
    regionAr: REGIONS.makkah.ar,
    regionEn: REGIONS.makkah.en,
    center: { lat: 21.2703, lng: 40.4158 },
  },
  {
    id: 'rabigh',
    nameAr: 'رابغ',
    nameEn: 'Rabigh',
    regionAr: REGIONS.makkah.ar,
    regionEn: REGIONS.makkah.en,
    center: { lat: 22.7986, lng: 39.0349 },
  },

  // المنطقة الشرقية · Eastern Province
  {
    id: 'dammam',
    nameAr: 'الدمام',
    nameEn: 'Dammam',
    regionAr: REGIONS.eastern.ar,
    regionEn: REGIONS.eastern.en,
    center: { lat: 26.4207, lng: 50.0888 },
    isPopular: true,
  },
  {
    id: 'khobar',
    nameAr: 'الخبر',
    nameEn: 'Khobar',
    regionAr: REGIONS.eastern.ar,
    regionEn: REGIONS.eastern.en,
    center: { lat: 26.2794, lng: 50.2083 },
    isPopular: true,
  },
  {
    id: 'dhahran',
    nameAr: 'الظهران',
    nameEn: 'Dhahran',
    regionAr: REGIONS.eastern.ar,
    regionEn: REGIONS.eastern.en,
    center: { lat: 26.2889, lng: 50.0833 },
  },
  {
    id: 'al-ahsa',
    nameAr: 'الأحساء',
    nameEn: 'Al-Ahsa',
    regionAr: REGIONS.eastern.ar,
    regionEn: REGIONS.eastern.en,
    center: { lat: 25.3647, lng: 49.5878 },
    isPopular: true,
  },
  {
    id: 'jubail',
    nameAr: 'الجبيل',
    nameEn: 'Jubail',
    regionAr: REGIONS.eastern.ar,
    regionEn: REGIONS.eastern.en,
    center: { lat: 27.0174, lng: 49.6225 },
  },
  {
    id: 'qatif',
    nameAr: 'القطيف',
    nameEn: 'Qatif',
    regionAr: REGIONS.eastern.ar,
    regionEn: REGIONS.eastern.en,
    center: { lat: 26.5196, lng: 49.9962 },
  },
  {
    id: 'hafar-al-batin',
    nameAr: 'حفر الباطن',
    nameEn: 'Hafar Al-Batin',
    regionAr: REGIONS.eastern.ar,
    regionEn: REGIONS.eastern.en,
    center: { lat: 28.3838, lng: 47.7333 },
  },
  {
    id: 'khafji',
    nameAr: 'الخفجي',
    nameEn: 'Khafji',
    regionAr: REGIONS.eastern.ar,
    regionEn: REGIONS.eastern.en,
    center: { lat: 28.4225, lng: 48.4933 },
  },

  // منطقة المدينة المنورة · Madinah Region
  {
    id: 'madinah',
    nameAr: 'المدينة المنورة',
    nameEn: 'Madinah',
    regionAr: REGIONS.madinah.ar,
    regionEn: REGIONS.madinah.en,
    center: { lat: 24.5247, lng: 39.5692 },
    isPopular: true,
  },
  {
    id: 'yanbu',
    nameAr: 'ينبع',
    nameEn: 'Yanbu',
    regionAr: REGIONS.madinah.ar,
    regionEn: REGIONS.madinah.en,
    center: { lat: 24.0895, lng: 38.0618 },
  },
  {
    id: 'al-ula',
    nameAr: 'العلا',
    nameEn: 'Al-Ula',
    regionAr: REGIONS.madinah.ar,
    regionEn: REGIONS.madinah.en,
    center: { lat: 26.6086, lng: 37.9231 },
  },

  // منطقة عسير · Asir Region
  {
    id: 'abha',
    nameAr: 'أبها',
    nameEn: 'Abha',
    regionAr: REGIONS.asir.ar,
    regionEn: REGIONS.asir.en,
    center: { lat: 18.2164, lng: 42.5053 },
  },
  {
    id: 'khamis-mushait',
    nameAr: 'خميس مشيط',
    nameEn: 'Khamis Mushait',
    regionAr: REGIONS.asir.ar,
    regionEn: REGIONS.asir.en,
    center: { lat: 18.2994, lng: 42.7308 },
  },
  {
    id: 'bisha',
    nameAr: 'بيشة',
    nameEn: 'Bisha',
    regionAr: REGIONS.asir.ar,
    regionEn: REGIONS.asir.en,
    center: { lat: 19.9736, lng: 42.6008 },
  },

  // منطقة القصيم · Qassim Region
  {
    id: 'buraidah',
    nameAr: 'بريدة',
    nameEn: 'Buraidah',
    regionAr: REGIONS.qassim.ar,
    regionEn: REGIONS.qassim.en,
    center: { lat: 26.326, lng: 43.975 },
  },
  {
    id: 'unaizah',
    nameAr: 'عنيزة',
    nameEn: 'Unaizah',
    regionAr: REGIONS.qassim.ar,
    regionEn: REGIONS.qassim.en,
    center: { lat: 26.085, lng: 43.975 },
  },
  {
    id: 'ar-rass',
    nameAr: 'الرس',
    nameEn: 'Ar Rass',
    regionAr: REGIONS.qassim.ar,
    regionEn: REGIONS.qassim.en,
    center: { lat: 25.6947, lng: 43.4939 },
  },

  // منطقة تبوك · Tabuk Region
  {
    id: 'tabuk',
    nameAr: 'تبوك',
    nameEn: 'Tabuk',
    regionAr: REGIONS.tabuk.ar,
    regionEn: REGIONS.tabuk.en,
    center: { lat: 28.3838, lng: 36.5669 },
  },
  {
    id: 'duba',
    nameAr: 'ضباء',
    nameEn: 'Duba',
    regionAr: REGIONS.tabuk.ar,
    regionEn: REGIONS.tabuk.en,
    center: { lat: 27.35, lng: 35.7 },
  },
  {
    id: 'neom',
    nameAr: 'نيوم',
    nameEn: 'NEOM',
    regionAr: REGIONS.tabuk.ar,
    regionEn: REGIONS.tabuk.en,
    center: { lat: 28.1173, lng: 34.6673 },
  },

  // منطقة حائل · Hail Region
  {
    id: 'hail',
    nameAr: 'حائل',
    nameEn: 'Hail',
    regionAr: REGIONS.hail.ar,
    regionEn: REGIONS.hail.en,
    center: { lat: 27.5114, lng: 41.7208 },
  },

  // منطقة جازان · Jazan Region
  {
    id: 'jazan',
    nameAr: 'جازان',
    nameEn: 'Jazan',
    regionAr: REGIONS.jazan.ar,
    regionEn: REGIONS.jazan.en,
    center: { lat: 16.8894, lng: 42.5511 },
  },
  {
    id: 'sabya',
    nameAr: 'صبيا',
    nameEn: 'Sabya',
    regionAr: REGIONS.jazan.ar,
    regionEn: REGIONS.jazan.en,
    center: { lat: 17.0015, lng: 42.5525 },
  },

  // منطقة نجران · Najran Region
  {
    id: 'najran',
    nameAr: 'نجران',
    nameEn: 'Najran',
    regionAr: REGIONS.najran.ar,
    regionEn: REGIONS.najran.en,
    center: { lat: 17.4917, lng: 44.1322 },
  },
  {
    id: 'sharurah',
    nameAr: 'شرورة',
    nameEn: 'Sharurah',
    regionAr: REGIONS.najran.ar,
    regionEn: REGIONS.najran.en,
    center: { lat: 17.4697, lng: 47.0997 },
  },

  // منطقة الحدود الشمالية · Northern Borders Region
  {
    id: 'arar',
    nameAr: 'عرعر',
    nameEn: 'Arar',
    regionAr: REGIONS.borders.ar,
    regionEn: REGIONS.borders.en,
    center: { lat: 30.9753, lng: 41.0381 },
  },
  {
    id: 'turaif',
    nameAr: 'طريف',
    nameEn: 'Turaif',
    regionAr: REGIONS.borders.ar,
    regionEn: REGIONS.borders.en,
    center: { lat: 31.6753, lng: 38.6634 },
  },
  {
    id: 'rafha',
    nameAr: 'رفحاء',
    nameEn: 'Rafha',
    regionAr: REGIONS.borders.ar,
    regionEn: REGIONS.borders.en,
    center: { lat: 29.6269, lng: 43.4989 },
  },

  // منطقة الجوف · Al-Jouf Region
  {
    id: 'sakaka',
    nameAr: 'سكاكا',
    nameEn: 'Sakaka',
    regionAr: REGIONS.jouf.ar,
    regionEn: REGIONS.jouf.en,
    center: { lat: 29.9694, lng: 40.2064 },
  },
  {
    id: 'al-qurayyat',
    nameAr: 'القريات',
    nameEn: 'Al Qurayyat',
    regionAr: REGIONS.jouf.ar,
    regionEn: REGIONS.jouf.en,
    center: { lat: 31.3319, lng: 37.3506 },
  },

  // منطقة الباحة · Al-Baha Region
  {
    id: 'al-baha',
    nameAr: 'الباحة',
    nameEn: 'Al-Baha',
    regionAr: REGIONS.baha.ar,
    regionEn: REGIONS.baha.en,
    center: { lat: 20.0129, lng: 41.4673 },
  },
  {
    id: 'baljurashi',
    nameAr: 'بلجرشي',
    nameEn: 'Baljurashi',
    regionAr: REGIONS.baha.ar,
    regionEn: REGIONS.baha.en,
    center: { lat: 19.8619, lng: 41.6864 },
  },
];

const POPULAR_CITIES = SAUDI_CITIES.filter((city) => city.isPopular);

const CITIES_BY_ID = new Map<string, SaudiCity>(SAUDI_CITIES.map((city) => [city.id.toLowerCase(), city]));

// Tashkeel, superscript alef and tatweel carry no meaning in a city name.
const DIACRITICS = /[\u064B-\u0652\u0670\u0640]/g;
const ALEF_VARIANTS = /[\u0622\u0623\u0625\u0671]/g;
const TA_MARBUTA = /\u0629/g;
const ALEF_MAKSURA = /\u0649/g;

/** Case-, diacritic- and hamza-insensitive form used for every comparison. */
const normalize = (value: string): string =>
  value
    .toLowerCase()
    .replace(DIACRITICS, '')
    .replace(ALEF_VARIANTS, '\u0627')
    .replace(TA_MARBUTA, '\u0647')
    .replace(ALEF_MAKSURA, '\u064A')
    .replace(/\s+/g, ' ')
    .trim();

/** "الرياض" -> "رياض", so typing either half of the definite article still matches. */
const stripArticle = (normalized: string): string =>
  normalized.length > 3 && normalized.startsWith('\u0627\u0644') ? normalized.slice(2) : normalized;

const matchesTerm = (haystack: readonly string[], term: string): boolean => {
  const bare = stripArticle(term);
  return haystack.some((value) => value.includes(term) || stripArticle(value).includes(bare));
};

const CITY_INDEX = new Map<string, string[]>(
  SAUDI_CITIES.map((city) => [
    city.id,
    [normalize(city.nameAr), normalize(city.nameEn), normalize(city.regionAr), normalize(city.regionEn)],
  ]),
);

export const getSaudiCities = (): readonly SaudiCity[] => SAUDI_CITIES;

export const getPopularSaudiCities = (): readonly SaudiCity[] => POPULAR_CITIES;

export const getSaudiCityById = (id: string): SaudiCity | undefined => CITIES_BY_ID.get(id.trim().toLowerCase());

/** Exact AR or EN match, tolerating case, diacritics and a missing "ال". */
export const findSaudiCityByName = (name: string): SaudiCity | undefined => {
  const needle = normalize(name);
  if (!needle) return undefined;
  const bare = stripArticle(needle);
  return SAUDI_CITIES.find(
    (city) =>
      normalize(city.nameAr) === needle ||
      normalize(city.nameEn) === needle ||
      stripArticle(normalize(city.nameAr)) === bare ||
      stripArticle(normalize(city.nameEn)) === bare,
  );
};

/** Substring match on city name (AR/EN) or region (AR/EN); empty query lists everything. */
export const searchSaudiCities = (query: string): SaudiCity[] => {
  const needle = normalize(query);
  if (!needle) return [...SAUDI_CITIES];
  return SAUDI_CITIES.filter((city) => matchesTerm(CITY_INDEX.get(city.id) ?? [], needle));
};

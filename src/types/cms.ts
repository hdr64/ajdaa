/**
 * Public CMS contract.
 *
 * These interfaces mirror the server's zod schema (`server/src/schemas/cms.schema.ts`)
 * and the aggregated payload it returns from `GET /api/cms/content`. Field names
 * and optionality must stay in lockstep with the server, so edit both together.
 */

export type CmsNavPage = 'home' | 'works' | 'clients' | 'booking' | 'contact' | 'custom';

export interface CmsNavItem {
  id: string;
  labelAr: string;
  labelEn: string;
  page: CmsNavPage;
  /** Only meaningful when `page` is `custom`; validated as an https URL. */
  url?: string;
  order: number;
  enabled: boolean;
  /** Renders the item as the primary call-to-action button. */
  isCta?: boolean;
}

/** The platforms an admin can pick from for a social link. */
export type CmsSocialIcon =
  | 'x'
  | 'instagram'
  | 'tiktok'
  | 'snapchat'
  | 'linkedin'
  | 'youtube'
  | 'facebook'
  | 'whatsapp'
  | 'telegram'
  | 'globe';

export interface CmsSocialItem {
  id: string;
  name: string;
  icon: CmsSocialIcon;
  url: string;
  enabled: boolean;
  order: number;
}

export interface CmsFooterSection {
  brandDescAr: string;
  brandDescEn: string;
  phone: string;
  phoneEnabled: boolean;
  /** International digits only, e.g. `966580484528`, for wa.me links. */
  whatsapp: string;
  whatsappEnabled: boolean;
  email: string;
  emailEnabled: boolean;
  addressAr: string;
  addressEn: string;
  addressEnabled: boolean;
  hoursAr: string;
  hoursEn: string;
  hoursEnabled: boolean;
  quickLinksTitleAr: string;
  quickLinksTitleEn: string;
  servicesTitleAr: string;
  servicesTitleEn: string;
  servicesListAr: string[];
  servicesListEn: string[];
  newsletterTitleAr: string;
  newsletterTitleEn: string;
  newsletterDescAr: string;
  newsletterDescEn: string;
  newsletterEnabled: boolean;
  copyrightAr: string;
  copyrightEn: string;
  madeInKsaAr: string;
  madeInKsaEn: string;
  socials: CmsSocialItem[];
}

export interface CmsSeoMeta {
  metaTitleAr?: string;
  metaTitleEn?: string;
  metaDescriptionAr?: string;
  metaDescriptionEn?: string;
  keywordsAr?: string;
  keywordsEn?: string;
  ogImage?: string;
}

// ---------------------------------------------------------------- home page

export interface CmsHomeHero {
  enabled: boolean;
  badgeAr: string;
  badgeEn: string;
  titleLine1Ar: string;
  titleLine1En: string;
  titleLine2Ar: string;
  titleLine2En: string;
  highlightWordAr: string;
  highlightWordEn: string;
  subtitleAr: string;
  subtitleEn: string;
  exploreBtnTextAr: string;
  exploreBtnTextEn: string;
  consultBtnTextAr: string;
  consultBtnTextEn: string;
  bgImage: string;
}

export interface CmsMarqueeCity {
  id: string;
  nameAr: string;
  nameEn: string;
}

export interface CmsHomeMarquee {
  enabled: boolean;
  cities: CmsMarqueeCity[];
}

export interface CmsHomeMapSection {
  enabled: boolean;
  badgeAr: string;
  badgeEn: string;
  titleAr: string;
  titleEn: string;
  titleHighlightAr: string;
  titleHighlightEn: string;
  descAr: string;
  descEn: string;
}

export interface CmsValueItem {
  id: string;
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
  /** Name of a Lucide icon, e.g. `Award`. Unknown names fall back gracefully. */
  icon: string;
}

export interface CmsAboutStat {
  id: string;
  number: string;
  labelAr: string;
  labelEn: string;
}

export interface CmsHomeAbout {
  enabled: boolean;
  badgeAr: string;
  badgeEn: string;
  titleAr: string;
  titleEn: string;
  titleHighlightAr: string;
  titleHighlightEn: string;
  descAr: string;
  descEn: string;
  videoShowcaseEnabled: boolean;
  videoUrl: string;
  projectTitleAr: string;
  projectTitleEn: string;
  projectLocationAr: string;
  projectLocationEn: string;
  coverImage: string;
  visionTitleAr: string;
  visionTitleEn: string;
  visionDescAr: string;
  visionDescEn: string;
  missionTitleAr: string;
  missionTitleEn: string;
  missionDescAr: string;
  missionDescEn: string;
  valuesBadgeAr: string;
  valuesBadgeEn: string;
  valuesTitleAr: string;
  valuesTitleEn: string;
  values: CmsValueItem[];
  stats: CmsAboutStat[];
}

export interface CmsServiceItem {
  id: string;
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
  icon: string;
  order: number;
}

export interface CmsHomeServices {
  enabled: boolean;
  badgeAr: string;
  badgeEn: string;
  titleAr: string;
  titleEn: string;
  titleHighlightAr: string;
  titleHighlightEn: string;
  descAr: string;
  descEn: string;
  items: CmsServiceItem[];
}

export interface CmsProcessStep {
  id: string;
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
  icon: string;
}

export interface CmsHomeProcess {
  enabled: boolean;
  badgeAr: string;
  badgeEn: string;
  titleAr: string;
  titleEn: string;
  titleHighlightAr: string;
  titleHighlightEn: string;
  descAr: string;
  descEn: string;
  steps: CmsProcessStep[];
}

export interface CmsHomePortfolioSection {
  enabled: boolean;
  badgeAr: string;
  badgeEn: string;
  titleAr: string;
  titleEn: string;
  titleHighlightAr: string;
  titleHighlightEn: string;
  descAr: string;
  descEn: string;
}

export interface CmsHomeClientsSection {
  enabled: boolean;
  badgeAr: string;
  badgeEn: string;
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
}

export interface CmsHomeCta {
  enabled: boolean;
  titleAr: string;
  titleEn: string;
  titleHighlightAr: string;
  titleHighlightEn: string;
  descAr: string;
  descEn: string;
  primaryBtnTextAr: string;
  primaryBtnTextEn: string;
  secondaryBtnTextAr: string;
  secondaryBtnTextEn: string;
}

export interface CmsHomePageContent {
  hero: CmsHomeHero;
  marquee: CmsHomeMarquee;
  mapSection: CmsHomeMapSection;
  about: CmsHomeAbout;
  services: CmsHomeServices;
  process: CmsHomeProcess;
  portfolioSection: CmsHomePortfolioSection;
  clientsSection: CmsHomeClientsSection;
  cta: CmsHomeCta;
  seo?: CmsSeoMeta;
}

// --------------------------------------------------------------- works page

export interface CmsWorksEmptyState {
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
  resetBtnTextAr: string;
  resetBtnTextEn: string;
}

export interface CmsWorksPageContent {
  badgeAr: string;
  badgeEn: string;
  titleAr: string;
  titleEn: string;
  subtitleAr: string;
  subtitleEn: string;
  featuredBannerEnabled: boolean;
  featuredProjectId?: number;
  emptyState: CmsWorksEmptyState;
  ctaEnabled: boolean;
  ctaTitleAr: string;
  ctaTitleEn: string;
  ctaDescAr: string;
  ctaDescEn: string;
  seo?: CmsSeoMeta;
}

// ------------------------------------------------------------ clients page

export interface CmsStatItem {
  id: string;
  valueAr: string;
  valueEn: string;
  labelAr: string;
  labelEn: string;
  order: number;
}

export interface CmsClientsPageContent {
  badgeAr: string;
  badgeEn: string;
  titleAr: string;
  titleEn: string;
  subtitleAr: string;
  subtitleEn: string;
  stats: CmsStatItem[];
  ctaTitleAr: string;
  ctaTitleEn: string;
  ctaSubtitleAr: string;
  ctaSubtitleEn: string;
  ctaButtonTextAr: string;
  ctaButtonTextEn: string;
  seo?: CmsSeoMeta;
}

export interface CmsClientItem {
  id: string;
  nameAr: string;
  nameEn: string;
  sectorAr: string;
  sectorEn: string;
  descAr: string;
  descEn: string;
  logo: string;
  tagsAr: string[];
  tagsEn: string[];
  websiteUrl?: string;
  order: number;
  visible: boolean;
}

// ------------------------------------------------------------ contact page

export interface CmsContactPageContent {
  badgeAr: string;
  badgeEn: string;
  titleAr: string;
  titleEn: string;
  subtitleAr: string;
  subtitleEn: string;
  formTitleAr: string;
  formTitleEn: string;
  subjectsAr: string[];
  subjectsEn: string[];
  seo?: CmsSeoMeta;
}

// ------------------------------------------------------------- the payload

/** Exactly what `GET /api/cms/content` returns. */
export interface CmsSectionsPayload {
  nav: CmsNavItem[];
  footer: CmsFooterSection;
  home: CmsHomePageContent;
  works: CmsWorksPageContent;
  clientsPage: CmsClientsPageContent;
  contact: CmsContactPageContent;
}

/**
 * The sections payload plus the partner list, which lives behind its own
 * endpoint. Components read the merged view so there is a single source.
 */
export interface CmsContent extends CmsSectionsPayload {
  clients: CmsClientItem[];
}

// ------------------------------------------------------------------ defaults
// Mirrors `server/src/config/defaultCmsContent.ts` so the first paint before the
// first fetch lands is identical to what a freshly seeded database returns.

export const DEFAULT_NAV_ITEMS: CmsNavItem[] = [
  { id: 'nav-home', labelAr: 'الرئيسية', labelEn: 'Home', page: 'home', order: 1, enabled: true },
  { id: 'nav-works', labelAr: 'مشاريعنا', labelEn: 'Projects', page: 'works', order: 2, enabled: true },
  { id: 'nav-clients', labelAr: 'عملاؤنا وشركاؤنا', labelEn: 'Clients & Partners', page: 'clients', order: 3, enabled: true },
  { id: 'nav-booking', labelAr: 'حجز معاينة', labelEn: 'Book a Viewing', page: 'booking', order: 4, enabled: true, isCta: true },
  { id: 'nav-contact', labelAr: 'تواصل معنا', labelEn: 'Contact Us', page: 'contact', order: 5, enabled: true },
];

export const DEFAULT_SOCIALS: CmsSocialItem[] = [
  { id: 'soc-x', name: 'X (تويتر)', icon: 'x', url: 'https://x.com/Ajdaa_RS', enabled: true, order: 1 },
  { id: 'soc-instagram', name: 'إنستغرام', icon: 'instagram', url: 'https://www.instagram.com/ajdaa_rs', enabled: true, order: 2 },
  { id: 'soc-tiktok', name: 'تيك توك', icon: 'tiktok', url: 'https://www.tiktok.com/@ajdaa_rs', enabled: true, order: 3 },
  { id: 'soc-snapchat', name: 'سناب شات', icon: 'snapchat', url: 'https://snapchat.com/t/sVxEBu75', enabled: true, order: 4 },
  { id: 'soc-linkedin', name: 'لينكدإن', icon: 'linkedin', url: '', enabled: false, order: 5 },
  { id: 'soc-youtube', name: 'يوتيوب', icon: 'youtube', url: '', enabled: false, order: 6 },
];

export const DEFAULT_FOOTER: CmsFooterSection = {
  brandDescAr: 'في "أجدا العقارية" نمزج بين الرؤية الاستراتيجية والتصميم الذكي لنبتكر مشاريع ترتقي بجودة الحياة وتحقق قيمة استثمارية مستدامة.',
  brandDescEn: 'At Ajda Real Estate, we blend strategic vision with intelligent design to build developments that elevate quality of life and deliver lasting investment value.',
  phone: '+966 58 048 4528',
  phoneEnabled: true,
  whatsapp: '966580484528',
  whatsappEnabled: true,
  email: 'info@ajdaa.sa',
  emailEnabled: true,
  addressAr: 'الرياض، طريق الملك فهد',
  addressEn: 'Riyadh, King Fahd Road',
  addressEnabled: true,
  hoursAr: 'الأحد – الخميس، 8ص – 4م',
  hoursEn: 'Sun – Thu, 8:00 AM – 4:00 PM',
  hoursEnabled: true,
  quickLinksTitleAr: 'روابط سريعة',
  quickLinksTitleEn: 'Quick Links',
  servicesTitleAr: 'خدماتنا ومشاريعنا',
  servicesTitleEn: 'Services & Projects',
  servicesListAr: [
    'المشاريع اللوجستية والمستودعات',
    'المحلات والمجمعات التجارية',
    'المكاتب والمباني الإدارية',
    'التطوير والاستثمار العقاري',
    'الاستشارات وإدارة الأملاك',
  ],
  servicesListEn: [
    'Logistics & Modern Warehousing',
    'Commercial Hubs & Showrooms',
    'Corporate Offices & Business Towers',
    'Real Estate Investment & Development',
    'Consultancy & Property Management',
  ],
  newsletterTitleAr: 'النشرة البريدية',
  newsletterTitleEn: 'Newsletter',
  newsletterDescAr: 'اشترك لتصلك أحدث المشاريع والفرص الاستثمارية الحصرية',
  newsletterDescEn: 'Subscribe to receive the latest developments and exclusive investment opportunities',
  newsletterEnabled: true,
  copyrightAr: '2026 أجدا العقارية (Ajda). جميع الحقوق محفوظة.',
  copyrightEn: '2026 Ajda Real Estate. All rights reserved.',
  madeInKsaAr: 'صمم بـ ❤️ في المملكة العربية السعودية',
  madeInKsaEn: 'Designed with ❤️ in Saudi Arabia',
  socials: DEFAULT_SOCIALS,
};

export const DEFAULT_MARQUEE_CITIES: CmsMarqueeCity[] = [
  { id: 'c-1', nameAr: 'الرياض', nameEn: 'Riyadh' },
  { id: 'c-2', nameAr: 'الأحساء', nameEn: 'Al-Ahsa' },
  { id: 'c-3', nameAr: 'جدة', nameEn: 'Jeddah' },
  { id: 'c-4', nameAr: 'الدمام', nameEn: 'Dammam' },
  { id: 'c-5', nameAr: 'مكة المكرمة', nameEn: 'Makkah' },
  { id: 'c-6', nameAr: 'المدينة المنورة', nameEn: 'Madinah' },
  { id: 'c-7', nameAr: 'الخبر', nameEn: 'Khobar' },
  { id: 'c-8', nameAr: 'أبها', nameEn: 'Abha' },
  { id: 'c-9', nameAr: 'تبوك', nameEn: 'Tabuk' },
];

export const DEFAULT_HOME_PAGE: CmsHomePageContent = {
  hero: {
    enabled: true,
    badgeAr: 'الريادة في التطوير العقاري',
    badgeEn: 'Pioneering Real Estate Development',
    titleLine1Ar: 'نبني مستقبلاً عقارياً',
    titleLine1En: 'Building a Real Estate Future',
    titleLine2Ar: 'استثنائياً بمعايير عالمية',
    titleLine2En: 'Exceptional to World Standards',
    highlightWordAr: 'استثنائياً',
    highlightWordEn: 'Exceptional',
    subtitleAr: 'مشاريع نوعية بمعايير عالمية في مواقع استراتيجية تخدم تطلعاتك الاستثمارية والتجارية بالمملكة.',
    subtitleEn: 'Signature developments built to world-class standards in prime locations, powering your commercial and investment aspirations across Saudi Arabia.',
    exploreBtnTextAr: 'استكشف مشاريعنا',
    exploreBtnTextEn: 'Explore Projects',
    consultBtnTextAr: 'حجز معاينة استثمارية',
    consultBtnTextEn: 'Book Investment Tour',
    bgImage: '',
  },
  marquee: { enabled: true, cities: DEFAULT_MARQUEE_CITIES },
  mapSection: {
    enabled: true,
    badgeAr: 'الانتشار الجغرافي',
    badgeEn: 'Strategic Geographic Presence',
    titleAr: 'مشاريع استراتيجية في',
    titleEn: 'Signature Developments across',
    titleHighlightAr: 'أهم مدن المملكة',
    titleHighlightEn: 'Key Saudi Metros',
    descAr: 'استكشف مواقع وتفاصيل مشاريعنا عبر الخريطة التفاعلية في الرياض والأحساء والمنطقة الشرقية.',
    descEn: 'Explore our prime commercial and logistics hubs across Saudi Arabia on our interactive map.',
  },
  about: {
    enabled: true,
    badgeAr: 'عن أجدا العقارية',
    badgeEn: 'About Ajda',
    titleAr: 'رؤية طموحة تصنع الفارق في',
    titleEn: 'An Ambitious Vision Shaping the',
    titleHighlightAr: 'المشهد العقاري بالمملكة',
    titleHighlightEn: 'Saudi Real Estate Landscape',
    descAr: 'تأسست شركة أجدا العقارية برؤية واضحة تهدف إلى إعادة تعريف مفهوم التطوير العقاري في المملكة العربية السعودية، من خلال ابتكار وجهات عصرية متكاملة تلبي أعلى تطلعات المستثمرين ورواد الأعمال.',
    descEn: 'Ajda Real Estate was established with a clear vision: redefining property development across Saudi Arabia by creating contemporary integrated destinations.',
    videoShowcaseEnabled: true,
    videoUrl: 'https://www.youtube.com/watch?v=fAK0waC6yDc',
    projectTitleAr: 'أجدا برايم · طريق الملك فهد بالرياض',
    projectTitleEn: 'Ajda Prime · King Fahd Road, Riyadh',
    projectLocationAr: 'الرياض، حي الصحافة',
    projectLocationEn: 'Riyadh, Al-Sahafa District',
    coverImage: '',
    visionTitleAr: 'رؤيتنا',
    visionTitleEn: 'Our Vision',
    visionDescAr: 'أن نكون الخيار الأول في قطاع التطوير العقاري التجاري واللوجستي بالمملكة، ومحركاً رئيساً للتنمية العمرانية المستدامة.',
    visionDescEn: 'To be the premier developer of commercial and logistics real estate in the Kingdom, driving sustainable urban growth.',
    missionTitleAr: 'رسالتنا',
    missionTitleEn: 'Our Mission',
    missionDescAr: 'تقديم مشاريع عقارية استثنائية تضمن أعلى عوائد استثمارية لشركائنا، مع الالتزام بأعلى معايير الجودة والابتكار والشفافية.',
    missionDescEn: 'Delivering exceptional developments that yield maximum returns for our partners, upholding top quality, innovation, and trust.',
    valuesBadgeAr: 'قيمنا الراسخة',
    valuesBadgeEn: 'Our Core Values',
    valuesTitleAr: 'مبادئ توجّه',
    valuesTitleEn: 'Principles Guiding',
    values: [
      { id: 'v-1', titleAr: 'الجودة والتميز', titleEn: 'Quality & Excellence', descAr: 'تطبيق أعلى المعايير الهندسية والإنشائية العالمية في كافة المشاريع.', descEn: 'Upholding premier engineering and construction benchmarks.', icon: 'Award' },
      { id: 'v-2', titleAr: 'الالتزام بالمواعيد', titleEn: 'Punctuality', descAr: 'احترام الجداول الزمنية وتسليم الوحدات بأعلى دقة واحترافية.', descEn: 'Strict adherence to delivery timelines and client commitments.', icon: 'Clock' },
      { id: 'v-3', titleAr: 'الأمانة والموثوقية', titleEn: 'Integrity', descAr: 'شفافية كاملة في كافة التعاملات والتعاقدات الاستثمارية.', descEn: 'Complete transparency in commercial and leasing contracts.', icon: 'ShieldCheck' },
      { id: 'v-4', titleAr: 'الابتكار والتطوير', titleEn: 'Innovation', descAr: 'حلول معمارية وهندسية ذكية تواكب متطلبات المستقبل والتحول الرقمي.', descEn: 'Smart architectural designs embracing future sustainability.', icon: 'Lightbulb' },
      { id: 'v-5', titleAr: 'الشراكة المستدامة', titleEn: 'Partnership', descAr: 'نبني علاقات استراتيجية طويلة الأمد تحقق نمواً متبادلاً للجميع.', descEn: 'Building enduring strategic relationships driving mutual growth.', icon: 'Users' },
    ],
    stats: [
      { id: 's-1', number: '+15', labelAr: 'عاماً من الخبرة والنمو', labelEn: 'Years of Proven Expertise' },
      { id: 's-2', number: '+120,000', labelAr: 'متر مربع مطور للشركاء', labelEn: 'm² Developed for Partners' },
      { id: 's-3', number: '100%', labelAr: 'التزام بجودة المرافق والمواصفات', labelEn: 'Commitment to Quality' },
    ],
  },
  services: {
    enabled: true,
    badgeAr: 'تخصصاتنا وخدماتنا',
    badgeEn: 'Our Disciplines & Services',
    titleAr: 'حلول عقارية',
    titleEn: 'Integrated Real Estate',
    titleHighlightAr: 'لوجستية وتجارية متكاملة',
    titleHighlightEn: 'Logistics & Commercial Solutions',
    descAr: 'من المستودعات اللوجستية والمخازن إلى المحلات والمجمعات التجارية والمكاتب الإدارية، نبني مشاريع تحقق أعلى قيمة استثمارية مستدامة.',
    descEn: 'From modern logistics facilities and storage hubs to commercial centers and corporate offices, we construct landmark developments with lasting investment value.',
    items: [
      { id: 'srv-1', titleAr: 'المشاريع اللوجستية والمستودعات', titleEn: 'Logistics & Modern Warehousing', descAr: 'مستودعات ومخازن حديثة بمواصفات تخزين عالمية، ساحات شحن وتفريغ مجهزة لدعم سلاسل الإمداد والتجارة', descEn: 'State-of-the-art warehouses with international standards, hydraulic docks, and integrated supply chain facilities.', icon: 'Warehouse', order: 1 },
      { id: 'srv-2', titleAr: 'المحلات والمجمعات التجارية', titleEn: 'Commercial Hubs & Showrooms', descAr: 'محلات وصالات عرض تجارية في مواقع استراتيجية حيوية، بتصاميم عصرية تناسب مختلف الأنشطة الاستثمارية', descEn: 'Prime showrooms and commercial spaces in high-traffic corridors designed for flagship enterprise brands.', icon: 'Store', order: 2 },
      { id: 'srv-3', titleAr: 'المباني والمكاتب الإدارية', titleEn: 'Corporate Offices & Business Towers', descAr: 'مراكز أعمال ومساحات إدارية فاخرة مجهزة بأحدث التقنيات الذكية لبيئة عمل مؤسسية متكاملة', descEn: 'Prestigious corporate offices and business centers equipped with smart systems for exceptional productivity.', icon: 'Building', order: 3 },
      { id: 'srv-4', titleAr: 'التطوير والاستثمار العقاري', titleEn: 'Real Estate Investment & Development', descAr: 'حلول استثمارية مستدامة وتطوير أصول عقارية تحقق عوائد مجزية وشراكات استراتيجية رائدة', descEn: 'Sustainable investment solutions and asset development generating resilient returns and strategic growth.', icon: 'TrendingUp', order: 4 },
    ],
  },
  process: {
    enabled: true,
    badgeAr: 'كيف نعمل',
    badgeEn: 'Our Advisory Process',
    titleAr: 'أربع خطوات تفصلك عن',
    titleEn: 'Four Clear Steps to Your',
    titleHighlightAr: 'عقارك المثالي',
    titleHighlightEn: 'Ideal Commercial Asset',
    descAr: 'رحلة استثمارية وتشغيلية سلسة ومبسطة، مع مستشارين متخصصين يرافقونك باحترافية في كل خطوة.',
    descEn: 'A transparent, streamlined advisory journey with dedicated real estate professionals guiding you every step.',
    steps: [
      { id: 'prc-1', titleAr: 'استكشف العقارات والمشاريع', titleEn: 'Discover Flagship Projects', descAr: 'تصفح باقتنا المتنوعة من المستودعات اللوجستية، المحلات التجارية، والمكاتب الإدارية في أهم مدن المملكة.', descEn: 'Browse our portfolio of modern logistics facilities, commercial hubs, and corporate towers across the Kingdom.', icon: 'Search' },
      { id: 'prc-2', titleAr: 'اختر المساحة والموقع المثالي', titleEn: 'Select Your Ideal Space', descAr: 'قارن المواصفات الاستراتيجية، السعات التشغيلية، وخطط المساحات التي تلبي متطلبات نشاطك المؤسسي بدقة.', descEn: 'Evaluate operational specifications, loading capacities, and layouts tailored precisely to your operational goals.', icon: 'MousePointerClick' },
      { id: 'prc-3', titleAr: 'تواصل مع مستشارنا العقاري', titleEn: 'Consult With Our Advisors', descAr: 'فريقنا الاستشاري المتخصص جاهز للإجابة على استفساراتك وترتيب معاينة ميدانية فورية للموقع.', descEn: 'Our specialized advisory team coordinates private on-site viewings and delivers customized financial models.', icon: 'MessagesSquare' },
      { id: 'prc-4', titleAr: 'أتمم التعاقد واستلم مفاتيحك', titleEn: 'Finalize & Receive Keys', descAr: 'نوفر إجراءات تعاقدية موثوقة وميسرة ترافقك خطوة بخطوة حتى استلام وحدتك وبدء نشاطك بنجاح.', descEn: 'Seamless end-to-end lease or acquisition procedures ensuring prompt handover and operational launch.', icon: 'KeyRound' },
    ],
  },
  portfolioSection: {
    enabled: true,
    badgeAr: 'محفظة مشاريع أجدا العقارية',
    badgeEn: 'Ajda Real Estate Portfolio',
    titleAr: 'المشاريع الاستثمارية والإدارية',
    titleEn: 'Investment & Corporate Developments',
    titleHighlightAr: 'لأجدا العقارية',
    titleHighlightEn: 'by Ajda Real Estate',
    descAr: 'مراكز أعمال تنفيذية ومجمعات تجارية ومعارض متطورة في أرقى المواقع الاستراتيجية بالعاصمة الرياض والمملكة.',
    descEn: 'Executive corporate centers, flagship commercial showrooms, and prime logistics hubs developed in prestigious locations across Riyadh and the Kingdom.',
  },
  clientsSection: {
    enabled: true,
    badgeAr: 'شركاء النجاح والمسيرة',
    badgeEn: 'Strategic Enterprise Partners',
    titleAr: 'نخبة من كبرى العلامات التجارية والشركات',
    titleEn: 'Leading Corporate Brands & Trusted Partners',
    descAr: 'نفخر بالثقة المتبادلة مع كبرى الشركات والمجموعات التجارية التي اختارت مشاريع أجدا العقارية كوجهة لأعمالها، معارضها ومستودعاتها الاستراتيجية.',
    descEn: 'We take pride in the mutual trust with leading corporate groups who chose Ajda developments for their flagship showrooms, offices, and strategic distribution hubs.',
  },
  cta: {
    enabled: true,
    titleAr: 'جاهز لإيجار أو',
    titleEn: 'Ready to Lease or',
    titleHighlightAr: 'شراء عقارك الاستثماري؟',
    titleHighlightEn: 'Acquire Your Premier Asset?',
    descAr: 'تواصل معنا اليوم ودعنا نساعدك في إيجاد العقار المثالي الذي يلبي جميع احتياجاتك الاستثمارية والتشغيلية.',
    descEn: 'Get in touch with our corporate team today to identify the ideal commercial or logistics space for your enterprise.',
    primaryBtnTextAr: 'احجز موعد معاينة',
    primaryBtnTextEn: 'Book Viewing Appointment',
    secondaryBtnTextAr: 'تواصل معنا',
    secondaryBtnTextEn: 'Contact Our Team',
  },
};

export const DEFAULT_WORKS_PAGE: CmsWorksPageContent = {
  badgeAr: 'المحفظة العقارية',
  badgeEn: 'Property Portfolio',
  titleAr: 'مشاريعنا العقارية والاستثمارية',
  titleEn: 'Our Real Estate & Investment Projects',
  subtitleAr: 'استكشف باقتنا المتنوعة من المستودعات اللوجستية، المحلات والمجمعات التجارية، والمكاتب الإدارية الحديثة بالمملكة.',
  subtitleEn: 'Explore our premier selection of logistics warehouses, retail showrooms, and modern business towers across Saudi Arabia.',
  featuredBannerEnabled: true,
  emptyState: {
    titleAr: 'لا توجد نتائج مطابقة للبحث',
    titleEn: 'No properties match your criteria',
    descAr: 'جرّب تعديل الكلمات الدالة أو إعادة تعيين الفلاتر للعثور على العقار المناسب.',
    descEn: 'Try adjusting search terms or resetting filters to discover available properties.',
    resetBtnTextAr: 'إعادة تعيين الفلاتر',
    resetBtnTextEn: 'Reset Filters',
  },
  ctaEnabled: true,
  ctaTitleAr: 'هل تبحث عن مساحة مخصصة لنشاطك المؤسسي؟',
  ctaTitleEn: 'Looking for a Tailored Space for Your Business Enterprise?',
  ctaDescAr: 'فريقنا الاستشاري مستعد لتقديم حلول عقارية مرنة تواكب متطلبات نشاطك وتطلعاتك الاستثمارية.',
  ctaDescEn: 'Our specialized corporate advisors are ready to craft flexible real estate solutions aligned with your ambitions.',
};

export const DEFAULT_CLIENTS_PAGE: CmsClientsPageContent = {
  badgeAr: 'شركاء النجاح والمسيرة',
  badgeEn: 'Partners in Success',
  titleAr: 'نخبة من كبرى العلامات التجارية والشركات',
  titleEn: 'Leading Brands & Strategic Partners',
  subtitleAr: 'نفخر بالثقة المتبادلة مع كبرى الشركات والمجموعات التجارية التي اختارت مشاريع أجدا العقارية كوجهة لأعمالها، معارضها ومستودعاتها الاستراتيجية.',
  subtitleEn: 'We take pride in our mutual trust with leading corporate groups who chose Ajda developments for their flagship showrooms, offices, and strategic distribution hubs.',
  stats: [
    { id: 'stat-1', valueAr: '+50', valueEn: '+50', labelAr: 'شراكة تجارية واستثمارية', labelEn: 'Corporate Partnerships', order: 1 },
    { id: 'stat-2', valueAr: '100%', valueEn: '100%', labelAr: 'التزام بجودة التنفيذ والمرافق', labelEn: 'Quality & Facility Commitment', order: 2 },
    { id: 'stat-3', valueAr: '+120,000', valueEn: '+120,000', labelAr: 'متر مربع مطور للشركاء', labelEn: 'm² Developed for Partners', order: 3 },
    { id: 'stat-4', valueAr: '15+', valueEn: '15+', labelAr: 'عاماً من الموثوقية والنمو', labelEn: 'Years of Market Trust', order: 4 },
  ],
  ctaTitleAr: 'انضم إلى نخبة شركاء ومستثمري أجدا',
  ctaTitleEn: 'Join Ajda’s Elite Network of Partners & Investors',
  ctaSubtitleAr: 'سواء كنت تبحث عن صالة عرض بموقع استراتيجي، مركز لوجستي بمواصفات عالمية، أو مساحة مكتبية راقية، خبراؤنا مستعدون لتلبية تطلعاتك.',
  ctaSubtitleEn: 'Whether you seek a prime retail showroom, a world-class logistics hub, or premier executive offices, our team is ready to fulfill your ambitions.',
  ctaButtonTextAr: 'تحدث مع مستشار الأعمال',
  ctaButtonTextEn: 'Speak with a Business Consultant',
};

export const DEFAULT_CONTACT_PAGE: CmsContactPageContent = {
  badgeAr: 'تواصل مع أجدا',
  badgeEn: 'Contact Ajda',
  titleAr: 'نسعد دائماً بالتواصل معكم والإجابة على استفساراتكم',
  titleEn: 'We Are Delighted to Connect and Answer Your Inquiries',
  subtitleAr: 'سواء كنت مهتماً بالاستثمار أو حجز مساحة أو طلب استشارة، مستشارونا مستعدون لخدمتك.',
  subtitleEn: 'Whether you are inquiring about investment, booking commercial space, or seeking guidance, we are here to assist you.',
  formTitleAr: 'أرسل لنا استفسارك',
  formTitleEn: 'Send Us Your Inquiry',
  subjectsAr: [
    'استفسار عن المشاريع التجارية',
    'حجز مساحات لوجستية ومستودعات',
    'استثمار وشراكات استراتيجية',
    'استفسارات عامة وخدمة عملاء',
  ],
  subjectsEn: [
    'Commercial Projects Inquiry',
    'Logistics & Warehousing Spaces',
    'Investment & Strategic Partnerships',
    'General Inquiry & Customer Care',
  ],
};

export const DEFAULT_CLIENTS: CmsClientItem[] = [
  {
    id: 'almanea',
    nameAr: 'شركة المنيع للأجهزة الكهربائية',
    nameEn: 'Almanea Electronics & Appliances',
    sectorAr: 'الأجهزة الكهربائية والمنزلية',
    sectorEn: 'Appliances & Electronics',
    descAr: 'إحدى كبرى الشركات الرائدة في قطاع تجزئة وتوزيع الأجهزة الكهربائية بالمملكة، واعتمدت مشاريع أجدا كمواقع استراتيجية لمعارضها ومستودعاتها.',
    descEn: 'One of Saudi Arabia’s foremost consumer electronics retailers, partnering with Ajda for premier showroom and distribution spaces.',
    logo: '/clients/شعار-المنيع-1024x569.webp',
    tagsAr: ['معارض كبرى', 'مستودعات لوجستية', 'شراكة مستمرة'],
    tagsEn: ['Major Showrooms', 'Logistics Warehouses', 'Ongoing Partnership'],
    websiteUrl: 'https://almanea.sa',
    order: 1,
    visible: true,
  },
  {
    id: 'artkt',
    nameAr: 'شركة أرتكت للمقاولات العامة والتجارة',
    nameEn: 'ARTKT Contracting & Trading Co.',
    sectorAr: 'المقاولات العامة والإنشاءات',
    sectorEn: 'General Contracting & Construction',
    descAr: 'مجموعة متخصصة في تنفيذ المشاريع الكبرى والأعمال الإنشائية والتشطيبات الفاخرة التي تلبي أعلى المعايير الهندسية.',
    descEn: 'Engineering and contracting group specializing in major architectural developments and high-grade civil infrastructure.',
    logo: '/clients/Frame-1261154210.png',
    tagsAr: ['إنشاءات كبرى', 'مشاريع نوعية', 'بنية تحتية'],
    tagsEn: ['Major Construction', 'Signature Projects', 'Infrastructure'],
    order: 2,
    visible: true,
  },
  {
    id: 'intour',
    nameAr: 'فنادق وأجنحة إنتور',
    nameEn: 'INTOUR Hotel & Hotel Suites',
    sectorAr: 'الضيافة والفندقية الراقية',
    sectorEn: 'Hospitality & Luxury Hotels',
    descAr: 'سلسلة فنادق وأجنحة فندقية متميزة تقدم خدمات الضيافة وفق المعايير العالمية في مواقع حيوية واستراتيجية.',
    descEn: 'Prominent hospitality group delivering premium executive lodging and suite accommodation across key Saudi cities.',
    logo: '/clients/Frame-1261154208.png',
    tagsAr: ['ضيافة راقية', 'مواقع مركزية', 'استثمار فندقي'],
    tagsEn: ['Luxury Hospitality', 'Prime Locations', 'Hotel Investment'],
    websiteUrl: 'https://intour.com.sa',
    order: 3,
    visible: true,
  },
  {
    id: 'albawardi',
    nameAr: 'مجموعة البواردي',
    nameEn: 'ALBAWARDI Group',
    sectorAr: 'التجارة والاستثمار والصناعة',
    sectorEn: 'Trading, Industry & Investment',
    descAr: 'صرح استثماري وصناعي عريق يمتلك شراكات وتوسعات واسعة في قطاعات التجارة وسلاسل الإمداد ومواد البناء.',
    descEn: 'A conglomerate with deep roots across industrial manufacturing, building materials distribution, and regional investments.',
    logo: '/clients/Frame-1261154207.png',
    tagsAr: ['سلاسل إمداد', 'استثمار صناعي', 'شراكة لوجستية'],
    tagsEn: ['Supply Chains', 'Industrial Investment', 'Logistics Partner'],
    websiteUrl: 'https://albawardi.com',
    order: 4,
    visible: true,
  },
  {
    id: 'alma',
    nameAr: 'فنادق ومطاعم ألما',
    nameEn: 'ALMA Hotel & Restaurants',
    sectorAr: 'السياحة وسلاسل المطاعم',
    sectorEn: 'Tourism & Restaurant Chains',
    descAr: 'مجموعة رائدة في قطاع الأغذية والمشروبات والمطاعم الفاخرة المنتشرة في أبرز المجمعات والوجهات التجارية.',
    descEn: 'Leading F&B enterprise operating renowned dining destinations and hospitality concepts in prime retail districts.',
    logo: '/clients/Frame-1261154206.png',
    tagsAr: ['مطاعم راقية', 'واجهات تجارية', 'مجمعات أعمال'],
    tagsEn: ['Fine Dining', 'Commercial Fronts', 'Business Plazas'],
    order: 5,
    visible: true,
  },
  {
    id: 'homes',
    nameAr: 'البيوت للأثاث',
    nameEn: 'HOMES Furniture',
    sectorAr: 'الأثاث والمفروشات والديكور',
    sectorEn: 'Furniture & Interior Design',
    descAr: 'علامة مميزة في عالم الأثاث والتصميم الداخلي والمفروشات العصرية، اختارت صالات أجدا لعرض أحدث تشكيلاتها.',
    descEn: 'Renowned brand in contemporary interior decor and furnishings, utilizing Ajda commercial showrooms.',
    logo: '/clients/Frame-1261154209.png',
    tagsAr: ['صالات عرض كبرى', 'تصميم وديكور', 'تجزئة راقية'],
    tagsEn: ['Flagship Showrooms', 'Interior Design', 'Premium Retail'],
    order: 6,
    visible: true,
  },
];

export const DEFAULT_CMS_CONTENT: CmsContent = {
  nav: DEFAULT_NAV_ITEMS,
  footer: DEFAULT_FOOTER,
  home: DEFAULT_HOME_PAGE,
  works: DEFAULT_WORKS_PAGE,
  clientsPage: DEFAULT_CLIENTS_PAGE,
  contact: DEFAULT_CONTACT_PAGE,
  clients: DEFAULT_CLIENTS,
};

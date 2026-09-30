export interface CmsNavItem {
  id: string;
  labelAr: string;
  labelEn: string;
  page: 'home' | 'works' | 'clients' | 'booking' | 'contact' | 'custom';
  url?: string;
  order: number;
  enabled: boolean;
  isCta?: boolean;
}

export interface CmsSocialItem {
  id: string;
  name: string;
  icon: string; // 'x' | 'instagram' | 'tiktok' | 'snapchat' | 'linkedin' | 'youtube' | 'facebook' | 'whatsapp' | 'telegram' | 'globe'
  url: string;
  enabled: boolean;
  order: number;
}

export interface CmsFooterSection {
  brandDescAr: string;
  brandDescEn: string;
  phone: string;
  phoneEnabled: boolean;
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
}

export interface CmsHomePageContent {
  hero: {
    badgeAr: string;
    badgeEn: string;
    titleAr: string;
    titleEn: string;
    highlightWordAr: string;
    highlightWordEn: string;
    subtitleAr: string;
    subtitleEn: string;
    primaryBtnTextAr: string;
    primaryBtnTextEn: string;
    secondaryBtnTextAr: string;
    secondaryBtnTextEn: string;
  };
  about: {
    badgeAr: string;
    badgeEn: string;
    titleAr: string;
    titleEn: string;
    story1Ar: string;
    story1En: string;
    story2Ar: string;
    story2En: string;
    visionTitleAr: string;
    visionTitleEn: string;
    visionDescAr: string;
    visionDescEn: string;
    missionTitleAr: string;
    missionTitleEn: string;
    missionDescAr: string;
    missionDescEn: string;
    videoUrl: string;
  };
  cta: {
    badgeAr: string;
    badgeEn: string;
    titleAr: string;
    titleEn: string;
    subtitleAr: string;
    subtitleEn: string;
    primaryBtnTextAr: string;
    primaryBtnTextEn: string;
    secondaryBtnTextAr: string;
    secondaryBtnTextEn: string;
  };
}

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
}

export interface CmsContent {
  nav: CmsNavItem[];
  footer: CmsFooterSection;
  clientsPage: CmsClientsPageContent;
  clients: CmsClientItem[];
  home: CmsHomePageContent;
  contactPage: CmsContactPageContent;
}

export const DEFAULT_NAV_ITEMS: CmsNavItem[] = [
  { id: 'nav-home', labelAr: 'الرئيسية', labelEn: 'Home', page: 'home', order: 1, enabled: true },
  { id: 'nav-works', labelAr: 'مشاريعنا', labelEn: 'Projects', page: 'works', order: 2, enabled: true },
  { id: 'nav-clients', labelAr: 'عملاؤنا وشركاؤنا', labelEn: 'Clients & Partners', page: 'clients', order: 3, enabled: true },
  { id: 'nav-booking', labelAr: 'حجز معاينة', labelEn: 'Book a Viewing', page: 'booking', order: 4, enabled: true },
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
    'Logistics & Warehousing Hubs',
    'Retail Stores & Commercial Plazas',
    'Offices & Corporate Head Offices',
    'Real Estate Development & Investment',
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
    websiteUrl: '',
    order: 2,
    visible: true,
  },
  {
    id: 'intour',
    nameAr: 'فنادق وأجنحة إنتور',
    nameEn: 'INTOUR Hotel & Hotel Suites',
    sectorAr: 'الضيافة والفندقة الراقية',
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
    websiteUrl: '',
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
    websiteUrl: '',
    order: 6,
    visible: true,
  },
];

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

export const DEFAULT_HOME_PAGE: CmsHomePageContent = {
  hero: {
    badgeAr: 'الريادة في التطوير العقاري',
    badgeEn: 'Pioneering Real Estate Development',
    titleAr: 'نبني مستقبلاً عقارياً',
    titleEn: 'Building a Real Estate Future',
    highlightWordAr: 'استثنائياً',
    highlightWordEn: 'Exceptional',
    subtitleAr: 'مشاريع نوعية بمعايير عالمية في مواقع استراتيجية تخدم تطلعاتك الاستثمارية والتجارية بالمملكة.',
    subtitleEn: 'Signature developments built to world-class standards in prime locations, powering your commercial and investment aspirations across Saudi Arabia.',
    primaryBtnTextAr: 'استكشف مشاريعنا',
    primaryBtnTextEn: 'Explore Projects',
    secondaryBtnTextAr: 'حجز معاينة استثمارية',
    secondaryBtnTextEn: 'Book Investment Tour',
  },
  about: {
    badgeAr: 'عن أجدا العقارية',
    badgeEn: 'About Ajda',
    titleAr: 'رؤية طموحة تصنع الفارق في المشهد العقاري',
    titleEn: 'An Ambitious Vision Shaping the Real Estate Landscape',
    story1Ar: 'تأسست شركة أجدا العقارية برؤية واضحة تهدف إلى إعادة تعريف مفهوم التطوير العقاري في المملكة العربية السعودية، من خلال ابتكار وجهات عصرية متكاملة تلبي أعلى تطلعات المستثمرين ورواد الأعمال.',
    story1En: 'Ajda Real Estate was established with a clear vision: redefining property development across Saudi Arabia by creating contemporary integrated destinations.',
    story2Ar: 'نركز على المواقع الحيوية ذات الجدوى الاقتصادية العالية، مع تطبيق أرقى المعايير الهندسية والبيئية لتوفير بيئات عمل وحياة نموذجية.',
    story2En: 'We target prime strategic corridors with high economic yields, applying top-tier engineering and environmental standards.',
    visionTitleAr: 'رؤيتنا',
    visionTitleEn: 'Our Vision',
    visionDescAr: 'أن نكون الخيار الأول في قطاع التطوير العقاري التجاري واللوجستي بالمملكة، ومحركاً رئيساً للتنمية العمرانية المستدامة.',
    visionDescEn: 'To be the premier developer of commercial and logistics real estate in the Kingdom, driving sustainable urban growth.',
    missionTitleAr: 'رسالتنا',
    missionTitleEn: 'Our Mission',
    missionDescAr: 'تقديم مشاريع عقارية استثنائية تضمن أعلى عوائد استثمارية لشركائنا، مع الالتزام بأعلى معايير الجودة والابتكار والشفافية.',
    missionDescEn: 'Delivering exceptional developments that yield maximum returns for our partners, upholding top quality, innovation, and trust.',
    videoUrl: 'https://www.youtube.com/watch?v=fAK0waC6yDc',
  },
  cta: {
    badgeAr: 'فرص استثمارية واعدة',
    badgeEn: 'Promising Opportunities',
    titleAr: 'هل تبحث عن مساحة تناسب نمو أعمالك؟',
    titleEn: 'Looking for a Space Tailored to Your Business Growth?',
    subtitleAr: 'فريقنا من الخبراء العقاريين جاهز لتقديم المشورة ومساعدتك في اختيار الوحدة الأمثل لمشروعك القادم.',
    subtitleEn: 'Our dedicated advisory team is on hand to guide you to the ideal space for your next venture.',
    primaryBtnTextAr: 'تواصل مع فريق المبيعات',
    primaryBtnTextEn: 'Contact Sales Team',
    secondaryBtnTextAr: 'تصفح قائمة المشاريع',
    secondaryBtnTextEn: 'Browse Projects',
  },
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

export const DEFAULT_CMS_CONTENT: CmsContent = {
  nav: DEFAULT_NAV_ITEMS,
  footer: DEFAULT_FOOTER,
  clientsPage: DEFAULT_CLIENTS_PAGE,
  clients: DEFAULT_CLIENTS,
  home: DEFAULT_HOME_PAGE,
  contactPage: DEFAULT_CONTACT_PAGE,
};

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
    id: 206,
    type: 'commercial',
    typeAr: 'مركز تجاري وإداري فاخر',
    typeEn: 'Luxury Commercial & Office Center',
    title: 'مركز أجدا برايم للأعمال (طريق الملك فهد)',
    titleEn: 'Ajda Prime Business Center',
    priceType: 'استثمار',
    priceTypeEn: 'Investment / Lease',
    status: 'متاح للتأجير والاستثمار',
    statusEn: 'Available for Lease & Investment',
    area: 7200,
    bathrooms: 12,
    units: 'معارض تجارية ومكاتب تنفيذية',
    unitsEn: 'Commercial Showrooms & Executive Offices',
    city: 'الرياض',
    cityEn: 'Riyadh',
    lat: 24.7743,
    lng: 46.6380,
    image: prime1,
    gallery: [prime1, prime2],
    badge: 'مشروع رئيسي مميز',
    badgeEn: 'Flagship Development',
    videoUrl: 'https://youtu.be/3RlVLmDkres',
    virtualTour3dAvailable: true,
    description: 'أجدا برايم، أيقونة الأعمال والاستثمار الجديدة على طريق الملك فهد بالرياض. مشروع تجاري وإداري نوعي يجمع بين الموقع الاستراتيجي الاستثنائي والتصميم العصري وجودة البناء، يضم معارض تجارية ومكاتب إدارية وجلسات خارجية مع جسر يربط بين الجهتين.',
    descriptionEn: 'Ajda Prime on King Fahd Road, a landmark commercial & business center in Riyadh offering premium showrooms, corporate office suites, landscaped outdoor terraces, and sky bridge connectivity.',
    features: [
      'واجهة وحضور استثنائي (+200 متر واجهة تجارية)',
      'يقع على 3 شوارع رئيسية بالقرب من طريق أنس بن مالك',
      'مقابل المستشفى السعودي الألماني ونادي الشباب',
      'قريب جداً من محطة مترو الرياض ومراكز الأعمال',
      'مواقف سيارات منظمة ومصاعد سريعة ذكية',
      'جلسات وتراسات خارجية مميزة بمناظر بانورامية'
    ],
    featuresEn: [
      'Exceptional frontage (+200m commercial presence)',
      'Located on 3 active streets near Anas Bin Malik Rd',
      'Opposite Saudi German Hospital & Al-Shabab Club',
      'Close proximity to Riyadh Metro & financial hubs',
      'Designated basement parking and smart elevators',
      'Panoramic outdoor terraces and executive seating'
    ],
    locationHighlightsAr: [
      'طريق الملك فهد - الرياض',
      'يقع على 3 شوارع رئيسية',
      'مقابل المستشفى السعودي الألماني',
      'مقابل نادي الشباب',
      'قريب من محطة مترو الرياض',
      'بالقرب من طريق أنس بن مالك'
    ],
    locationHighlightsEn: [
      'King Fahd Road, Riyadh',
      'Frontage on 3 main streets',
      'Opposite Saudi German Hospital',
      'Opposite Al-Shabab FC Club',
      'Walking distance to Riyadh Metro',
      'Adjacent to Anas Bin Malik Road'
    ],
    floors: [
      {
        floorNumber: 0,
        floorNameAr: 'الدور الأرضي - معارض تجارية',
        floorNameEn: 'Ground Floor - Showrooms',
        descriptionAr: 'معارض تجارية فخمة بواجهات زجاجية مزدوجة مقسمة بين الجهة الشمالية والجهة الجنوبية',
        descriptionEn: 'Premium commercial showrooms with double-height glass facades',
        totalArea: 964.15,
        units: [
          {
            id: 'p206-g-n1',
            unitNumber: 'معرض 01 (شمالي)',
            floorNumber: 0,
            floorNameAr: 'الدور الأرضي',
            sectionAr: 'الجهة الشمالية',
            type: 'showroom',
            typeAr: 'معرض تجاري',
            typeEn: 'Showroom',
            area: 117.80,
            priceLabel: 'متاح للإيجار',
            status: 'available',
            statusAr: 'متاح',
            features: ['إطلالة على طريق الملك فهد', 'واجهة زجاجية كاملة', 'مدخل خاص']
          },
          {
            id: 'p206-g-n2',
            unitNumber: 'معرض 02 (شمالي)',
            floorNumber: 0,
            floorNameAr: 'الدور الأرضي',
            sectionAr: 'الجهة الشمالية',
            type: 'showroom',
            typeAr: 'معرض تجاري',
            typeEn: 'Showroom',
            area: 158.50,
            priceLabel: 'متاح للإيجار',
            status: 'available',
            statusAr: 'متاح',
            features: ['واجهة على شارعين', 'إضاءة طبيعية', 'مناسب للمطاعم والكافيهات']
          },
          {
            id: 'p206-g-s1',
            unitNumber: 'معرض 01 (جنوبي)',
            floorNumber: 0,
            floorNameAr: 'الدور الأرضي',
            sectionAr: 'الجهة الجنوبية',
            type: 'showroom',
            typeAr: 'معرض تجاري رئيسي',
            typeEn: 'Main Showroom',
            area: 259.80,
            priceLabel: 'متاح للإيجار',
            status: 'available',
            statusAr: 'متاح',
            features: ['أكبر معرض بالمجمع', 'واجهة ثلاثية الشوارع', 'ارتفاع سقف 6 أمتار']
          },
          {
            id: 'p206-g-s2',
            unitNumber: 'معرض 02 (جنوبي)',
            floorNumber: 0,
            floorNameAr: 'الدور الأرضي',
            sectionAr: 'الجهة الجنوبية',
            type: 'showroom',
            typeAr: 'معرض تجاري',
            typeEn: 'Showroom',
            area: 191.00,
            priceLabel: 'محجوز',
            status: 'reserved',
            statusAr: 'محجوز',
            features: ['موقع استراتيجي', 'واجهة زجاجية واسعة']
          },
          {
            id: 'p206-g-s3',
            unitNumber: 'معرض 03 (جنوبي)',
            floorNumber: 0,
            floorNameAr: 'الدور الأرضي',
            sectionAr: 'الجهة الجنوبية',
            type: 'showroom',
            typeAr: 'معرض تجاري',
            typeEn: 'Showroom',
            area: 233.25,
            priceLabel: 'متاح للإيجار',
            status: 'available',
            statusAr: 'متاح',
            features: ['واجهة شرقية وجنوبية', 'مواقف مباشرة', 'مدخل شحن خلفي']
          }
        ]
      },
      {
        floorNumber: 1,
        floorNameAr: 'الدور الأول - مكاتب إدارية',
        floorNameEn: 'First Floor - Corporate Offices',
        descriptionAr: 'مكاتب إدارية وتنفيذية مع جسر يربط بين الجهة الشمالية والجنوبية',
        descriptionEn: 'Executive office suites with an interconnecting sky bridge',
        totalArea: 966.60,
        units: [
          {
            id: 'p206-f1-n1',
            unitNumber: 'مكتب 01 (شمالي)',
            floorNumber: 1,
            floorNameAr: 'الدور الأول',
            sectionAr: 'الجهة الشمالية',
            type: 'office',
            typeAr: 'مكتب إداري',
            typeEn: 'Office',
            area: 113.50,
            priceLabel: 'متاح للإيجار',
            status: 'available',
            statusAr: 'متاح',
            features: ['إطلالة بانورامية', 'شبكة ألياف بصرية', 'تكييف مركزي']
          },
          {
            id: 'p206-f1-n2',
            unitNumber: 'مكتب 02 (شمالي)',
            floorNumber: 1,
            floorNameAr: 'الدور الأول',
            sectionAr: 'الجهة الشمالية',
            type: 'office',
            typeAr: 'مكتب إداري',
            typeEn: 'Office',
            area: 192.50,
            priceLabel: 'متاح للإيجار',
            status: 'available',
            statusAr: 'متاح',
            features: ['تقسيم إداري ذكي', 'صالة استقبال مجهزة']
          },
          {
            id: 'p206-f1-s4',
            unitNumber: 'مكتب 04 (جنوبي)',
            floorNumber: 1,
            floorNameAr: 'الدور الأول',
            sectionAr: 'الجهة الجنوبية',
            type: 'office',
            typeAr: 'مكتب تنفيذي',
            typeEn: 'Executive Office',
            area: 192.00,
            priceLabel: 'متاح للإيجار',
            status: 'available',
            statusAr: 'متاح',
            features: ['متصل بالجسر الرابط', 'إطلالة على طريق الملك فهد']
          },
          {
            id: 'p206-f1-s5',
            unitNumber: 'مكتب 05 (جنوبي)',
            floorNumber: 1,
            floorNameAr: 'الدور الأول',
            sectionAr: 'الجهة الجنوبية',
            type: 'office',
            typeAr: 'مقر شركة',
            typeEn: 'Corporate HQ Suite',
            area: 255.00,
            priceLabel: 'مؤجر',
            status: 'rented',
            statusAr: 'مؤجر',
            features: ['مقر إداري كامل', 'قاعة اجتماعات مدمجة']
          },
          {
            id: 'p206-f1-s6',
            unitNumber: 'مكتب 06 (جنوبي)',
            floorNumber: 1,
            floorNameAr: 'الدور الأول',
            sectionAr: 'الجهة الجنوبية',
            type: 'office',
            typeAr: 'مكتب إداري',
            typeEn: 'Office',
            area: 239.50,
            priceLabel: 'متاح للإيجار',
            status: 'available',
            statusAr: 'متاح',
            features: ['مساحات عمل مفتوحة', 'إطلالة مزدوجة']
          }
        ]
      },
      {
        floorNumber: 2,
        floorNameAr: 'الدور الثاني - مكاتب وجلسات خارجية',
        floorNameEn: 'Second Floor - Offices & Outdoor Terraces',
        descriptionAr: 'تجمع بين الخصوصية والأناقة مع جلسات خارجية مميزة تمنح تجربة عمل متفردة',
        descriptionEn: 'High-end offices integrated with private outdoor landscaped terraces',
        totalArea: 684.05,
        units: [
          {
            id: 'p206-f2-1',
            unitNumber: 'مكتب 01 + تراس',
            floorNumber: 2,
            floorNameAr: 'الدور الثاني',
            type: 'office',
            typeAr: 'مكتب وتراس',
            typeEn: 'Office & Terrace',
            area: 259.80,
            priceLabel: 'متاح للإيجار',
            status: 'available',
            statusAr: 'متاح',
            features: ['جلسة خارجية خاصة', 'واجهة زجاجية ممتدة']
          },
          {
            id: 'p206-f2-2',
            unitNumber: 'مكتب 02',
            floorNumber: 2,
            floorNameAr: 'الدور الثاني',
            type: 'office',
            typeAr: 'مكتب تجاري',
            typeEn: 'Commercial Office',
            area: 191.00,
            priceLabel: 'متاح للإيجار',
            status: 'available',
            statusAr: 'متاح',
            features: ['تشطيب فاخر سوبر ديلوكس', 'هدوء تام']
          },
          {
            id: 'p206-f2-3',
            unitNumber: 'مكتب 03 + O.S',
            floorNumber: 2,
            floorNameAr: 'الدور الثاني',
            type: 'outdoor',
            typeAr: 'مكتب وجلسة خارجية',
            typeEn: 'Office & Outdoor Area',
            area: 233.25,
            priceLabel: 'متاح للاستثمار',
            status: 'available',
            statusAr: 'متاح',
            features: ['جلسات خارجية O.S 233م²', 'إطلالة ساحرة على الرياض']
          }
        ]
      },
      {
        floorNumber: 3,
        floorNameAr: 'الدور الثالث - مساحات أرحب لأعمال متطلعة',
        floorNameEn: 'Third Floor - Rooftop Executive Suites',
        descriptionAr: 'الدور الثالث بتجربة أعمال أكثر رحابة مع جلسات خارجية واسعة تليق بكبرى الشركات',
        descriptionEn: 'Penthouse-level corporate suites with expansive terrace views',
        totalArea: 684.05,
        units: [
          {
            id: 'p206-f3-1',
            unitNumber: 'مكتب روف 01',
            floorNumber: 3,
            floorNameAr: 'الدور الثالث',
            type: 'office',
            typeAr: 'مكتب تنفيذي روف',
            typeEn: 'Executive Penthouse Office',
            area: 259.80,
            priceLabel: 'متاح للإيجار',
            status: 'available',
            statusAr: 'متاح',
            features: ['إطلالة أفقية على طريق الملك فهد', 'تراس خاص']
          },
          {
            id: 'p206-f3-2',
            unitNumber: 'مكتب روف 02',
            floorNumber: 3,
            floorNameAr: 'الدور الثالث',
            type: 'office',
            typeAr: 'مكتب تنفيذي',
            typeEn: 'Executive Office',
            area: 191.00,
            priceLabel: 'متاح للإيجار',
            status: 'available',
            statusAr: 'متاح',
            features: ['مدخل تنفيذي خاص', 'أنظمة تحكم ذكية']
          },
          {
            id: 'p206-f3-3',
            unitNumber: 'مكتب روف 03 + تراس بانورامي',
            floorNumber: 3,
            floorNameAr: 'الدور الثالث',
            type: 'outdoor',
            typeAr: 'مكتب وتراس بانورامي',
            typeEn: 'Office & Sky Terrace',
            area: 233.25,
            priceLabel: 'متاح للاستثمار',
            status: 'available',
            statusAr: 'متاح',
            features: ['تراس بانورامي مفتوح', 'جلسات VIP']
          }
        ]
      }
    ]
  },
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
    lat: 24.5821,
    lng: 46.7725,
    image: almansoria,
    gallery: [almansoria],
    badge: 'مشروع لوجستي رئيسي',
    badgeEn: 'Key Logistics Hub',
    videoUrl: 'https://youtu.be/Ti7MQxfmNWY',
    virtualTour3dAvailable: true,
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
    ],
    floors: [
      {
        floorNumber: 0,
        floorNameAr: 'المجمع اللوجستي - المستودعات الرئيسية',
        floorNameEn: 'Main Logistics Zone',
        totalArea: 18500,
        units: [
          {
            id: 'p201-w1',
            unitNumber: 'مستودع A-01 (مكّيف)',
            floorNumber: 0,
            floorNameAr: 'المنطقة A',
            type: 'warehouse',
            typeAr: 'مستودع لوجستي مكيف',
            area: 4500,
            priceLabel: 'متاح للتأجير',
            status: 'available',
            statusAr: 'متاح',
            features: ['تكييف مركزي متكامل', '3 أرصفة هيدروليكية']
          },
          {
            id: 'p201-w2',
            unitNumber: 'مستودع A-02 (جاف)',
            floorNumber: 0,
            floorNameAr: 'المنطقة A',
            type: 'warehouse',
            typeAr: 'مستودع جاف',
            area: 4500,
            priceLabel: 'مؤجر',
            status: 'rented',
            statusAr: 'مؤجر',
            features: ['أرضيات إيبوكسي عالية التحمل', 'سقف 12 متر']
          },
          {
            id: 'p201-w3',
            unitNumber: 'مستودع B-01 (تبريد/تجميد)',
            floorNumber: 0,
            floorNameAr: 'المنطقة B',
            type: 'warehouse',
            typeAr: 'مستودع مبرد',
            area: 5000,
            priceLabel: 'متاح للتأجير',
            status: 'available',
            statusAr: 'متاح',
            features: ['أنظمة تبريد وتجميد غذائي', 'مستودع أدوية معتمد']
          },
          {
            id: 'p201-w4',
            unitNumber: 'مستودع B-02 (عام)',
            floorNumber: 0,
            floorNameAr: 'المنطقة B',
            type: 'warehouse',
            typeAr: 'مستودع لوجستي عام',
            area: 4500,
            priceLabel: 'متاح للاستثمار',
            status: 'available',
            statusAr: 'متاح',
            features: ['ساحة مناورة واسعة', 'مكتب إداري ملحق']
          }
        ]
      }
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
    lat: 25.3800,
    lng: 49.5850,
    image: alehsa,
    gallery: [alehsa, alehsa2, alehsa3, alehsa4, alehsa5],
    badge: 'محجوز بالكامل',
    badgeEn: 'Fully Booked',
    videoUrl: 'https://youtu.be/jZ6x76Uf9_Q',
    virtualTour3dAvailable: true,
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
    ],
    floors: [
      {
        floorNumber: 0,
        floorNameAr: 'الدور الأرضي - واجهة المحلات التجارية',
        floorNameEn: 'Ground Retail Strip',
        totalArea: 4600,
        units: [
          {
            id: 'p202-s1',
            unitNumber: 'محل تجاري 101',
            floorNumber: 0,
            floorNameAr: 'الدور الأرضي',
            type: 'showroom',
            typeAr: 'معرض تجاري',
            area: 580,
            status: 'sold',
            statusAr: 'محجوز بالكامل'
          },
          {
            id: 'p202-s2',
            unitNumber: 'محل تجاري 102',
            floorNumber: 0,
            floorNameAr: 'الدور الأرضي',
            type: 'showroom',
            typeAr: 'محل تجاري',
            area: 420,
            status: 'sold',
            statusAr: 'محجوز بالكامل'
          }
        ]
      }
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
    lat: 24.8450,
    lng: 46.8200,
    image: alkher2,
    gallery: [alkher2, alkher],
    badge: 'محلات تجارية فاخرة',
    badgeEn: 'Luxury Commercial Retail',
    videoUrl: 'https://youtu.be/AUvKPKorzHE',
    virtualTour3dAvailable: true,
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
    ],
    floors: [
      {
        floorNumber: 0,
        floorNameAr: 'الدور الأرضي - المحلات والمعارض',
        floorNameEn: 'Ground Floor Retail',
        totalArea: 2800,
        units: [
          {
            id: 'p203-u1',
            unitNumber: 'صالة عرض 01',
            floorNumber: 0,
            floorNameAr: 'الدور الأرضي',
            type: 'showroom',
            typeAr: 'صالة عرض فاخرة',
            area: 450,
            status: 'available',
            statusAr: 'متاح'
          },
          {
            id: 'p203-u2',
            unitNumber: 'معرض 02 (ناصية)',
            floorNumber: 0,
            floorNameAr: 'الدور الأرضي',
            type: 'showroom',
            typeAr: 'معرض ناصية',
            area: 380,
            status: 'available',
            statusAr: 'متاح'
          }
        ]
      }
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
    lat: 24.7180,
    lng: 46.6620,
    image: vera,
    gallery: [vera],
    badge: 'معارض تجارية كبرى',
    badgeEn: 'Major Commercial Showrooms',
    videoUrl: 'https://youtu.be/3RlVLmDkres',
    virtualTour3dAvailable: true,
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
    ],
    floors: [
      {
        floorNumber: 0,
        floorNameAr: 'الدور الأرضي - صالات العرض',
        floorNameEn: 'Ground Floor Showrooms',
        totalArea: 3800,
        units: [
          {
            id: 'p204-s1',
            unitNumber: 'صالة العرض الكبرى A',
            floorNumber: 0,
            floorNameAr: 'الدور الأرضي',
            type: 'showroom',
            typeAr: 'صالة كبرى',
            area: 1200,
            status: 'available',
            statusAr: 'متاح'
          },
          {
            id: 'p204-s2',
            unitNumber: 'صالة العرض B',
            floorNumber: 0,
            floorNameAr: 'الدور الأرضي',
            type: 'showroom',
            typeAr: 'صالة عرض',
            area: 950,
            status: 'available',
            statusAr: 'متاح'
          }
        ]
      }
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
    lat: 24.8150,
    lng: 46.6900,
    image: festa1,
    gallery: [festa1, festa2, festa3],
    badge: 'مشروع إداري رئيسي',
    badgeEn: 'Flagship Corporate Hub',
    videoUrl: 'https://youtu.be/mYfEpM_GTuc',
    virtualTour3dAvailable: true,
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
    ],
    floors: [
      {
        floorNumber: 0,
        floorNameAr: 'الدور الأرضي - معارض تجارية',
        floorNameEn: 'Ground Floor Commercial',
        totalArea: 1800,
        units: [
          {
            id: 'p205-g1',
            unitNumber: 'معرض فيستا 01',
            floorNumber: 0,
            floorNameAr: 'الدور الأرضي',
            type: 'showroom',
            typeAr: 'معرض تجاري',
            area: 480,
            status: 'available',
            statusAr: 'متاح'
          }
        ]
      },
      {
        floorNumber: 1,
        floorNameAr: 'الدور الأول - أجنحة مكتبية',
        floorNameEn: 'First Floor - Office Suites',
        totalArea: 1800,
        units: [
          {
            id: 'p205-f1-1',
            unitNumber: 'جناح إداري 101',
            floorNumber: 1,
            floorNameAr: 'الدور الأول',
            type: 'office',
            typeAr: 'مكتب إداري',
            area: 320,
            status: 'available',
            statusAr: 'متاح'
          }
        ]
      }
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
    lat: 24.7650,
    lng: 46.6800,
    image: line1,
    gallery: [line1, line2],
    badge: 'موقع استراتيجي',
    badgeEn: 'Strategic Arterial Address',
    videoUrl: 'https://youtu.be/jZ6x76Uf9_Q',
    virtualTour3dAvailable: true,
    description: 'مجمع أجدا لاين الإداري، بيئة عمل متكاملة مخصصة للمقرات الإدارية والشركات في موقع استراتيجي يسهل الوصول إليه، مع خدمات أمن وإدارة مرافق متقدمة ومساحات مكتبية مرنة.',
    descriptionEn: 'Ajda Line administrative office park, engineered for headquarters and modern enterprise offices in an easily accessible location with advanced facilities management.',
    features: [
      'مساحات مكتبية مرنة وقابلة للتخصيص',
      'مدخل رئيسي فخم واستقبال مركزي',
      'مواقف سيارات كافية للموظفين والزوار',
      'أنظمة اتصالات وإنترنت فائق السرعة'
    ],
    featuresEn: [
      'Modular & customizable corporate floor plates',
      'Prestigious main lobby & visitor reception',
      'Ample shaded tenant & guest parking',
      'High-speed fiber connectivity infrastructure'
    ],
    floors: [
      {
        floorNumber: 0,
        floorNameAr: 'الدور الأرضي - الاستقبال والخدمات',
        floorNameEn: 'Ground Floor & Services',
        totalArea: 1400,
        units: [
          {
            id: 'p207-g1',
            unitNumber: 'صالة عرض لاين',
            floorNumber: 0,
            floorNameAr: 'الدور الأرضي',
            type: 'showroom',
            typeAr: 'صالة عرض أعمال',
            area: 390,
            status: 'available',
            statusAr: 'متاح'
          }
        ]
      },
      {
        floorNumber: 1,
        floorNameAr: 'الدور الأول - مكاتب تنفيذية',
        floorNameEn: 'First Floor - Executive Offices',
        totalArea: 1400,
        units: [
          {
            id: 'p207-f1',
            unitNumber: 'مكتب تنفيذي 201',
            floorNumber: 1,
            floorNameAr: 'الدور الأول',
            type: 'office',
            typeAr: 'مكتب إداري',
            area: 280,
            status: 'available',
            statusAr: 'متاح'
          }
        ]
      }
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

export const getPropertyDisplay = (prop: Property, language: 'ar' | 'en' | string): PropertyDisplayData => {
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

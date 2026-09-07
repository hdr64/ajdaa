import type { Property } from '../types/property';

// New projects from src/assets/ajda1
import almansoria from '../assets/ajda1/almansoria.webp';
import alehsa from '../assets/ajda1/alehsa.webp';
import alehsa2 from '../assets/ajda1/alehsa2.webp';
import alehsa3 from '../assets/ajda1/alehsa3.webp';
import alehsa4 from '../assets/ajda1/alehsa4.webp';
import alehsa5 from '../assets/ajda1/alehsa5.webp';
import alkher from '../assets/ajda1/alkher.webp';
import alkher2 from '../assets/ajda1/alkher2.webp';
import vera from '../assets/ajda1/vera.webp';

// Existing commercial & office projects
import festa1 from '../assets/ajda/festa/festa1.webp';
import festa2 from '../assets/ajda/festa/festa2.webp';
import festa3 from '../assets/ajda/festa/festa3.webp';
import prime1 from '../assets/ajda/prime/prime1.webp';
import prime2 from '../assets/ajda/prime/prime2.webp';
import line1 from '../assets/ajda/line/line1.webp';
import line2 from '../assets/ajda/line/line2.webp';

// Residential assets
import img2 from '../assets/imgs/2.webp';
import img3 from '../assets/imgs/3.webp';
import img4 from '../assets/imgs/4.webp';
import img5 from '../assets/imgs/5.webp';
import img6 from '../assets/imgs/6.webp';
import img7 from '../assets/imgs/7.webp';
import img8 from '../assets/imgs/8.webp';
import img9 from '../assets/imgs/9.webp';
import img10 from '../assets/imgs/10.webp';
import img11 from '../assets/imgs/11.webp';
import imgA1 from '../assets/imgs/a1.webp';

export const properties: Property[] = [
  {
    id: 201,
    type: 'logistics',
    typeAr: 'مستودعات ومخازن لوجستية',
    title: 'مستودعات المنصورية اللوجستية · Al Mansoria Warehouses',
    priceType: 'إيجار',
    status: 'متاح للتأجير والاستثمار',
    area: 18500,
    rooms: 0,
    bathrooms: 4,
    units: 'مستودعات ومخازن كبرى',
    city: 'الرياض',
    image: almansoria,
    gallery: [almansoria],
    badge: 'مشروع لوجستي رئيسي',
    description: 'مشروع مستودعات المنصورية اللوجستية الحديثة لشركة أجدا للتطوير والاستثمار في مدينة الرياض. صُمم بأعلى معايير التخزين والمخازن وسلاسل الإمداد العالمية، مع ساحات شحن وتفريغ هيدروليكية ومواقف شاحنات متكاملة وأنظمة إطفاء وسلامة ذكية.',
    features: [
      'سقف مرتفع ومساحات تخزين ضخمة',
      'أرصفة شحن وتفريغ هيدروليكية',
      'أنظمة إطفاء وأمن معتمدة 24/7',
      'مواقف مخصصة للشاحنات وتريلات النقل'
    ]
  },
  {
    id: 202,
    type: 'commercial',
    typeAr: 'محلات ومجمع تجاري',
    title: 'مشروع الأحساء التجاري · Al Ahsa Commercial Project',
    priceType: 'استثمار',
    status: 'محجوز بالكامل',
    area: 4600,
    rooms: 0,
    bathrooms: 6,
    units: 'مجمع محلات ومعارض تجارية',
    city: 'الأحساء',
    image: alehsa,
    gallery: [alehsa, alehsa2, alehsa3, alehsa4, alehsa5],
    badge: 'محجوز بالكامل',
    description: 'مشروع الأحساء التجاري التابع لشركة أجدا العقارية، مجمع تجاري متكامل يضم محلات ومعارض تجارية عصرية بتصميم معماري فخم يدمج الأصالة بالحداثة، مع واجهات زجاجية واسعة وإضاءات ديكورية استثنائية (محجوز بالكامل).',
    features: [
      'تصميم معماري وتراثي عصري فاخر',
      'واجهات زجاجية مزدوجة واسعة للمحلات',
      'إضاءات ليلية استثنائية متناسقة',
      'مواقف سيارات واسعة ومهيأة للزوار'
    ]
  },
  {
    id: 203,
    type: 'commercial',
    typeAr: 'محلات تجارية',
    title: 'مجمع محلات أجدا لوكس · Ajda Lux Commercial Shops',
    priceType: 'إيجار',
    status: 'متاح للتأجير والاستثمار',
    area: 2800,
    rooms: 0,
    bathrooms: 4,
    units: 'محلات وصالات تجارية راقية',
    city: 'الرياض',
    image: alkher2,
    gallery: [alkher2, alkher],
    badge: 'محلات تجارية فاخرة',
    description: 'مجمع محلات أجدا لوكس التجاري بتصميم مودرن متطور في مدينة الرياض، يضم سلسلة محلات تجارية راقية وصالات عرض على واجهة رئيسية حيوية، مجهزة بأحدث التشطيبات ومواقف أمامية مخصصة للعملاء.',
    features: [
      'واجهات عرض زجاجية مزدوجة',
      'تراسات وجلسات خارجية راقية',
      'مواقف خاصة لعملاء المحلات',
      'موقع تجاري نشط وحيوي'
    ]
  },
  {
    id: 204,
    type: 'commercial',
    typeAr: 'معارض ومحلات تجارية',
    title: 'معارض وصالات أجدا التجارية (طريق رئيسي)',
    priceType: 'إيجار',
    status: 'متاح للتأجير',
    area: 3800,
    rooms: 0,
    bathrooms: 4,
    units: 'صالات ومعارض تجارية كبرى',
    city: 'الرياض',
    image: vera,
    gallery: [vera],
    badge: 'معارض تجارية كبرى',
    description: 'صالات ومعارض تجارية كبرى مجهزة للعلامات التجارية والشركات الرائدة (بجوار المنيع)، تتميز بمساحات عرض فسيحة وارتفاعات مناسبة ومواقف منظمة على محور تجاري رئيسي.',
    features: [
      'واجهات زجاجية ممتدة على الشارع التجاري',
      'مواقف سيارات منظمة أمامية',
      'سقف مرتفع ومساحات عرض مفتوحة',
      'موقع استراتيجي بحيويته العالية'
    ]
  },
  {
    id: 101,
    type: 'office',
    typeAr: 'مبنى تجاري وإداري',
    title: 'أجدا فيستا · Ajda Vista (مبنى تجاري متعدد المكاتب)',
    priceType: 'إيجار',
    status: 'متاح للتأجير والاستثمار',
    area: 680,
    rooms: 12,
    bathrooms: 8,
    units: 'مبنى تجاري وإداري',
    city: 'الرياض',
    image: festa1,
    gallery: [festa1, festa2, festa3],
    badge: 'مشروع إداري رئيسي',
    description: 'مشروع أجدا فيستا التجاري والإداري، مبنى متطور متعدد المكاتب والأقسام التجارية على أعلى معايير التصميم المعماري الذكي.',
    features: [
      'مكاتب تجارية متعددة المساحات',
      'واجهات زجاجية عصرية',
      'مواقف خاصة وأنظمة أمنية'
    ]
  },
  {
    id: 102,
    type: 'office',
    typeAr: 'مركز أعمال',
    title: 'أجدا برايم · Ajda Prime (مكاتب تنفيذية)',
    priceType: 'بيع',
    status: 'جاهز للاستخدام',
    area: 850,
    rooms: 15,
    bathrooms: 10,
    units: 'مبنى إداري تنفيذي',
    city: 'جدة',
    image: prime1,
    gallery: [prime1, prime2],
    badge: 'مركز تنفيذي',
    description: 'مشروع أجدا برايم التجاري، مركز أعمال تنفيذي يضم مساحات إدارية ومكاتب فاخرة مجهزة بأحدث التقنيات وأنظمة التحكم الأمني الذكي.',
    features: [
      'مقر استراتيجي للشركات',
      'أنظمة تحكم وأمن ذكية',
      'قاعات اجتماعات تنفيذية'
    ]
  },
  {
    id: 103,
    type: 'office',
    typeAr: 'مجمع مكاتب',
    title: 'أجدا لاين · Ajda Line (مكاتب إدارية استراتيجية)',
    priceType: 'إيجار',
    status: 'متاح للتأجير',
    area: 540,
    rooms: 9,
    bathrooms: 6,
    units: 'مجمع مكاتب وأقسام',
    city: 'الرياض',
    image: line1,
    gallery: [line1, line2],
    badge: 'موقع استراتيجي',
    description: 'مشروع أجدا لاين التجاري والإداري بموقع حيوي متميز يوفر بيئة عمل استثمارية مرخصة ومكتملة الخدمات للمؤسسات كبرى.',
    features: [
      'مواقع تجارية حيوية',
      'تصميم معماري مستدام',
      'خدمات إدارة ممتلكات متكاملة'
    ]
  },
  {
    id: 1,
    type: 'villa',
    typeAr: 'فيلا',
    title: 'فيلا فاخرة في حي العليا',
    priceType: 'بيع',
    status: 'متاح للشراء',
    area: 520,
    rooms: 7,
    bathrooms: 6,
    city: 'الرياض',
    image: img2,
    gallery: [img2, img5, img6, imgA1],
    badge: 'مشروع فاخر',
    description: 'فيلا مودرن بتصميم مميز في أرقى أحياء العليا، تشمل مسبحاً خاصاً وحديقة واسعة ونظام منزل ذكي سمارت هوم.'
  },
  {
    id: 2,
    type: 'apartment',
    typeAr: 'شقة',
    title: 'شقة فندقية فاخرة بإطلالة بحرية',
    priceType: 'بيع',
    status: 'متاح للشراء',
    area: 180,
    rooms: 3,
    bathrooms: 2,
    city: 'جدة',
    image: img3,
    gallery: [img3, img7, img11, img4],
    badge: 'إطلالة شاطئية',
    description: 'شقة فندقية مؤثثة بالكامل بأفخم الديكورات الإيطالية، تقع في برج سكني فاخر مع خدمات استقبال وصيانة 24/7.'
  },
  {
    id: 3,
    type: 'office',
    typeAr: 'مكتب',
    title: 'مكتب تجاري ذكي بمركز الأعمال',
    priceType: 'إيجار',
    status: 'متاح للتأجير',
    area: 250,
    rooms: 4,
    bathrooms: 2,
    city: 'الرياض',
    image: img4,
    gallery: [img4, img8, img9, img3],
    badge: 'مقر استراتيجي',
    description: 'مساحة مكتبية جاهزة على طريق الملك فهد، مصممة بطابع عصري ومجهزة بإنترنت ألياف بصرية ومواقف خاصة.'
  },
  {
    id: 4,
    type: 'villa',
    typeAr: 'فيلا',
    title: 'فيلا بحرية في أبحر الشمالية',
    priceType: 'بيع',
    status: 'متاح للشراء',
    area: 480,
    rooms: 6,
    bathrooms: 5,
    city: 'جدة',
    image: img6,
    gallery: [img6, img2, img10, img5],
    badge: 'عقار شاطئي',
    description: 'تصميم ساحلي ذكي يمنحك تجربة سكنية استثنائية بالقرب من كورنيش أبحر الشمالية مع إمكانية التخصيص.'
  }
];
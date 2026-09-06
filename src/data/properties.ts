import type { Property } from '../types/property';

import festa1 from '../assets/ajda/festa/festa1.webp';
import festa2 from '../assets/ajda/festa/festa2.webp';
import festa3 from '../assets/ajda/festa/festa3.webp';
import prime1 from '../assets/ajda/prime/prime1.webp';
import prime2 from '../assets/ajda/prime/prime2.webp';
import line1 from '../assets/ajda/line/line1.webp';
import line2 from '../assets/ajda/line/line2.webp';

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
    id: 101,
    type: 'office',
    typeAr: 'مبنى تجاري',
    title: 'أجدا فيستا · Ajda Vista (مبنى تجاري متعدد المكاتب)',
    price: 185000,
    priceLabel: '185,000 ريال/سنوياً',
    priceType: 'إيجار',
    area: 680,
    rooms: 12,
    bathrooms: 8,
    city: 'الرياض',
    image: festa1,
    gallery: [festa1, festa2, festa3],
    badge: 'مشروع رئيسي',
    description: 'مشروع أجدا فيستا التجاري والإداري، مبنى متطور متعدد المكاتب والأقسام التجارية على أعلى معايير التصميم المعماري الذكي.'
  },
  {
    id: 102,
    type: 'office',
    typeAr: 'مركز أعمال',
    title: 'أجدا برايم · Ajda Prime (مكاتب تنفيذية)',
    price: 4200000,
    priceLabel: '4,200,000 ريال',
    priceType: 'بيع',
    area: 850,
    rooms: 15,
    bathrooms: 10,
    city: 'جدة',
    image: prime1,
    gallery: [prime1, prime2],
    badge: 'مركز تنفيذي',
    description: 'مشروع أجدا برايم التجاري، مركز أعمال تنفيذي يضم مساحات إدارية ومكاتب فاخرة مجهزة بأحدث التقنيات وأنظمة التحكم الأمني الذكي.'
  },
  {
    id: 103,
    type: 'office',
    typeAr: 'مجمع مكاتب',
    title: 'أجدا لاين · Ajda Line (مكاتب إدارية استراتيجية)',
    price: 140000,
    priceLabel: '140,000 ريال/سنوياً',
    priceType: 'إيجار',
    area: 540,
    rooms: 9,
    bathrooms: 6,
    city: 'الرياض',
    image: line1,
    gallery: [line1, line2],
    badge: 'موقع استراتيجي',
    description: 'مشروع أجدا لاين التجاري والإداري بموقع حيوي متميز يوفر بيئة عمل استثمارية مرخصة ومكتملة الخدمات للمؤسسات كبرى.'
  },
  {
    id: 1,
    type: 'villa',
    typeAr: 'فيلا',
    title: 'فيلا فاخرة في حي العليا',
    price: 3500000,
    priceLabel: '3,500,000 ريال',
    priceType: 'بيع',
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
    price: 950000,
    priceLabel: '950,000 ريال',
    priceType: 'بيع',
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
    price: 45000,
    priceLabel: '45,000 ريال/سنوياً',
    priceType: 'إيجار',
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
    price: 2800000,
    priceLabel: '2,800,000 ريال',
    priceType: 'بيع',
    area: 480,
    rooms: 6,
    bathrooms: 5,
    city: 'جدة',
    image: img6,
    gallery: [img6, img2, img10, img5],
    badge: 'عقار شاطئي',
    description: 'تصميم ساحلي ذكي يمنحك تجربة سكنية استثنائية بالقرب من كورنيش أبحر الشمالية مع إمكانية التخصيص.'
  },
  {
    id: 5,
    type: 'house',
    typeAr: 'بيت',
    title: 'بيت دوبلكس راقي بحي الورود',
    price: 1800000,
    priceLabel: '1,800,000 ريال',
    priceType: 'بيع',
    area: 350,
    rooms: 5,
    bathrooms: 4,
    city: 'الرياض',
    image: img5,
    gallery: [img5, img2, imgA1, img6],
    badge: 'تصميم حديث',
    description: 'دوبلكس عصري بواجهة حجرية فاخرة ومساحات مفتوحة تناسب تطلعات العائلة السعودية الحديثة.'
  },
  {
    id: 6,
    type: 'apartment',
    typeAr: 'شقة',
    title: 'شقة سكنية راقية بالواجهة البحرية',
    price: 35000,
    priceLabel: '35,000 ريال/سنوياً',
    priceType: 'إيجار',
    area: 160,
    rooms: 3,
    bathrooms: 2,
    city: 'الخبر',
    image: img7,
    gallery: [img7, img3, img11, img4],
    badge: 'قريبة من الخدمات',
    description: 'شقة ممتازة في حي الحزام الذهبي بالخبر، قريبة من أهم المراكز التجارية والمدارس والخدمات.'
  },
  {
    id: 7,
    type: 'villa',
    typeAr: 'فيلا',
    title: 'فيلا متميزة بجوار العوالي',
    price: 2200000,
    priceLabel: '2,200,000 ريال',
    priceType: 'بيع',
    area: 400,
    rooms: 5,
    bathrooms: 4,
    city: 'مكة المكرمة',
    image: img8,
    gallery: [img8, img10, img2, img5],
    badge: 'موقع هادئ',
    description: 'فيلا ذات بوابتين ومجلس خارجي واسع مع خزان أرضي كبير وموقف مغطى لسيارتين.'
  }
];
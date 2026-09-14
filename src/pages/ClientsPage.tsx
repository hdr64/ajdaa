import React from 'react';
import { Handshake, Building2, CheckCircle2, Award, TrendingUp, ArrowLeft, ArrowRight, ExternalLink } from 'lucide-react';
import { Reveal } from '../components/common/Reveal';
import { useLanguage } from '../hooks/useLanguage';

import almaneaLogo from '../assets/clients/شعار-المنيع-1024x569.webp';
import artktLogo from '../assets/clients/Frame-1261154210.png';
import intourLogo from '../assets/clients/Frame-1261154208.png';
import albawardiLogo from '../assets/clients/Frame-1261154207.png';
import almaLogo from '../assets/clients/Frame-1261154206.png';
import homesLogo from '../assets/clients/Frame-1261154209.png';

interface ClientDetail {
  id: string;
  nameAr: string;
  nameEn: string;
  sectorAr: string;
  sectorEn: string;
  descAr: string;
  descEn: string;
  logo: string;
  tags: string[];
}

const CLIENTS_LIST: ClientDetail[] = [
  {
    id: 'almanea',
    nameAr: 'شركة المنيع للأجهزة الكهربائية',
    nameEn: 'Almanea Electronics & Appliances',
    sectorAr: 'الأجهزة الكهربائية والمنزلية',
    sectorEn: 'Appliances & Electronics',
    descAr: 'إحدى كبرى الشركات الرائدة في قطاع تجزئة وتوزيع الأجهزة الكهربائية بالمملكة، واعتمدت مشاريع أجدا كمواقع استراتيجية لمعارضها ومستودعاتها.',
    descEn: 'One of Saudi Arabia’s foremost consumer electronics retailers, partnering with Ajda for premier showroom and distribution spaces.',
    logo: almaneaLogo,
    tags: ['معارض كبرى', 'مستودعات لوجستية', 'شراكة مستمرة'],
  },
  {
    id: 'artkt',
    nameAr: 'شركة أرتكت للمقاولات العامة والتجارة',
    nameEn: 'ARTKT Contracting & Trading Co.',
    sectorAr: 'المقاولات العامة والإنشاءات',
    sectorEn: 'General Contracting & Construction',
    descAr: 'مجموعة متخصصة في تنفيذ المشاريع الكبرى والأعمال الإنشائية والتشطيبات الفاخرة التي تلبي أعلى المعايير الهندسية.',
    descEn: 'Engineering and contracting group specializing in major architectural developments and high-grade civil infrastructure.',
    logo: artktLogo,
    tags: ['إنشاءات كبرى', 'مشاريع نوعية', 'بنية تحتية'],
  },
  {
    id: 'intour',
    nameAr: 'فنادق وأجنحة إنتور',
    nameEn: 'INTOUR Hotel & Hotel Suites',
    sectorAr: 'الضيافة والفندقة الراقية',
    sectorEn: 'Hospitality & Luxury Hotels',
    descAr: 'سلسلة فنادق وأجنحة فندقية متميزة تقدم خدمات الضيافة وفق المعايير العالمية في مواقع حيوية واستراتيجية.',
    descEn: 'Prominent hospitality group delivering premium executive lodging and suite accommodation across key Saudi cities.',
    logo: intourLogo,
    tags: ['ضيافة راقية', 'مواقع مركزية', 'استثمار فندقي'],
  },
  {
    id: 'albawardi',
    nameAr: 'مجموعة البواردي',
    nameEn: 'ALBAWARDI Group',
    sectorAr: 'التجارة والاستثمار والصناعة',
    sectorEn: 'Trading, Industry & Investment',
    descAr: 'صرح استثماري وصناعي عريق يمتلك شراكات وتوسعات واسعة في قطاعات التجارة وسلاسل الإمداد ومواد البناء.',
    descEn: 'A conglomerate with deep roots across industrial manufacturing, building materials distribution, and regional investments.',
    logo: albawardiLogo,
    tags: ['سلاسل إمداد', 'استثمار صناعي', 'شراكة لوجستية'],
  },
  {
    id: 'alma',
    nameAr: 'فنادق ومطاعم ألما',
    nameEn: 'ALMA Hotel & Restaurants',
    sectorAr: 'السياحة وسلاسل المطاعم',
    sectorEn: 'Tourism & Restaurant Chains',
    descAr: 'مجموعة رائدة في قطاع الأغذية والمشروبات والمطاعم الفاخرة المنتشرة في أبرز المجمعات والوجهات التجارية.',
    descEn: 'Leading F&B enterprise operating renowned dining destinations and hospitality concepts in prime retail districts.',
    logo: almaLogo,
    tags: ['مطاعم راقية', 'واجهات تجارية', 'مجمعات أعمال'],
  },
  {
    id: 'homes',
    nameAr: 'البيوت للأثاث',
    nameEn: 'HOMES Furniture',
    sectorAr: 'الأثاث والمفروشات والديكور',
    sectorEn: 'Furniture & Interior Design',
    descAr: 'علامة مميزة في عالم الأثاث والتصميم الداخلي والمفروشات العصرية، اختارت صالات أجدا لعرض أحدث تشكيلاتها.',
    descEn: 'Renowned brand in contemporary interior decor and furnishings, utilizing Ajda commercial showrooms.',
    logo: homesLogo,
    tags: ['صالات عرض كبرى', 'تصميم وديكور', 'تجزئة راقية'],
  },
];

const STATS = [
  { value: '+50', labelAr: 'شراكة تجارية واستثمارية', labelEn: 'Corporate Partnerships', icon: Handshake },
  { value: '100%', labelAr: 'التزام بجودة التنفيذ والمرافق', labelEn: 'Quality & Facility Commitment', icon: CheckCircle2 },
  { value: '+120,000', labelAr: 'متر مربع مطور للشركاء', labelEn: 'm² Developed for Partners', icon: Building2 },
  { value: '15+', labelAr: 'عاماً من الموثوقية والنمو', labelEn: 'Years of Market Trust', icon: Award },
];

interface ClientsPageProps {
  onNavigate: (page: 'home' | 'works' | 'booking' | 'contact' | 'clients') => void;
}

export const ClientsPage: React.FC<ClientsPageProps> = ({ onNavigate }) => {
  const { language, isRTL } = useLanguage();
  const isAr = language === 'ar';
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  return (
    <div className="pt-28 sm:pt-36 pb-24 min-h-screen relative">
      {/* Background ambient lighting */}
      <div
        aria-hidden
        className="absolute top-24 left-1/3 -translate-x-1/2 w-[600px] h-[350px] bg-accent/6 blur-[140px] rounded-full pointer-events-none -z-10"
      />
      <div
        aria-hidden
        className="absolute bottom-40 right-1/4 w-[500px] h-[300px] bg-gold/5 blur-[130px] rounded-full pointer-events-none -z-10"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <Reveal>
          <div className="text-center max-w-3xl mx-auto mb-16 sm:mb-20">
            <span className="inline-flex items-center gap-2 text-xs font-bold brand-badge px-4 py-2 rounded-full mb-4">
              <Handshake className="w-3.5 h-3.5 text-accent" />
              {isAr ? 'شركاء النجاح والمسيرة' : 'Our Success Partners'}
            </span>
            <h1 className="text-3xl sm:text-5xl font-black text-heading tracking-tight leading-tight">
              {isAr ? 'نخبة من كبرى' : 'Trusted by Premier'}{' '}
              <span className="brand-gradient-text">
                {isAr ? 'العلامات التجارية والشركات' : 'Enterprises & Brands'}
              </span>
            </h1>
            <p className="mt-4 text-sm sm:text-base text-neutral-text/75 leading-relaxed">
              {isAr
                ? 'نفخر بالثقة المتبادلة مع كبرى الشركات والمجموعات التجارية التي اختارت مشاريع أجدا العقارية كوجهة لأعمالها، معارضها ومستودعاتها الاستراتيجية.'
                : 'We take pride in our sustained partnerships with Saudi Arabia’s leading commercial and logistics corporations that anchor their headquarters and flagship hubs with us.'}
            </p>
          </div>
        </Reveal>

        {/* Stats Grid */}


        {/* Clients In-depth Cards */}
        <div className="mb-20">
          <div className="flex items-center justify-between gap-4 mb-8">
            <h2 className="text-xl sm:text-2xl font-black text-heading flex items-center gap-2.5">
              <Building2 className="w-6 h-6 text-accent" />
              <span>{isAr ? 'قائمة الشركاء الاستراتيجيين' : 'Strategic Partners Directory'}</span>
            </h2>
            <span className="text-xs text-neutral-text/60 font-semibold">
              {isAr ? `${CLIENTS_LIST.length} شركاء معتمدين` : `${CLIENTS_LIST.length} Accredited Partners`}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {CLIENTS_LIST.map((client, idx) => (
              <Reveal key={client.id} delay={idx * 80}>
                <div className="h-full rounded-3xl bg-surface/80 border border-muted-border/40 hover:border-accent/40 p-6 flex flex-col justify-between group transition-all duration-300 hover:-translate-y-1 shadow-xs hover:shadow-md">
                  <div>
                    {/* Logo container */}
                    <div className="w-full h-32 rounded-2xl bg-white p-4 flex items-center justify-center border border-slate-100 mb-6 group-hover:border-accent/20 transition-all">
                      <img
                        src={client.logo}
                        alt={isAr ? client.nameAr : client.nameEn}
                        className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-105"
                      />
                    </div>

                    {/* Sector Badge */}
                    <span className="inline-block text-[11px] font-bold px-3 py-1 rounded-full bg-accent/10 text-accent border border-accent/20 mb-3">
                      {isAr ? client.sectorAr : client.sectorEn}
                    </span>

                    {/* Client Name */}
                    <h3 className="text-base sm:text-lg font-black text-heading group-hover:text-accent transition-colors mb-2">
                      {isAr ? client.nameAr : client.nameEn}
                    </h3>

                    {/* Description */}
                    <p className="text-xs text-neutral-text/70 leading-relaxed mb-6">
                      {isAr ? client.descAr : client.descEn}
                    </p>
                  </div>

                  {/* Tags */}
                  <div className="border-t border-muted-border/30 pt-4 flex flex-wrap gap-1.5">
                    {client.tags.map((tag, tIdx) => (
                      <span
                        key={tIdx}
                        className="text-[10px] font-semibold px-2.5 py-0.5 rounded-lg bg-surface border border-muted-border/40 text-neutral-text/60"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>

        {/* Partnership Call to Action Banner */}
        <Reveal delay={200}>
          <div className="relative rounded-3xl overflow-hidden p-8 sm:p-12 border border-accent/30 brand-hero-mesh text-center sm:text-start flex flex-col sm:flex-row items-center justify-between gap-8">
            <div className="max-w-xl">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-full bg-accent/20 text-accent border border-accent/40 mb-3">
                <TrendingUp className="w-3.5 h-3.5" />
                {isAr ? 'فرص شراكة واستثمار' : 'Partnership & Investment'}
              </span>
              <h3 className="text-2xl sm:text-3xl font-black text-heading">
                {isAr ? 'هل تبحث عن موقع استراتيجي لأعمالك؟' : 'Looking for a Flagship Address for Your Enterprise?'}
              </h3>
              <p className="text-xs sm:text-sm text-neutral-text/75 mt-2 leading-relaxed">
                {isAr
                  ? 'انضم إلى نخبة عملائنا واستفد من مواقعنا الاستراتيجية على أهم المحاور الاقتصادية بالرياض والمملكة.'
                  : 'Partner with Ajda Real Estate and scale your business operations from premier commercial and logistics locations.'}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0 w-full sm:w-auto">
              <button
                onClick={() => onNavigate('contact')}
                className="w-full sm:w-auto brand-btn-primary font-bold text-xs sm:text-sm px-6 py-3.5 rounded-full flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-105"
              >
                <span>{isAr ? 'تواصل مع فريق التطوير' : 'Contact Development Team'}</span>
                <ArrowIcon className="w-4 h-4" />
              </button>
              <a
                href="https://wa.me/966580484528"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto brand-btn-secondary font-bold text-xs sm:text-sm px-6 py-3.5 rounded-full flex items-center justify-center gap-2"
              >
                <span>{isAr ? 'واتساب مباشر' : 'WhatsApp Us'}</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  );
};

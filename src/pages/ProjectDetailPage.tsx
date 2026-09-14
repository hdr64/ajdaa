import React, { useState, useEffect } from 'react';
import type { Property, PropertyUnit, UnitStatus } from '../types/property';
import { AdminStorage } from '../services/adminStorage';
import { useLanguage } from '../hooks/useLanguage';
import { Reveal } from '../components/common/Reveal';
import {
  MapPin,
  Play,
  Box,
  Layers,
  CheckCircle2,
  AlertCircle,
  Clock,
  Send,
  X,
  Building,
  Sparkles,
  Compass,
  Maximize2,
  ExternalLink
} from 'lucide-react';

interface ProjectDetailPageProps {
  projectId: number;
  onNavigate: (page: 'home' | 'works' | 'booking' | 'contact' | 'clients', options?: { projectId?: number; unitId?: string }) => void;
  onShowToast: (msg: string) => void;
}

const getYouTubeEmbedUrl = (url?: string, autoplay: boolean = true): string => {
  if (!url) return '';
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  if (match && match[1]) {
    return `https://www.youtube-nocookie.com/embed/${match[1]}?autoplay=${autoplay ? '1' : '0'}&rel=0&modestbranding=1`;
  }
  return url;
};

export const ProjectDetailPage: React.FC<ProjectDetailPageProps> = ({
  projectId,
  onNavigate,
  onShowToast,
}) => {
  const { language } = useLanguage();
  const isAr = language === 'ar';

  const project: Property | undefined = AdminStorage.getProjectById(projectId);

  const [selectedImage, setSelectedImage] = useState<string>(project?.image || '');
  const [activeFloorIndex, setActiveFloorIndex] = useState<number>(0);
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [interestModalUnit, setInterestModalUnit] = useState<PropertyUnit | null>(null);
  const [activeMediaTab, setActiveMediaTab] = useState<'photos' | 'video'>('photos');

  // Quick Inline Interest Form State
  const [interestName, setInterestName] = useState('');
  const [interestPhone, setInterestPhone] = useState('');
  const [interestEmail, setInterestEmail] = useState('');
  const [interestNotes, setInterestNotes] = useState('');
  const [submittingInterest, setSubmittingInterest] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  // Keyboard shortcut and scroll lock for video & interest modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setVideoModalOpen(false);
        setInterestModalUnit(null);
      }
    };
    if (videoModalOpen || interestModalUnit !== null) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [videoModalOpen, interestModalUnit]);

  const handleWatchVideo = (mode: 'hero' | 'modal' = 'hero') => {
    if (mode === 'modal') {
      setVideoModalOpen(true);
      return;
    }
    setActiveMediaTab('video');
    const el = document.getElementById('project-hero-media');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-accent', 'transition-all');
      setTimeout(() => el.classList.remove('ring-2', 'ring-accent'), 2000);
    } else {
      setVideoModalOpen(true);
    }
  };

  if (!project) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4 pt-32">
        <h2 className="text-2xl font-black text-heading mb-3">
          {isAr ? 'المشروع غير موجود' : 'Project Not Found'}
        </h2>
        <p className="text-sm text-neutral-text/60 mb-6">
          {isAr ? 'لم نتمكن من العثور على المشروع المطلوب.' : 'The requested project could not be found.'}
        </p>
        <button
          onClick={() => onNavigate('works')}
          className="brand-btn-primary font-bold text-xs px-6 py-2.5 rounded-full"
        >
          {isAr ? 'العودة لقائمة المشاريع' : 'Back to Projects'}
        </button>
      </div>
    );
  }

  const floors = project.floors || [];
  const activeFloor = floors[activeFloorIndex] || floors[0];

  const handleOpenInterest = (unit?: PropertyUnit) => {
    setInterestModalUnit(unit || null);
    setSubmittedSuccess(false);
  };

  const handleInterestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!interestName.trim()) {
      onShowToast(isAr ? 'يرجى إدخال اسمك الكريم' : 'Please enter your name');
      return;
    }

    setSubmittingInterest(true);
    setTimeout(() => {
      AdminStorage.addInquiry({
        name: interestName.trim(),
        phone: interestPhone.trim() || undefined,
        email: interestEmail.trim() || undefined,
        projectId: project.id,
        projectTitle: project.title,
        unitId: interestModalUnit?.id,
        unitNumber: interestModalUnit?.unitNumber,
        interestType: (project.priceType === 'بيع' ? 'buy' : project.priceType === 'إيجار' ? 'rent' : 'invest'),
        interestTypeAr: project.priceType === 'بيع' ? 'شراء' : project.priceType === 'إيجار' ? 'استئجار' : 'استثمار',
        message: interestNotes.trim() || undefined,
      });

      setSubmittingInterest(false);
      setSubmittedSuccess(true);
      onShowToast(isAr ? 'تم تسجيل اهتمامك بنجاح!' : 'Your interest has been recorded!');
      setTimeout(() => {
        setInterestModalUnit(null);
        setSubmittedSuccess(false);
        setInterestName('');
        setInterestPhone('');
        setInterestEmail('');
        setInterestNotes('');
      }, 1800);
    }, 600);
  };

  const getStatusBadge = (status: UnitStatus, statusAr?: string) => {
    switch (status) {
      case 'available':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" />
            {isAr ? statusAr || 'متاح' : 'Available'}
          </span>
        );
      case 'reserved':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-500 border border-amber-500/30">
            <Clock className="w-3 h-3" />
            {isAr ? statusAr || 'محجوز' : 'Reserved'}
          </span>
        );
      case 'rented':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30">
            <CheckCircle2 className="w-3 h-3" />
            {isAr ? statusAr || 'مؤجر' : 'Leased'}
          </span>
        );
      case 'sold':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-neutral-500/15 text-neutral-400 border border-neutral-500/30">
            <AlertCircle className="w-3 h-3" />
            {isAr ? statusAr || 'مباع' : 'Sold'}
          </span>
        );
    }
  };

  return (
    <div className="pt-28 sm:pt-36 pb-24 min-h-screen relative">
      {/* Background ambient lighting */}
      <div
        aria-hidden
        className="absolute top-24 right-1/4 w-[600px] h-[350px] bg-accent/8 blur-[140px] rounded-full pointer-events-none -z-10"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 text-xs text-neutral-text/60 mb-6 font-medium">
          <button
            onClick={() => onNavigate('home')}
            className="hover:text-accent transition cursor-pointer"
          >
            {isAr ? 'الرئيسية' : 'Home'}
          </button>
          <span>/</span>
          <button
            onClick={() => onNavigate('works')}
            className="hover:text-accent transition cursor-pointer"
          >
            {isAr ? 'المشاريع' : 'Projects'}
          </button>
          <span>/</span>
          <span className="text-heading font-bold truncate max-w-xs">{project.title}</span>
        </div>

        {/* Top Overview Grid: Gallery + Project Highlights */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-16">
          {/* Gallery & Video Showcase (7 Cols) */}
          <div id="project-hero-media" className="lg:col-span-7 flex flex-col gap-3">
            {/* Media Mode Tabs */}
            <div className="flex items-center justify-between gap-2 px-1">
              <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-surface/80 border border-muted-border/40 shadow-xs">
                <button
                  onClick={() => setActiveMediaTab('photos')}
                  className={`px-3.5 sm:px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeMediaTab === 'photos'
                      ? 'brand-fill text-canvas shadow-xs'
                      : 'text-neutral-text/70 hover:text-heading'
                  }`}
                >
                  <Building className="w-3.5 h-3.5" />
                  <span>{isAr ? 'الصور' : 'Photos'}</span>
                  {project.gallery && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      activeMediaTab === 'photos' ? 'bg-canvas/20 text-canvas' : 'bg-canvas/60 text-neutral-text/60'
                    }`}>
                      {project.gallery.length}
                    </span>
                  )}
                </button>

                {project.videoUrl && (
                  <button
                    onClick={() => setActiveMediaTab('video')}
                    className={`px-3.5 sm:px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      activeMediaTab === 'video'
                        ? 'brand-fill text-canvas shadow-xs'
                        : 'text-neutral-text/70 hover:text-accent'
                    }`}
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>{isAr ? 'فيديو المشروع' : 'Video Tour'}</span>
                    <span className="text-[9px] font-black px-1.5 py-0.2 rounded-full bg-accent/20 text-accent-light border border-accent/30">
                      4K
                    </span>
                  </button>
                )}
              </div>

              {/* Quick Cinema Modal Trigger */}
              {project.videoUrl && (
                <button
                  onClick={() => setVideoModalOpen(true)}
                  className="text-[11px] font-bold text-neutral-text/60 hover:text-accent flex items-center gap-1 transition px-2 py-1 cursor-pointer"
                  title={isAr ? 'فتح في نافذة السينما المكبرة' : 'Open in Cinema Lightbox'}
                >
                  <Maximize2 className="w-3.5 h-3.5 text-accent" />
                  <span className="hidden sm:inline">{isAr ? 'وضع السينما' : 'Cinema Mode'}</span>
                </button>
              )}
            </div>

            {/* Main Media Viewer */}
            {activeMediaTab === 'video' && project.videoUrl ? (
              <div className="relative aspect-[16/10] rounded-3xl overflow-hidden bg-black border border-accent/40 shadow-xl ring-1 ring-accent/20">
                <iframe
                  className="w-full h-full border-0"
                  src={getYouTubeEmbedUrl(project.videoUrl, true)}
                  title={project.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
                <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
                  <span className="brand-badge text-xs font-black px-3 py-1 rounded-full shadow-md">
                    {isAr ? 'فيديو تعريفي 4K' : '4K Video'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="relative aspect-[16/10] rounded-3xl overflow-hidden bg-surface border border-muted-border/40 shadow-sm group">
                <img
                  src={selectedImage || project.image}
                  alt={project.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />

                {/* Floating Play Video Button in Center if Video Exists */}
                {project.videoUrl && (
                  <button
                    onClick={() => setActiveMediaTab('video')}
                    className="absolute inset-0 m-auto w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-black/60 hover:bg-accent text-white backdrop-blur-md border border-white/30 flex items-center justify-center transition-all duration-300 hover:scale-110 shadow-2xl cursor-pointer group/play"
                    aria-label={isAr ? 'تشغيل جولة الفيديو' : 'Play Video Tour'}
                  >
                    <Play className="w-7 h-7 sm:w-8 sm:h-8 fill-current translate-x-[-1px] text-white group-hover/play:text-canvas transition-colors" />
                    <span className="absolute -bottom-8 whitespace-nowrap text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-black/75 backdrop-blur-md text-white border border-white/20 opacity-0 group-hover/play:opacity-100 transition-opacity">
                      {isAr ? 'مشاهدة جولة الفيديو 4K' : 'Watch 4K Tour'}
                    </span>
                  </button>
                )}

                <div className="absolute top-4 right-4 flex items-center gap-2">
                  <span className="brand-badge text-xs font-bold px-3 py-1 rounded-full shadow-md">
                    {project.badge || project.typeAr}
                  </span>
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-surface/90 backdrop-blur-md text-heading border border-muted-border/40 shadow-md">
                    {project.priceType}
                  </span>
                </div>
              </div>
            )}

            {/* Thumbnails Strip (Including Video Card) */}
            <div className="flex items-center gap-3 overflow-x-auto pb-2 pt-1">
              {/* Video Thumbnail Button */}
              {project.videoUrl && (
                <button
                  onClick={() => setActiveMediaTab('video')}
                  className={`relative w-24 h-16 rounded-xl overflow-hidden shrink-0 border-2 transition-all cursor-pointer flex flex-col items-center justify-center bg-neutral-900 text-white ${
                    activeMediaTab === 'video'
                      ? 'border-accent shadow-md scale-105 ring-2 ring-accent/40'
                      : 'border-muted-border/50 opacity-80 hover:opacity-100'
                  }`}
                >
                  <img
                    src={project.image}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover opacity-35"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                  <Play className="w-5 h-5 text-accent fill-accent mb-0.5 relative z-10" />
                  <span className="text-[10px] font-black relative z-10 text-white">
                    {isAr ? 'فيديو 4K' : 'Video'}
                  </span>
                </button>
              )}

              {/* Image Gallery Thumbnails */}
              {project.gallery && project.gallery.map((img, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setSelectedImage(img);
                    setActiveMediaTab('photos');
                  }}
                  className={`relative w-20 h-16 rounded-xl overflow-hidden shrink-0 border-2 transition-all cursor-pointer ${
                    activeMediaTab === 'photos' && selectedImage === img
                      ? 'border-accent shadow-md scale-105'
                      : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>

          {/* Project Details & Primary Action Hub (5 Cols) */}
          <div className="lg:col-span-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-accent mb-2">
                <Building className="w-4 h-4" />
                <span>{project.typeAr}</span>
                <span>•</span>
                <span className="flex items-center gap-1 text-neutral-text/70">
                  <MapPin className="w-3.5 h-3.5 text-accent" />
                  {project.city}
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-heading leading-tight mb-4">
                {project.title}
              </h1>

              <p className="text-xs sm:text-sm text-neutral-text/75 leading-relaxed mb-6">
                {project.description}
              </p>

              {/* Key Quick Stats */}
              <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-surface/80 border border-muted-border/40 mb-6">
                <div>
                  <span className="text-[11px] text-neutral-text/60 block">{isAr ? 'المساحة الإجمالية' : 'Total Area'}</span>
                  <span className="text-base font-black text-heading">{project.area.toLocaleString()} م²</span>
                </div>
                <div>
                  <span className="text-[11px] text-neutral-text/60 block">{isAr ? 'نوع العقد' : 'Contract Type'}</span>
                  <span className="text-base font-black text-accent">{project.priceType}</span>
                </div>
                <div>
                  <span className="text-[11px] text-neutral-text/60 block">{isAr ? 'حالة المشروع' : 'Status'}</span>
                  <span className="text-xs font-bold text-heading">{project.status || 'متاح'}</span>
                </div>
                <div>
                  <span className="text-[11px] text-neutral-text/60 block">{isAr ? 'عدد الأدوار والوحدات' : 'Floors & Units'}</span>
                  <span className="text-xs font-bold text-heading">
                    {floors.length > 0 ? `${floors.length} أدوار` : project.units || 'متعدد الوحدات'}
                  </span>
                </div>
              </div>
            </div>

            {/* Primary Action Buttons Bar */}
            <div className="flex flex-col gap-3 pt-2">
              {/* 1. Register Interest Button */}
              <button
                onClick={() => handleOpenInterest()}
                className="w-full brand-btn-primary font-black text-sm py-4 rounded-2xl flex items-center justify-center gap-2 cursor-pointer shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5"
              >
                <Sparkles className="w-4 h-4 text-[var(--brand-btn-text)]" />
                <span>{isAr ? 'سجل اهتمامك بهذا المشروع' : 'Register Interest in Project'}</span>
              </button>

              <div className="grid grid-cols-2 gap-3">
                {/* 2. Video Preview Button */}
                <button
                  onClick={() => handleWatchVideo('hero')}
                  className="brand-btn-secondary font-bold text-xs py-3 px-3 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer hover:text-accent hover:border-accent transition-all group"
                >
                  <Play className="w-3.5 h-3.5 text-accent shrink-0 fill-accent/20 group-hover:fill-accent/60 transition-colors" />
                  <span className="truncate">{isAr ? 'مشاهدة الفيديو' : 'Watch Video'}</span>
                </button>

                {/* 3. 3D Tour (Disabled with "Coming Soon") */}
                <div
                  title={isAr ? 'الجولة الافتراضية 3D قريباً' : '3D Virtual Tour Coming Soon'}
                  className="p-2.5 rounded-xl bg-surface/50 border border-muted-border/30 text-neutral-text/40 flex items-center justify-center gap-1.5 text-xs font-bold cursor-not-allowed select-none text-center"
                >
                  <Box className="w-3.5 h-3.5 shrink-0 opacity-50" />
                  <span className="truncate">{isAr ? '3D قريباً' : '3D Tour (Soon)'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Location Highlights Section */}
        {project.locationHighlightsAr && project.locationHighlightsAr.length > 0 && (
          <Reveal>
            <div className="mb-16 p-6 sm:p-8 rounded-3xl bg-surface/70 border border-muted-border/40">
              <div className="flex items-center gap-2.5 mb-6">
                <div className="w-10 h-10 rounded-xl brand-fill text-canvas flex items-center justify-center">
                  <Compass className="w-5 h-5 text-inherit" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-heading">{isAr ? 'الموقع والمميزات الاستراتيجية' : 'Strategic Location & Highlights'}</h3>
                  <p className="text-xs text-neutral-text/60">{isAr ? 'موقع نوعي وحضور استثنائي على أهم المحاور' : 'Prime corridor location with exceptional visibility'}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {project.locationHighlightsAr.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2.5 p-3 rounded-xl bg-canvas/60 border border-muted-border/30 text-xs font-bold text-heading">
                    <CheckCircle2 className="w-4 h-4 text-accent shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        )}

        {/* Dedicated Cinematic Video Showcase Section */}
        {project.videoUrl && (
          <Reveal>
            <div id="project-video-section" className="mb-20 scroll-mt-28">
              <div className="relative rounded-3xl overflow-hidden glass-card border border-accent/35 p-4 sm:p-7 shadow-xl">
                {/* Ambient glow */}
                <div
                  aria-hidden="true"
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-accent/15 blur-[130px] rounded-full pointer-events-none"
                />

                {/* Video Header bar */}
                <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-muted-border/30">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl brand-fill text-canvas flex items-center justify-center shrink-0 shadow-md">
                      <Play className="w-5 h-5 fill-current" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black brand-badge px-3 py-0.5 rounded-full text-accent">
                          {isAr ? 'فيديو تعريفي 4K' : 'Official 4K Showcase'}
                        </span>
                        <span className="text-[10px] text-neutral-text/60 font-medium">
                          {isAr ? 'إنتاج أجدا العقارية' : 'Ajda Real Estate Media'}
                        </span>
                      </div>
                      <h3 className="text-lg sm:text-2xl font-black text-heading mt-1">
                        {isAr ? `جولة سينمائية في ${project.title}` : `Cinematic Tour of ${project.title}`}
                      </h3>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <button
                      onClick={() => setVideoModalOpen(true)}
                      className="brand-btn-secondary text-xs font-bold px-4 py-2.5 rounded-xl inline-flex items-center gap-2 hover:border-accent hover:text-accent transition cursor-pointer shadow-xs"
                    >
                      <Maximize2 className="w-3.5 h-3.5 text-accent" />
                      <span>{isAr ? 'وضع السينما المكبر' : 'Theater Mode'}</span>
                    </button>
                  </div>
                </div>

                {/* 16:9 Video Player Container */}
                <div className="relative z-10 aspect-video w-full rounded-2xl overflow-hidden bg-black shadow-2xl border border-muted-border/50">
                  <iframe
                    className="w-full h-full border-0"
                    src={getYouTubeEmbedUrl(project.videoUrl, false)}
                    title={project.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    loading="lazy"
                  />
                </div>
              </div>
            </div>
          </Reveal>
        )}

        {/* Floor Plans & Units Interactive Breakdown */}
        {floors.length > 0 && (
          <div className="mb-20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
              <div>
                <span className="text-xs font-bold brand-badge px-3 py-1 rounded-full text-accent mb-2 inline-block">
                  {isAr ? 'توزيع الوحدات والمساحات' : 'Units & Floor Plans'}
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-heading flex items-center gap-2.5">
                  <Layers className="w-7 h-7 text-accent" />
                  <span>{isAr ? 'الأدوار والوحدات المتاحة' : 'Floors & Available Units'}</span>
                </h2>
              </div>
              <span className="text-xs text-neutral-text/60 font-medium">
                {isAr ? 'انقر على أي وحدة لتسجيل اهتمامك بها مباشرة' : 'Click any unit to express direct interest'}
              </span>
            </div>

            {/* Floor Navigation Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-8">
              {floors.map((floor, idx) => (
                <button
                  key={floor.floorNumber}
                  onClick={() => setActiveFloorIndex(idx)}
                  className={`px-5 py-3 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer border ${
                    activeFloorIndex === idx
                      ? 'brand-fill text-canvas border-accent shadow-sm scale-102'
                      : 'bg-surface/80 border-muted-border/40 text-neutral-text/80 hover:border-accent/40 hover:text-heading'
                  }`}
                >
                  {isAr ? floor.floorNameAr : floor.floorNameEn}
                </button>
              ))}
            </div>

            {/* Active Floor Details Banner */}
            {activeFloor && (
              <div className="mb-8 p-5 rounded-2xl bg-surface/60 border border-muted-border/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-black text-heading mb-1">
                    {isAr ? activeFloor.floorNameAr : activeFloor.floorNameEn}
                  </h3>
                  <p className="text-xs text-neutral-text/70">
                    {activeFloor.descriptionAr}
                  </p>
                </div>
                {activeFloor.totalArea && (
                  <div className="text-start sm:text-end shrink-0">
                    <span className="text-[11px] text-neutral-text/60 block">{isAr ? 'مساحة الدور' : 'Floor Area'}</span>
                    <span className="text-sm font-black text-accent">{activeFloor.totalArea} م²</span>
                  </div>
                )}
              </div>
            )}

            {/* Units Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {activeFloor?.units.map((unit) => (
                <div
                  key={unit.id}
                  className="rounded-2xl bg-surface/90 border border-muted-border/40 hover:border-accent/50 p-5 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 shadow-xs hover:shadow-md group"
                >
                  <div>
                    {/* Unit header */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        {unit.sectionAr && (
                          <span className="text-[10px] font-bold text-neutral-text/50 block mb-0.5">
                            {unit.sectionAr}
                          </span>
                        )}
                        <h4 className="text-base font-black text-heading group-hover:text-accent transition-colors">
                          {unit.unitNumber}
                        </h4>
                      </div>
                      {getStatusBadge(unit.status, unit.statusAr)}
                    </div>

                    {/* Specs */}
                    <div className="flex items-center gap-4 py-3 border-y border-muted-border/30 my-3 text-xs">
                      <div>
                        <span className="text-neutral-text/50 block text-[10px]">{isAr ? 'المساحة' : 'Area'}</span>
                        <span className="font-bold text-heading">{unit.area} م²</span>
                      </div>
                      <div>
                        <span className="text-neutral-text/50 block text-[10px]">{isAr ? 'النوع' : 'Type'}</span>
                        <span className="font-bold text-heading">{unit.typeAr}</span>
                      </div>
                      {unit.priceLabel && (
                        <div>
                          <span className="text-neutral-text/50 block text-[10px]">{isAr ? 'الحالة' : 'Note'}</span>
                          <span className="font-bold text-accent">{unit.priceLabel}</span>
                        </div>
                      )}
                    </div>

                    {/* Features checklist */}
                    {unit.features && unit.features.length > 0 && (
                      <div className="flex flex-col gap-1.5 mb-4">
                        {unit.features.map((feat, fIdx) => (
                          <div key={fIdx} className="flex items-center gap-1.5 text-[11px] text-neutral-text/70">
                            <span className="w-1.5 h-1.5 rounded-full bg-accent/60" />
                            <span>{feat}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Unit CTA */}
                  <button
                    onClick={() => handleOpenInterest(unit)}
                    className="w-full mt-2 brand-btn-secondary text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 group-hover:border-accent group-hover:bg-accent/10 transition-all cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-accent" />
                    <span>{isAr ? 'سجل اهتمامك بهذه الوحدة' : 'Express Interest'}</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Video Preview Modal (Cinematic Theater Lightbox) */}
      {videoModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 md:p-8 animate-fade-in"
          role="dialog"
          aria-modal="true"
        >
          {/* Deep dark backdrop with click-to-close */}
          <div
            className="absolute inset-0 bg-neutral-950/95 backdrop-blur-2xl transition-opacity cursor-pointer"
            onClick={() => setVideoModalOpen(false)}
          />

          {/* Ambient subtle backlight behind modal */}
          <div
            aria-hidden="true"
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[75vw] max-w-4xl h-[50vh] bg-accent/15 blur-[120px] rounded-full pointer-events-none"
          />

          {/* Integrated Luxury Cinema Modal Card */}
          <div
            className="relative w-full max-w-5xl z-10 flex flex-col rounded-2xl sm:rounded-3xl overflow-hidden bg-neutral-900/95 border border-white/15 shadow-[0_25px_80px_rgba(0,0,0,0.85)] ring-1 ring-white/10 my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Bar Header */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-black/60 border-b border-white/10 backdrop-blur-md">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-xl brand-fill text-canvas flex items-center justify-center shrink-0 shadow-sm">
                  <Play className="w-3.5 h-3.5 fill-current" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-accent/20 border border-accent/40 text-accent-light">
                      {isAr ? 'عرض سينمائي 4K' : 'Cinema Mode 4K'}
                    </span>
                    <span className="text-[11px] text-white/50 hidden md:inline">
                      {project.city} • {project.typeAr}
                    </span>
                  </div>
                  <h3 className="text-sm sm:text-base font-black text-white truncate mt-0.5">
                    {project.title}
                  </h3>
                </div>
              </div>

              {/* Header Right Actions */}
              <div className="flex items-center gap-2 shrink-0">
                {project.videoUrl && (
                  <a
                    href={project.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={isAr ? 'فتح على يوتيوب' : 'Open on YouTube'}
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/15 text-white/70 hover:text-white border border-white/10 transition hidden sm:flex items-center gap-1.5 text-xs font-bold"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>YouTube</span>
                  </a>
                )}

                <button
                  onClick={() => setVideoModalOpen(false)}
                  aria-label={isAr ? 'إغلاق الفيديو' : 'Close video'}
                  className="w-9 h-9 rounded-xl bg-white/10 hover:bg-red-500/80 text-white/90 hover:text-white border border-white/15 flex items-center justify-center transition-all cursor-pointer hover:scale-105"
                  title={isAr ? 'إغلاق (Esc)' : 'Close (Esc)'}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Video Player Card */}
            <div className="relative aspect-video w-full bg-black flex items-center justify-center max-h-[70vh]">
              <iframe
                className="w-full h-full border-0"
                src={getYouTubeEmbedUrl(project.videoUrl, true)}
                title={project.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>

            {/* Bottom Bar Info & CTA */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-6 py-3.5 bg-black/70 border-t border-white/10 text-white text-xs">
              <div className="flex items-center gap-4 text-white/70 text-[11px] sm:text-xs">
                <span>
                  <strong className="text-white font-bold">{isAr ? 'المساحة: ' : 'Area: '}</strong>
                  {project.area.toLocaleString()} م²
                </span>
                <span>•</span>
                <span>
                  <strong className="text-white font-bold">{isAr ? 'العقد: ' : 'Contract: '}</strong>
                  <span className="text-accent font-bold">{project.priceType}</span>
                </span>
                <span>•</span>
                <span>
                  <strong className="text-white font-bold">{isAr ? 'الحالة: ' : 'Status: '}</strong>
                  {project.status || 'متاح'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setVideoModalOpen(false);
                    handleOpenInterest();
                  }}
                  className="brand-btn-primary font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isAr ? 'سجل اهتمامك بهذا المشروع' : 'Express Interest'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Register Interest Modal */}
      {interestModalUnit !== null && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg bg-surface rounded-3xl border border-muted-border/40 shadow-2xl p-6 sm:p-8 my-8">
            <button
              onClick={() => setInterestModalUnit(null)}
              className="absolute top-5 left-5 w-8 h-8 rounded-full bg-surface border border-muted-border/40 flex items-center justify-center text-heading hover:text-accent cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="mb-6">
              <span className="text-[11px] font-bold text-accent brand-badge px-3 py-1 rounded-full mb-2 inline-block">
                {isAr ? 'تسجيل اهتمام' : 'Register Interest'}
              </span>
              <h3 className="text-xl font-black text-heading">
                {interestModalUnit ? `${project.title} - ${interestModalUnit.unitNumber}` : project.title}
              </h3>
              <p className="text-xs text-neutral-text/60 mt-1">
                {isAr ? 'أدخل بياناتك وسيتواصل معك فريق الاستثمار والتطوير مباشرة' : 'Leave your details and our team will get back to you promptly.'}
              </p>
            </div>

            {submittedSuccess ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h4 className="text-lg font-black text-heading mb-1">
                  {isAr ? 'تم تسجيل اهتمامك بنجاح!' : 'Interest Registered!'}
                </h4>
                <p className="text-xs text-neutral-text/70">
                  {isAr ? 'شكراً لاهتمامك بمشاريع أجدا العقارية.' : 'Thank you for your interest in Ajda developments.'}
                </p>
              </div>
            ) : (
              <form onSubmit={handleInterestSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-neutral-text/70 mb-1">
                    {isAr ? 'الاسم الكامل *' : 'Full Name *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={interestName}
                    onChange={(e) => setInterestName(e.target.value)}
                    placeholder={isAr ? 'أدخل اسمك الكريم' : 'Enter your name'}
                    className="w-full px-4 py-2.5 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-neutral-text/70 mb-1">
                      {isAr ? 'رقم الجوال (اختياري)' : 'Mobile (Optional)'}
                    </label>
                    <input
                      type="tel"
                      dir="ltr"
                      value={interestPhone}
                      onChange={(e) => setInterestPhone(e.target.value)}
                      placeholder="+966 5X XXX XXXX"
                      className="w-full px-4 py-2.5 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-neutral-text/70 mb-1">
                      {isAr ? 'البريد الإلكتروني (اختياري)' : 'Email (Optional)'}
                    </label>
                    <input
                      type="email"
                      dir="ltr"
                      value={interestEmail}
                      onChange={(e) => setInterestEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full px-4 py-2.5 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-neutral-text/70 mb-1">
                    {isAr ? 'ملاحظات أو استفسار' : 'Notes or Inquiries'}
                  </label>
                  <textarea
                    rows={3}
                    value={interestNotes}
                    onChange={(e) => setInterestNotes(e.target.value)}
                    placeholder={isAr ? 'اكتب أي متطلبات خاصة أو استفسار حول المساحة أو الأسعار...' : 'Any specific requirements or questions...'}
                    className="w-full px-4 py-2.5 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingInterest}
                  className="brand-btn-primary font-black text-xs py-3.5 rounded-xl flex items-center justify-center gap-2 cursor-pointer mt-2 disabled:opacity-50"
                >
                  {submittingInterest ? (
                    <span>{isAr ? 'جاري الإرسال...' : 'Submitting...'}</span>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>{isAr ? 'تأكيد تسجيل الاهتمام' : 'Submit Interest'}</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

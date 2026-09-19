import React, { useState, useMemo } from 'react';
import type { Property, PropertyUnit, UnitStatus, CustomerInquiry, PropertyType } from '../../types/property';
import { AdminStorage, type CategoryItem } from '../../services/adminStorage';
import { useLanguage } from '../../hooks/useLanguage';
import { BuildingVisualizer } from '../../components/admin/BuildingVisualizer';
import { UsersPermissionsManager } from '../../components/admin/UsersPermissionsManager';
import {
  LayoutDashboard,
  Building2,
  Layers,
  Tags,
  Users,
  LogOut,
  ExternalLink,
  Plus,
  CheckCircle2,
  Clock,
  RefreshCw,
  ShieldCheck,
  Search,
  MapPin,
  TrendingUp,
  MessageCircle,
  Phone,
  Store,
  Warehouse,
  Building,
  Trash2,
  Eye,
  Filter,
  ArrowUpRight,
  SlidersHorizontal
} from 'lucide-react';

interface AdminDashboardPageProps {
  onLogout: () => void;
  onNavigateHome: () => void;
  onShowToast: (msg: string) => void;
}

type AdminTab = 'overview' | 'projects' | 'units' | 'categories' | 'inquiries' | 'users';

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({
  onLogout,
  onNavigateHome,
  onShowToast,
}) => {
  const { language } = useLanguage();
  const isAr = language === 'ar';

  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [projects, setProjects] = useState<Property[]>(() => AdminStorage.getAllProjects());
  const [inquiries, setInquiries] = useState<CustomerInquiry[]>(() => AdminStorage.getInquiries());
  const [categories, setCategories] = useState<CategoryItem[]>(() => AdminStorage.getCategories());

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [projectTypeFilter, setProjectTypeFilter] = useState<string>('all');
  const [inquiryStatusFilter, setInquiryStatusFilter] = useState<string>('all');

  // Unit management selected project
  const [selectedProjectId, setSelectedProjectId] = useState<number>(projects[0]?.id || 206);

  // New Project Modal State
  const [newProjectModalOpen, setNewProjectModalOpen] = useState(false);
  const [newProjectData, setNewProjectData] = useState({
    title: '',
    type: 'commercial' as PropertyType,
    city: 'الرياض',
    area: 5000,
    priceType: 'إيجار' as 'إيجار' | 'بيع' | 'استثمار',
    description: '',
    floorsCount: 3,
    unitsPerFloor: 4,
  });

  // Category new tag state
  const [newTagText, setNewTagText] = useState('');
  const [activeCategoryForTag, setActiveCategoryForTag] = useState<string>('cat-commercial');

  const refreshData = () => {
    setProjects(AdminStorage.getAllProjects());
    setInquiries(AdminStorage.getInquiries());
    setCategories(AdminStorage.getCategories());
    onShowToast(isAr ? 'تم تحديث البيانات بنجاح' : 'Data refreshed');
  };

  // Portfolio Stats Calculations
  const totalProjects = projects.length;
  let totalUnits = 0;
  let availableUnits = 0;
  let reservedUnits = 0;
  let rentedUnits = 0;
  let totalBuiltArea = 0;

  projects.forEach((p) => {
    totalBuiltArea += p.area || 0;
    p.floors?.forEach((f) => {
      f.units.forEach((u) => {
        totalUnits++;
        if (u.status === 'available') availableUnits++;
        else if (u.status === 'reserved') reservedUnits++;
        else if (u.status === 'rented' || u.status === 'sold') rentedUnits++;
      });
    });
  });

  const occupancyRate = totalUnits > 0 ? Math.round(((reservedUnits + rentedUnits) / totalUnits) * 100) : 0;
  const newInquiriesCount = inquiries.filter((i) => i.status === 'new').length;

  const handleInquiryStatusChange = (id: string, newStatus: 'new' | 'contacted' | 'closed') => {
    AdminStorage.updateInquiryStatus(id, newStatus);
    refreshData();
    onShowToast(isAr ? 'تم تحديث حالة طلب الاهتمام' : 'Inquiry status updated');
  };

  const handleDeleteProject = (id: number, title: string) => {
    if (window.confirm(isAr ? `هل أنت متأكد من حذف المشروع "${title}"؟` : `Are you sure you want to delete "${title}"?`)) {
      AdminStorage.deleteProject(id);
      refreshData();
      onShowToast(isAr ? 'تم حذف المشروع' : 'Project deleted');
    }
  };

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectData.title.trim()) return;

    const newId = Date.now();
    const typeArMap: Record<PropertyType, string> = {
      commercial: 'مجمع ومراكز تجارية',
      residential: 'مجمع سكني فاخر',
      office: 'مبنى إداري للأعمال',
      logistics: 'مستودعات ومخازن لوجستية',
    };

    // Auto-generate realistic floors & units
    const generatedFloors = Array.from({ length: newProjectData.floorsCount }).map((_, fIdx) => {
      const floorNameAr =
        fIdx === 0
          ? 'الدور الأرضي'
          : fIdx === 1
          ? 'الدور الأول'
          : fIdx === 2
          ? 'الدور الثاني'
          : `الدور ${fIdx + 1}`;

      const units: PropertyUnit[] = Array.from({ length: newProjectData.unitsPerFloor }).map((_, uIdx) => {
        const uNum = (fIdx + 1) * 100 + (uIdx + 1);
        const unitType =
          newProjectData.type === 'residential'
            ? 'apartment'
            : newProjectData.type === 'commercial' && fIdx === 0
            ? 'showroom'
            : newProjectData.type === 'logistics'
            ? 'warehouse'
            : 'office';

        const unitTypeAr =
          unitType === 'apartment'
            ? 'شقة سكنية فاخرة'
            : unitType === 'showroom'
            ? 'معرض تجاري'
            : unitType === 'warehouse'
            ? 'مستودع تخزين'
            : 'مكتب إداري';

        return {
          id: `p${newId}-f${fIdx}-u${uIdx}`,
          unitNumber: `وحدة ${uNum}`,
          floorNumber: fIdx,
          floorNameAr,
          type: unitType,
          typeAr: unitTypeAr,
          area: Math.round(newProjectData.area / (newProjectData.floorsCount * newProjectData.unitsPerFloor)),
          status: 'available' as UnitStatus,
          statusAr: 'متاح',
          features: ['تشطيب راقي', 'تكييف مركزي', 'مواقف خاصة'],
        };
      });

      return {
        floorNumber: fIdx,
        floorNameAr,
        floorNameEn: `Floor ${fIdx}`,
        totalArea: Math.round(newProjectData.area / newProjectData.floorsCount),
        units,
      };
    });

    const newProj: Property = {
      id: newId,
      title: newProjectData.title.trim(),
      type: newProjectData.type,
      typeAr: typeArMap[newProjectData.type],
      priceType: newProjectData.priceType,
      city: newProjectData.city,
      area: newProjectData.area,
      status: 'متاح',
      image: projects[0]?.image || '',
      description: newProjectData.description || 'مشروع جديد متميز تم إدراجه من خلال لوحة التحكم.',
      floors: generatedFloors,
      virtualTour3dAvailable: true,
    };

    AdminStorage.saveNewProject(newProj);
    refreshData();
    setNewProjectModalOpen(false);
    setNewProjectData({
      title: '',
      type: 'commercial',
      city: 'الرياض',
      area: 5000,
      priceType: 'إيجار',
      description: '',
      floorsCount: 3,
      unitsPerFloor: 4,
    });
    onShowToast(isAr ? 'تم إنشاء المشروع الجديد بنجاح!' : 'New project added successfully!');
  };

  const handleAddTag = (catId: string) => {
    if (!newTagText.trim()) return;
    const updated = categories.map((c) =>
      c.id === catId ? { ...c, tags: [...c.tags, newTagText.trim()] } : c
    );
    AdminStorage.saveCategories(updated);
    setCategories(updated);
    setNewTagText('');
    onShowToast(isAr ? 'تمت إضافة الوسم بنجاح' : 'Tag added successfully');
  };

  const selectedProjectForUnits = projects.find((p) => p.id === selectedProjectId) || projects[0];

  // Filtered Projects for Projects Tab
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const matchType = projectTypeFilter === 'all' || p.type === projectTypeFilter;
      const matchSearch =
        !searchQuery.trim() ||
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.city.toLowerCase().includes(searchQuery.toLowerCase());
      return matchType && matchSearch;
    });
  }, [projects, projectTypeFilter, searchQuery]);

  // Filtered Inquiries for Inquiries Tab
  const filteredInquiries = useMemo(() => {
    return inquiries.filter((inq) => {
      const matchStatus = inquiryStatusFilter === 'all' || inq.status === inquiryStatusFilter;
      const matchSearch =
        !searchQuery.trim() ||
        inq.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (inq.phone && inq.phone.includes(searchQuery)) ||
        (inq.projectTitle && inq.projectTitle.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchStatus && matchSearch;
    });
  }, [inquiries, inquiryStatusFilter, searchQuery]);

  return (
    <div className="min-h-screen bg-canvas flex flex-col md:flex-row text-xs selection:bg-accent selection:text-white">
      {/* 1. LUXURY EXECUTIVE SIDEBAR */}
      <aside className="w-full md:w-72 bg-surface border-e border-muted-border/40 flex flex-col justify-between shrink-0 p-4 shadow-sm z-30">
        <div>
          {/* Executive Brand Emblem */}
          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-gradient-to-br from-surface to-surface-hover border border-muted-border/50 shadow-xs mb-5">
            <div className="w-10 h-10 rounded-xl brand-fill text-canvas flex items-center justify-center font-black text-sm shadow-md ring-2 ring-accent/20">
              أجدا
            </div>
            <div className="min-w-0">
              <h2 className="text-xs font-black text-heading truncate">أجدا للتطوير العقاري</h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] text-accent font-bold">بوابة الإدارة التنفيذية</span>
              </div>
            </div>
          </div>

          {/* Active Administrator Card */}
          <div className="p-3 rounded-2xl bg-canvas/70 border border-muted-border/30 mb-5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent/15 text-accent flex items-center justify-center font-black text-xs shrink-0 border border-accent/25">
              SM
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-heading truncate">سلطان المقرن</div>
              <div className="text-[10px] text-gold font-medium truncate">مدير عام النظام (Super Admin)</div>
            </div>
          </div>

          {/* Navigation Menu */}
          <nav className="space-y-1.5 font-bold">
            <button
              onClick={() => setActiveTab('overview')}
              className={`w-full flex items-center justify-between p-3 rounded-xl transition-all cursor-pointer ${
                activeTab === 'overview'
                  ? 'brand-fill text-canvas shadow-md scale-[1.01]'
                  : 'text-neutral-text/75 hover:bg-surface-hover hover:text-heading'
              }`}
            >
              <div className="flex items-center gap-3">
                <LayoutDashboard className="w-4 h-4" />
                <span>نظرة عامة ومؤشرات الأداء</span>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('projects')}
              className={`w-full flex items-center justify-between p-3 rounded-xl transition-all cursor-pointer ${
                activeTab === 'projects'
                  ? 'brand-fill text-canvas shadow-md scale-[1.01]'
                  : 'text-neutral-text/75 hover:bg-surface-hover hover:text-heading'
              }`}
            >
              <div className="flex items-center gap-3">
                <Building2 className="w-4 h-4" />
                <span>إدارة المشاريع العقارية</span>
              </div>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                  activeTab === 'projects' ? 'bg-canvas/20 text-canvas' : 'bg-surface border border-muted-border/40 text-neutral-text/70'
                }`}
              >
                {totalProjects}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('units')}
              className={`w-full flex items-center justify-between p-3 rounded-xl transition-all cursor-pointer ${
                activeTab === 'units'
                  ? 'brand-fill text-canvas shadow-md scale-[1.01]'
                  : 'text-neutral-text/75 hover:bg-surface-hover hover:text-heading'
              }`}
            >
              <div className="flex items-center gap-3">
                <Layers className="w-4 h-4" />
                <span>المخطط البصري للأدوار</span>
              </div>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                  activeTab === 'units' ? 'bg-canvas/20 text-canvas' : 'bg-surface border border-muted-border/40 text-neutral-text/70'
                }`}
              >
                {totalUnits}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('inquiries')}
              className={`w-full flex items-center justify-between p-3 rounded-xl transition-all cursor-pointer ${
                activeTab === 'inquiries'
                  ? 'brand-fill text-canvas shadow-md scale-[1.01]'
                  : 'text-neutral-text/75 hover:bg-surface-hover hover:text-heading'
              }`}
            >
              <div className="flex items-center gap-3">
                <Users className="w-4 h-4" />
                <span>طلبات الاهتمام والعملاء</span>
              </div>
              {newInquiriesCount > 0 && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500 text-white shadow-xs animate-pulse">
                  {newInquiriesCount} جديد
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('categories')}
              className={`w-full flex items-center justify-between p-3 rounded-xl transition-all cursor-pointer ${
                activeTab === 'categories'
                  ? 'brand-fill text-canvas shadow-md scale-[1.01]'
                  : 'text-neutral-text/75 hover:bg-surface-hover hover:text-heading'
              }`}
            >
              <div className="flex items-center gap-3">
                <Tags className="w-4 h-4" />
                <span>التصنيفات والوسوم</span>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('users')}
              className={`w-full flex items-center justify-between p-3 rounded-xl transition-all cursor-pointer ${
                activeTab === 'users'
                  ? 'brand-fill text-canvas shadow-md scale-[1.01]'
                  : 'text-neutral-text/75 hover:bg-surface-hover hover:text-heading'
              }`}
            >
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-4 h-4" />
                <span>المستخدمين والصلاحيات</span>
              </div>
            </button>
          </nav>
        </div>

        {/* Sidebar Bottom Dock */}
        <div className="pt-4 border-t border-muted-border/30 space-y-2">
          <button
            onClick={onNavigateHome}
            className="w-full p-2.5 rounded-xl border border-muted-border/40 hover:border-accent hover:bg-accent/5 flex items-center justify-center gap-2 text-neutral-text/80 hover:text-accent font-bold transition cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>عرض الموقع الحي</span>
          </button>

          <button
            onClick={onLogout}
            className="w-full p-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 flex items-center justify-center gap-2 font-bold transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>تسجيل الخروج الآمن</span>
          </button>
        </div>
      </aside>

      {/* 2. MAIN EXECUTIVE WORKSPACE */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto max-h-screen">
        {/* Top Control Bar */}
        <header className="h-20 px-6 bg-surface/85 border-b border-muted-border/30 backdrop-blur-xl flex items-center justify-between sticky top-0 z-20 gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div>
              <h1 className="text-base sm:text-lg font-black text-heading leading-tight truncate">
                {activeTab === 'overview' && 'لوحة التحكم والمؤشرات العقارية'}
                {activeTab === 'projects' && 'المحفظة العقارية والمشاريع'}
                {activeTab === 'units' && 'المخطط البصري للأدوار وتوزيع الوحدات'}
                {activeTab === 'categories' && 'التصنيفات والوسوم المعتمدة'}
                {activeTab === 'inquiries' && 'إدارة طلبات الاهتمام والتواصل مع المستثمرين'}
                {activeTab === 'users' && 'المستخدمين ومصفوفة الأذونات'}
              </h1>
              <p className="text-[10px] text-neutral-text/60 mt-0.5 hidden sm:block">
                متابعة حركة الأصول، نسب الإشغال، والفرص الاستثمارية الفعالة
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Live Market Status Badge */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 font-bold text-[11px]">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>السوق العقاري: نشط</span>
            </div>

            {/* Quick Refresh */}
            <button
              onClick={refreshData}
              title="تحديث البيانات"
              className="p-2.5 rounded-xl border border-muted-border/40 hover:border-accent hover:text-accent bg-surface transition cursor-pointer text-neutral-text/70 shadow-xs"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {/* Primary Action: Add Project */}
            <button
              onClick={() => setNewProjectModalOpen(true)}
              className="brand-btn-primary font-black px-4 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer shadow-md hover:shadow-lg transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة مشروع جديد</span>
            </button>
          </div>
        </header>

        {/* Content Body */}
        <div className="p-6 space-y-6 flex-1">
          {/* TAB 1: EXECUTIVE OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* 4 Hero Analytical KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Projects & Managed Area */}
                <div className="p-5 rounded-2xl bg-surface border border-muted-border/40 shadow-xs hover:border-accent/40 transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-neutral-text/60 font-bold text-xs">إجمالي المحفظة العقارية</span>
                      <div className="w-8 h-8 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
                        <Building2 className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-3xl font-black text-heading tracking-tight">{totalProjects}</div>
                    <div className="text-[11px] font-bold text-accent mt-1 flex items-center gap-1">
                      <span>{totalBuiltArea.toLocaleString()} م²</span>
                      <span className="text-neutral-text/50 text-[10px]">مساحة مبنية</span>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-muted-border/20 text-[10px] text-neutral-text/60">
                    مشاريع تجارية، إدارية ولوجستية
                  </div>
                </div>

                {/* 2. Occupancy Rate & Units */}
                <div className="p-5 rounded-2xl bg-surface border border-muted-border/40 shadow-xs hover:border-accent/40 transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-neutral-text/60 font-bold text-xs">معدل الإشغال الكلي</span>
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                        <TrendingUp className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-3xl font-black text-emerald-500 tracking-tight">{occupancyRate}%</div>
                    <div className="w-full bg-canvas rounded-full h-2 mt-2 overflow-hidden border border-muted-border/30">
                      <div
                        className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-700"
                        style={{ width: `${occupancyRate}%` }}
                      />
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-muted-border/20 flex items-center justify-between text-[10px]">
                    <span className="text-emerald-500 font-bold">{availableUnits} متاح</span>
                    <span className="text-amber-500 font-bold">{reservedUnits} محجوز</span>
                    <span className="text-neutral-text/60">{rentedUnits} مؤجر</span>
                  </div>
                </div>

                {/* 3. Inquiries & Sales Pipeline */}
                <div className="p-5 rounded-2xl bg-surface border border-muted-border/40 shadow-xs hover:border-accent/40 transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-neutral-text/60 font-bold text-xs">طلبات الاهتمام الواردة</span>
                      <div className="w-8 h-8 rounded-xl bg-gold/15 flex items-center justify-center text-gold">
                        <Users className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-3xl font-black text-heading tracking-tight">{inquiries.length}</div>
                    <div className="text-[11px] font-bold text-emerald-500 mt-1 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                      <span>{newInquiriesCount} طلبات جديدة</span>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-muted-border/20 text-[10px] text-neutral-text/60">
                    فرص ومستثمرين بانتظار المتابعة
                  </div>
                </div>

                {/* 4. Total Units in System */}
                <div className="p-5 rounded-2xl bg-surface border border-muted-border/40 shadow-xs hover:border-accent/40 transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-neutral-text/60 font-bold text-xs">الوحدات الاستثمارية</span>
                      <div className="w-8 h-8 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
                        <Layers className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-3xl font-black text-heading tracking-tight">{totalUnits}</div>
                    <div className="text-[11px] font-bold text-neutral-text/70 mt-1">
                      صالات، مكاتب، ومستودعات
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-muted-border/20 text-[10px] text-accent font-bold">
                    جاهزة لإدارة العقود والإشغال
                  </div>
                </div>
              </div>

              {/* Quick Pipeline & Recent Inquiries CRM Table */}
              <div className="rounded-2xl bg-surface border border-muted-border/40 p-6 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-muted-border/30">
                  <div>
                    <h3 className="text-sm font-black text-heading">أحدث استفسارات المستثمرين والعملاء</h3>
                    <p className="text-[11px] text-neutral-text/60 mt-0.5">
                      طلبات التأجير والاستثمار المسجلة عبر البوابة الرئيسية
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('inquiries')}
                    className="brand-btn-secondary px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 hover:text-accent transition cursor-pointer self-start sm:self-auto"
                  >
                    <span>عرض سجل الاستفسارات الكامل ({inquiries.length})</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-start border-collapse">
                    <thead>
                      <tr className="border-b border-muted-border/20 text-neutral-text/50 text-[11px]">
                        <th className="pb-3 text-start font-bold">العميل والمستثمر</th>
                        <th className="pb-3 text-start font-bold">المشروع المستهدف</th>
                        <th className="pb-3 text-start font-bold">نوع الاهتمام</th>
                        <th className="pb-3 text-start font-bold">التاريخ</th>
                        <th className="pb-3 text-start font-bold">الحالة</th>
                        <th className="pb-3 text-end font-bold">إجراء سريع</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-muted-border/15">
                      {inquiries.slice(0, 6).map((inq) => (
                        <tr key={inq.id} className="hover:bg-surface-hover/60 transition-colors">
                          {/* Client */}
                          <td className="py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-xl bg-accent/10 text-accent font-black text-xs flex items-center justify-center shrink-0">
                                {inq.name.slice(0, 1)}
                              </div>
                              <div>
                                <div className="font-bold text-heading text-xs">{inq.name}</div>
                                <div className="text-[10px] text-neutral-text/60 font-mono" dir="ltr">
                                  {inq.phone || inq.email || '-'}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Target Project */}
                          <td className="py-3.5">
                            <span className="font-bold text-heading block">{inq.projectTitle || 'مشروع عام'}</span>
                            {inq.unitNumber && (
                              <span className="text-[10px] text-accent font-medium block">
                                {inq.unitNumber}
                              </span>
                            )}
                          </td>

                          {/* Interest type */}
                          <td className="py-3.5">
                            <span className="px-2.5 py-1 rounded-full bg-accent/10 text-accent font-black text-[10px] border border-accent/20">
                              {inq.interestTypeAr}
                            </span>
                          </td>

                          {/* Date */}
                          <td className="py-3.5 text-[11px] text-neutral-text/60 whitespace-nowrap">
                            {new Date(inq.createdAt).toLocaleDateString('ar-SA')}
                          </td>

                          {/* Status dropdown */}
                          <td className="py-3.5">
                            <select
                              value={inq.status}
                              onChange={(e) =>
                                handleInquiryStatusChange(inq.id, e.target.value as any)
                              }
                              className={`text-[11px] font-bold px-2.5 py-1 rounded-xl border outline-none cursor-pointer ${
                                inq.status === 'new'
                                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
                                  : inq.status === 'contacted'
                                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-500'
                                  : 'bg-neutral-500/10 border-neutral-500/30 text-neutral-400'
                              }`}
                            >
                              <option value="new">جديد</option>
                              <option value="contacted">تم التواصل</option>
                              <option value="closed">مغلق</option>
                            </select>
                          </td>

                          {/* Quick Action */}
                          <td className="py-3.5 text-end">
                            {inq.phone && (
                              <a
                                href={`https://wa.me/${inq.phone.replace(/[^0-9]/g, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 transition inline-flex items-center justify-center cursor-pointer"
                                title="تواصل عبر واتساب"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PROJECTS PORTFOLIO (Visual Cards) */}
          {activeTab === 'projects' && (
            <div className="space-y-5">
              {/* Filter & Search Bar */}
              <div className="p-4 rounded-2xl bg-surface border border-muted-border/40 flex flex-col md:flex-row md:items-center justify-between gap-3">
                {/* Search */}
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-text/40" />
                  <input
                    type="text"
                    placeholder="ابحث باسم المشروع، المدينة، أو النوع..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full ps-10 pe-4 py-2 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent"
                  />
                </div>

                {/* Category Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                  <button
                    onClick={() => setProjectTypeFilter('all')}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer ${
                      projectTypeFilter === 'all'
                        ? 'brand-fill text-canvas shadow-xs'
                        : 'bg-canvas border border-muted-border/40 text-neutral-text/70 hover:text-heading'
                    }`}
                  >
                    الكل ({projects.length})
                  </button>
                  <button
                    onClick={() => setProjectTypeFilter('commercial')}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer ${
                      projectTypeFilter === 'commercial'
                        ? 'brand-fill text-canvas shadow-xs'
                        : 'bg-canvas border border-muted-border/40 text-neutral-text/70 hover:text-heading'
                    }`}
                  >
                    تجاري
                  </button>
                  <button
                    onClick={() => setProjectTypeFilter('office')}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer ${
                      projectTypeFilter === 'office'
                        ? 'brand-fill text-canvas shadow-xs'
                        : 'bg-canvas border border-muted-border/40 text-neutral-text/70 hover:text-heading'
                    }`}
                  >
                    إداري ومكتبي
                  </button>
                  <button
                    onClick={() => setProjectTypeFilter('logistics')}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer ${
                      projectTypeFilter === 'logistics'
                        ? 'brand-fill text-canvas shadow-xs'
                        : 'bg-canvas border border-muted-border/40 text-neutral-text/70 hover:text-heading'
                    }`}
                  >
                    لوجستي
                  </button>
                </div>
              </div>

              {/* Projects Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredProjects.map((proj) => {
                  let projUnits = 0;
                  let projAvail = 0;
                  proj.floors?.forEach((f) => {
                    f.units.forEach((u) => {
                      projUnits++;
                      if (u.status === 'available') projAvail++;
                    });
                  });
                  const projOccupancy = projUnits > 0 ? Math.round(((projUnits - projAvail) / projUnits) * 100) : 0;

                  return (
                    <div
                      key={proj.id}
                      className="rounded-3xl bg-surface border border-muted-border/40 overflow-hidden shadow-xs hover:shadow-md hover:border-accent/40 transition-all flex flex-col justify-between group"
                    >
                      <div>
                        {/* Project Image Banner */}
                        <div className="relative aspect-[16/9] w-full overflow-hidden bg-neutral-900">
                          {proj.image ? (
                            <img
                              src={proj.image}
                              alt={proj.title}
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-accent/10 text-accent">
                              <Building2 className="w-12 h-12 opacity-40" />
                            </div>
                          )}

                          {/* Gradient shadow & badges */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />

                          <div className="absolute top-3 inset-x-3 flex items-center justify-between gap-2">
                            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-neutral-950/80 backdrop-blur-md text-white border border-white/20">
                              {proj.typeAr}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gold text-neutral-950 shadow-xs">
                              {proj.priceType}
                            </span>
                          </div>

                          <div className="absolute bottom-3 inset-x-3 flex items-center gap-1.5 text-white/90 text-xs font-bold">
                            <MapPin className="w-3.5 h-3.5 text-gold shrink-0" />
                            <span className="truncate">{proj.city}</span>
                          </div>
                        </div>

                        {/* Details */}
                        <div className="p-5">
                          <h4 className="text-sm font-black text-heading mb-1.5 line-clamp-1">{proj.title}</h4>
                          <p className="text-[11px] text-neutral-text/60 line-clamp-2 mb-4 leading-relaxed">
                            {proj.description}
                          </p>

                          {/* Specs Grid */}
                          <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-canvas/70 border border-muted-border/30 text-[11px] mb-4 text-center">
                            <div>
                              <span className="text-neutral-text/50 block text-[10px]">المساحة</span>
                              <span className="font-bold text-heading">{proj.area.toLocaleString()} م²</span>
                            </div>
                            <div>
                              <span className="text-neutral-text/50 block text-[10px]">الأدوار</span>
                              <span className="font-bold text-heading">{proj.floors?.length || 1}</span>
                            </div>
                            <div>
                              <span className="text-neutral-text/50 block text-[10px]">الوحدات</span>
                              <span className="font-bold text-heading">{projUnits || 'متعدد'}</span>
                            </div>
                          </div>

                          {/* Occupancy bar if units */}
                          {projUnits > 0 && (
                            <div className="space-y-1 mb-2">
                              <div className="flex items-center justify-between text-[10px] font-bold">
                                <span className="text-neutral-text/60">نسبة الإشغال</span>
                                <span className="text-emerald-500">{projOccupancy}% ({projUnits - projAvail}/{projUnits})</span>
                              </div>
                              <div className="w-full bg-canvas h-1.5 rounded-full overflow-hidden border border-muted-border/30">
                                <div
                                  className="bg-accent h-full rounded-full transition-all"
                                  style={{ width: `${projOccupancy}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="p-4 pt-0 flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedProjectId(proj.id);
                            setActiveTab('units');
                          }}
                          className="flex-1 brand-btn-primary text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <Layers className="w-3.5 h-3.5" />
                          <span>إدارة الوحدات</span>
                        </button>

                        <button
                          onClick={() => handleDeleteProject(proj.id, proj.title)}
                          title="حذف المشروع"
                          className="p-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: UNITS & FLOORS (BuildingVisualizer) */}
          {activeTab === 'units' && (
            <div className="space-y-6">
              {/* Project Picker Bar */}
              <div className="p-4 rounded-2xl bg-surface border border-muted-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-heading text-xs">حدد المشروع لعرض وتعديل أدوار ووحدات المبنى:</span>
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(Number(e.target.value))}
                    className="px-3 py-2 rounded-xl bg-canvas border border-muted-border/50 font-bold text-xs text-heading outline-none cursor-pointer focus:border-accent"
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} ({p.typeAr})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedProjectForUnits ? (
                <BuildingVisualizer
                  project={selectedProjectForUnits}
                  onProjectUpdate={refreshData}
                  onShowToast={onShowToast}
                />
              ) : (
                <div className="p-12 text-center bg-surface rounded-3xl border border-muted-border/40 text-neutral-text/60 font-bold">
                  يرجى اختيار مشروع لعرض الأدوار والوحدات
                </div>
              )}
            </div>
          )}

          {/* TAB 4: INQUIRIES ("سجل اهتمامك" FULL CRM) */}
          {activeTab === 'inquiries' && (
            <div className="rounded-3xl bg-surface border border-muted-border/40 p-6 space-y-5 shadow-xs">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-black text-heading">سجل اهتمامات واستفسارات العملاء</h3>
                  <p className="text-[11px] text-neutral-text/60 mt-0.5">
                    كافة الطلبات المسجلة من خلال صفحات المشاريع ونموذج "سجل اهتمامك"
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={inquiryStatusFilter}
                    onChange={(e) => setInquiryStatusFilter(e.target.value)}
                    className="px-3 py-1.5 rounded-xl bg-canvas border border-muted-border/40 text-xs font-bold text-heading outline-none cursor-pointer"
                  >
                    <option value="all">كافة الحالات</option>
                    <option value="new">جديد فقط</option>
                    <option value="contacted">تم التواصل</option>
                    <option value="closed">مغلق</option>
                  </select>

                  <button
                    onClick={refreshData}
                    className="brand-btn-secondary text-xs font-bold px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-accent" />
                    <span>تحديث السجل</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-start border-collapse">
                  <thead>
                    <tr className="border-b border-muted-border/30 text-neutral-text/50 text-[11px]">
                      <th className="pb-3 text-start font-bold">العميل والمستثمر</th>
                      <th className="pb-3 text-start font-bold">المشروع / الوحدة</th>
                      <th className="pb-3 text-start font-bold">نوع الاهتمام</th>
                      <th className="pb-3 text-start font-bold">الرسالة والملاحظات</th>
                      <th className="pb-3 text-start font-bold">تاريخ التسجيل</th>
                      <th className="pb-3 text-start font-bold">حالة المتابعة</th>
                      <th className="pb-3 text-end font-bold">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-muted-border/20">
                    {filteredInquiries.map((inq) => (
                      <tr key={inq.id} className="hover:bg-surface-hover/60 transition-colors">
                        <td className="py-3.5 font-bold text-heading">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-accent/10 text-accent font-black text-xs flex items-center justify-center shrink-0">
                              {inq.name.slice(0, 1)}
                            </div>
                            <div>
                              <div>{inq.name}</div>
                              {inq.phone && (
                                <div className="text-[10px] text-neutral-text/60 font-mono" dir="ltr">
                                  {inq.phone}
                                </div>
                              )}
                              {inq.email && (
                                <div className="text-[10px] text-neutral-text/50 font-mono" dir="ltr">
                                  {inq.email}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5">
                          <span className="font-bold text-heading">{inq.projectTitle || 'مشروع عام'}</span>
                          {inq.unitNumber && (
                            <span className="text-[10px] text-accent block font-bold">
                              {inq.unitNumber}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5">
                          <span className="px-2.5 py-1 rounded-full bg-accent/10 text-accent font-bold text-[10px] border border-accent/20">
                            {inq.interestTypeAr}
                          </span>
                        </td>
                        <td className="py-3.5 text-[11px] text-neutral-text/75 max-w-xs leading-relaxed">
                          {inq.message || '-'}
                        </td>
                        <td className="py-3.5 text-[10px] text-neutral-text/60 whitespace-nowrap">
                          {new Date(inq.createdAt).toLocaleString('ar-SA')}
                        </td>
                        <td className="py-3.5">
                          <select
                            value={inq.status}
                            onChange={(e) =>
                              handleInquiryStatusChange(inq.id, e.target.value as any)
                            }
                            className={`text-[11px] font-bold px-2.5 py-1 rounded-xl border outline-none cursor-pointer ${
                              inq.status === 'new'
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500 font-black'
                                : inq.status === 'contacted'
                                ? 'bg-amber-500/10 border-amber-500/30 text-amber-500'
                                : 'bg-neutral-500/10 border-neutral-500/30 text-neutral-400'
                            }`}
                          >
                            <option value="new">جديد</option>
                            <option value="contacted">تم التواصل</option>
                            <option value="closed">مغلق</option>
                          </select>
                        </td>
                        <td className="py-3.5 text-end">
                          <div className="flex items-center justify-end gap-1.5">
                            {inq.phone && (
                              <a
                                href={`https://wa.me/${inq.phone.replace(/[^0-9]/g, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 transition inline-flex items-center justify-center cursor-pointer"
                                title="مراسلة عبر واتساب"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                              </a>
                            )}
                            {inq.phone && (
                              <a
                                href={`tel:${inq.phone}`}
                                className="p-2 rounded-xl bg-accent/10 hover:bg-accent/20 text-accent transition inline-flex items-center justify-center cursor-pointer"
                                title="اتصال هاتفي"
                              >
                                <Phone className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: CATEGORIES & TAGS */}
          {activeTab === 'categories' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {categories.map((cat) => (
                  <div key={cat.id} className="p-6 rounded-3xl bg-surface border border-muted-border/40 shadow-xs">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="text-sm font-black text-heading">{cat.nameAr}</h4>
                        <span className="text-[10px] text-accent font-bold">{cat.nameEn}</span>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-accent/10 text-accent font-bold text-[10px]">
                        {cat.type}
                      </span>
                    </div>

                    <div className="border-t border-muted-border/30 pt-3 mb-4">
                      <span className="text-[11px] font-bold text-neutral-text/60 block mb-2">
                        الوسوم المعتمدة (Tags):
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {cat.tags.map((tag, tIdx) => (
                          <span
                            key={tIdx}
                            className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-canvas border border-muted-border/40 text-heading"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Add Tag Inline Form */}
                    <div className="flex items-center gap-2 pt-2 border-t border-muted-border/20">
                      <input
                        type="text"
                        placeholder="أدخل وسماً جديداً..."
                        value={activeCategoryForTag === cat.id ? newTagText : ''}
                        onFocus={() => setActiveCategoryForTag(cat.id)}
                        onChange={(e) => {
                          setActiveCategoryForTag(cat.id);
                          setNewTagText(e.target.value);
                        }}
                        className="flex-1 px-3 py-2 rounded-xl bg-canvas border border-muted-border/40 text-[11px] text-heading outline-none focus:border-accent"
                      />
                      <button
                        onClick={() => handleAddTag(cat.id)}
                        className="brand-btn-primary px-3.5 py-2 rounded-xl font-bold text-[11px] cursor-pointer"
                      >
                        + إضافة
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 6: USERS & PERMISSIONS */}
          {activeTab === 'users' && (
            <UsersPermissionsManager onShowToast={onShowToast} />
          )}
        </div>
      </main>

      {/* 3. LUXURY MODAL: ADD NEW PROJECT */}
      {newProjectModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg bg-surface rounded-3xl border border-muted-border/40 shadow-2xl p-6 sm:p-8 my-8">
            <h3 className="text-base font-black text-heading mb-4">
              إضافة مشروع عقاري جديد (تعريف المجمع والأدوار)
            </h3>

            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-neutral-text/70 mb-1">
                  اسم المشروع *
                </label>
                <input
                  type="text"
                  required
                  value={newProjectData.title}
                  onChange={(e) => setNewProjectData({ ...newProjectData, title: e.target.value })}
                  placeholder="مثال: مجمع أبراج السحاب السكني"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-neutral-text/70 mb-1">
                    نوع المشروع
                  </label>
                  <select
                    value={newProjectData.type}
                    onChange={(e) =>
                      setNewProjectData({ ...newProjectData, type: e.target.value as PropertyType })
                    }
                    className="w-full px-3 py-2.5 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none cursor-pointer"
                  >
                    <option value="commercial">مجمع تجاري (محلات ومعارض)</option>
                    <option value="residential">مجمع سكني (أدوار وشقق)</option>
                    <option value="office">مبنى ومكاتب إدارية</option>
                    <option value="logistics">مستودعات لوجستية</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-neutral-text/70 mb-1">
                    طبيعة العقد
                  </label>
                  <select
                    value={newProjectData.priceType}
                    onChange={(e) =>
                      setNewProjectData({ ...newProjectData, priceType: e.target.value as any })
                    }
                    className="w-full px-3 py-2.5 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none cursor-pointer"
                  >
                    <option value="إيجار">للإيجار</option>
                    <option value="بيع">للبيع والتملك</option>
                    <option value="استثمار">فرصة استثمارية</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-neutral-text/70 mb-1">
                    المساحة (م²)
                  </label>
                  <input
                    type="number"
                    value={newProjectData.area}
                    onChange={(e) =>
                      setNewProjectData({ ...newProjectData, area: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2.5 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-neutral-text/70 mb-1">
                    عدد الأدوار
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={newProjectData.floorsCount}
                    onChange={(e) =>
                      setNewProjectData({ ...newProjectData, floorsCount: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2.5 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-neutral-text/70 mb-1">
                    وحدات بكل دور
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={newProjectData.unitsPerFloor}
                    onChange={(e) =>
                      setNewProjectData({ ...newProjectData, unitsPerFloor: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2.5 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-neutral-text/70 mb-1">
                  وصف المشروع
                </label>
                <textarea
                  rows={2}
                  value={newProjectData.description}
                  onChange={(e) =>
                    setNewProjectData({ ...newProjectData, description: e.target.value })
                  }
                  placeholder="وصف مختصر لمميزات المشروع والموقع..."
                  className="w-full px-3 py-2 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-muted-border/30">
                <button
                  type="button"
                  onClick={() => setNewProjectModalOpen(false)}
                  className="brand-btn-secondary px-4 py-2 rounded-xl text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="brand-btn-primary px-5 py-2.5 rounded-xl text-xs font-bold cursor-pointer"
                >
                  تأكيد وإنشاء المشروع
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

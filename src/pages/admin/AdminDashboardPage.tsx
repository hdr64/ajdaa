import React, { useState } from 'react';
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
  ShieldCheck
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
  };

  // Stats
  const totalProjects = projects.length;
  let totalUnits = 0;
  let availableUnits = 0;
  let reservedUnits = 0;
  let rentedUnits = 0;

  projects.forEach((p) => {
    p.floors?.forEach((f) => {
      f.units.forEach((u) => {
        totalUnits++;
        if (u.status === 'available') availableUnits++;
        else if (u.status === 'reserved') reservedUnits++;
        else if (u.status === 'rented' || u.status === 'sold') rentedUnits++;
      });
    });
  });

  const newInquiriesCount = inquiries.filter((i) => i.status === 'new').length;

  const handleInquiryStatusChange = (id: string, newStatus: 'new' | 'contacted' | 'closed') => {
    AdminStorage.updateInquiryStatus(id, newStatus);
    refreshData();
    onShowToast(isAr ? 'تم تحديث حالة طلب الاهتمام' : 'Inquiry status updated');
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

  return (
    <div className="min-h-screen bg-canvas flex flex-col md:flex-row text-xs">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 bg-surface border-e border-muted-border/40 flex flex-col justify-between shrink-0 p-4">
        <div>
          {/* Logo & Portal Info */}
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-accent/10 border border-accent/20 mb-6">
            <div className="w-9 h-9 rounded-xl brand-fill text-canvas flex items-center justify-center font-black">
              AJ
            </div>
            <div>
              <h2 className="text-xs font-black text-heading">لوحة تحكم أجدا</h2>
              <span className="text-[10px] text-accent font-bold">نظام إدارة العقارات</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5 font-bold">
            <button
              onClick={() => setActiveTab('overview')}
              className={`w-full flex items-center justify-between p-3 rounded-xl transition-all cursor-pointer ${
                activeTab === 'overview'
                  ? 'brand-fill text-canvas shadow-xs'
                  : 'text-neutral-text/75 hover:bg-surface/80 hover:text-heading'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <LayoutDashboard className="w-4 h-4" />
                <span>نظرة عامة</span>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('projects')}
              className={`w-full flex items-center justify-between p-3 rounded-xl transition-all cursor-pointer ${
                activeTab === 'projects'
                  ? 'brand-fill text-canvas shadow-xs'
                  : 'text-neutral-text/75 hover:bg-surface/80 hover:text-heading'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Building2 className="w-4 h-4" />
                <span>إدارة المشاريع</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface/50 border border-muted-border/30">
                {totalProjects}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('units')}
              className={`w-full flex items-center justify-between p-3 rounded-xl transition-all cursor-pointer ${
                activeTab === 'units'
                  ? 'brand-fill text-canvas shadow-xs'
                  : 'text-neutral-text/75 hover:bg-surface/80 hover:text-heading'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Layers className="w-4 h-4" />
                <span>الأدوار والوحدات</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface/50 border border-muted-border/30">
                {totalUnits}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('categories')}
              className={`w-full flex items-center justify-between p-3 rounded-xl transition-all cursor-pointer ${
                activeTab === 'categories'
                  ? 'brand-fill text-canvas shadow-xs'
                  : 'text-neutral-text/75 hover:bg-surface/80 hover:text-heading'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Tags className="w-4 h-4" />
                <span>التصنيفات والوسوم</span>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('inquiries')}
              className={`w-full flex items-center justify-between p-3 rounded-xl transition-all cursor-pointer ${
                activeTab === 'inquiries'
                  ? 'brand-fill text-canvas shadow-xs'
                  : 'text-neutral-text/75 hover:bg-surface/80 hover:text-heading'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Users className="w-4 h-4" />
                <span>طلبات الاهتمام</span>
              </div>
              {newInquiriesCount > 0 && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500 text-white animate-pulse">
                  {newInquiriesCount} جديد
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('users')}
              className={`w-full flex items-center justify-between p-3 rounded-xl transition-all cursor-pointer ${
                activeTab === 'users'
                  ? 'brand-fill text-canvas shadow-xs'
                  : 'text-neutral-text/75 hover:bg-surface/80 hover:text-heading'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4" />
                <span>المستخدمين والصلاحيات</span>
              </div>
            </button>
          </nav>
        </div>

        {/* Sidebar Footer: Return to public site & Logout */}
        <div className="pt-4 border-t border-muted-border/30 space-y-2">
          <button
            onClick={onNavigateHome}
            className="w-full p-2.5 rounded-xl border border-muted-border/40 hover:border-accent flex items-center justify-center gap-2 text-neutral-text/75 hover:text-accent font-bold transition cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>عرض الموقع الحي</span>
          </button>

          <button
            onClick={onLogout}
            className="w-full p-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 flex items-center justify-center gap-2 font-bold transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto max-h-screen">
        {/* Top bar */}
        <header className="h-16 px-6 bg-surface/70 border-b border-muted-border/30 backdrop-blur-md flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <span className="text-sm font-black text-heading capitalize">
              {activeTab === 'overview' && 'لوحة التحكم والمؤشرات'}
              {activeTab === 'projects' && 'إدارة المشاريع العقارية'}
              {activeTab === 'units' && 'المخطط البصري للأدوار والوحدات'}
              {activeTab === 'categories' && 'التصنيفات والوسوم العقارية'}
              {activeTab === 'inquiries' && 'طلبات الاهتمام الواردة من العملاء'}
              {activeTab === 'users' && 'المستخدمين ومصفوفة الصلاحيات'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setNewProjectModalOpen(true)}
              className="brand-btn-primary font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة مشروع جديد</span>
            </button>
          </div>
        </header>

        {/* Content Body */}
        <div className="p-6 space-y-6 flex-1">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* KPI Metrics */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl bg-surface border border-muted-border/40 shadow-xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-neutral-text/60 font-bold">إجمالي المشاريع</span>
                    <Building2 className="w-4 h-4 text-accent" />
                  </div>
                  <div className="text-2xl font-black text-heading">{totalProjects}</div>
                  <span className="text-[10px] text-emerald-500 font-bold mt-1 block">تجارية، سكنية ولوجستية</span>
                </div>

                <div className="p-5 rounded-2xl bg-surface border border-muted-border/40 shadow-xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-neutral-text/60 font-bold">الوحدات المتاحة</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div className="text-2xl font-black text-emerald-500">{availableUnits}</div>
                  <span className="text-[10px] text-neutral-text/50 mt-1 block">من إجمالي {totalUnits} وحدة</span>
                </div>

                <div className="p-5 rounded-2xl bg-surface border border-muted-border/40 shadow-xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-neutral-text/60 font-bold">المحجوزة والمؤجرة</span>
                    <Clock className="w-4 h-4 text-amber-500" />
                  </div>
                  <div className="text-2xl font-black text-amber-500">{reservedUnits + rentedUnits}</div>
                  <span className="text-[10px] text-neutral-text/50 mt-1 block">
                    {reservedUnits} محجوز • {rentedUnits} مؤجر
                  </span>
                </div>

                <div className="p-5 rounded-2xl bg-surface border border-muted-border/40 shadow-xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-neutral-text/60 font-bold">طلبات الاهتمام</span>
                    <Users className="w-4 h-4 text-accent" />
                  </div>
                  <div className="text-2xl font-black text-heading">{inquiries.length}</div>
                  <span className="text-[10px] text-emerald-500 font-bold mt-1 block">
                    {newInquiriesCount} طلب جديد بانتظار التواصل
                  </span>
                </div>
              </div>

              {/* Recent Inquiries Quick Table */}
              <div className="rounded-2xl bg-surface border border-muted-border/40 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-black text-heading">أحدث طلبات الاهتمام المسجلة</h3>
                  <button
                    onClick={() => setActiveTab('inquiries')}
                    className="text-accent font-bold text-xs hover:underline cursor-pointer"
                  >
                    عرض كافة الطلبات ({inquiries.length})
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-start border-collapse">
                    <thead>
                      <tr className="border-b border-muted-border/30 text-neutral-text/50 text-[11px]">
                        <th className="pb-3 text-start">العميل</th>
                        <th className="pb-3 text-start">المشروع / الوحدة</th>
                        <th className="pb-3 text-start">نوع الاهتمام</th>
                        <th className="pb-3 text-start">التاريخ</th>
                        <th className="pb-3 text-start">الحالة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-muted-border/20">
                      {inquiries.slice(0, 5).map((inq) => (
                        <tr key={inq.id} className="hover:bg-surface/50">
                          <td className="py-3 font-bold text-heading">
                            <div>{inq.name}</div>
                            <div className="text-[10px] text-neutral-text/60 font-mono" dir="ltr">
                              {inq.phone || inq.email || '-'}
                            </div>
                          </td>
                          <td className="py-3">
                            <span className="font-bold text-heading">{inq.projectTitle || 'مشروع عام'}</span>
                            {inq.unitNumber && (
                              <span className="text-[10px] text-accent block">{inq.unitNumber}</span>
                            )}
                          </td>
                          <td className="py-3">
                            <span className="px-2.5 py-1 rounded-full bg-accent/10 text-accent font-bold text-[10px]">
                              {inq.interestTypeAr}
                            </span>
                          </td>
                          <td className="py-3 text-[10px] text-neutral-text/60">
                            {new Date(inq.createdAt).toLocaleDateString('ar-SA')}
                          </td>
                          <td className="py-3">
                            <select
                              value={inq.status}
                              onChange={(e) =>
                                handleInquiryStatusChange(inq.id, e.target.value as any)
                              }
                              className={`text-[10px] font-bold px-2 py-1 rounded-lg border outline-none cursor-pointer ${
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
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PROJECTS */}
          {activeTab === 'projects' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs text-neutral-text/60">
                  إجمالي المشاريع المعرفة: {projects.length} مشاريع
                </span>
                <button
                  onClick={() => setNewProjectModalOpen(true)}
                  className="brand-btn-primary font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة مشروع جديد (سكني / تجاري / لوجستي)</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {projects.map((proj) => (
                  <div
                    key={proj.id}
                    className="p-5 rounded-2xl bg-surface border border-muted-border/40 hover:border-accent/40 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent/15 text-accent">
                          {proj.typeAr}
                        </span>
                        <span className="text-[10px] font-bold text-neutral-text/60">{proj.priceType}</span>
                      </div>
                      <h4 className="text-sm font-black text-heading mb-1">{proj.title}</h4>
                      <p className="text-[11px] text-neutral-text/60 line-clamp-2 mb-4">
                        {proj.description}
                      </p>

                      <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-canvas/60 text-[11px] mb-4">
                        <div>
                          <span className="text-neutral-text/50 block text-[10px]">المساحة:</span>
                          <span className="font-bold text-heading">{proj.area} م²</span>
                        </div>
                        <div>
                          <span className="text-neutral-text/50 block text-[10px]">الأدوار:</span>
                          <span className="font-bold text-heading">
                            {proj.floors?.length || 1} أدوار
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-muted-border/30">
                      <button
                        onClick={() => {
                          setSelectedProjectId(proj.id);
                          setActiveTab('units');
                        }}
                        className="flex-1 brand-btn-secondary text-xs font-bold py-2 rounded-xl flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Layers className="w-3.5 h-3.5 text-accent" />
                        <span>إدارة الوحدات والأدوار</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: UNITS & FLOORS (BuildingVisualizer) */}
          {activeTab === 'units' && (
            <div className="space-y-6">
              {/* Project Picker */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-surface border border-muted-border/40">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-heading text-xs">حدد المشروع لعرض وتعديل أدوار ووحدات المبنى:</span>
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(Number(e.target.value))}
                    className="px-3 py-2 rounded-xl bg-canvas border border-muted-border/50 font-bold text-xs text-heading outline-none cursor-pointer"
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
                <div className="p-8 text-center bg-surface rounded-2xl text-neutral-text/60">
                  يرجى اختيار مشروع لعرض الأدوار والوحدات
                </div>
              )}
            </div>
          )}

          {/* TAB 4: CATEGORIES & TAGS */}
          {activeTab === 'categories' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {categories.map((cat) => (
                  <div key={cat.id} className="p-5 rounded-2xl bg-surface border border-muted-border/40">
                    <div className="flex items-center justify-between mb-3">
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
                        className="flex-1 px-3 py-1.5 rounded-lg bg-canvas border border-muted-border/40 text-[11px] text-heading outline-none focus:border-accent"
                      />
                      <button
                        onClick={() => handleAddTag(cat.id)}
                        className="brand-btn-primary px-3 py-1.5 rounded-lg font-bold text-[11px] cursor-pointer"
                      >
                        + إضافة
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: INQUIRIES ("سجل اهتمامك") */}
          {activeTab === 'inquiries' && (
            <div className="rounded-2xl bg-surface border border-muted-border/40 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-heading">سجل اهتمامات واستفسارات العملاء</h3>
                  <p className="text-[11px] text-neutral-text/60">
                    كافة الطلبات المسجلة من خلال صفحات المشاريع ونموذج "سجل اهتمامك"
                  </p>
                </div>
                <button
                  onClick={refreshData}
                  className="brand-btn-secondary text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3 text-accent" />
                  <span>تحديث</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-start border-collapse">
                  <thead>
                    <tr className="border-b border-muted-border/30 text-neutral-text/50 text-[11px]">
                      <th className="pb-3 text-start">العميل</th>
                      <th className="pb-3 text-start">المشروع / الوحدة</th>
                      <th className="pb-3 text-start">نوع الاهتمام</th>
                      <th className="pb-3 text-start">الرسالة / الملاحظات</th>
                      <th className="pb-3 text-start">التاريخ</th>
                      <th className="pb-3 text-start">حالة الطلب</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-muted-border/20">
                    {inquiries.map((inq) => (
                      <tr key={inq.id} className="hover:bg-surface/50">
                        <td className="py-3 font-bold text-heading">
                          <div>{inq.name}</div>
                          {inq.phone && (
                            <div className="text-[10px] text-neutral-text/60 font-mono" dir="ltr">
                              {inq.phone}
                            </div>
                          )}
                          {inq.email && (
                            <div className="text-[10px] text-neutral-text/60 font-mono" dir="ltr">
                              {inq.email}
                            </div>
                          )}
                        </td>
                        <td className="py-3">
                          <span className="font-bold text-heading">{inq.projectTitle || 'مشروع عام'}</span>
                          {inq.unitNumber && (
                            <span className="text-[10px] text-accent block font-bold">
                              {inq.unitNumber}
                            </span>
                          )}
                        </td>
                        <td className="py-3">
                          <span className="px-2.5 py-1 rounded-full bg-accent/10 text-accent font-bold text-[10px]">
                            {inq.interestTypeAr}
                          </span>
                        </td>
                        <td className="py-3 text-[11px] text-neutral-text/75 max-w-xs">
                          {inq.message || '-'}
                        </td>
                        <td className="py-3 text-[10px] text-neutral-text/60 whitespace-nowrap">
                          {new Date(inq.createdAt).toLocaleString('ar-SA')}
                        </td>
                        <td className="py-3">
                          <select
                            value={inq.status}
                            onChange={(e) =>
                              handleInquiryStatusChange(inq.id, e.target.value as any)
                            }
                            className={`text-[10px] font-bold px-2 py-1 rounded-lg border outline-none cursor-pointer ${
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 6: USERS & PERMISSIONS */}
          {activeTab === 'users' && (
            <UsersPermissionsManager onShowToast={onShowToast} />
          )}
        </div>
      </main>

      {/* MODAL: ADD NEW PROJECT */}
      {newProjectModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg bg-surface rounded-3xl border border-muted-border/40 shadow-2xl p-6 my-8">
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
                  className="brand-btn-primary px-5 py-2 rounded-xl text-xs font-bold cursor-pointer"
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

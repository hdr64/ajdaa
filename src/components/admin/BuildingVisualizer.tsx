import React, { useState } from 'react';
import type { Property, PropertyFloor, PropertyUnit, UnitStatus } from '../../types/property';
import { AdminStorage } from '../../services/adminStorage';
import {
  Layers,
  Building,
  Plus,
  Trash2,
  Edit2,
  RefreshCw,
  Store,
  Briefcase,
  Home,
  Warehouse,
  Sun,
  X
} from 'lucide-react';

interface BuildingVisualizerProps {
  project: Property;
  onProjectUpdate: () => void;
  onShowToast: (msg: string) => void;
}

export const BuildingVisualizer: React.FC<BuildingVisualizerProps> = ({
  project,
  onProjectUpdate,
  onShowToast,
}) => {
  const floors = project.floors || [];
  const [selectedFloorIndex, setSelectedFloorIndex] = useState<number>(0);
  const [unitFilter, setUnitFilter] = useState<'all' | UnitStatus>('all');

  // Add / Edit Unit Modal State
  const [unitModalOpen, setUnitModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<PropertyUnit | null>(null);
  const [unitForm, setUnitForm] = useState({
    unitNumber: '',
    sectionAr: '',
    type: 'showroom' as PropertyUnit['type'],
    area: 120,
    priceLabel: 'متاح للإيجار',
    status: 'available' as UnitStatus,
    featuresStr: 'واجهة زجاجية، تكييف مركزي',
  });

  // Add Floor Modal State
  const [floorModalOpen, setFloorModalOpen] = useState(false);
  const [newFloorName, setNewFloorName] = useState('');

  const activeFloor: PropertyFloor | undefined = floors[selectedFloorIndex] || floors[0];

  const filteredUnits = activeFloor?.units.filter((u) => {
    if (unitFilter === 'all') return true;
    return u.status === unitFilter;
  }) || [];

  const handleOpenAddUnit = () => {
    setEditingUnit(null);
    setUnitForm({
      unitNumber: `وحدة ${Date.now().toString().slice(-3)}`,
      sectionAr: 'الجهة الشمالية',
      type: 'office',
      area: 150,
      priceLabel: 'متاح للإيجار',
      status: 'available',
      featuresStr: 'واجهة زجاجية، تكييف مركزي',
    });
    setUnitModalOpen(true);
  };

  const handleOpenEditUnit = (unit: PropertyUnit) => {
    setEditingUnit(unit);
    setUnitForm({
      unitNumber: unit.unitNumber,
      sectionAr: unit.sectionAr || '',
      type: unit.type,
      area: unit.area,
      priceLabel: unit.priceLabel || '',
      status: unit.status,
      featuresStr: unit.features?.join('، ') || '',
    });
    setUnitModalOpen(true);
  };

  const handleSaveUnit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!unitForm.unitNumber.trim()) return;

    const typeArMap: Record<PropertyUnit['type'], string> = {
      showroom: 'معرض تجاري',
      office: 'مكتب إداري',
      apartment: 'شقة سكنية',
      warehouse: 'مستودع تخزين',
      outdoor: 'جلسات خارجية / تراس',
    };

    const statusArMap: Record<UnitStatus, string> = {
      available: 'متاح',
      reserved: 'محجوز',
      rented: 'مؤجر',
      sold: 'مباع',
    };

    const features = unitForm.featuresStr
      .split(/[,،]/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (editingUnit) {
      // Update existing unit
      const updated: PropertyUnit = {
        ...editingUnit,
        unitNumber: unitForm.unitNumber.trim(),
        sectionAr: unitForm.sectionAr.trim() || undefined,
        type: unitForm.type,
        typeAr: typeArMap[unitForm.type],
        area: Number(unitForm.area),
        priceLabel: unitForm.priceLabel.trim() || undefined,
        status: unitForm.status,
        statusAr: statusArMap[unitForm.status],
        features,
      };
      AdminStorage.updateUnitInProject(project.id, updated);
      onShowToast('تم تحديث بيانات الوحدة بنجاح');
    } else {
      // Add new unit
      const newUnit: PropertyUnit = {
        id: `u-${Date.now()}`,
        unitNumber: unitForm.unitNumber.trim(),
        floorNumber: activeFloor?.floorNumber || 0,
        floorNameAr: activeFloor?.floorNameAr || 'الدور الأرضي',
        sectionAr: unitForm.sectionAr.trim() || undefined,
        type: unitForm.type,
        typeAr: typeArMap[unitForm.type],
        area: Number(unitForm.area),
        priceLabel: unitForm.priceLabel.trim() || undefined,
        status: unitForm.status,
        statusAr: statusArMap[unitForm.status],
        features,
      };
      AdminStorage.addUnitToProject(project.id, activeFloor?.floorNumber || 0, newUnit);
      onShowToast('تمت إضافة الوحدة الجديدة بنجاح');
    }

    setUnitModalOpen(false);
    onProjectUpdate();
  };

  const handleDeleteUnit = (unitId: string, unitNumber: string) => {
    if (confirm(`هل أنت متأكد من حذف (${unitNumber})؟`)) {
      AdminStorage.deleteUnitFromProject(project.id, unitId);
      onProjectUpdate();
      onShowToast('تم حذف الوحدة');
    }
  };

  const handleCycleStatus = (unit: PropertyUnit) => {
    const sequence: UnitStatus[] = ['available', 'reserved', 'rented', 'sold'];
    const nextIdx = (sequence.indexOf(unit.status) + 1) % sequence.length;
    const nextStatus = sequence[nextIdx];

    const statusArMap: Record<UnitStatus, string> = {
      available: 'متاح',
      reserved: 'محجوز',
      rented: 'مؤجر',
      sold: 'مباع',
    };

    const updated: PropertyUnit = {
      ...unit,
      status: nextStatus,
      statusAr: statusArMap[nextStatus],
    };

    AdminStorage.updateUnitInProject(project.id, updated);
    AdminStorage.updateUnitStatus(unit.id, nextStatus);
    onProjectUpdate();
  };

  const handleAddFloor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFloorName.trim()) return;
    AdminStorage.addFloorToProject(project.id, newFloorName.trim());
    setNewFloorName('');
    setFloorModalOpen(false);
    onProjectUpdate();
    onShowToast('تمت إضافة الدور بنجاح');
  };

  const handleDeleteFloor = (floorNumber: number, floorName: string) => {
    if (confirm(`هل تريد بالتأكيد حذف (${floorName}) وكافة الوحدات التابعة له؟`)) {
      AdminStorage.deleteFloorFromProject(project.id, floorNumber);
      setSelectedFloorIndex(0);
      onProjectUpdate();
      onShowToast('تم حذف الدور');
    }
  };

  const getUnitIcon = (type: PropertyUnit['type']) => {
    switch (type) {
      case 'showroom':
        return <Store className="w-4 h-4 text-accent" />;
      case 'office':
        return <Briefcase className="w-4 h-4 text-accent" />;
      case 'apartment':
        return <Home className="w-4 h-4 text-accent" />;
      case 'warehouse':
        return <Warehouse className="w-4 h-4 text-accent" />;
      case 'outdoor':
        return <Sun className="w-4 h-4 text-amber-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Building Header Controls */}
      <div className="p-5 rounded-3xl bg-surface border border-muted-border/40 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-accent/15 text-accent mb-2 inline-block">
            المخطط البصري للمبنى والأدوار
          </span>
          <h3 className="text-base sm:text-lg font-black text-heading flex items-center gap-2">
            <Building className="w-5 h-5 text-accent" />
            <span>{project.title}</span>
          </h3>
          <p className="text-xs text-neutral-text/60 mt-0.5">
            إدارة وتعديل أجزاء المبنى، إضافة وحذف الأدوار والوحدات مع إمكانية التخصيص الكامل
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setFloorModalOpen(true)}
            className="brand-btn-secondary text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer hover:border-accent"
          >
            <Plus className="w-3.5 h-3.5 text-accent" />
            <span>إضافة دور للمبنى</span>
          </button>
          <button
            onClick={handleOpenAddUnit}
            className="brand-btn-primary text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إضافة وحدة بالدور الحالي</span>
          </button>
        </div>
      </div>

      {/* Main Visual Layout: Left Floor Stacking + Right Floor Map & Units */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Visual Building 2.5D Floor Stacking (4 cols) */}
        <div className="lg:col-span-4 rounded-3xl bg-surface border border-muted-border/40 p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-muted-border/30 pb-3 mb-2">
            <span className="text-xs font-black text-heading flex items-center gap-2">
              <Layers className="w-4 h-4 text-accent" />
              <span>هيكل أدوار المبنى ({floors.length})</span>
            </span>
            <span className="text-[10px] text-neutral-text/50">انقر لتحديد الدور</span>
          </div>

          {/* Reverse order so higher floors are visually stacked on top! */}
          <div className="flex flex-col gap-2.5">
            {[...floors].reverse().map((fl, rIdx) => {
              const originalIndex = floors.length - 1 - rIdx;
              const isSelected = selectedFloorIndex === originalIndex;

              const availableCount = fl.units.filter((u) => u.status === 'available').length;
              const occupiedCount = fl.units.length - availableCount;

              return (
                <div
                  key={fl.floorNumber}
                  onClick={() => setSelectedFloorIndex(originalIndex)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
                    isSelected
                      ? 'bg-accent/15 border-accent shadow-sm scale-102'
                      : 'bg-canvas/80 border-muted-border/40 hover:border-accent/40 hover:bg-surface'
                  }`}
                >
                  {/* Subtle 3D architectural edge bar */}
                  <div
                    className={`absolute top-0 bottom-0 start-0 w-1.5 transition-colors ${
                      isSelected ? 'bg-accent' : 'bg-muted-border/40 group-hover:bg-accent/40'
                    }`}
                  />

                  <div className="ps-2">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-black text-xs text-heading">
                        {fl.floorNameAr}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-surface/70 border border-muted-border/30 text-neutral-text/70">
                        {fl.units.length} وحدات
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-neutral-text/60">
                      <span>{fl.totalArea ? `${fl.totalArea} م²` : 'مساحات متنوعة'}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-500 font-bold">{availableCount} متاح</span>
                        <span>•</span>
                        <span className="text-neutral-text/50">{occupiedCount} مشغول</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Floor actions */}
          {activeFloor && floors.length > 1 && (
            <div className="pt-3 border-t border-muted-border/30">
              <button
                onClick={() => handleDeleteFloor(activeFloor.floorNumber, activeFloor.floorNameAr)}
                className="w-full py-2 text-[11px] font-bold text-red-400 hover:bg-red-500/10 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>حذف ({activeFloor.floorNameAr})</span>
              </button>
            </div>
          )}
        </div>

        {/* Floor Blueprint & Visual Unit Grid (8 cols) */}
        <div className="lg:col-span-8 rounded-3xl bg-surface border border-muted-border/40 p-6 space-y-5">
          {/* Active Floor Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-muted-border/30 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-heading">
                  {activeFloor?.floorNameAr || 'الدور الأرضي'}
                </span>
                {activeFloor?.totalArea && (
                  <span className="text-xs font-bold text-accent">({activeFloor.totalArea} م²)</span>
                )}
              </div>
              <p className="text-xs text-neutral-text/60 mt-0.5">
                {activeFloor?.descriptionAr || 'توزيع الوحدات والمساحات الخاصة بهذا الدور'}
              </p>
            </div>

            {/* Filter by unit status */}
            <div className="flex items-center gap-1.5 bg-canvas p-1 rounded-xl border border-muted-border/30 text-[10px] font-bold">
              <button
                onClick={() => setUnitFilter('all')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  unitFilter === 'all' ? 'brand-fill text-canvas' : 'text-neutral-text/70'
                }`}
              >
                الكل ({activeFloor?.units.length || 0})
              </button>
              <button
                onClick={() => setUnitFilter('available')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  unitFilter === 'available' ? 'bg-emerald-500 text-white' : 'text-emerald-500'
                }`}
              >
                متاح
              </button>
              <button
                onClick={() => setUnitFilter('reserved')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  unitFilter === 'reserved' ? 'bg-amber-500 text-white' : 'text-amber-500'
                }`}
              >
                محجوز
              </button>
              <button
                onClick={() => setUnitFilter('rented')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  unitFilter === 'rented' ? 'bg-blue-500 text-white' : 'text-blue-400'
                }`}
              >
                مؤجر
              </button>
            </div>
          </div>

          {/* Interactive Unit Matrix / Blueprint Cards */}
          {filteredUnits.length === 0 ? (
            <div className="py-16 text-center border border-dashed border-muted-border/50 rounded-2xl">
              <Layers className="w-8 h-8 text-neutral-text/30 mx-auto mb-2" />
              <p className="text-xs text-neutral-text/60 font-bold">لا توجد وحدات مطابقة بهذا الدور</p>
              <button
                onClick={handleOpenAddUnit}
                className="mt-3 brand-btn-secondary text-xs font-bold px-4 py-2 rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة وحدة جديدة الآن</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
              {filteredUnits.map((unit) => {
                const statusColor =
                  unit.status === 'available'
                    ? 'border-emerald-500/40 hover:border-emerald-500 bg-emerald-500/5'
                    : unit.status === 'reserved'
                    ? 'border-amber-500/40 hover:border-amber-500 bg-amber-500/5'
                    : unit.status === 'rented'
                    ? 'border-blue-500/40 hover:border-blue-500 bg-blue-500/5'
                    : 'border-neutral-500/40 hover:border-neutral-500 bg-neutral-500/5';

                const badgeColor =
                  unit.status === 'available'
                    ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
                    : unit.status === 'reserved'
                    ? 'bg-amber-500/15 text-amber-500 border-amber-500/30'
                    : unit.status === 'rented'
                    ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                    : 'bg-neutral-500/15 text-neutral-400 border-neutral-500/30';

                return (
                  <div
                    key={unit.id}
                    className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col justify-between group shadow-xs hover:shadow-md ${statusColor}`}
                  >
                    <div>
                      {/* Top bar: icon, section, and status */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-surface border border-muted-border/40 flex items-center justify-center shrink-0">
                            {getUnitIcon(unit.type)}
                          </div>
                          <div>
                            {unit.sectionAr && (
                              <span className="text-[10px] text-neutral-text/50 font-bold block leading-none">
                                {unit.sectionAr}
                              </span>
                            )}
                            <h5 className="text-xs font-black text-heading mt-0.5">
                              {unit.unitNumber}
                            </h5>
                          </div>
                        </div>

                        {/* Interactive Status Switcher Chip */}
                        <button
                          onClick={() => handleCycleStatus(unit)}
                          title="انقر لتغيير الحالة مباشرة"
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border cursor-pointer hover:scale-105 transition-transform flex items-center gap-1 ${badgeColor}`}
                        >
                          <RefreshCw className="w-2.5 h-2.5" />
                          <span>{unit.statusAr}</span>
                        </button>
                      </div>

                      {/* Info grid */}
                      <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-surface/70 border border-muted-border/30 text-[11px] my-2.5">
                        <div>
                          <span className="text-neutral-text/50 block text-[9px]">المساحة</span>
                          <span className="font-bold text-heading">{unit.area} م²</span>
                        </div>
                        <div>
                          <span className="text-neutral-text/50 block text-[9px]">النوع</span>
                          <span className="font-bold text-heading truncate block">{unit.typeAr}</span>
                        </div>
                      </div>

                      {unit.priceLabel && (
                        <div className="text-[10px] text-accent font-bold mb-2">
                          {unit.priceLabel}
                        </div>
                      )}

                      {/* Features */}
                      {unit.features && unit.features.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {unit.features.slice(0, 2).map((feat, fIdx) => (
                            <span
                              key={fIdx}
                              className="text-[9px] px-1.5 py-0.5 rounded bg-surface border border-muted-border/30 text-neutral-text/60 truncate max-w-full"
                            >
                              {feat}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Unit actions: Edit / Delete */}
                    <div className="flex items-center gap-1.5 pt-2 border-t border-muted-border/20">
                      <button
                        onClick={() => handleOpenEditUnit(unit)}
                        className="flex-1 py-1.5 rounded-lg bg-surface border border-muted-border/40 hover:border-accent text-neutral-text/75 hover:text-accent font-bold text-[10px] transition flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>تعديل</span>
                      </button>
                      <button
                        onClick={() => handleDeleteUnit(unit.id, unit.unitNumber)}
                        className="p-1.5 rounded-lg bg-surface border border-muted-border/40 hover:border-red-400 text-neutral-text/40 hover:text-red-400 transition cursor-pointer"
                        title="حذف الوحدة"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* MODAL: ADD / EDIT UNIT */}
      {unitModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative w-full max-w-md bg-surface rounded-3xl border border-muted-border/40 shadow-2xl p-6 my-8">
            <div className="flex items-center justify-between mb-4 border-b border-muted-border/30 pb-3">
              <h4 className="text-sm font-black text-heading">
                {editingUnit ? `تعديل (${editingUnit.unitNumber})` : 'إضافة وحدة جديدة بالدور'}
              </h4>
              <button
                onClick={() => setUnitModalOpen(false)}
                className="w-7 h-7 rounded-full bg-surface border border-muted-border/40 flex items-center justify-center text-heading hover:text-accent cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <form onSubmit={handleSaveUnit} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-neutral-text/70 mb-1">
                  رقم / اسم الوحدة *
                </label>
                <input
                  type="text"
                  required
                  value={unitForm.unitNumber}
                  onChange={(e) => setUnitForm({ ...unitForm, unitNumber: e.target.value })}
                  placeholder="مثال: معرض 101 أو مكتب 204"
                  className="w-full px-3 py-2 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-neutral-text/70 mb-1">
                    الجهة / القسم
                  </label>
                  <input
                    type="text"
                    value={unitForm.sectionAr}
                    onChange={(e) => setUnitForm({ ...unitForm, sectionAr: e.target.value })}
                    placeholder="مثال: الجهة الشمالية"
                    className="w-full px-3 py-2 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-neutral-text/70 mb-1">
                    المساحة (م²) *
                  </label>
                  <input
                    type="number"
                    required
                    value={unitForm.area}
                    onChange={(e) => setUnitForm({ ...unitForm, area: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-neutral-text/70 mb-1">
                    نوع الوحدة
                  </label>
                  <select
                    value={unitForm.type}
                    onChange={(e) => setUnitForm({ ...unitForm, type: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none cursor-pointer"
                  >
                    <option value="showroom">معرض تجاري</option>
                    <option value="office">مكتب إداري</option>
                    <option value="apartment">شقة سكنية</option>
                    <option value="warehouse">مستودع تخزين</option>
                    <option value="outdoor">جلسات خارجية / تراس</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-neutral-text/70 mb-1">
                    حالة الوحدة
                  </label>
                  <select
                    value={unitForm.status}
                    onChange={(e) => setUnitForm({ ...unitForm, status: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none cursor-pointer"
                  >
                    <option value="available">متاح</option>
                    <option value="reserved">محجوز</option>
                    <option value="rented">مؤجر</option>
                    <option value="sold">مباع</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-neutral-text/70 mb-1">
                  المميزات (مفصولة بفواصل)
                </label>
                <input
                  type="text"
                  value={unitForm.featuresStr}
                  onChange={(e) => setUnitForm({ ...unitForm, featuresStr: e.target.value })}
                  placeholder="واجهة زجاجية، تكييف، إطلالة رئيسية"
                  className="w-full px-3 py-2 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-muted-border/30">
                <button
                  type="button"
                  onClick={() => setUnitModalOpen(false)}
                  className="brand-btn-secondary px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="brand-btn-primary px-5 py-2 rounded-xl text-xs font-bold cursor-pointer"
                >
                  {editingUnit ? 'حفظ التعديلات' : 'إضافة الوحدة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD FLOOR */}
      {floorModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative w-full max-w-sm bg-surface rounded-3xl border border-muted-border/40 shadow-2xl p-6">
            <h4 className="text-sm font-black text-heading mb-3">إضافة دور جديد للمشروع</h4>
            <form onSubmit={handleAddFloor} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-neutral-text/70 mb-1">
                  اسم الدور *
                </label>
                <input
                  type="text"
                  required
                  value={newFloorName}
                  onChange={(e) => setNewFloorName(e.target.value)}
                  placeholder="مثال: الدور الرابع - صالات مفتوحة"
                  className="w-full px-3 py-2 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setFloorModalOpen(false)}
                  className="brand-btn-secondary px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="brand-btn-primary px-4 py-2 rounded-xl text-xs font-bold cursor-pointer"
                >
                  تأكيد الإضافة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

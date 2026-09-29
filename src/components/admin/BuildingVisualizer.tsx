import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { Property, PropertyFloor, PropertyUnit, UnitStatus } from '../../types/property';
import { AdminStorage } from '../../services/adminStorage';
import { propertyService } from '../../services/propertyService';
import { getErrorMessage } from '../../services/api';
import { usePersistentState } from '../../hooks/usePersistentState';
import { useAdmin } from '../../pages/admin/adminContextDef';
import { UNIT_STATUS_LABELS_AR } from '../../pages/admin/projectLabels';
import {
  Layers,
  Plus,
  Trash2,
  Edit2,
  Store,
  Briefcase,
  Home,
  Warehouse,
  Sun,
  X,
  Pencil,
  PanelRight,
  LayoutGrid,
  GripVertical,
} from 'lucide-react';

interface BuildingVisualizerProps {
  project: Property;
  onProjectUpdate: () => void | Promise<void>;
  onShowToast: (msg: string) => void;
  /** Units: add, edit, delete, change status (server: manageUnits). */
  canEdit?: boolean;
  /** Floors: add, rename, delete (server: manageProjects). */
  canEditFloors?: boolean;
}

type FloorsView = 'side' | 'grid';
type UnitColumns = 0 | 2 | 3 | 4 | 5; // 0 = automatic

const STATUSES: UnitStatus[] = ['available', 'reserved', 'rented', 'sold'];
const STATUS_VAR: Record<UnitStatus, string> = {
  available: 'var(--viz-available)',
  reserved: 'var(--viz-reserved)',
  rented: 'var(--viz-rented)',
  sold: 'var(--viz-sold)',
};

/** Static class map: Tailwind cannot see dynamically built class names. */
const UNIT_GRID_CLASSES: Record<UnitColumns, string> = {
  0: 'sm:grid-cols-[repeat(auto-fill,minmax(220px,1fr))]',
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-2 lg:grid-cols-3',
  4: 'sm:grid-cols-2 lg:grid-cols-4',
  5: 'sm:grid-cols-3 xl:grid-cols-5',
};

const SIDE_MIN = 220;
const SIDE_MAX = 560;
const SIDE_DEFAULT = 320;

const isFloorsView = (v: unknown): v is FloorsView => v === 'side' || v === 'grid';
const isUnitColumns = (v: unknown): v is UnitColumns => v === 0 || v === 2 || v === 3 || v === 4 || v === 5;
const isSideWidth = (v: unknown): v is number => typeof v === 'number' && v >= SIDE_MIN && v <= SIDE_MAX;

const UNIT_TYPE_AR: Record<PropertyUnit['type'], string> = {
  showroom: 'معرض تجاري',
  office: 'مكتب إداري',
  apartment: 'شقة سكنية',
  warehouse: 'مستودع تخزين',
  outdoor: 'جلسات خارجية / تراس',
};

function UnitIcon({ type }: { type: PropertyUnit['type'] }) {
  const className = 'w-4 h-4 text-accent';
  switch (type) {
    case 'showroom':
      return <Store className={className} />;
    case 'office':
      return <Briefcase className={className} />;
    case 'apartment':
      return <Home className={className} />;
    case 'warehouse':
      return <Warehouse className={className} />;
    case 'outdoor':
      return <Sun className="w-4 h-4 text-amber-500" />;
  }
}

/** Stacked composition bar, same encoding as the overview chart. */
function FloorComposition({ units, className = '' }: { units: PropertyUnit[]; className?: string }) {
  if (units.length === 0) return <div className={`h-1.5 rounded-full bg-canvas ${className}`} />;
  return (
    <div className={`flex h-1.5 gap-[2px] ${className}`} aria-hidden="true">
      {STATUSES.map((status) => {
        const n = units.filter((u) => u.status === status).length;
        return n > 0 ? (
          <div
            key={status}
            className="h-full first:rounded-s-full last:rounded-e-full"
            style={{ width: `${(n / units.length) * 100}%`, background: STATUS_VAR[status] }}
          />
        ) : null;
      })}
    </div>
  );
}

function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
  className = '',
}: {
  label: string;
  value: T;
  options: { value: T; label: React.ReactNode; title: string }[];
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div className={`items-center gap-1.5 ${className}`}>
      <span className="text-[10px] font-bold text-neutral-text/50">{label}</span>
      <div className="inline-flex rounded-lg border border-muted-border/40 p-0.5 bg-canvas" role="group" aria-label={label}>
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={value === o.value}
            title={o.title}
            className={`min-w-7 px-2 py-1 rounded-md text-[10px] font-bold cursor-pointer inline-flex items-center justify-center gap-1 ${
              value === o.value ? 'bg-surface text-heading shadow-xs' : 'text-neutral-text/55 hover:text-heading'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export const BuildingVisualizer: React.FC<BuildingVisualizerProps> = ({
  project,
  onProjectUpdate,
  onShowToast,
  canEdit = true,
  canEditFloors = canEdit,
}) => {
  const { confirm } = useAdmin();
  const floors = project.floors || [];
  const [selectedFloorNumber, setSelectedFloorNumber] = useState<number | null>(floors[0]?.floorNumber ?? null);
  const [unitFilter, setUnitFilter] = useState<'all' | UnitStatus>('all');
  const [saving, setSaving] = useState(false);

  const [floorsView, setFloorsView] = usePersistentState<FloorsView>('ajda.admin.floorplan.floorsView', 'side', isFloorsView);
  const [unitColumns, setUnitColumns] = usePersistentState<UnitColumns>('ajda.admin.floorplan.unitColumns', 0, isUnitColumns);
  const [sideWidth, setSideWidth] = usePersistentState<number>('ajda.admin.floorplan.sideWidth', SIDE_DEFAULT, isSideWidth);

  // Unit dialog
  const [unitModalOpen, setUnitModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<PropertyUnit | null>(null);
  const [unitForm, setUnitForm] = useState({
    unitNumber: '',
    sectionAr: '',
    type: 'showroom' as PropertyUnit['type'],
    area: 120,
    priceLabel: 'متاح للإيجار',
    status: 'available' as UnitStatus,
    featuresStr: '',
  });

  // Floor dialog (add or rename)
  const [floorDialog, setFloorDialog] = useState<{ floor: PropertyFloor | null } | null>(null);
  const [floorForm, setFloorForm] = useState({ nameAr: '', nameEn: '', descriptionAr: '' });

  // A different project, or the selected floor deleted: fall back to the first floor.
  const activeFloor: PropertyFloor | undefined =
    floors.find((f) => f.floorNumber === selectedFloorNumber) ?? floors[0];

  useEffect(() => {
    setUnitFilter('all');
  }, [project.id]);

  const filteredUnits = activeFloor?.units.filter((u) => unitFilter === 'all' || u.status === unitFilter) ?? [];

  /* ------------------------------- Mutations ------------------------------ */

  const runMutation = async (action: () => Promise<unknown>, successMessage: string): Promise<boolean> => {
    setSaving(true);
    try {
      await action();
      await onProjectUpdate();
      onShowToast(successMessage);
      return true;
    } catch (error) {
      onShowToast(getErrorMessage(error, 'تعذر حفظ التعديلات على الخادم'));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const openAddUnit = () => {
    setEditingUnit(null);
    setUnitForm({
      unitNumber: '',
      sectionAr: '',
      type: project.type === 'residential' ? 'apartment' : project.type === 'logistics' ? 'warehouse' : project.type === 'office' ? 'office' : 'showroom',
      area: 150,
      priceLabel: 'متاح للإيجار',
      status: 'available',
      featuresStr: '',
    });
    setUnitModalOpen(true);
  };

  const openEditUnit = (unit: PropertyUnit) => {
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

  const saveUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unitForm.unitNumber.trim() || !activeFloor) return;

    const features = unitForm.featuresStr
      .split(/[,،]/)
      .map((s) => s.trim())
      .filter(Boolean);

    const baseUnit = {
      unitNumber: unitForm.unitNumber.trim(),
      floorNumber: activeFloor.floorNumber,
      floorNameAr: activeFloor.floorNameAr,
      floorNameEn: activeFloor.floorNameEn,
      sectionAr: unitForm.sectionAr.trim() || undefined,
      type: unitForm.type,
      typeAr: UNIT_TYPE_AR[unitForm.type],
      area: Number(unitForm.area),
      priceLabel: unitForm.priceLabel.trim() || undefined,
      status: unitForm.status,
      statusAr: UNIT_STATUS_LABELS_AR[unitForm.status],
      features,
    };

    const ok = await runMutation(
      () =>
        editingUnit
          ? AdminStorage.updateUnitInProject(project.id, activeFloor, { ...editingUnit, ...baseUnit })
          : AdminStorage.addUnitToProject(project.id, activeFloor, { ...baseUnit, id: `u-${crypto.randomUUID()}` }),
      editingUnit ? 'تم تحديث بيانات الوحدة' : 'تمت إضافة الوحدة'
    );
    if (ok) setUnitModalOpen(false);
  };

  const deleteUnit = async (unit: PropertyUnit) => {
    const ok = await confirm({
      title: `حذف الوحدة "${unit.unitNumber}"؟`,
      message: 'لا يمكن التراجع عن هذا الإجراء.',
      confirmLabel: 'حذف الوحدة',
      danger: true,
    });
    if (ok) void runMutation(() => AdminStorage.deleteUnitFromProject(project.id, unit.id), 'تم حذف الوحدة');
  };

  const setUnitStatus = (unit: PropertyUnit, status: UnitStatus) => {
    if (status === unit.status) return;
    // The server owns the labels and broadcasts the change to every open tab.
    void runMutation(() => AdminStorage.updateUnitStatus(unit.id, status), `الوحدة ${unit.unitNumber}: ${UNIT_STATUS_LABELS_AR[status]}`);
  };

  const openFloorDialog = (floor: PropertyFloor | null) => {
    setFloorForm({
      nameAr: floor?.floorNameAr ?? '',
      nameEn: floor?.floorNameEn ?? '',
      descriptionAr: floor?.descriptionAr ?? '',
    });
    setFloorDialog({ floor });
  };

  const saveFloor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!floorDialog || !floorForm.nameAr.trim()) return;
    const editing = floorDialog.floor;
    const ok = await runMutation(
      () =>
        editing
          ? propertyService.updateFloor(project.id, editing.floorNumber, {
              floorNameAr: floorForm.nameAr.trim(),
              floorNameEn: floorForm.nameEn.trim() || null,
              descriptionAr: floorForm.descriptionAr.trim() || null,
            })
          : propertyService.createFloor(project.id, {
              // Next free number above the highest existing floor.
              floorNumber: floors.reduce((max, f) => Math.max(max, f.floorNumber), -1) + 1,
              floorNameAr: floorForm.nameAr.trim(),
              floorNameEn: floorForm.nameEn.trim() || null,
            }),
      editing ? 'تم تحديث بيانات الدور' : 'تمت إضافة الدور'
    );
    if (ok) setFloorDialog(null);
  };

  const deleteFloor = async (floor: PropertyFloor) => {
    const ok = await confirm({
      title: `حذف "${floor.floorNameAr}"؟`,
      message: `سيتم حذف الدور و${floor.units.length} وحدة تابعة له نهائياً.`,
      confirmLabel: 'حذف الدور',
      danger: true,
    });
    if (!ok) return;
    const deleted = await runMutation(() => AdminStorage.deleteFloorFromProject(project.id, floor.floorNumber), 'تم حذف الدور');
    if (deleted && floor.floorNumber === activeFloor?.floorNumber) setSelectedFloorNumber(null);
  };

  /* ------------------------------ Resizing ------------------------------- */

  const layoutRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startWidth: number; rtl: boolean } | null>(null);
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const clampWidth = (w: number) => Math.round(Math.min(SIDE_MAX, Math.max(SIDE_MIN, w)));
  const isRtl = () => (layoutRef.current ? getComputedStyle(layoutRef.current).direction === 'rtl' : true);

  const onResizeStart = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startWidth: sideWidth, rtl: isRtl() };
    setDragWidth(sideWidth);
  };
  const onResizeMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    // The floor panel sits at the inline start: in RTL that is the right edge,
    // so moving the handle left widens it.
    const delta = drag.rtl ? drag.startX - e.clientX : e.clientX - drag.startX;
    setDragWidth(clampWidth(drag.startWidth + delta));
  };
  const onResizeEnd = useCallback(() => {
    if (dragRef.current && dragWidth !== null) setSideWidth(dragWidth);
    dragRef.current = null;
    setDragWidth(null);
  }, [dragWidth, setSideWidth]);
  const onResizeKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 64 : 16;
    const grow = isRtl() ? 'ArrowLeft' : 'ArrowRight';
    const shrink = isRtl() ? 'ArrowRight' : 'ArrowLeft';
    if (e.key === grow) setSideWidth(clampWidth(sideWidth + step));
    else if (e.key === shrink) setSideWidth(clampWidth(sideWidth - step));
    else if (e.key === 'Home') setSideWidth(SIDE_MIN);
    else if (e.key === 'End') setSideWidth(SIDE_MAX);
    else return;
    e.preventDefault();
  };
  const currentSideWidth = dragWidth ?? sideWidth;

  /* -------------------------------- Pieces ------------------------------- */

  const floorCard = (fl: PropertyFloor, compact: boolean) => {
    const isSelected = fl.floorNumber === activeFloor?.floorNumber;
    const available = fl.units.filter((u) => u.status === 'available').length;
    return (
      <div
        key={fl.id ?? fl.floorNumber}
        className={`relative rounded-2xl border transition-all group ${
          isSelected ? 'bg-accent/10 border-accent shadow-sm' : 'bg-canvas/70 border-muted-border/40 hover:border-accent/40'
        }`}
      >
        <button
          type="button"
          onClick={() => setSelectedFloorNumber(fl.floorNumber)}
          aria-pressed={isSelected}
          className={`w-full text-start cursor-pointer ${compact ? 'p-3' : 'p-4'} ${canEditFloors ? 'pe-16' : ''}`}
        >
          <span className="block font-black text-xs text-heading truncate" title={fl.floorNameAr}>
            {fl.floorNameAr}
          </span>
          {fl.floorNameEn && (
            <span className="block text-[10px] text-neutral-text/45 truncate" dir="ltr">
              {fl.floorNameEn}
            </span>
          )}
          <span className="flex items-center justify-between gap-2 text-[10px] text-neutral-text/60 mt-2">
            <span>
              {fl.units.length} وحدة{fl.totalArea ? ` · ${fl.totalArea.toLocaleString('en-US')} م²` : ''}
            </span>
            <span className="font-bold text-heading whitespace-nowrap">{available} متاح</span>
          </span>
          <FloorComposition units={fl.units} className="mt-2" />
        </button>
        {canEditFloors && (
          <div className="absolute top-2.5 end-2.5 flex items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition">
            <button
              type="button"
              onClick={() => openFloorDialog(fl)}
              className="p-1.5 rounded-lg text-neutral-text/55 hover:text-accent hover:bg-accent/10 cursor-pointer"
              title="تعديل اسم الدور"
              aria-label={`تعديل اسم ${fl.floorNameAr}`}
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => void deleteFloor(fl)}
              className="p-1.5 rounded-lg text-neutral-text/55 hover:text-red-500 hover:bg-red-500/10 cursor-pointer"
              title="حذف الدور"
              aria-label={`حذف ${fl.floorNameAr}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    );
  };

  // Highest floor on top, like a building.
  const floorsTopDown = [...floors].reverse();

  const floorsPanel = (
    <div className="rounded-3xl bg-surface border border-muted-border/40 p-4 sm:p-5 space-y-3 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-black text-heading flex items-center gap-2">
          <Layers className="w-4 h-4 text-accent" />
          أدوار المبنى ({floors.length})
        </span>
        {canEditFloors && (
          <button
            type="button"
            onClick={() => openFloorDialog(null)}
            className="text-[11px] font-bold text-accent hover:underline cursor-pointer inline-flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            دور جديد
          </button>
        )}
      </div>
      {floors.length === 0 ? (
        <p className="text-[11px] text-neutral-text/50 py-6 text-center">لا توجد أدوار بعد.</p>
      ) : floorsView === 'grid' ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-2.5">
          {floorsTopDown.map((fl) => floorCard(fl, true))}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">{floorsTopDown.map((fl) => floorCard(fl, false))}</div>
      )}
    </div>
  );

  const statusCounts = STATUSES.map((status) => ({
    status,
    n: activeFloor?.units.filter((u) => u.status === status).length ?? 0,
  }));

  const unitsPanel = (
    <div className="rounded-3xl bg-surface border border-muted-border/40 p-4 sm:p-6 space-y-5 min-w-0">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 border-b border-muted-border/30 pb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-black text-heading">{activeFloor?.floorNameAr ?? '—'}</span>
            {activeFloor?.totalArea ? (
              <span className="text-xs font-bold text-accent">({activeFloor.totalArea.toLocaleString('en-US')} م²)</span>
            ) : null}
          </div>
          <p className="text-xs text-neutral-text/60 mt-0.5">
            {activeFloor?.descriptionAr || 'توزيع الوحدات والمساحات الخاصة بهذا الدور'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-canvas p-1 rounded-xl border border-muted-border/30 text-[10px] font-bold" role="group" aria-label="تصفية الوحدات">
            <button
              type="button"
              onClick={() => setUnitFilter('all')}
              aria-pressed={unitFilter === 'all'}
              className={`px-2.5 py-1 rounded-lg cursor-pointer ${unitFilter === 'all' ? 'brand-fill text-canvas' : 'text-neutral-text/70'}`}
            >
              الكل ({activeFloor?.units.length ?? 0})
            </button>
            {statusCounts.map(({ status, n }) => (
              <button
                key={status}
                type="button"
                onClick={() => setUnitFilter(status)}
                aria-pressed={unitFilter === status}
                className={`px-2.5 py-1 rounded-lg cursor-pointer inline-flex items-center gap-1.5 ${
                  unitFilter === status ? 'bg-surface text-heading shadow-xs' : 'text-neutral-text/70'
                }`}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: STATUS_VAR[status] }} aria-hidden="true" />
                {UNIT_STATUS_LABELS_AR[status]} ({n})
              </button>
            ))}
          </div>
          {canEdit && activeFloor && (
            <button
              type="button"
              onClick={openAddUnit}
              className="brand-btn-primary text-xs font-bold px-3.5 py-2 rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              وحدة جديدة
            </button>
          )}
        </div>
      </div>

      {filteredUnits.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-muted-border/50 rounded-2xl">
          <Layers className="w-8 h-8 text-neutral-text/30 mx-auto mb-2" />
          <p className="text-xs text-neutral-text/60 font-bold">
            {activeFloor ? 'لا توجد وحدات مطابقة في هذا الدور' : 'أضف دوراً أولاً'}
          </p>
          {canEdit && activeFloor && unitFilter === 'all' && (
            <button
              type="button"
              onClick={openAddUnit}
              className="mt-3 brand-btn-secondary text-xs font-bold px-4 py-2 rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              إضافة وحدة
            </button>
          )}
        </div>
      ) : (
        <div className={`grid grid-cols-1 gap-3.5 ${UNIT_GRID_CLASSES[unitColumns]}`}>
          {filteredUnits.map((unit) => (
            <div
              key={unit.id}
              className="p-4 rounded-2xl border border-muted-border/40 bg-canvas/50 hover:border-accent/40 transition flex flex-col justify-between min-w-0 border-s-4"
              style={{ borderInlineStartColor: STATUS_VAR[unit.status] }}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-surface border border-muted-border/40 flex items-center justify-center shrink-0">
                      <UnitIcon type={unit.type} />
                    </div>
                    <div className="min-w-0">
                      {unit.sectionAr && (
                        <span className="text-[10px] text-neutral-text/50 font-bold block leading-none truncate">{unit.sectionAr}</span>
                      )}
                      <h5 className="text-xs font-black text-heading mt-0.5 truncate" title={unit.unitNumber}>
                        {unit.unitNumber}
                      </h5>
                    </div>
                  </div>
                  {canEdit ? (
                    <select
                      value={unit.status}
                      disabled={saving}
                      onChange={(e) => setUnitStatus(unit, e.target.value as UnitStatus)}
                      aria-label={`حالة الوحدة ${unit.unitNumber}`}
                      className="shrink-0 px-2 py-1 rounded-lg bg-surface border border-muted-border/50 text-[10px] font-bold text-heading outline-none cursor-pointer focus:border-accent disabled:opacity-50"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {UNIT_STATUS_LABELS_AR[s]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="shrink-0 inline-flex items-center gap-1.5 text-[10px] font-bold text-heading whitespace-nowrap">
                      <span className="w-2 h-2 rounded-full" style={{ background: STATUS_VAR[unit.status] }} aria-hidden="true" />
                      {UNIT_STATUS_LABELS_AR[unit.status]}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-surface/70 border border-muted-border/30 text-[11px] my-2.5">
                  <div className="min-w-0">
                    <span className="text-neutral-text/50 block text-[9px]">المساحة</span>
                    <span className="font-bold text-heading">{unit.area.toLocaleString('en-US')} م²</span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-neutral-text/50 block text-[9px]">النوع</span>
                    <span className="font-bold text-heading truncate block">{unit.typeAr}</span>
                  </div>
                </div>

                {unit.priceLabel && <div className="text-[10px] text-accent font-bold mb-2">{unit.priceLabel}</div>}

                {unit.features && unit.features.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {unit.features.slice(0, 3).map((feat) => (
                      <span key={feat} className="text-[9px] px-1.5 py-0.5 rounded bg-surface border border-muted-border/30 text-neutral-text/60 truncate max-w-full">
                        {feat}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {canEdit && (
                <div className="flex items-center gap-1.5 pt-2 border-t border-muted-border/20">
                  <button
                    type="button"
                    onClick={() => openEditUnit(unit)}
                    className="flex-1 py-1.5 rounded-lg bg-surface border border-muted-border/40 hover:border-accent text-neutral-text/75 hover:text-accent font-bold text-[10px] transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Edit2 className="w-3 h-3" />
                    تعديل
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteUnit(unit)}
                    className="p-1.5 rounded-lg bg-surface border border-muted-border/40 hover:border-red-400 text-neutral-text/40 hover:text-red-400 transition cursor-pointer"
                    title="حذف الوحدة"
                    aria-label={`حذف الوحدة ${unit.unitNumber}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  /* -------------------------------- Render ------------------------------- */

  const inputClass =
    'w-full px-3 py-2 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent';

  return (
    <div className="space-y-4">
      {/* View toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <Segmented<FloorsView>
          label="عرض الأدوار"
          value={floorsView}
          onChange={setFloorsView}
          className="flex"
          options={[
            { value: 'side', label: <PanelRight className="w-3.5 h-3.5" />, title: 'قائمة جانبية' },
            { value: 'grid', label: <LayoutGrid className="w-3.5 h-3.5" />, title: 'شبكة أعلى الصفحة' },
          ]}
        />
        <Segmented<UnitColumns>
          label="أعمدة الوحدات"
          value={unitColumns}
          onChange={setUnitColumns}
          className="hidden sm:flex"
          options={[
            { value: 0, label: 'تلقائي', title: 'حسب عرض الشاشة' },
            { value: 2, label: '2', title: 'عمودان' },
            { value: 3, label: '3', title: '3 أعمدة' },
            { value: 4, label: '4', title: '4 أعمدة' },
            { value: 5, label: '5', title: '5 أعمدة' },
          ]}
        />
      </div>

      {floorsView === 'grid' ? (
        <div className="space-y-5">
          {floorsPanel}
          {unitsPanel}
        </div>
      ) : (
        <div
          ref={layoutRef}
          className="flex flex-col gap-5 lg:grid lg:gap-0 items-start"
          style={{ gridTemplateColumns: `${currentSideWidth}px 20px minmax(0, 1fr)` }}
        >
          {floorsPanel}
          {/* Resize handle (desktop only) */}
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="تغيير عرض قائمة الأدوار"
            aria-valuemin={SIDE_MIN}
            aria-valuemax={SIDE_MAX}
            aria-valuenow={currentSideWidth}
            tabIndex={0}
            onPointerDown={onResizeStart}
            onPointerMove={onResizeMove}
            onPointerUp={onResizeEnd}
            onPointerCancel={onResizeEnd}
            onKeyDown={onResizeKey}
            onDoubleClick={() => setSideWidth(SIDE_DEFAULT)}
            title="اسحب لتغيير العرض · انقر مرتين للإعادة"
            className="relative hidden lg:flex self-stretch items-center justify-center cursor-col-resize group outline-none touch-none"
          >
            <div className="h-full w-px bg-muted-border/40 group-hover:bg-accent/60 group-focus-visible:bg-accent transition" />
            <GripVertical className="absolute w-3.5 h-3.5 text-neutral-text/40 group-hover:text-accent" />
          </div>
          {unitsPanel}
        </div>
      )}

      {/* Unit dialog */}
      {canEdit && unitModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setUnitModalOpen(false);
          }}
        >
          <div role="dialog" aria-modal="true" className="relative w-full max-w-md bg-surface rounded-3xl border border-muted-border/40 shadow-2xl p-6 my-8">
            <div className="flex items-center justify-between mb-4 border-b border-muted-border/30 pb-3">
              <h4 className="text-sm font-black text-heading">
                {editingUnit ? `تعديل (${editingUnit.unitNumber})` : `وحدة جديدة في ${activeFloor?.floorNameAr ?? ''}`}
              </h4>
              <button
                type="button"
                onClick={() => setUnitModalOpen(false)}
                className="w-7 h-7 rounded-full bg-surface border border-muted-border/40 flex items-center justify-center text-heading hover:text-accent cursor-pointer"
                aria-label="إغلاق"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <form onSubmit={saveUnit} className="space-y-3.5">
              <label className="block">
                <span className="block text-[11px] font-bold text-neutral-text/70 mb-1">رقم / اسم الوحدة *</span>
                <input
                  type="text"
                  required
                  autoFocus
                  value={unitForm.unitNumber}
                  onChange={(e) => setUnitForm({ ...unitForm, unitNumber: e.target.value })}
                  placeholder="مثال: معرض 101 أو مكتب 204"
                  className={inputClass}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-[11px] font-bold text-neutral-text/70 mb-1">الجهة / القسم</span>
                  <input
                    type="text"
                    value={unitForm.sectionAr}
                    onChange={(e) => setUnitForm({ ...unitForm, sectionAr: e.target.value })}
                    placeholder="مثال: الجهة الشمالية"
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className="block text-[11px] font-bold text-neutral-text/70 mb-1">المساحة (م²) *</span>
                  <input
                    type="number"
                    required
                    min={0}
                    step="any"
                    value={unitForm.area}
                    onChange={(e) => setUnitForm({ ...unitForm, area: Number(e.target.value) })}
                    className={inputClass}
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-[11px] font-bold text-neutral-text/70 mb-1">نوع الوحدة</span>
                  <select
                    value={unitForm.type}
                    onChange={(e) => setUnitForm({ ...unitForm, type: e.target.value as PropertyUnit['type'] })}
                    className={`${inputClass} cursor-pointer`}
                  >
                    {(Object.keys(UNIT_TYPE_AR) as PropertyUnit['type'][]).map((t) => (
                      <option key={t} value={t}>
                        {UNIT_TYPE_AR[t]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="block text-[11px] font-bold text-neutral-text/70 mb-1">حالة الوحدة</span>
                  <select
                    value={unitForm.status}
                    onChange={(e) => setUnitForm({ ...unitForm, status: e.target.value as UnitStatus })}
                    className={`${inputClass} cursor-pointer`}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {UNIT_STATUS_LABELS_AR[s]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="block text-[11px] font-bold text-neutral-text/70 mb-1">السعر / وصف العرض</span>
                <input
                  type="text"
                  value={unitForm.priceLabel}
                  onChange={(e) => setUnitForm({ ...unitForm, priceLabel: e.target.value })}
                  placeholder="مثال: متاح للإيجار"
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="block text-[11px] font-bold text-neutral-text/70 mb-1">المميزات (مفصولة بفواصل)</span>
                <input
                  type="text"
                  value={unitForm.featuresStr}
                  onChange={(e) => setUnitForm({ ...unitForm, featuresStr: e.target.value })}
                  placeholder="واجهة زجاجية، تكييف، إطلالة رئيسية"
                  className={inputClass}
                />
              </label>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-muted-border/30">
                <button type="button" onClick={() => setUnitModalOpen(false)} className="brand-btn-secondary px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer">
                  إلغاء
                </button>
                <button type="submit" disabled={saving} className="brand-btn-primary px-5 py-2 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50">
                  {editingUnit ? 'حفظ التعديلات' : 'إضافة الوحدة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floor dialog: add or rename */}
      {canEditFloors && floorDialog && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setFloorDialog(null);
          }}
        >
          <form
            onSubmit={saveFloor}
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-sm bg-surface rounded-3xl border border-muted-border/40 shadow-2xl p-6 space-y-3.5"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-black text-heading">{floorDialog.floor ? 'تعديل بيانات الدور' : 'إضافة دور جديد'}</h4>
              <button
                type="button"
                onClick={() => setFloorDialog(null)}
                className="w-7 h-7 rounded-full bg-surface border border-muted-border/40 flex items-center justify-center text-heading hover:text-accent cursor-pointer"
                aria-label="إغلاق"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <label className="block">
              <span className="block text-[11px] font-bold text-neutral-text/70 mb-1">اسم الدور بالعربية *</span>
              <input
                type="text"
                required
                autoFocus
                value={floorForm.nameAr}
                onChange={(e) => setFloorForm({ ...floorForm, nameAr: e.target.value })}
                placeholder="مثال: الدور الأول - مكاتب إدارية"
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="block text-[11px] font-bold text-neutral-text/70 mb-1">اسم الدور بالإنجليزية</span>
              <input
                type="text"
                dir="ltr"
                value={floorForm.nameEn}
                onChange={(e) => setFloorForm({ ...floorForm, nameEn: e.target.value })}
                placeholder="First floor - Offices"
                className={inputClass}
              />
            </label>
            {floorDialog.floor && (
              <label className="block">
                <span className="block text-[11px] font-bold text-neutral-text/70 mb-1">وصف قصير</span>
                <input
                  type="text"
                  value={floorForm.descriptionAr}
                  onChange={(e) => setFloorForm({ ...floorForm, descriptionAr: e.target.value })}
                  className={inputClass}
                />
              </label>
            )}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button type="button" onClick={() => setFloorDialog(null)} className="brand-btn-secondary px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer">
                إلغاء
              </button>
              <button type="submit" disabled={saving} className="brand-btn-primary px-4 py-2 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50">
                {floorDialog.floor ? 'حفظ' : 'إضافة الدور'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

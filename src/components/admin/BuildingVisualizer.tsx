import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { Property, PropertyFloor, PropertyUnit, UnitStatus } from '../../types/property';
import { usePersistentState } from '../../hooks/usePersistentState';
import { useFloorPlanEditor } from './floorplan/useFloorPlanEditor';
import { UNIT_STATUS_KEYS } from '../../pages/admin/projectLabels';
import { useAdminT } from '../../i18n/admin/useAdminT';
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
  Pencil,
  PanelRight,
  LayoutGrid,
  GripVertical,
} from 'lucide-react';

interface BuildingVisualizerProps {
  project: Property;
  onProjectUpdate: () => void | Promise<void>;
  /** Kept for compatibility; toasts now come from the admin context. */
  onShowToast?: (msg: string) => void;
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
  canEdit = true,
  canEditFloors = canEdit,
}) => {
  const { t, isEn } = useAdminT();
  const floors = project.floors || [];
  const [selectedFloorNumber, setSelectedFloorNumber] = useState<number | null>(floors[0]?.floorNumber ?? null);
  const [unitFilter, setUnitFilter] = useState<'all' | UnitStatus>('all');
  const [floorsView, setFloorsView] = usePersistentState<FloorsView>('ajda.admin.floorplan.floorsView', 'side', isFloorsView);
  const [unitColumns, setUnitColumns] = usePersistentState<UnitColumns>('ajda.admin.floorplan.unitColumns', 0, isUnitColumns);
  const [sideWidth, setSideWidth] = usePersistentState<number>('ajda.admin.floorplan.sideWidth', SIDE_DEFAULT, isSideWidth);

  // A different project, or the selected floor deleted: fall back to the first floor.
  const activeFloor: PropertyFloor | undefined =
    floors.find((f) => f.floorNumber === selectedFloorNumber) ?? floors[0];

  useEffect(() => {
    setUnitFilter('all');
  }, [activeFloor?.floorNumber]);

  const editor = useFloorPlanEditor(project, onProjectUpdate);

  const deleteFloor = async (floor: PropertyFloor) => {
    const deleted = await editor.deleteFloor(floor);
    if (deleted && floor.floorNumber === selectedFloorNumber) {
      const remaining = floors.filter((f) => f.floorNumber !== floor.floorNumber);
      setSelectedFloorNumber(remaining[0]?.floorNumber ?? null);
    }
  };

  const filteredUnits = (activeFloor?.units || []).filter((u) => (unitFilter === 'all' ? true : u.status === unitFilter));

  /* ------------------------------- Side resize ------------------------------ */

  const layoutRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startWidth: number; rtl: boolean } | null>(null);
  const [dragWidth, setDragWidth] = useState<number | null>(null);

  const isRtl = () => (layoutRef.current ? getComputedStyle(layoutRef.current).direction === 'rtl' : true);
  const clampWidth = (w: number) => Math.min(SIDE_MAX, Math.max(SIDE_MIN, Math.round(w)));

  const onResizeStart = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startWidth: sideWidth,
      rtl: isRtl(),
    };
    setDragWidth(sideWidth);
  };
  const onResizeMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
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

  const floorDisplayName = (fl: PropertyFloor) => (isEn && fl.floorNameEn ? fl.floorNameEn : fl.floorNameAr);

  const floorCard = (fl: PropertyFloor, compact: boolean) => {
    const isSelected = fl.floorNumber === activeFloor?.floorNumber;
    const available = fl.units.filter((u) => u.status === 'available').length;
    const displayName = floorDisplayName(fl);

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
          <span className="block font-black text-xs text-heading truncate" title={displayName}>
            {displayName}
          </span>
          {isEn
            ? fl.floorNameAr !== fl.floorNameEn && (
                <span className="block text-[10px] text-neutral-text/45 truncate">
                  {fl.floorNameAr}
                </span>
              )
            : fl.floorNameEn && (
                <span className="block text-[10px] text-neutral-text/45 truncate" dir="ltr">
                  {fl.floorNameEn}
                </span>
              )}
          <span className="flex items-center justify-between gap-2 text-[10px] text-neutral-text/60 mt-2">
            <span>
              {t('floorplan.unitsCount', { count: fl.units.length })}
              {fl.totalArea
                ? ` · ${fl.totalArea.toLocaleString(isEn ? 'en-US' : 'ar-SA')} ${isEn ? 'm²' : 'م²'}`
                : ''}
            </span>
            <span className="font-bold text-heading whitespace-nowrap">
              {t('floorplan.availableUnits', { count: available })}
            </span>
          </span>
          <FloorComposition units={fl.units} className="mt-2" />
        </button>
        {canEditFloors && (
          <div className="absolute top-2.5 end-2.5 flex items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition">
            <button
              type="button"
              onClick={() => editor.openEditFloor(fl)}
              className="p-1.5 rounded-lg text-neutral-text/55 hover:text-accent hover:bg-accent/10 cursor-pointer"
              title={t('floorplan.editFloor')}
              aria-label={t('floorplan.editFloorAria', { name: displayName })}
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => void deleteFloor(fl)}
              className="p-1.5 rounded-lg text-neutral-text/55 hover:text-red-500 hover:bg-red-500/10 cursor-pointer"
              title={t('floorplan.deleteFloor')}
              aria-label={t('floorplan.deleteFloorAria', { name: displayName })}
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
          {t('floorplan.floorsCount', { count: floors.length })}
        </span>
        {canEditFloors && (
          <button
            type="button"
            onClick={editor.openAddFloor}
            className="text-[11px] font-bold text-accent hover:underline cursor-pointer inline-flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            {t('floorplan.newFloor')}
          </button>
        )}
      </div>
      {floors.length === 0 ? (
        <p className="text-[11px] text-neutral-text/50 py-6 text-center">{t('floorplan.noFloorsYet')}</p>
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

  const activeFloorDisplayName = activeFloor ? floorDisplayName(activeFloor) : '—';
  const activeFloorDescription =
    (isEn && activeFloor?.descriptionEn ? activeFloor.descriptionEn : activeFloor?.descriptionAr) ||
    t('floorplan.defaultFloorDescription');

  const unitsPanel = (
    <div className="rounded-3xl bg-surface border border-muted-border/40 p-4 sm:p-6 space-y-5 min-w-0">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 border-b border-muted-border/30 pb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-black text-heading">{activeFloorDisplayName}</span>
            {activeFloor?.totalArea ? (
              <span className="text-xs font-bold text-accent">
                ({activeFloor.totalArea.toLocaleString(isEn ? 'en-US' : 'ar-SA')} {isEn ? 'm²' : 'م²'})
              </span>
            ) : null}
          </div>
          <p className="text-xs text-neutral-text/60 mt-0.5">{activeFloorDescription}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div
            className="flex items-center gap-1 bg-canvas p-1 rounded-xl border border-muted-border/30 text-[10px] font-bold"
            role="group"
            aria-label={t('floorplan.unitsFilterAria')}
          >
            <button
              type="button"
              onClick={() => setUnitFilter('all')}
              aria-pressed={unitFilter === 'all'}
              className={`px-2.5 py-1 rounded-lg cursor-pointer ${
                unitFilter === 'all' ? 'brand-fill text-canvas' : 'text-neutral-text/70'
              }`}
            >
              {t('floorplan.allFilter', { count: activeFloor?.units.length ?? 0 })}
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
                {t(UNIT_STATUS_KEYS[status])} ({n})
              </button>
            ))}
          </div>
          {canEdit && activeFloor && (
            <button
              type="button"
              onClick={() => activeFloor && editor.openAddUnit(activeFloor)}
              className="brand-btn-primary text-xs font-bold px-3.5 py-2 rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              {t('floorplan.newUnit')}
            </button>
          )}
        </div>
      </div>

      {filteredUnits.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-muted-border/50 rounded-2xl">
          <Layers className="w-8 h-8 text-neutral-text/30 mx-auto mb-2" />
          <p className="text-xs text-neutral-text/60 font-bold">
            {activeFloor ? t('floorplan.noMatchingUnits') : t('floorplan.addFloorFirst')}
          </p>
          {canEdit && activeFloor && unitFilter === 'all' && (
            <button
              type="button"
              onClick={() => activeFloor && editor.openAddUnit(activeFloor)}
              className="mt-3 brand-btn-secondary text-xs font-bold px-4 py-2 rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              {t('floorplan.addUnit')}
            </button>
          )}
        </div>
      ) : (
        <div className={`grid grid-cols-1 gap-3.5 ${UNIT_GRID_CLASSES[unitColumns]}`}>
          {filteredUnits.map((unit) => {
            const section = unit.sectionAr;
            const unitType = isEn && unit.typeEn ? unit.typeEn : unit.typeAr;
            return (
              <div
                key={unit.id}
                className="p-4 rounded-2xl border border-muted-border/40 bg-canvas/50 hover:border-accent/40 transition flex flex-col justify-between min-w-0 border-s-2"
                style={{ borderInlineStartColor: STATUS_VAR[unit.status] }}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-surface border border-muted-border/40 flex items-center justify-center shrink-0">
                        <UnitIcon type={unit.type} />
                      </div>
                      <div className="min-w-0">
                        {section && (
                          <span className="text-[10px] text-neutral-text/50 font-bold block leading-none truncate">
                            {section}
                          </span>
                        )}
                        <h5 className="text-xs font-black text-heading mt-0.5 truncate" title={unit.unitNumber}>
                          {unit.unitNumber}
                        </h5>
                      </div>
                    </div>
                    {canEdit ? (
                      <select
                        value={unit.status}
                        disabled={editor.saving}
                        onChange={(e) => editor.setUnitStatus(unit, e.target.value as UnitStatus)}
                        aria-label={t('floorplan.unitStatusAria', { number: unit.unitNumber })}
                        className="shrink-0 px-2 py-1 rounded-lg bg-surface border border-muted-border/50 text-[10px] font-bold text-heading outline-none cursor-pointer focus:border-accent disabled:opacity-50"
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {t(UNIT_STATUS_KEYS[s])}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="shrink-0 inline-flex items-center gap-1.5 text-[10px] font-bold text-heading whitespace-nowrap">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ background: STATUS_VAR[unit.status] }}
                          aria-hidden="true"
                        />
                        {t(UNIT_STATUS_KEYS[unit.status])}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-surface/70 border border-muted-border/30 text-[11px] my-2.5">
                    <div className="min-w-0">
                      <span className="text-neutral-text/50 block text-[9px]">{t('floorplan.areaLabel')}</span>
                      <span className="font-bold text-heading">
                        {unit.area.toLocaleString(isEn ? 'en-US' : 'ar-SA')} {isEn ? 'm²' : 'م²'}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <span className="text-neutral-text/50 block text-[9px]">{t('floorplan.typeLabel')}</span>
                      <span className="font-bold text-heading truncate block">{unitType}</span>
                    </div>
                  </div>

                  {unit.priceLabel && <div className="text-[10px] text-accent font-bold mb-2">{unit.priceLabel}</div>}

                  {unit.features && unit.features.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {unit.features.slice(0, 3).map((feat) => (
                        <span
                          key={feat}
                          className="text-[9px] px-1.5 py-0.5 rounded bg-surface border border-muted-border/30 text-neutral-text/60 truncate max-w-full"
                        >
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
                      onClick={() => activeFloor && editor.openEditUnit(activeFloor, unit)}
                      className="flex-1 py-1.5 rounded-lg bg-surface border border-muted-border/40 hover:border-accent text-neutral-text/75 hover:text-accent font-bold text-[10px] transition flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Edit2 className="w-3 h-3" />
                      {t('floorplan.editUnit')}
                    </button>
                    <button
                      type="button"
                      onClick={() => void editor.deleteUnit(unit)}
                      className="p-1.5 rounded-lg bg-surface border border-muted-border/40 hover:border-red-400 text-neutral-text/40 hover:text-red-400 transition cursor-pointer"
                      title={t('floorplan.deleteUnit')}
                      aria-label={t('floorplan.deleteUnitAria', { number: unit.unitNumber })}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  /* -------------------------------- Render ------------------------------- */

  return (
    <div className="space-y-4">
      {/* View toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <Segmented<FloorsView>
          label={t('floorplan.floorsViewLabel')}
          value={floorsView}
          onChange={setFloorsView}
          className="flex"
          options={[
            { value: 'side', label: <PanelRight className="w-3.5 h-3.5" />, title: t('floorplan.sideList') },
            { value: 'grid', label: <LayoutGrid className="w-3.5 h-3.5" />, title: t('floorplan.gridTop') },
          ]}
        />
        <Segmented<UnitColumns>
          label={t('floorplan.unitColumnsLabel')}
          value={unitColumns}
          onChange={setUnitColumns}
          className="hidden sm:flex"
          options={[
            { value: 0, label: t('floorplan.autoCols'), title: t('floorplan.autoColsTitle') },
            { value: 2, label: '2', title: t('floorplan.col2') },
            { value: 3, label: '3', title: t('floorplan.col3') },
            { value: 4, label: '4', title: t('floorplan.col4') },
            { value: 5, label: '5', title: t('floorplan.col5') },
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
            aria-label={t('floorplan.resizeFloorsAria')}
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
            title={t('floorplan.resizeFloorsTitle')}
            className="relative hidden lg:flex self-stretch items-center justify-center cursor-col-resize group outline-none touch-none"
          >
            <div className="h-full w-px bg-muted-border/40 group-hover:bg-accent/60 group-focus-visible:bg-accent transition" />
            <GripVertical className="absolute w-3.5 h-3.5 text-neutral-text/40 group-hover:text-accent" />
          </div>
          {unitsPanel}
        </div>
      )}

      {editor.dialogs}
    </div>
  );
};

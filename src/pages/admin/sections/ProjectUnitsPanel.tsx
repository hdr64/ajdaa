import React, { useMemo, useState } from 'react';
import { ChevronDown, Layers, Pencil, Plus, Search, SearchX, Trash2 } from 'lucide-react';
import type { Property, PropertyFloor, PropertyUnit, UnitStatus } from '../../../types/property';
import { AdminStorage } from '../../../services/adminStorage';
import { getErrorMessage } from '../../../services/api';
import { useAdmin } from '../adminContextDef';
import { EmptyState } from '../../../components/admin/common/EmptyState';
import { useFloorPlanEditor } from '../../../components/admin/floorplan/useFloorPlanEditor';
import { UNIT_STATUS_LABELS_AR } from '../projectLabels';

const STATUSES: UnitStatus[] = ['available', 'reserved', 'rented', 'sold'];

/** Same validated tokens as the overview chart, so a status keeps one colour everywhere. */
const STATUS_VAR: Record<UnitStatus, string> = {
  available: 'var(--viz-available)',
  reserved: 'var(--viz-reserved)',
  rented: 'var(--viz-rented)',
  sold: 'var(--viz-sold)',
};

const STATUS_EN: Record<UnitStatus, string> = {
  available: 'Available',
  reserved: 'Reserved',
  rented: 'Rented',
  sold: 'Sold',
};

function StatusDot({ status }: { status: UnitStatus }) {
  return <span className="w-2 h-2 rounded-full shrink-0" style={{ background: STATUS_VAR[status] }} aria-hidden="true" />;
}

/** Direct status select: any status in one step. */
const UnitStatusControl: React.FC<{ unit: PropertyUnit; editable: boolean; onChange: (status: UnitStatus) => void; busy: boolean }> = ({
  unit,
  editable,
  onChange,
  busy,
}) => {
  if (!editable) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-heading whitespace-nowrap">
        <StatusDot status={unit.status} />
        {UNIT_STATUS_LABELS_AR[unit.status]}
      </span>
    );
  }
  return (
    <label className="relative inline-flex items-center">
      <span className="absolute start-2.5 pointer-events-none">
        <StatusDot status={unit.status} />
      </span>
      <select
        value={unit.status}
        disabled={busy}
        onChange={(e) => onChange(e.target.value as UnitStatus)}
        aria-label={`حالة الوحدة ${unit.unitNumber}`}
        className="ps-6 pe-2 py-1 rounded-lg bg-canvas border border-muted-border/50 text-[11px] font-bold text-heading outline-none cursor-pointer focus:border-accent disabled:opacity-50"
      >
        {STATUSES.map((status) => (
          <option key={status} value={status}>
            {UNIT_STATUS_LABELS_AR[status]}
          </option>
        ))}
      </select>
    </label>
  );
};

const iconBtn =
  'p-1.5 rounded-lg text-neutral-text/55 hover:bg-surface-hover cursor-pointer inline-flex items-center justify-center disabled:opacity-40';

export const ProjectUnitsPanel: React.FC<{ project: Property }> = ({ project }) => {
  const { can, showToast, projects } = useAdmin();
  const canUnits = can('manageUnits');
  const canFloors = can('manageProjects');
  const floors = useMemo(() => project.floors ?? [], [project.floors]);
  const editor = useFloorPlanEditor(project, projects.reload);

  const [statusFilter, setStatusFilter] = useState<UnitStatus | 'all'>('all');
  const [query, setQuery] = useState('');
  // First floor open by default; the rest collapse so long buildings stay scannable.
  const [open, setOpen] = useState<Set<number>>(() => new Set(floors.length ? [floors[0].floorNumber] : []));
  const [savingUnit, setSavingUnit] = useState<string | null>(null);

  const counts = useMemo(() => {
    const result: Record<UnitStatus | 'all', number> = { all: 0, available: 0, reserved: 0, rented: 0, sold: 0 };
    for (const floor of floors) {
      for (const unit of floor.units) {
        result.all += 1;
        result[unit.status] += 1;
      }
    }
    return result;
  }, [floors]);

  const needle = query.trim().toLowerCase();
  const matches = (unit: PropertyUnit) =>
    (statusFilter === 'all' || unit.status === statusFilter) &&
    (!needle ||
      [unit.unitNumber, unit.typeAr, unit.sectionAr, unit.priceLabel]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)));
  const filtering = statusFilter !== 'all' || needle.length > 0;

  // Highest floor on top, like a building; empty floors stay visible unless filtering.
  const visibleFloors = [...floors]
    .reverse()
    .map((floor) => ({ floor, units: floor.units.filter(matches) }))
    .filter(({ units }) => !filtering || units.length > 0);

  const toggle = (floorNumber: number) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(floorNumber)) next.delete(floorNumber);
      else next.add(floorNumber);
      return next;
    });
  const expandFloor = (floorNumber: number) => setOpen((current) => new Set(current).add(floorNumber));
  const allOpen = visibleFloors.length > 0 && visibleFloors.every(({ floor }) => open.has(floor.floorNumber));

  const changeStatus = async (unit: PropertyUnit, status: UnitStatus) => {
    if (status === unit.status) return;
    const previous = projects.data;
    // Optimistic; the server's realtime broadcast confirms it for every other tab.
    projects.setData((list) =>
      list.map((p) =>
        p.id !== project.id
          ? p
          : {
              ...p,
              floors: (p.floors ?? []).map((f) => ({
                ...f,
                units: f.units.map((u) =>
                  u.id === unit.id ? { ...u, status, statusAr: UNIT_STATUS_LABELS_AR[status], statusEn: STATUS_EN[status] } : u
                ),
              })),
            }
      )
    );
    setSavingUnit(unit.id);
    try {
      await AdminStorage.updateUnitStatus(unit.id, status);
      showToast(`الوحدة ${unit.unitNumber}: ${UNIT_STATUS_LABELS_AR[status]}`);
    } catch (error) {
      projects.setData(previous);
      showToast(getErrorMessage(error, 'تعذر تحديث حالة الوحدة'));
    } finally {
      setSavingUnit(null);
    }
  };

  const addUnitTo = (floor: PropertyFloor) => {
    expandFloor(floor.floorNumber);
    editor.openAddUnit(floor);
  };

  const unitActions = (floor: PropertyFloor, unit: PropertyUnit) =>
    canUnits && (
      <div className="flex items-center gap-0.5 justify-end">
        <button type="button" onClick={() => editor.openEditUnit(floor, unit)} className={`${iconBtn} hover:text-accent`} title="تعديل الوحدة" aria-label={`تعديل ${unit.unitNumber}`}>
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button type="button" onClick={() => void editor.deleteUnit(unit)} className={`${iconBtn} hover:text-red-500`} title="حذف الوحدة" aria-label={`حذف ${unit.unitNumber}`}>
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    );

  if (floors.length === 0) {
    return (
      <>
        <EmptyState
          icon={Layers}
          title="لا توجد أدوار في هذا المشروع"
          description="ابدأ بإضافة دور ثم أضف وحداته."
          action={
            canFloors && (
              <button type="button" onClick={editor.openAddFloor} className="brand-btn-primary font-bold text-xs px-4 py-2 rounded-xl cursor-pointer inline-flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                إضافة دور
              </button>
            )
          }
        />
        {editor.dialogs}
      </>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar: status filter (with counts), search, expand all, add floor */}
      <div className="p-4 rounded-2xl bg-surface border border-muted-border/40 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto" role="group" aria-label="تصفية حسب الحالة">
          {(['all', ...STATUSES] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              aria-pressed={statusFilter === status}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs whitespace-nowrap cursor-pointer transition ${
                statusFilter === status
                  ? 'brand-fill text-canvas shadow-xs'
                  : 'bg-canvas border border-muted-border/40 text-neutral-text/70 hover:text-heading'
              }`}
            >
              {status !== 'all' && <StatusDot status={status} />}
              {status === 'all' ? 'الكل' : UNIT_STATUS_LABELS_AR[status]}
              <span className="opacity-70 tabular-nums">({counts[status]})</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 xl:w-56">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-text/40" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="رقم الوحدة أو النوع..."
              className="w-full ps-9 pe-3 py-2 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent"
            />
          </div>
          <button
            type="button"
            onClick={() => setOpen(allOpen ? new Set() : new Set(visibleFloors.map(({ floor }) => floor.floorNumber)))}
            className="brand-btn-secondary px-3 py-2 rounded-xl text-[11px] font-bold whitespace-nowrap cursor-pointer"
          >
            {allOpen ? 'طي الكل' : 'توسيع الكل'}
          </button>
          {canFloors && (
            <button
              type="button"
              onClick={editor.openAddFloor}
              className="brand-btn-primary px-3 py-2 rounded-xl text-[11px] font-bold whitespace-nowrap cursor-pointer inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              دور جديد
            </button>
          )}
        </div>
      </div>

      {visibleFloors.length === 0 ? (
        <EmptyState icon={SearchX} title="لا توجد وحدات مطابقة" />
      ) : (
        <div className="space-y-3">
          {visibleFloors.map(({ floor, units }) => {
            const expanded = filtering || open.has(floor.floorNumber);
            const available = floor.units.filter((u) => u.status === 'available').length;
            const panelId = `floor-${project.id}-${floor.floorNumber}`;
            return (
              <section key={floor.id ?? floor.floorNumber} className="rounded-2xl bg-surface border border-muted-border/40 overflow-hidden">
                <div className="flex items-center hover:bg-surface-hover/60">
                  <button
                    type="button"
                    onClick={() => toggle(floor.floorNumber)}
                    aria-expanded={expanded}
                    aria-controls={panelId}
                    className="flex-1 min-w-0 flex flex-wrap items-center gap-x-4 gap-y-2 p-4 text-start cursor-pointer"
                  >
                    <ChevronDown className={`w-4 h-4 text-neutral-text/50 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                    <div className="min-w-0 flex-1 basis-40">
                      <div className="text-xs font-black text-heading truncate">{floor.floorNameAr}</div>
                      <div className="text-[10px] text-neutral-text/55">
                        {floor.units.length} وحدة{floor.totalArea ? ` · ${floor.totalArea.toLocaleString('en-US')} م²` : ''}
                        {floor.floorNameEn ? <span dir="ltr"> · {floor.floorNameEn}</span> : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="hidden sm:flex w-28 h-2 gap-[2px]" aria-hidden="true">
                        {STATUSES.map((s) => {
                          const n = floor.units.filter((u) => u.status === s).length;
                          return n > 0 ? (
                            <div
                              key={s}
                              className="h-full first:rounded-s-full last:rounded-e-full"
                              style={{ width: `${(n / floor.units.length) * 100}%`, background: STATUS_VAR[s] }}
                            />
                          ) : null;
                        })}
                      </div>
                      <span className="text-[11px] text-neutral-text/65 whitespace-nowrap">
                        <span className="font-black text-heading">{available}</span> متاح من {floor.units.length}
                      </span>
                    </div>
                  </button>

                  {(canUnits || canFloors) && (
                    <div className="flex items-center gap-0.5 pe-3 shrink-0">
                      {canUnits && (
                        <button type="button" onClick={() => addUnitTo(floor)} className={`${iconBtn} hover:text-accent`} title="إضافة وحدة لهذا الدور" aria-label={`إضافة وحدة إلى ${floor.floorNameAr}`}>
                          <Plus className="w-4 h-4" />
                        </button>
                      )}
                      {canFloors && (
                        <>
                          <button type="button" onClick={() => editor.openEditFloor(floor)} className={`${iconBtn} hover:text-accent`} title="تعديل الدور" aria-label={`تعديل ${floor.floorNameAr}`}>
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" onClick={() => void editor.deleteFloor(floor)} className={`${iconBtn} hover:text-red-500`} title="حذف الدور" aria-label={`حذف ${floor.floorNameAr}`}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {expanded && (
                  <div id={panelId} className="border-t border-muted-border/30">
                    {units.length === 0 ? (
                      <div className="px-4 py-6 text-center text-[11px] text-neutral-text/55">
                        لا توجد وحدات في هذا الدور.
                        {canUnits && (
                          <button type="button" onClick={() => addUnitTo(floor)} className="ms-1.5 font-bold text-accent hover:underline cursor-pointer">
                            إضافة وحدة
                          </button>
                        )}
                      </div>
                    ) : (
                      <>
                        {/* Phones: cards, so the status control is never scrolled off-screen */}
                        <ul className="md:hidden divide-y divide-muted-border/15">
                          {units.map((unit) => (
                            <li key={unit.id} className="flex items-center justify-between gap-3 px-4 py-3">
                              <div className="min-w-0">
                                <div className="text-xs font-black text-heading truncate">{unit.unitNumber}</div>
                                <div className="text-[10px] text-neutral-text/60 truncate">
                                  {unit.typeAr} · {unit.area.toLocaleString('en-US')} م²
                                  {unit.sectionAr ? ` · ${unit.sectionAr}` : ''}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <UnitStatusControl unit={unit} editable={canUnits} busy={savingUnit === unit.id} onChange={(s) => void changeStatus(unit, s)} />
                                {unitActions(floor, unit)}
                              </div>
                            </li>
                          ))}
                        </ul>
                        <table className="hidden md:table w-full text-xs">
                          <thead>
                            <tr className="text-neutral-text/50 text-[11px] bg-canvas/40">
                              <th className="px-4 py-2 text-start font-bold">الوحدة</th>
                              <th className="px-3 py-2 text-start font-bold">النوع</th>
                              <th className="px-3 py-2 text-start font-bold">القسم</th>
                              <th className="px-3 py-2 text-end font-bold">المساحة</th>
                              <th className="px-3 py-2 text-start font-bold">السعر</th>
                              <th className="px-3 py-2 text-start font-bold">الحالة</th>
                              {canUnits && <th className="px-4 py-2 text-end font-bold">إجراءات</th>}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-muted-border/15">
                            {units.map((unit) => (
                              <tr key={unit.id} className="hover:bg-surface-hover/50">
                                <td className="px-4 py-2.5 font-black text-heading whitespace-nowrap">{unit.unitNumber}</td>
                                <td className="px-3 py-2.5 text-neutral-text/80">{unit.typeAr}</td>
                                <td className="px-3 py-2.5 text-neutral-text/60">{unit.sectionAr || '—'}</td>
                                <td className="px-3 py-2.5 text-end tabular-nums text-heading whitespace-nowrap">{unit.area.toLocaleString('en-US')} م²</td>
                                <td className="px-3 py-2.5 text-neutral-text/70">{unit.priceLabel || '—'}</td>
                                <td className="px-3 py-2">
                                  <UnitStatusControl unit={unit} editable={canUnits} busy={savingUnit === unit.id} onChange={(s) => void changeStatus(unit, s)} />
                                </td>
                                {canUnits && <td className="px-4 py-2">{unitActions(floor, unit)}</td>}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </>
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {editor.dialogs}
    </div>
  );
};

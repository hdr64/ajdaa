import React, { useMemo, useState } from 'react';
import { ChevronDown, Layers, Search, SearchX } from 'lucide-react';
import type { Property, PropertyUnit, UnitStatus } from '../../../types/property';
import { AdminStorage } from '../../../services/adminStorage';
import { getErrorMessage } from '../../../services/api';
import { useAdmin } from '../adminContextDef';
import { EmptyState } from '../../../components/admin/common/EmptyState';
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

/** Direct status select: any status in one step (the floor plan chip only cycles). */
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

export const ProjectUnitsPanel: React.FC<{ project: Property }> = ({ project }) => {
  const { can, navigate, showToast, projects } = useAdmin();
  const editable = can('manageUnits');
  const floors = useMemo(() => project.floors ?? [], [project.floors]);

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

  const visibleFloors = floors
    .map((floor) => ({ floor, units: floor.units.filter(matches) }))
    .filter(({ units }) => !filtering || units.length > 0);

  const toggle = (floorNumber: number) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(floorNumber)) next.delete(floorNumber);
      else next.add(floorNumber);
      return next;
    });
  const allOpen = visibleFloors.length > 0 && visibleFloors.every(({ floor }) => open.has(floor.floorNumber));

  const changeStatus = async (unit: PropertyUnit, status: UnitStatus) => {
    if (status === unit.status) return;
    const previous = projects.data;
    const patchUnit = (list: Property[]) =>
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
      );
    // Optimistic; the server's realtime broadcast confirms it for every other tab.
    projects.setData(patchUnit);
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

  if (counts.all === 0) {
    return (
      <EmptyState
        icon={Layers}
        title="لا توجد وحدات في هذا المشروع"
        description="أضف الأدوار والوحدات من المخطط البصري."
        action={
          editable && (
            <button
              onClick={() => navigate({ section: 'units', projectId: project.id })}
              className="brand-btn-primary font-bold text-xs px-4 py-2 rounded-xl cursor-pointer"
            >
              فتح المخطط البصري
            </button>
          )
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar: status filter (with counts), search, expand all */}
      <div className="p-4 rounded-2xl bg-surface border border-muted-border/40 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto" role="group" aria-label="تصفية حسب الحالة">
          {(['all', ...STATUSES] as const).map((status) => (
            <button
              key={status}
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
          <div className="relative flex-1 lg:w-56">
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
            onClick={() => setOpen(allOpen ? new Set() : new Set(visibleFloors.map(({ floor }) => floor.floorNumber)))}
            className="brand-btn-secondary px-3 py-2 rounded-xl text-[11px] font-bold whitespace-nowrap cursor-pointer"
          >
            {allOpen ? 'طي الكل' : 'توسيع الكل'}
          </button>
        </div>
      </div>

      {visibleFloors.length === 0 ? (
        <EmptyState icon={SearchX} title="لا توجد وحدات مطابقة" />
      ) : (
        <div className="space-y-3">
          {visibleFloors.map(({ floor, units }) => {
            const expanded = filtering || open.has(floor.floorNumber);
            const floorCounts = STATUSES.map((s) => ({ status: s, n: floor.units.filter((u) => u.status === s).length }));
            const panelId = `floor-${project.id}-${floor.floorNumber}`;
            return (
              <section key={floor.id ?? floor.floorNumber} className="rounded-2xl bg-surface border border-muted-border/40 overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggle(floor.floorNumber)}
                  aria-expanded={expanded}
                  aria-controls={panelId}
                  className="w-full flex flex-wrap items-center gap-x-4 gap-y-2 p-4 text-start hover:bg-surface-hover/60 cursor-pointer"
                >
                  <ChevronDown className={`w-4 h-4 text-neutral-text/50 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                  <div className="min-w-0 flex-1 basis-40">
                    <div className="text-xs font-black text-heading truncate">{floor.floorNameAr}</div>
                    <div className="text-[10px] text-neutral-text/55">
                      {floor.units.length} وحدة{floor.totalArea ? ` · ${floor.totalArea.toLocaleString('en-US')} م²` : ''}
                    </div>
                  </div>
                  {/* Per-floor composition: the same stacked encoding as the overview chart */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="hidden sm:flex w-28 h-2 gap-[2px]" aria-hidden="true">
                      {floorCounts
                        .filter((c) => c.n > 0)
                        .map((c) => (
                          <div
                            key={c.status}
                            className="h-full first:rounded-s-full last:rounded-e-full"
                            style={{ width: `${(c.n / floor.units.length) * 100}%`, background: STATUS_VAR[c.status] }}
                          />
                        ))}
                    </div>
                    <span className="text-[11px] text-neutral-text/65 whitespace-nowrap">
                      <span className="font-black text-heading">{floorCounts[0].n}</span> متاح من {floor.units.length}
                    </span>
                  </div>
                </button>

                {expanded && (
                  <div id={panelId} className="border-t border-muted-border/30">
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
                          <UnitStatusControl
                            unit={unit}
                            editable={editable}
                            busy={savingUnit === unit.id}
                            onChange={(status) => void changeStatus(unit, status)}
                          />
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
                          <th className="px-4 py-2 text-start font-bold">الحالة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-muted-border/15">
                        {units.map((unit) => (
                          <tr key={unit.id} className="hover:bg-surface-hover/50">
                            <td className="px-4 py-2.5 font-black text-heading whitespace-nowrap">{unit.unitNumber}</td>
                            <td className="px-3 py-2.5 text-neutral-text/80">{unit.typeAr}</td>
                            <td className="px-3 py-2.5 text-neutral-text/60">{unit.sectionAr || '—'}</td>
                            <td className="px-3 py-2.5 text-end tabular-nums text-heading whitespace-nowrap">
                              {unit.area.toLocaleString('en-US')} م²
                            </td>
                            <td className="px-3 py-2.5 text-neutral-text/70">{unit.priceLabel || '—'}</td>
                            <td className="px-4 py-2">
                              <UnitStatusControl
                                unit={unit}
                                editable={editable}
                                busy={savingUnit === unit.id}
                                onChange={(status) => void changeStatus(unit, status)}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {editable && (
        <p className="text-[11px] text-neutral-text/55">
          لإضافة أدوار أو وحدات أو تعديل تفاصيلها استخدم{' '}
          <button
            onClick={() => navigate({ section: 'units', projectId: project.id })}
            className="font-bold text-accent hover:underline cursor-pointer"
          >
            المخطط البصري للمشروع
          </button>
          .
        </p>
      )}
    </div>
  );
};

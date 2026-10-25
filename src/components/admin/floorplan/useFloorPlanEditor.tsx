import React, { useState } from 'react';
import type { Property, PropertyFloor, PropertyUnit, UnitStatus } from '../../../types/property';
import { AdminStorage } from '../../../services/adminStorage';
import { propertyService } from '../../../services/propertyService';
import { getErrorMessage } from '../../../services/api';
import { useAdmin } from '../../../pages/admin/adminContextDef';
import { UNIT_STATUS_LABELS_AR } from '../../../pages/admin/projectLabels';
import { DialogShell, Label } from './dialogParts';

const STATUSES: UnitStatus[] = ['available', 'reserved', 'rented', 'sold'];

const UNIT_TYPE_AR: Record<PropertyUnit['type'], string> = {
  showroom: 'معرض تجاري',
  office: 'مكتب إداري',
  apartment: 'شقة سكنية',
  warehouse: 'مستودع تخزين',
  outdoor: 'جلسات خارجية / تراس',
};

const INPUT_CLASS =
  'w-full px-3 py-2 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent';

interface UnitFormState {
  unitNumber: string;
  sectionAr: string;
  type: PropertyUnit['type'];
  area: number;
  priceLabel: string;
  status: UnitStatus;
  featuresStr: string;
}

function defaultUnitType(project: Property): PropertyUnit['type'] {
  if (project.type === 'residential') return 'apartment';
  if (project.type === 'logistics') return 'warehouse';
  if (project.type === 'office') return 'office';
  return 'showroom';
}

/**
 * Floor & unit CRUD shared by the floor plan and the project page's Units tab:
 * one set of dialogs, confirmations and server calls so both screens behave the
 * same. Returns actions plus the `dialogs` node to render once.
 */
export function useFloorPlanEditor(project: Property, onProjectUpdate: () => void | Promise<void>) {
  const { showToast, confirmDelete } = useAdmin();
  const [saving, setSaving] = useState(false);

  const [unitDialog, setUnitDialog] = useState<{ floor: PropertyFloor; unit: PropertyUnit | null } | null>(null);
  const [unitForm, setUnitForm] = useState<UnitFormState>({
    unitNumber: '',
    sectionAr: '',
    type: 'showroom',
    area: 150,
    priceLabel: 'متاح للإيجار',
    status: 'available',
    featuresStr: '',
  });

  const [floorDialog, setFloorDialog] = useState<{ floor: PropertyFloor | null } | null>(null);
  const [floorForm, setFloorForm] = useState({ nameAr: '', nameEn: '', descriptionAr: '' });

  const run = async (action: () => Promise<unknown>, success: string): Promise<boolean> => {
    setSaving(true);
    try {
      await action();
      await onProjectUpdate();
      showToast(success);
      return true;
    } catch (error) {
      showToast(getErrorMessage(error, 'تعذر حفظ التعديلات على الخادم'));
      return false;
    } finally {
      setSaving(false);
    }
  };

  /* ----------------------------------- Units ---------------------------------- */

  const openAddUnit = (floor: PropertyFloor) => {
    setUnitForm({
      unitNumber: '',
      sectionAr: '',
      type: defaultUnitType(project),
      area: 150,
      priceLabel: 'متاح للإيجار',
      status: 'available',
      featuresStr: '',
    });
    setUnitDialog({ floor, unit: null });
  };

  const openEditUnit = (floor: PropertyFloor, unit: PropertyUnit) => {
    setUnitForm({
      unitNumber: unit.unitNumber,
      sectionAr: unit.sectionAr || '',
      type: unit.type,
      area: unit.area,
      priceLabel: unit.priceLabel || '',
      status: unit.status,
      featuresStr: unit.features?.join('، ') || '',
    });
    setUnitDialog({ floor, unit });
  };

  const saveUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unitDialog || !unitForm.unitNumber.trim()) return;
    const { floor, unit } = unitDialog;
    const features = unitForm.featuresStr
      .split(/[,،]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const base = {
      unitNumber: unitForm.unitNumber.trim(),
      floorNumber: floor.floorNumber,
      floorNameAr: floor.floorNameAr,
      floorNameEn: floor.floorNameEn,
      sectionAr: unitForm.sectionAr.trim() || undefined,
      type: unitForm.type,
      typeAr: UNIT_TYPE_AR[unitForm.type],
      area: Number(unitForm.area),
      priceLabel: unitForm.priceLabel.trim() || undefined,
      status: unitForm.status,
      statusAr: UNIT_STATUS_LABELS_AR[unitForm.status],
      features,
    };
    const ok = await run(
      () =>
        unit
          ? AdminStorage.updateUnitInProject(project.id, floor, { ...unit, ...base })
          : AdminStorage.addUnitToProject(project.id, floor, { ...base, id: `u-${crypto.randomUUID()}` }),
      unit ? 'تم تحديث بيانات الوحدة' : 'تمت إضافة الوحدة'
    );
    if (ok) setUnitDialog(null);
  };

  const deleteUnit = async (unit: PropertyUnit) => {
    const ok = await confirmDelete({
      title: `حذف الوحدة "${unit.unitNumber}"؟`,
      message: 'لا يمكن التراجع عن هذا الإجراء.',
      confirmLabel: 'حذف الوحدة',
    });
    if (ok) await run(() => AdminStorage.deleteUnitFromProject(project.id, unit.id), 'تم حذف الوحدة');
  };

  const setUnitStatus = (unit: PropertyUnit, status: UnitStatus) => {
    if (status === unit.status) return;
    void run(() => AdminStorage.updateUnitStatus(unit.id, status), `الوحدة ${unit.unitNumber}: ${UNIT_STATUS_LABELS_AR[status]}`);
  };

  /* ---------------------------------- Floors ---------------------------------- */

  const openAddFloor = () => {
    setFloorForm({ nameAr: '', nameEn: '', descriptionAr: '' });
    setFloorDialog({ floor: null });
  };

  const openEditFloor = (floor: PropertyFloor) => {
    setFloorForm({ nameAr: floor.floorNameAr, nameEn: floor.floorNameEn ?? '', descriptionAr: floor.descriptionAr ?? '' });
    setFloorDialog({ floor });
  };

  const saveFloor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!floorDialog || !floorForm.nameAr.trim()) return;
    const editing = floorDialog.floor;
    const floors = project.floors ?? [];
    const ok = await run(
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
              descriptionAr: floorForm.descriptionAr.trim() || null,
            }),
      editing ? 'تم تحديث بيانات الدور' : 'تمت إضافة الدور'
    );
    if (ok) setFloorDialog(null);
  };

  /** Resolves to true when the floor was deleted. */
  const deleteFloor = async (floor: PropertyFloor): Promise<boolean> => {
    const ok = await confirmDelete({
      title: `حذف "${floor.floorNameAr}"؟`,
      message: `سيتم حذف الدور و${floor.units.length} وحدة تابعة له نهائياً.`,
      confirmLabel: 'حذف الدور',
    });
    if (!ok) return false;
    return run(() => AdminStorage.deleteFloorFromProject(project.id, floor.floorNumber), 'تم حذف الدور');
  };

  /* ---------------------------------- Dialogs --------------------------------- */

  const dialogs = (
    <>
      {unitDialog && (
        <DialogShell
          title={unitDialog.unit ? `تعديل (${unitDialog.unit.unitNumber})` : `وحدة جديدة في ${unitDialog.floor.floorNameAr}`}
          onClose={() => setUnitDialog(null)}
        >
          <form onSubmit={saveUnit} className="space-y-3.5">
            <Label text="رقم / اسم الوحدة *">
              <input
                type="text"
                required
                autoFocus
                value={unitForm.unitNumber}
                onChange={(e) => setUnitForm({ ...unitForm, unitNumber: e.target.value })}
                placeholder="مثال: معرض 101 أو مكتب 204"
                className={INPUT_CLASS}
              />
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <Label text="الجهة / القسم">
                <input
                  type="text"
                  value={unitForm.sectionAr}
                  onChange={(e) => setUnitForm({ ...unitForm, sectionAr: e.target.value })}
                  placeholder="مثال: الجهة الشمالية"
                  className={INPUT_CLASS}
                />
              </Label>
              <Label text="المساحة (م²) *">
                <input
                  type="number"
                  required
                  min={0}
                  step="any"
                  value={unitForm.area}
                  onChange={(e) => setUnitForm({ ...unitForm, area: Number(e.target.value) })}
                  className={INPUT_CLASS}
                />
              </Label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Label text="نوع الوحدة">
                <select
                  value={unitForm.type}
                  onChange={(e) => setUnitForm({ ...unitForm, type: e.target.value as PropertyUnit['type'] })}
                  className={`${INPUT_CLASS} cursor-pointer`}
                >
                  {(Object.keys(UNIT_TYPE_AR) as PropertyUnit['type'][]).map((t) => (
                    <option key={t} value={t}>
                      {UNIT_TYPE_AR[t]}
                    </option>
                  ))}
                </select>
              </Label>
              <Label text="حالة الوحدة">
                <select
                  value={unitForm.status}
                  onChange={(e) => setUnitForm({ ...unitForm, status: e.target.value as UnitStatus })}
                  className={`${INPUT_CLASS} cursor-pointer`}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {UNIT_STATUS_LABELS_AR[s]}
                    </option>
                  ))}
                </select>
              </Label>
            </div>
            <Label text="السعر / وصف العرض">
              <input
                type="text"
                value={unitForm.priceLabel}
                onChange={(e) => setUnitForm({ ...unitForm, priceLabel: e.target.value })}
                placeholder="مثال: متاح للإيجار"
                className={INPUT_CLASS}
              />
            </Label>
            <Label text="المميزات (مفصولة بفواصل)">
              <input
                type="text"
                value={unitForm.featuresStr}
                onChange={(e) => setUnitForm({ ...unitForm, featuresStr: e.target.value })}
                placeholder="واجهة زجاجية، تكييف، إطلالة رئيسية"
                className={INPUT_CLASS}
              />
            </Label>
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-muted-border/30">
              <button type="button" onClick={() => setUnitDialog(null)} className="brand-btn-secondary px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer">
                إلغاء
              </button>
              <button type="submit" disabled={saving} className="brand-btn-primary px-5 py-2 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50">
                {unitDialog.unit ? 'حفظ التعديلات' : 'إضافة الوحدة'}
              </button>
            </div>
          </form>
        </DialogShell>
      )}

      {floorDialog && (
        <DialogShell title={floorDialog.floor ? 'تعديل بيانات الدور' : 'إضافة دور جديد'} onClose={() => setFloorDialog(null)}>
          <form onSubmit={saveFloor} className="space-y-3.5">
            <Label text="اسم الدور بالعربية *">
              <input
                type="text"
                required
                autoFocus
                value={floorForm.nameAr}
                onChange={(e) => setFloorForm({ ...floorForm, nameAr: e.target.value })}
                placeholder="مثال: الدور الأول - مكاتب إدارية"
                className={INPUT_CLASS}
              />
            </Label>
            <Label text="اسم الدور بالإنجليزية">
              <input
                type="text"
                dir="ltr"
                value={floorForm.nameEn}
                onChange={(e) => setFloorForm({ ...floorForm, nameEn: e.target.value })}
                placeholder="First floor - Offices"
                className={INPUT_CLASS}
              />
            </Label>
            <Label text="وصف قصير">
              <input
                type="text"
                value={floorForm.descriptionAr}
                onChange={(e) => setFloorForm({ ...floorForm, descriptionAr: e.target.value })}
                className={INPUT_CLASS}
              />
            </Label>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button type="button" onClick={() => setFloorDialog(null)} className="brand-btn-secondary px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer">
                إلغاء
              </button>
              <button type="submit" disabled={saving} className="brand-btn-primary px-4 py-2 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50">
                {floorDialog.floor ? 'حفظ' : 'إضافة الدور'}
              </button>
            </div>
          </form>
        </DialogShell>
      )}
    </>
  );

  return {
    saving,
    openAddUnit,
    openEditUnit,
    deleteUnit,
    setUnitStatus,
    openAddFloor,
    openEditFloor,
    deleteFloor,
    dialogs,
  };
}

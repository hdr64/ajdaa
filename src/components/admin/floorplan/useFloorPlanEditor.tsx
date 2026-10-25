import React, { useState } from 'react';
import type { Property, PropertyFloor, PropertyUnit, UnitStatus } from '../../../types/property';
import { AdminStorage } from '../../../services/adminStorage';
import { propertyService } from '../../../services/propertyService';
import { getErrorMessage } from '../../../services/api';
import { useAdmin } from '../../../pages/admin/adminContextDef';
import { UNIT_STATUS_KEYS, UNIT_STATUS_LABELS_AR } from '../../../pages/admin/projectLabels';
import { useAdminT } from '../../../i18n/admin/useAdminT';
import { DialogShell, Label } from './dialogParts';

const STATUSES: UnitStatus[] = ['available', 'reserved', 'rented', 'sold'];

const UNIT_TYPE_AR: Record<PropertyUnit['type'], string> = {
  showroom: 'معرض تجاري',
  office: 'مكتب إداري',
  apartment: 'شقة سكنية',
  warehouse: 'مستودع تخزين',
  outdoor: 'جلسات خارجية / تراس',
};

const UNIT_TYPE_EN: Record<PropertyUnit['type'], string> = {
  showroom: 'Commercial Showroom',
  office: 'Office',
  apartment: 'Apartment',
  warehouse: 'Warehouse',
  outdoor: 'Outdoor / Terrace',
};

const UNIT_TYPE_KEYS: Record<
  PropertyUnit['type'],
  | 'floorplan.typeShowroom'
  | 'floorplan.typeOffice'
  | 'floorplan.typeApartment'
  | 'floorplan.typeWarehouse'
  | 'floorplan.typeOutdoor'
> = {
  showroom: 'floorplan.typeShowroom',
  office: 'floorplan.typeOffice',
  apartment: 'floorplan.typeApartment',
  warehouse: 'floorplan.typeWarehouse',
  outdoor: 'floorplan.typeOutdoor',
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
  const { t, isEn } = useAdminT();
  const [saving, setSaving] = useState(false);

  const [unitDialog, setUnitDialog] = useState<{ floor: PropertyFloor; unit: PropertyUnit | null } | null>(null);
  const [unitForm, setUnitForm] = useState<UnitFormState>({
    unitNumber: '',
    sectionAr: '',
    type: 'showroom',
    area: 150,
    priceLabel: t('floorplan.defaultPriceLabel'),
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
      showToast(getErrorMessage(error, t('floorplan.toastSaveFailed')));
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
      priceLabel: t('floorplan.defaultPriceLabel'),
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
      featuresStr: unit.features?.join(isEn ? ', ' : '، ') || '',
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
      typeEn: UNIT_TYPE_EN[unitForm.type],
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
      unit ? t('floorplan.toastUnitUpdated') : t('floorplan.toastUnitSaved')
    );
    if (ok) setUnitDialog(null);
  };

  const deleteUnit = async (unit: PropertyUnit) => {
    const ok = await confirmDelete({
      title: t('floorplan.deleteUnitConfirmTitle', { number: unit.unitNumber }),
      message: t('floorplan.deleteUnitConfirmMsg'),
      confirmLabel: t('floorplan.deleteUnitConfirmBtn'),
    });
    if (ok) await run(() => AdminStorage.deleteUnitFromProject(project.id, unit.id), t('floorplan.toastUnitDeleted'));
  };

  const setUnitStatus = (unit: PropertyUnit, status: UnitStatus) => {
    if (status === unit.status) return;
    void run(() => AdminStorage.updateUnitStatus(unit.id, status), `${unit.unitNumber}: ${t(UNIT_STATUS_KEYS[status])}`);
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
      editing ? t('floorplan.toastFloorUpdated') : t('floorplan.toastFloorSaved')
    );
    if (ok) setFloorDialog(null);
  };

  /** Resolves to true when the floor was deleted. */
  const deleteFloor = async (floor: PropertyFloor): Promise<boolean> => {
    const name = isEn && floor.floorNameEn ? floor.floorNameEn : floor.floorNameAr;
    const ok = await confirmDelete({
      title: t('floorplan.deleteFloorConfirmTitle', { name }),
      message: t('floorplan.deleteFloorConfirmMsg', { count: floor.units.length }),
      confirmLabel: t('floorplan.deleteFloorConfirmBtn'),
    });
    if (!ok) return false;
    return run(() => AdminStorage.deleteFloorFromProject(project.id, floor.floorNumber), t('floorplan.toastFloorDeleted'));
  };

  /* ---------------------------------- Dialogs --------------------------------- */

  const dialogs = (
    <>
      {unitDialog && (
        <DialogShell
          title={
            unitDialog.unit
              ? t('floorplan.dialogEditUnitTitle', { number: unitDialog.unit.unitNumber })
              : t('floorplan.dialogAddUnitTitle', {
                  floor: isEn && unitDialog.floor.floorNameEn ? unitDialog.floor.floorNameEn : unitDialog.floor.floorNameAr,
                })
          }
          onClose={() => setUnitDialog(null)}
        >
          <form onSubmit={saveUnit} className="space-y-3.5">
            <Label text={t('floorplan.unitNumberLabel')}>
              <input
                type="text"
                required
                autoFocus
                value={unitForm.unitNumber}
                onChange={(e) => setUnitForm({ ...unitForm, unitNumber: e.target.value })}
                placeholder={t('floorplan.unitNumberPlaceholder')}
                className={INPUT_CLASS}
              />
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <Label text={t('floorplan.unitSectionLabel')}>
                <input
                  type="text"
                  value={unitForm.sectionAr}
                  onChange={(e) => setUnitForm({ ...unitForm, sectionAr: e.target.value })}
                  placeholder={t('floorplan.unitSectionPlaceholder')}
                  className={INPUT_CLASS}
                />
              </Label>
              <Label text={t('floorplan.unitAreaLabel')}>
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
              <Label text={t('floorplan.unitTypeLabel')}>
                <select
                  value={unitForm.type}
                  onChange={(e) => setUnitForm({ ...unitForm, type: e.target.value as PropertyUnit['type'] })}
                  className={`${INPUT_CLASS} cursor-pointer`}
                >
                  {(Object.keys(UNIT_TYPE_KEYS) as PropertyUnit['type'][]).map((typeKey) => (
                    <option key={typeKey} value={typeKey}>
                      {t(UNIT_TYPE_KEYS[typeKey])}
                    </option>
                  ))}
                </select>
              </Label>
              <Label text={t('floorplan.unitStatusLabel')}>
                <select
                  value={unitForm.status}
                  onChange={(e) => setUnitForm({ ...unitForm, status: e.target.value as UnitStatus })}
                  className={`${INPUT_CLASS} cursor-pointer`}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {t(UNIT_STATUS_KEYS[s])}
                    </option>
                  ))}
                </select>
              </Label>
            </div>
            <Label text={t('floorplan.unitPriceLabel')}>
              <input
                type="text"
                value={unitForm.priceLabel}
                onChange={(e) => setUnitForm({ ...unitForm, priceLabel: e.target.value })}
                placeholder={t('floorplan.unitPricePlaceholder')}
                className={INPUT_CLASS}
              />
            </Label>
            <Label text={t('floorplan.unitFeaturesLabel')}>
              <input
                type="text"
                value={unitForm.featuresStr}
                onChange={(e) => setUnitForm({ ...unitForm, featuresStr: e.target.value })}
                placeholder={t('floorplan.unitFeaturesPlaceholder')}
                className={INPUT_CLASS}
              />
            </Label>
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-muted-border/30">
              <button
                type="button"
                onClick={() => setUnitDialog(null)}
                className="brand-btn-secondary px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer"
              >
                {t('floorplan.cancelBtn')}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="brand-btn-primary px-5 py-2 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {unitDialog.unit ? t('floorplan.saveChanges') : t('floorplan.addUnitBtn')}
              </button>
            </div>
          </form>
        </DialogShell>
      )}

      {floorDialog && (
        <DialogShell
          title={floorDialog.floor ? t('floorplan.dialogEditFloorTitle') : t('floorplan.dialogAddFloorTitle')}
          onClose={() => setFloorDialog(null)}
        >
          <form onSubmit={saveFloor} className="space-y-3.5">
            <Label text={t('floorplan.floorNameArLabel')}>
              <input
                type="text"
                required
                autoFocus
                value={floorForm.nameAr}
                onChange={(e) => setFloorForm({ ...floorForm, nameAr: e.target.value })}
                placeholder={t('floorplan.floorNameArPlaceholder')}
                className={INPUT_CLASS}
              />
            </Label>
            <Label text={t('floorplan.floorNameEnLabel')}>
              <input
                type="text"
                dir="ltr"
                value={floorForm.nameEn}
                onChange={(e) => setFloorForm({ ...floorForm, nameEn: e.target.value })}
                placeholder={t('floorplan.floorNameEnPlaceholder')}
                className={INPUT_CLASS}
              />
            </Label>
            <Label text={t('floorplan.floorDescLabel')}>
              <input
                type="text"
                value={floorForm.descriptionAr}
                onChange={(e) => setFloorForm({ ...floorForm, descriptionAr: e.target.value })}
                placeholder={t('floorplan.floorDescPlaceholder')}
                className={INPUT_CLASS}
              />
            </Label>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setFloorDialog(null)}
                className="brand-btn-secondary px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer"
              >
                {t('floorplan.cancelBtn')}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="brand-btn-primary px-4 py-2 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {floorDialog.floor ? t('floorplan.saveFloorBtn') : t('floorplan.addFloorBtn')}
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

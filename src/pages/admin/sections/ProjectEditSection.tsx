import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  FileText,
  ImageUp,
  MapPin,
  Plus,
  RefreshCw,
  Save,
  SearchX,
  XCircle,
  X as CloseIcon,
} from 'lucide-react';
import type { PriceType, Property, PropertyType } from '../../../types/property';
import { AdminStorage } from '../../../services/adminStorage';
import { getErrorMessage } from '../../../services/api';
import { isAcceptedMedia, MAX_UPLOAD_BYTES, uploadMedia } from '../../../services/mediaService';
import { toYoutubeEmbedUrl } from '../../../services/youtube';
import { useAdmin } from '../adminContextDef';
import { useAdminT } from '../../../i18n/admin/useAdminT';
import { AdminHeaderActions } from '../../../components/admin/layout/AdminHeaderActions';
import { EmptyState } from '../../../components/admin/common/EmptyState';
import { NoAccess, SectionError, SectionLoading } from '../../../components/admin/common/SectionState';
import { PRICE_TYPES, PROJECT_TYPE_LABELS_AR, PROPERTY_TYPES } from '../projectLabels';
import { MapLocationPicker } from '../../../components/admin/projects/MapLocationPicker';
import { CitySelect } from '../../../components/admin/projects/CitySelect';
import { findSaudiCityByName } from '../../../data/saudiCities';
import { isHttpsUrl } from '../../../utils/urlValidation';

const INPUT_CLASS =
  'w-full px-3.5 py-2.5 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent';
const LABEL_CLASS = 'block text-[11px] font-bold text-neutral-text/70 mb-1';
const FORM_ID = 'project-edit-form';

interface EditorForm {
  title: string;
  titleEn: string;
  type: PropertyType;
  typeAr: string;
  typeEn: string;
  priceType: PriceType;
  priceTypeEn: string;
  price: string;
  priceLabel: string;
  status: string;
  statusEn: string;
  badge: string;
  badgeEn: string;
  city: string;
  cityEn: string;
  area: string;
  rooms: string;
  bathrooms: string;
  unitsCount: string;
  unitsCountEn: string;
  description: string;
  descriptionEn: string;
  features: string;
  featuresEn: string;
  locationHighlightsAr: string;
  locationHighlightsEn: string;
  lat: string;
  lng: string;
  videoUrl: string;
  model3dUrl: string;
  image: string;
  gallery: string[];
  brochureUrl: string;
}

const trimmedOrUndefined = (value: string) => value.trim() || undefined;

/** One entry per non-empty line, which is how the textareas are authored. */
const splitLines = (value: string) =>
  value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

function toFormState(project: Property): EditorForm {
  return {
    title: project.title ?? '',
    titleEn: project.titleEn ?? '',
    type: project.type,
    typeAr: project.typeAr ?? '',
    typeEn: project.typeEn ?? '',
    priceType: project.priceType,
    priceTypeEn: project.priceTypeEn ?? '',
    price: project.price == null ? '' : String(project.price),
    priceLabel: project.priceLabel ?? '',
    status: project.status ?? '',
    statusEn: project.statusEn ?? '',
    badge: project.badge ?? '',
    badgeEn: project.badgeEn ?? '',
    city: project.city ?? '',
    cityEn: project.cityEn ?? '',
    area: project.area == null ? '' : String(project.area),
    rooms: project.rooms == null ? '' : String(project.rooms),
    bathrooms: project.bathrooms == null ? '' : String(project.bathrooms),
    unitsCount: project.units ?? '',
    unitsCountEn: project.unitsEn ?? '',
    description: project.description ?? '',
    descriptionEn: project.descriptionEn ?? '',
    features: (project.features ?? []).join('\n'),
    featuresEn: (project.featuresEn ?? []).join('\n'),
    locationHighlightsAr: (project.locationHighlightsAr ?? []).join('\n'),
    locationHighlightsEn: (project.locationHighlightsEn ?? []).join('\n'),
    lat: project.lat == null ? '' : String(project.lat),
    lng: project.lng == null ? '' : String(project.lng),
    videoUrl: project.videoUrl ?? '',
    model3dUrl: project.model3dUrl ?? '',
    image: project.image ?? '',
    gallery: [...(project.gallery ?? [])],
    brochureUrl: project.brochureUrl ?? '',
  };
}

/** null = empty, NaN = not a number. */
function parseNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function validateImageFile(file: File): string | null {
  if (!isAcceptedMedia(file) || !file.type.startsWith('image/')) return 'projectEdit.upload.unsupportedImage';
  if (file.size > MAX_UPLOAD_BYTES) return 'projectEdit.upload.imageTooLarge';
  return null;
}

function Card({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl bg-surface border border-muted-border/40 p-5 sm:p-6 shadow-xs space-y-4">
      <div>
        <h3 className="text-sm font-black text-heading">{title}</h3>
        {description && <p className="text-[11px] text-neutral-text/60 mt-0.5">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-1 flex items-center gap-1 text-[10px] font-bold text-red-500">
      <AlertCircle className="w-3 h-3 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={LABEL_CLASS} htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error && <ErrorText>{error}</ErrorText>}
    </div>
  );
}

const ProjectEditForm: React.FC<{ project: Property }> = ({ project }) => {
  const { projects, navigate, showToast, confirm, confirmDelete } = useAdmin();
  const { t } = useAdminT();
  const [baseline, setBaseline] = useState<EditorForm>(() => toFormState(project));
  const [form, setForm] = useState<EditorForm>(baseline);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<'image' | 'gallery' | 'brochure' | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const imageInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const brochureInputRef = useRef<HTMLInputElement>(null);

  const patch = useCallback((changes: Partial<EditorForm>) => {
    setForm((current) => ({ ...current, ...changes }));
    setErrors((current) => {
      if (Object.keys(current).length === 0) return current;
      const next = { ...current };
      Object.keys(changes).forEach((key) => delete next[key]);
      return next;
    });
  }, []);

  // Keeps the map in view of the chosen city without moving an existing pin.
  const cityFocus = useMemo(() => findSaudiCityByName(form.city)?.center ?? null, [form.city]);

  const handleCityChange = (city: { nameAr: string; nameEn: string; center?: { lat: number; lng: number } }) => {
    const isMapEmpty = parseNumber(form.lat) === null && parseNumber(form.lng) === null;
    patch({
      city: city.nameAr,
      // A free-text city has no English match, so keep what the admin already typed.
      ...(city.nameEn ? { cityEn: city.nameEn } : {}),
      // Seed coordinates once; a pin already dropped on the map is never overwritten.
      ...(city.center && isMapEmpty ? { lat: String(city.center.lat), lng: String(city.center.lng) } : {}),
    });
  };

  // Removals only change the form until it is saved, but they still ask first.
  const removeGalleryImage = async (index: number) => {
    const url = form.gallery[index];
    const ok = await confirmDelete({
      title: t('projectEdit.gallery.removeConfirmTitle'),
      message: t('projectEdit.gallery.removeConfirmMessage'),
      confirmLabel: t('projectEdit.gallery.removeConfirmLabel'),
    });
    if (!ok) return;
    // By URL, not index: an upload may have appended images while the dialog was open.
    setForm((current) => {
      const at = current.gallery.indexOf(url);
      return at === -1 ? current : { ...current, gallery: current.gallery.filter((_, i) => i !== at) };
    });
  };

  const removeBrochure = async () => {
    const ok = await confirmDelete({
      title: t('projectEdit.brochure.removeConfirmTitle'),
      message: t('projectEdit.brochure.removeConfirmMessage'),
      confirmLabel: t('projectEdit.brochure.removeConfirmLabel'),
    });
    if (ok) patch({ brochureUrl: '' });
  };

  const embedUrl = toYoutubeEmbedUrl(form.videoUrl);
  const busy = saving || uploading !== null;
  const isDirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(baseline), [form, baseline]);

  // Refresh / tab close with unsaved edits.
  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);

  const validate = (): Record<string, string> => {
    const found: Record<string, string> = {};
    if (!form.title.trim()) found.title = t('projectEdit.validation.titleRequired');
    if (!form.city.trim()) found.city = t('projectEdit.validation.cityRequired');
    if (!form.image.trim()) found.image = t('projectEdit.validation.imageRequired');

    const area = parseNumber(form.area);
    if (area === null || Number.isNaN(area)) found.area = t('projectEdit.validation.areaRequired');
    else if (area < 0) found.area = t('projectEdit.validation.areaNegative');

    const price = parseNumber(form.price);
    if (Number.isNaN(price)) found.price = t('projectEdit.validation.priceNumber');
    else if (price !== null && price < 0) found.price = t('projectEdit.validation.priceNegative');

    // The server stores rooms/bathrooms as integers, so reject a fraction here.
    const rooms = parseNumber(form.rooms);
    if (Number.isNaN(rooms)) found.rooms = t('projectEdit.validation.roomsNumber');
    else if (rooms !== null && !Number.isInteger(rooms)) found.rooms = t('projectEdit.validation.roomsInteger');

    const bathrooms = parseNumber(form.bathrooms);
    if (Number.isNaN(bathrooms)) found.bathrooms = t('projectEdit.validation.bathroomsNumber');
    else if (bathrooms !== null && !Number.isInteger(bathrooms)) found.bathrooms = t('projectEdit.validation.bathroomsInteger');

    if (form.model3dUrl.trim() && !isHttpsUrl(form.model3dUrl)) {
      found.model3dUrl = t('projectEdit.validation.model3dUrl');
    }

    const lat = parseNumber(form.lat);
    const lng = parseNumber(form.lng);
    if (Number.isNaN(lat)) found.lat = t('projectEdit.validation.latNumber');
    else if (lat !== null && (lat < -90 || lat > 90)) found.lat = t('projectEdit.validation.latRange');
    if (Number.isNaN(lng)) found.lng = t('projectEdit.validation.lngNumber');
    else if (lng !== null && (lng < -180 || lng > 180)) found.lng = t('projectEdit.validation.lngRange');
    if ((lat === null) !== (lng === null)) found.lng = t('projectEdit.validation.latLngPair');

    if (embedUrl === undefined) found.videoUrl = t('projectEdit.validation.videoUrl');
    return found;
  };

  const upload = async (kind: 'image' | 'brochure', file: File) => {
    if (kind === 'image') {
      const problem = validateImageFile(file);
      if (problem) return showToast(t(problem as 'projectEdit.upload.unsupportedImage' | 'projectEdit.upload.imageTooLarge'));
    } else if (file.type !== 'application/pdf') {
      return showToast(t('projectEdit.upload.brochurePdfOnly'));
    } else if (file.size > MAX_UPLOAD_BYTES) {
      return showToast(t('projectEdit.upload.fileTooLarge'));
    }

    setUploading(kind);
    try {
      const uploaded = await uploadMedia(file);
      patch(kind === 'image' ? { image: uploaded.url } : { brochureUrl: uploaded.url });
      showToast(kind === 'image' ? t('projectEdit.upload.imageSuccess') : t('projectEdit.upload.brochureSuccess'));
    } catch (error) {
      showToast(getErrorMessage(error, t('projectEdit.upload.error')));
    } finally {
      setUploading(null);
    }
  };

  const uploadGallery = async (files: FileList) => {
    const selected = Array.from(files);
    if (selected.length === 0) return;
    setUploading('gallery');
    const urls: string[] = [];
    try {
      // Sequential on purpose: parallel 50 MB uploads starve the connection pool.
      for (const file of selected) {
        const problem = validateImageFile(file);
        if (problem) {
          showToast(t(problem as 'projectEdit.upload.unsupportedImage' | 'projectEdit.upload.imageTooLarge'));
          continue;
        }
        urls.push((await uploadMedia(file)).url);
      }
      if (urls.length > 0) {
        showToast(urls.length === selected.length ? t('projectEdit.upload.gallerySuccess') : t('projectEdit.upload.galleryPartial', { uploaded: urls.length, total: selected.length }));
      }
    } catch (error) {
      showToast(getErrorMessage(error, t('projectEdit.upload.galleryError')));
    } finally {
      // Append to the gallery as it is *now*: removals made during the upload stay removed.
      if (urls.length > 0) setForm((current) => ({ ...current, gallery: [...current.gallery, ...urls] }));
      setUploading(null);
    }
  };

  const moveGalleryItem = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= form.gallery.length) return;
    const gallery = [...form.gallery];
    [gallery[index], gallery[target]] = [gallery[target], gallery[index]];
    patch({ gallery });
  };

  const leave = async () => {
    if (busy) return;
    if (isDirty) {
      const ok = await confirm({
        title: t('projectEdit.dirty.confirmTitle'),
        message: t('projectEdit.dirty.confirmMessage'),
        confirmLabel: t('projectEdit.dirty.confirmLabel'),
        danger: true,
      });
      if (!ok) return;
    }
    navigate({ section: 'project', projectId: project.id });
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;

    const found = validate();
    if (Object.keys(found).length > 0) {
      setErrors(found);
      showToast(t('projectEdit.save.validationError'));
      document.getElementById(`pe-${Object.keys(found)[0]}`)?.focus();
      return;
    }

    const lat = parseNumber(form.lat);
    const lng = parseNumber(form.lng);
    const merged: Property = {
      ...project,
      title: form.title.trim(),
      titleEn: trimmedOrUndefined(form.titleEn),
      type: form.type,
      typeAr: form.typeAr.trim() || PROJECT_TYPE_LABELS_AR[form.type],
      typeEn: trimmedOrUndefined(form.typeEn),
      priceType: form.priceType,
      priceTypeEn: trimmedOrUndefined(form.priceTypeEn),
      price: parseNumber(form.price) ?? undefined,
      priceLabel: trimmedOrUndefined(form.priceLabel),
      status: trimmedOrUndefined(form.status),
      statusEn: trimmedOrUndefined(form.statusEn),
      badge: trimmedOrUndefined(form.badge),
      badgeEn: trimmedOrUndefined(form.badgeEn),
      city: form.city.trim(),
      cityEn: trimmedOrUndefined(form.cityEn),
      area: parseNumber(form.area) as number,
      rooms: parseNumber(form.rooms) ?? undefined,
      bathrooms: parseNumber(form.bathrooms) ?? undefined,
      units: trimmedOrUndefined(form.unitsCount),
      unitsEn: trimmedOrUndefined(form.unitsCountEn),
      description: trimmedOrUndefined(form.description),
      descriptionEn: trimmedOrUndefined(form.descriptionEn),
      features: splitLines(form.features),
      featuresEn: splitLines(form.featuresEn),
      locationHighlightsAr: splitLines(form.locationHighlightsAr),
      locationHighlightsEn: splitLines(form.locationHighlightsEn),
      lat: lat ?? undefined,
      lng: lng ?? undefined,
      videoUrl: embedUrl ?? undefined,
      model3dUrl: trimmedOrUndefined(form.model3dUrl),
      image: form.image,
      gallery: [...form.gallery],
      brochureUrl: form.brochureUrl || undefined,
    };

    setSaving(true);
    try {
      await AdminStorage.updateProject(project.id, merged);
      setBaseline(form); // clears the dirty flag before leaving
      showToast(t('projectEdit.save.success'));
      await projects.reload();
      navigate({ section: 'project', projectId: project.id });
    } catch (error) {
      showToast(getErrorMessage(error, t('projectEdit.save.error')));
    } finally {
      setSaving(false);
    }
  };

  const lat = parseNumber(form.lat);
  const lng = parseNumber(form.lng);
  const hasCoords = lat !== null && lng !== null && !Number.isNaN(lat) && !Number.isNaN(lng);

  return (
    <>
      <AdminHeaderActions>
        <button
          type="button"
          onClick={() => void leave()}
          disabled={saving}
          className="brand-btn-secondary px-3 sm:px-4 py-2.5 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
        >
          {t('common.action.cancel')}
        </button>
        <button
          type="submit"
          form={FORM_ID}
          disabled={busy || !isDirty}
          className="brand-btn-primary px-3 sm:px-5 py-2.5 rounded-xl text-xs font-black cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
          title={!isDirty ? t('projectEdit.save.noChanges') : undefined}
        >
          {busy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span className="hidden sm:inline">{saving ? t('projectEdit.save.saving') : uploading ? t('projectEdit.save.uploading') : t('projectEdit.save.label')}</span>
        </button>
      </AdminHeaderActions>

      <form id={FORM_ID} onSubmit={handleSave} noValidate className="space-y-5">
        <button
          type="button"
          onClick={() => void leave()}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-text/60 hover:text-accent cursor-pointer"
        >
          <ArrowRight className="w-3.5 h-3.5 rtl:rotate-0 ltr:rotate-180" />
          {t('projectEdit.backToProject')}
        </button>

        {isDirty && (
          <div className="px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-600 text-[11px] font-bold">
            {t('projectEdit.dirtyNotice')}
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-5 items-start">
          {/* Content column */}
          <div className="xl:col-span-3 space-y-5">
            <Card title={t('projectEdit.card.basic')}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label={t('projectEdit.field.title')} htmlFor="pe-title" error={errors.title}>
                  <input id="pe-title" type="text" value={form.title} onChange={(e) => patch({ title: e.target.value })} className={INPUT_CLASS} />
                </Field>
                <Field label={t('projectEdit.field.titleEn')} htmlFor="pe-titleEn">
                  <input id="pe-titleEn" type="text" dir="ltr" value={form.titleEn} onChange={(e) => patch({ titleEn: e.target.value })} className={INPUT_CLASS} />
                </Field>
                <Field label={t('projectEdit.field.type')} htmlFor="pe-type">
                  <select
                    id="pe-type"
                    value={form.type}
                    onChange={(e) => {
                      const type = e.target.value as PropertyType;
                      patch({ type, typeAr: PROJECT_TYPE_LABELS_AR[type] });
                    }}
                    className={`${INPUT_CLASS} cursor-pointer`}
                  >
                    {PROPERTY_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {PROJECT_TYPE_LABELS_AR[type]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t('projectEdit.field.typeAr')} htmlFor="pe-typeAr">
                  <input id="pe-typeAr" type="text" value={form.typeAr} onChange={(e) => patch({ typeAr: e.target.value })} className={INPUT_CLASS} />
                </Field>
                <Field label={t('projectEdit.field.typeEn')} htmlFor="pe-typeEn">
                  <input id="pe-typeEn" type="text" dir="ltr" value={form.typeEn} onChange={(e) => patch({ typeEn: e.target.value })} className={INPUT_CLASS} />
                </Field>
                <Field label={t('projectEdit.field.priceType')} htmlFor="pe-priceType">
                  <select id="pe-priceType" value={form.priceType} onChange={(e) => patch({ priceType: e.target.value as PriceType })} className={`${INPUT_CLASS} cursor-pointer`}>
                    {PRICE_TYPES.map((priceType) => (
                      <option key={priceType} value={priceType}>
                        {priceType}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t('projectEdit.field.priceTypeEn')} htmlFor="pe-priceTypeEn">
                  <input id="pe-priceTypeEn" type="text" dir="ltr" value={form.priceTypeEn} onChange={(e) => patch({ priceTypeEn: e.target.value })} className={INPUT_CLASS} />
                </Field>
                <Field label={t('projectEdit.field.price')} htmlFor="pe-price" error={errors.price}>
                  <input id="pe-price" type="number" step="any" min={0} dir="ltr" value={form.price} onChange={(e) => patch({ price: e.target.value })} className={INPUT_CLASS} />
                </Field>
                <Field label={t('projectEdit.field.priceLabel')} htmlFor="pe-priceLabel">
                  <input id="pe-priceLabel" type="text" placeholder={t('projectEdit.placeholder.priceStart')} value={form.priceLabel} onChange={(e) => patch({ priceLabel: e.target.value })} className={INPUT_CLASS} />
                </Field>
                <Field label={t('projectEdit.field.area')} htmlFor="pe-area" error={errors.area}>
                  <input id="pe-area" type="number" min={0} value={form.area} onChange={(e) => patch({ area: e.target.value })} className={INPUT_CLASS} />
                </Field>
                <Field label={t('projectEdit.field.rooms')} htmlFor="pe-rooms" error={errors.rooms}>
                  <input id="pe-rooms" type="number" step="1" min={0} dir="ltr" value={form.rooms} onChange={(e) => patch({ rooms: e.target.value })} className={INPUT_CLASS} />
                </Field>
                <Field label={t('projectEdit.field.bathrooms')} htmlFor="pe-bathrooms" error={errors.bathrooms}>
                  <input id="pe-bathrooms" type="number" step="1" min={0} dir="ltr" value={form.bathrooms} onChange={(e) => patch({ bathrooms: e.target.value })} className={INPUT_CLASS} />
                </Field>
                <Field label={t('projectEdit.field.unitsCount')} htmlFor="pe-unitsCount">
                  <input id="pe-unitsCount" type="text" placeholder={t('projectEdit.unitsCountPlaceholder')} value={form.unitsCount} onChange={(e) => patch({ unitsCount: e.target.value })} className={INPUT_CLASS} />
                </Field>
                <Field label={t('projectEdit.field.unitsCountEn')} htmlFor="pe-unitsCountEn">
                  <input id="pe-unitsCountEn" type="text" dir="ltr" placeholder="24 Units" value={form.unitsCountEn} onChange={(e) => patch({ unitsCountEn: e.target.value })} className={INPUT_CLASS} />
                </Field>
                <div className="sm:col-span-2">
                  <Field label={t('projectEdit.field.city')} htmlFor="pe-city" error={errors.city}>
                    <CitySelect
                      id="pe-city"
                      valueAr={form.city}
                      valueEn={form.cityEn}
                      onChange={handleCityChange}
                      disabled={busy}
                    />
                  </Field>
                </div>
                <Field label={t('projectEdit.field.cityEn')} htmlFor="pe-cityEn">
                  <input id="pe-cityEn" type="text" dir="ltr" value={form.cityEn} onChange={(e) => patch({ cityEn: e.target.value })} className={INPUT_CLASS} />
                </Field>
                <Field label={t('projectEdit.field.status')} htmlFor="pe-status">
                  <input id="pe-status" type="text" placeholder={t('projectEdit.statusPlaceholder')} value={form.status} onChange={(e) => patch({ status: e.target.value })} className={INPUT_CLASS} />
                </Field>
                <Field label={t('projectEdit.field.statusEn')} htmlFor="pe-statusEn">
                  <input id="pe-statusEn" type="text" dir="ltr" value={form.statusEn} onChange={(e) => patch({ statusEn: e.target.value })} className={INPUT_CLASS} />
                </Field>
                <Field label={t('projectEdit.field.badge')} htmlFor="pe-badge">
                  <input id="pe-badge" type="text" placeholder={t('projectEdit.badgePlaceholder')} value={form.badge} onChange={(e) => patch({ badge: e.target.value })} className={INPUT_CLASS} />
                </Field>
                <Field label={t('projectEdit.field.badgeEn')} htmlFor="pe-badgeEn">
                  <input id="pe-badgeEn" type="text" dir="ltr" value={form.badgeEn} onChange={(e) => patch({ badgeEn: e.target.value })} className={INPUT_CLASS} />
                </Field>
              </div>
            </Card>

            <Card
              title={t('projectEdit.card.map')}
              description={t('projectEdit.map.hint')}
            >
              <MapLocationPicker
                lat={Number.isNaN(lat) ? null : lat}
                lng={Number.isNaN(lng) ? null : lng}
                disabled={busy}
                focusCenter={cityFocus}
                onChange={(coords) => patch({ lat: String(coords.lat), lng: String(coords.lng) })}
                onClear={() => patch({ lat: '', lng: '' })}
              />
              {(errors.lat || errors.lng) && (
                <p className="text-[11px] text-red-500 font-bold mt-1">
                  {errors.lat || errors.lng}
                </p>
              )}
            </Card>

            <Card title={t('projectEdit.card.description')}>
              <Field label={t('projectEdit.field.descriptionAr')} htmlFor="pe-description">
                <textarea id="pe-description" rows={5} value={form.description} onChange={(e) => patch({ description: e.target.value })} className={`${INPUT_CLASS} resize-y leading-relaxed`} />
              </Field>
              <Field label={t('projectEdit.field.descriptionEn')} htmlFor="pe-descriptionEn">
                <textarea id="pe-descriptionEn" rows={5} dir="ltr" value={form.descriptionEn} onChange={(e) => patch({ descriptionEn: e.target.value })} className={`${INPUT_CLASS} resize-y leading-relaxed`} />
              </Field>
            </Card>

            <Card title={t('projectEdit.card.features')} description={t('projectEdit.listHint')}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label={t('projectEdit.label.ar')} htmlFor="pe-features">
                  <textarea id="pe-features" rows={7} value={form.features} onChange={(e) => patch({ features: e.target.value })} placeholder={t('projectEdit.featuresPlaceholder')} className={`${INPUT_CLASS} resize-y leading-loose`} />
                </Field>
                <Field label={t('projectEdit.label.en')} htmlFor="pe-featuresEn">
                  <textarea id="pe-featuresEn" rows={7} dir="ltr" value={form.featuresEn} onChange={(e) => patch({ featuresEn: e.target.value })} placeholder={'Prime location\nPrivate parking'} className={`${INPUT_CLASS} resize-y leading-loose`} />
                </Field>
              </div>
            </Card>

            <Card title={t('projectEdit.card.locationHighlights')} description={t('projectEdit.listHint')}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label={t('projectEdit.label.ar')} htmlFor="pe-locationHighlightsAr">
                  <textarea id="pe-locationHighlightsAr" rows={6} value={form.locationHighlightsAr} onChange={(e) => patch({ locationHighlightsAr: e.target.value })} placeholder={t('projectEdit.locationHighlightsPlaceholder')} className={`${INPUT_CLASS} resize-y leading-loose`} />
                </Field>
                <Field label={t('projectEdit.label.en')} htmlFor="pe-locationHighlightsEn">
                  <textarea id="pe-locationHighlightsEn" rows={6} dir="ltr" value={form.locationHighlightsEn} onChange={(e) => patch({ locationHighlightsEn: e.target.value })} placeholder={'Close to King Fahd Road\nBehind Riyadh Airport'} className={`${INPUT_CLASS} resize-y leading-loose`} />
                </Field>
              </div>
            </Card>
          </div>

          {/* Media column */}
          <div className="xl:col-span-2 space-y-5">
            <Card title={t('projectEdit.card.images')}>
              <div>
                <span className={LABEL_CLASS}>{t('projectEdit.field.mainImage')}</span>
                {form.image ? (
                  <div className="relative rounded-2xl overflow-hidden border border-muted-border/50">
                    <img src={form.image} alt={t('projectEdit.field.mainImage')} className="w-full aspect-[16/9] object-cover" />
                    <button
                      type="button"
                      onClick={() => imageInputRef.current?.click()}
                      disabled={busy}
                      className="absolute top-2 end-2 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-black/70 text-white text-[10px] font-bold hover:bg-black/85 cursor-pointer disabled:opacity-60"
                    >
                      {uploading === 'image' ? <RefreshCw className="w-3 h-3 animate-spin" /> : <ImageUp className="w-3 h-3" />}
                      {uploading === 'image' ? t('projectEdit.uploading') : t('projectEdit.action.replace')}
                    </button>
                  </div>
                ) : (
                  <button
                    id="pe-image"
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={busy}
                    className="w-full aspect-[16/9] rounded-2xl border border-dashed border-muted-border/50 hover:border-accent/60 text-neutral-text/60 hover:text-accent flex flex-col items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {uploading === 'image' ? <RefreshCw className="w-5 h-5 animate-spin" /> : <ImageUp className="w-5 h-5" />}
                    <span className="text-[10px] font-bold">{uploading === 'image' ? t('projectEdit.uploading') : t('projectEdit.image.upload')}</span>
                  </button>
                )}
                {errors.image && <ErrorText>{errors.image}</ErrorText>}
              </div>

              <div>
                <span className={LABEL_CLASS}>{t('projectEdit.gallery.label', { count: form.gallery.length })}</span>
                {form.gallery.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    {form.gallery.map((src, index) => (
                      <div key={`${src}-${index}`} className="relative group rounded-xl overflow-hidden border border-muted-border/40 aspect-square">
                        <img src={src} alt={t('projectEdit.gallery.imageAlt', { index: index + 1 })} className="w-full h-full object-cover" />
                        <div className="absolute inset-x-1 bottom-1 flex items-center justify-between gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition">
                          <div className="flex gap-1">
                            <button type="button" onClick={() => moveGalleryItem(index, -1)} disabled={index === 0} className="px-1.5 py-0.5 rounded bg-black/70 text-white text-[10px] font-black disabled:opacity-30 cursor-pointer" aria-label={t('projectEdit.gallery.moveEarlier')}>
                              →
                            </button>
                            <button type="button" onClick={() => moveGalleryItem(index, 1)} disabled={index === form.gallery.length - 1} className="px-1.5 py-0.5 rounded bg-black/70 text-white text-[10px] font-black disabled:opacity-30 cursor-pointer" aria-label={t('projectEdit.gallery.moveLater')}>
                              ←
                            </button>
                          </div>
                          {form.image !== src && (
                            <button type="button" onClick={() => patch({ image: src })} className="px-1.5 py-0.5 rounded bg-black/70 text-white text-[9px] font-bold cursor-pointer" title={t('projectEdit.gallery.makeMain')}>
                              {t('projectEdit.gallery.main')}
                            </button>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => void removeGalleryImage(index)}
                          title={t('projectEdit.action.removeImage')}
                          aria-label={t('projectEdit.action.removeImage')}
                          className="absolute top-1 start-1 p-1 rounded-lg bg-black/70 text-white hover:bg-red-500 cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  disabled={busy}
                  className="w-full py-3 rounded-2xl border border-dashed border-muted-border/50 hover:border-accent/60 text-neutral-text/60 hover:text-accent flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {uploading === 'gallery' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  <span className="text-[10px] font-bold">{uploading === 'gallery' ? t('projectEdit.gallery.uploading') : t('projectEdit.gallery.add')}</span>
                </button>
              </div>
            </Card>

            <Card title={t('projectEdit.card.map')} description={t('projectEdit.map.noCoordsDescription')}>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t('projectEdit.field.lat')} htmlFor="pe-lat" error={errors.lat}>
                  <input id="pe-lat" type="number" step="any" dir="ltr" placeholder="24.7136" value={form.lat} onChange={(e) => patch({ lat: e.target.value })} className={INPUT_CLASS} />
                </Field>
                <Field label={t('projectEdit.field.lng')} htmlFor="pe-lng" error={errors.lng}>
                  <input id="pe-lng" type="number" step="any" dir="ltr" placeholder="46.6753" value={form.lng} onChange={(e) => patch({ lng: e.target.value })} className={INPUT_CLASS} />
                </Field>
              </div>
              {hasCoords ? (
                <>
                  <div className="aspect-[4/3] w-full overflow-hidden rounded-2xl border border-muted-border/50">
                    <iframe
                      title={t('projectEdit.map.preview')}
                      src={`https://maps.google.com/maps?q=${lat},${lng}&z=15&output=embed`}
                      className="w-full h-full"
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                  </div>
                  <a href={`https://www.google.com/maps?q=${lat},${lng}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[10px] font-bold text-accent hover:underline">
                    <MapPin className="w-3 h-3" />
                    {t('projectEdit.map.openGoogle')}
                  </a>
                </>
              ) : (
                <p className="text-[11px] text-neutral-text/50">
                  {t('projectEdit.map.copyCoordsHint')}
                </p>
              )}
            </Card>

            <Card title={t('projectEdit.card.video')} description={t('projectEdit.video.description')}>
              <Field label={t('projectEdit.field.videoUrl')} htmlFor="pe-videoUrl" error={errors.videoUrl}>
                <input id="pe-videoUrl" type="text" dir="ltr" placeholder="https://youtu.be/XXXXXXXXXXX" value={form.videoUrl} onChange={(e) => patch({ videoUrl: e.target.value })} className={INPUT_CLASS} />
              </Field>
              {embedUrl && (
                <div className="aspect-video w-full overflow-hidden rounded-2xl border border-muted-border/50 bg-neutral-950">
                  <iframe src={embedUrl} title={t('projectEdit.videoPreview')} allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="w-full h-full" />
                </div>
              )}
            </Card>

            <Card title={t('projectEdit.card.brochureModel')}>
              <div>
                <span className={LABEL_CLASS}>{t('projectEdit.brochure.label')}</span>
                {form.brochureUrl ? (
                  <div className="flex items-center gap-2 p-3 rounded-xl border border-muted-border/50 bg-canvas">
                    <FileText className="w-5 h-5 text-accent shrink-0" />
                    <a href={form.brochureUrl} target="_blank" rel="noreferrer" className="text-[11px] font-bold text-heading hover:text-accent truncate min-w-0">
                      {t('projectEdit.brochure.view')}
                    </a>
                    <button type="button" onClick={() => brochureInputRef.current?.click()} disabled={busy} className="ms-auto text-[10px] font-bold text-accent hover:underline cursor-pointer">
                        {busy ? t('projectEdit.uploading') : t('projectEdit.action.replace')}
                    </button>
                    <button type="button" onClick={() => void removeBrochure()} className="p-1 rounded-lg text-neutral-text/60 hover:text-red-500 cursor-pointer" aria-label={t('projectEdit.action.removeBrochure')} title={t('projectEdit.action.removeBrochure')}>
                      <CloseIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => brochureInputRef.current?.click()}
                    disabled={busy}
                    className="w-full py-3 rounded-2xl border border-dashed border-muted-border/50 hover:border-accent/60 text-neutral-text/60 hover:text-accent flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {uploading === 'brochure' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                    <span className="text-[10px] font-bold">{uploading === 'brochure' ? t('projectEdit.uploading') : t('projectEdit.brochure.upload')}</span>
                  </button>
                )}
              </div>
              <Field label={t('projectEdit.field.model3dUrl')} htmlFor="pe-model3dUrl" error={errors.model3dUrl}>
                <input
                  id="pe-model3dUrl"
                  type="url"
                  dir="ltr"
                  inputMode="url"
                  placeholder="https://viewer.example.com/model/123"
                  value={form.model3dUrl}
                  onChange={(e) => patch({ model3dUrl: e.target.value })}
                  className={INPUT_CLASS}
                />
              </Field>
              <p className="text-[10px] text-neutral-text/50">
                {t('projectEdit.model3d.hint')}
              </p>
            </Card>
          </div>
        </div>

        <input
          ref={imageInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload('image', file);
            e.target.value = '';
          }}
        />
        <input
          ref={galleryInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) void uploadGallery(e.target.files);
            e.target.value = '';
          }}
        />
        <input
          ref={brochureInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload('brochure', file);
            e.target.value = '';
          }}
        />
      </form>
    </>
  );
};

export const ProjectEditSection: React.FC = () => {
  const { projects, location, can, navigate } = useAdmin();
  const { t } = useAdminT();
  const project = projects.data.find((p) => p.id === location.projectId);

  if (!can('manageProjects')) return <NoAccess />;
  if (projects.error) return <SectionError message={projects.error} onRetry={() => void projects.reload()} />;
  if (!project && projects.loading) return <SectionLoading variant="form" label={t('projectEdit.loading')} />;
  if (!project) {
    return (
      <EmptyState
        icon={SearchX}
        title={t('projectEdit.notFoundTitle')}
        description={t('projectEdit.notFoundDescription')}
        action={
          <button onClick={() => navigate({ section: 'projects' })} className="brand-btn-secondary font-bold text-xs px-4 py-2 rounded-xl cursor-pointer">
            {t('projectEdit.backToProjects')}
          </button>
        }
      />
    );
  }

  // Keyed by id so switching projects resets the form state.
  return <ProjectEditForm key={project.id} project={project} />;
};

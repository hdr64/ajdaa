import { api, resolveMediaUrl } from './api';
import type { Property, PropertyFloor, PropertyType, PropertyUnit, UnitStatus, PublishStatus } from '../types/property';

const PROPERTY_TYPES: readonly PropertyType[] = ['logistics', 'commercial', 'office', 'residential', 'hotel'];
const PRICE_TYPES = ['بيع', 'إيجار', 'استثمار'] as const;
const UNIT_STATUSES: readonly UnitStatus[] = ['available', 'reserved', 'rented', 'sold'];
const UNIT_TYPES = ['showroom', 'office', 'apartment', 'warehouse', 'outdoor'] as const;

export type UnitType = (typeof UNIT_TYPES)[number];

/* -------------------------------------------------------------------------- */
/*                              Wire format (DTO)                             */
/* -------------------------------------------------------------------------- */

interface UnitDto {
  id: string;
  floorId: number;
  unitNumber: string;
  floorNumber: number;
  floorNameAr: string;
  floorNameEn: string | null;
  sectionAr: string | null;
  type: string;
  typeAr: string;
  typeEn: string | null;
  area: number;
  priceLabel: string | null;
  status: string;
  statusAr: string;
  statusEn: string | null;
  features: string[] | null;
  featuresEn: string[] | null;
}

interface FloorDto {
  id: number;
  projectId: number;
  floorNumber: number;
  floorNameAr: string;
  floorNameEn: string | null;
  descriptionAr: string | null;
  descriptionEn: string | null;
  totalArea: number | null;
  units: UnitDto[];
}

interface ProjectDto {
  id: number;
  type: string;
  typeAr: string;
  typeEn: string | null;
  title: string;
  titleEn: string | null;
  price: number | null;
  priceLabel: string | null;
  priceType: string;
  priceTypeEn: string | null;
  status: string | null;
  statusEn: string | null;
  publishStatus?: string;
  publishedAt?: string | null;
  area: number;
  rooms: number | null;
  bathrooms: number | null;
  unitsCount: string | null;
  unitsCountEn: string | null;
  city: string;
  cityEn: string | null;
  image: string;
  gallery: string[] | null;
  description: string | null;
  descriptionEn: string | null;
  badge: string | null;
  badgeEn: string | null;
  features: string[] | null;
  featuresEn: string[] | null;
  videoUrl: string | null;
  virtualTour3dAvailable: boolean;
  locationHighlightsAr: string[] | null;
  locationHighlightsEn: string[] | null;
  lat: number | null;
  lng: number | null;
  brochureUrl: string | null;
  floors: FloorDto[];
}

export type ProjectFilters = {
  city?: string;
  type?: string;
  priceType?: string;
  status?: string;
};

export interface ProjectRequestOptions {
  scope?: 'admin';
}

/** Body accepted by POST/PUT /api/projects. Floors are managed by their own routes. */
export type ProjectPayload = Omit<
  ProjectDto,
  'id' | 'floors' | 'unitsCount' | 'unitsCountEn'
> & {
  unitsCount?: string | null;
  unitsCountEn?: string | null;
  publishStatus?: string;
};

/* -------------------------------------------------------------------------- */
/*                          DTO -> domain mappers                             */
/* -------------------------------------------------------------------------- */

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function optional(value: string | null | undefined): string | undefined {
  return value ?? undefined;
}

function toUnitStatus(value: unknown): UnitStatus {
  return oneOf(value, UNIT_STATUSES, 'available');
}

export function toPropertyUnit(dto: UnitDto): PropertyUnit {
  return {
    id: dto.id,
    unitNumber: dto.unitNumber,
    floorNumber: dto.floorNumber,
    floorNameAr: dto.floorNameAr,
    floorNameEn: optional(dto.floorNameEn),
    sectionAr: optional(dto.sectionAr),
    type: oneOf(dto.type, UNIT_TYPES, 'office'),
    typeAr: dto.typeAr,
    typeEn: optional(dto.typeEn),
    area: dto.area,
    priceLabel: optional(dto.priceLabel),
    status: toUnitStatus(dto.status),
    statusAr: dto.statusAr,
    statusEn: optional(dto.statusEn),
    features: dto.features ?? undefined,
    featuresEn: dto.featuresEn ?? undefined,
  };
}

export function toPropertyFloor(dto: FloorDto): PropertyFloor {
  return {
    id: dto.id,
    floorNumber: dto.floorNumber,
    floorNameAr: dto.floorNameAr,
    floorNameEn: dto.floorNameEn ?? `Floor ${dto.floorNumber}`,
    descriptionAr: optional(dto.descriptionAr),
    descriptionEn: optional(dto.descriptionEn),
    totalArea: dto.totalArea ?? undefined,
    units: dto.units.map(toPropertyUnit),
  };
}

export function toProperty(dto: ProjectDto): Property {
  return {
    id: dto.id,
    type: oneOf(dto.type, PROPERTY_TYPES, 'commercial'),
    typeAr: dto.typeAr,
    typeEn: optional(dto.typeEn),
    title: dto.title,
    titleEn: optional(dto.titleEn),
    price: dto.price ?? undefined,
    priceLabel: optional(dto.priceLabel),
    priceType: oneOf(dto.priceType, PRICE_TYPES, 'استثمار'),
    priceTypeEn: optional(dto.priceTypeEn),
    status: optional(dto.status),
    statusEn: optional(dto.statusEn),
    publishStatus: (dto.publishStatus as PublishStatus) ?? undefined,
    publishedAt: optional(dto.publishedAt),
    area: dto.area,
    rooms: dto.rooms ?? undefined,
    bathrooms: dto.bathrooms ?? undefined,
    units: optional(dto.unitsCount),
    unitsEn: optional(dto.unitsCountEn),
    city: dto.city,
    cityEn: optional(dto.cityEn),
    image: resolveMediaUrl(dto.image),
    gallery: dto.gallery?.map(resolveMediaUrl),
    description: optional(dto.description),
    descriptionEn: optional(dto.descriptionEn),
    badge: optional(dto.badge),
    badgeEn: optional(dto.badgeEn),
    features: dto.features ?? undefined,
    featuresEn: dto.featuresEn ?? undefined,
    videoUrl: optional(dto.videoUrl),
    virtualTour3dAvailable: dto.virtualTour3dAvailable,
    locationHighlightsAr: dto.locationHighlightsAr ?? undefined,
    locationHighlightsEn: dto.locationHighlightsEn ?? undefined,
    floors: dto.floors.map(toPropertyFloor),
    lat: dto.lat ?? undefined,
    lng: dto.lng ?? undefined,
    brochureUrl: dto.brochureUrl ? resolveMediaUrl(dto.brochureUrl) : undefined,
  };
}

/* -------------------------------------------------------------------------- */
/*                       Domain -> wire (mutations)                           */
/* -------------------------------------------------------------------------- */

export function toProjectPayload(project: Property): ProjectPayload {
  const payload: ProjectPayload = {
    type: project.type,
    typeAr: project.typeAr,
    typeEn: project.typeEn ?? null,
    title: project.title,
    titleEn: project.titleEn ?? null,
    price: project.price ?? null,
    priceLabel: project.priceLabel ?? null,
    priceType: project.priceType,
    priceTypeEn: project.priceTypeEn ?? null,
    status: project.status ?? null,
    statusEn: project.statusEn ?? null,
    area: project.area,
    rooms: project.rooms ?? null,
    bathrooms: project.bathrooms ?? null,
    unitsCount: project.units ?? null,
    unitsCountEn: project.unitsEn ?? null,
    city: project.city,
    cityEn: project.cityEn ?? null,
    image: project.image,
    gallery: project.gallery ?? [],
    description: project.description ?? null,
    descriptionEn: project.descriptionEn ?? null,
    badge: project.badge ?? null,
    badgeEn: project.badgeEn ?? null,
    features: project.features ?? [],
    featuresEn: project.featuresEn ?? [],
    videoUrl: project.videoUrl ?? null,
    virtualTour3dAvailable: project.virtualTour3dAvailable ?? false,
    locationHighlightsAr: project.locationHighlightsAr ?? [],
    locationHighlightsEn: project.locationHighlightsEn ?? [],
    lat: project.lat ?? null,
    lng: project.lng ?? null,
    brochureUrl: project.brochureUrl ?? null,
  };
  if (project.publishStatus !== undefined) {
    payload.publishStatus = project.publishStatus;
  }
  return payload;
}

export interface FloorInput {
  floorNumber: number;
  floorNameAr: string;
  floorNameEn?: string | null;
  descriptionAr?: string | null;
  descriptionEn?: string | null;
  totalArea?: number | null;
}

export interface UnitInput {
  id?: string;
  floorId: number;
  unitNumber: string;
  floorNumber: number;
  floorNameAr: string;
  floorNameEn?: string | null;
  sectionAr?: string | null;
  type: UnitType;
  typeAr: string;
  typeEn?: string | null;
  area: number;
  priceLabel?: string | null;
  status?: UnitStatus;
  features?: string[];
  featuresEn?: string[];
}

export function toUnitInput(unit: PropertyUnit, floorId: number): UnitInput {
  return {
    id: unit.id,
    floorId,
    unitNumber: unit.unitNumber,
    floorNumber: unit.floorNumber,
    floorNameAr: unit.floorNameAr,
    floorNameEn: unit.floorNameEn ?? null,
    sectionAr: unit.sectionAr ?? null,
    type: unit.type,
    typeAr: unit.typeAr,
    typeEn: unit.typeEn ?? null,
    area: unit.area,
    priceLabel: unit.priceLabel ?? null,
    status: unit.status,
    features: unit.features ?? [],
    featuresEn: unit.featuresEn ?? [],
  };
}

/* -------------------------------------------------------------------------- */
/*                              Realtime payloads                             */
/* -------------------------------------------------------------------------- */

export interface UnitStatusEvent {
  unitId: string;
  status: UnitStatus;
  statusAr: string;
  statusEn: string | null;
  floorId: number;
}

export interface UnitRemovedEvent {
  unitId: string;
  floorId: number;
  projectId: number;
}

/* -------------------------------------------------------------------------- */
/*                                   Service                                  */
/* -------------------------------------------------------------------------- */

export const propertyService = {
  async list(
    filters: ProjectFilters = {},
    signal?: AbortSignal,
    options?: ProjectRequestOptions
  ): Promise<Property[]> {
    const query: Record<string, string | number | boolean | undefined | null> = { ...filters };
    if (options?.scope) {
      query.scope = options.scope;
    }
    const projects = await api.get<ProjectDto[]>('/api/projects', { query, signal });
    return projects.map(toProperty);
  },

  async getById(
    id: number,
    signal?: AbortSignal,
    options?: ProjectRequestOptions
  ): Promise<Property> {
    const query = options?.scope ? { scope: options.scope } : undefined;
    const project = await api.get<ProjectDto>(`/api/projects/${id}`, { query, signal });
    return toProperty(project);
  },

  async setPublishStatus(id: number, publishStatus: PublishStatus): Promise<Property> {
    const project = await api.patch<ProjectDto>(`/api/projects/${id}/publish`, { publishStatus });
    return toProperty(project);
  },

  async create(project: Property): Promise<Property> {
    const created = await api.post<ProjectDto>('/api/projects', toProjectPayload(project));
    return toProperty(created);
  },

  async update(id: number, project: Property): Promise<Property> {
    const updated = await api.put<ProjectDto>(`/api/projects/${id}`, toProjectPayload(project));
    return toProperty(updated);
  },

  async remove(id: number): Promise<void> {
    await api.delete(`/api/projects/${id}`);
  },

  /* ------------------------------ Floors ---------------------------------- */

  async createFloor(projectId: number, floor: FloorInput): Promise<PropertyFloor> {
    const created = await api.post<FloorDto>(`/api/projects/${projectId}/floors`, floor);
    return toPropertyFloor(created);
  },

  async updateFloor(projectId: number, floorNumber: number, floor: Partial<FloorInput>): Promise<PropertyFloor> {
    const updated = await api.put<FloorDto>(`/api/projects/${projectId}/floors/${floorNumber}`, floor);
    return toPropertyFloor(updated);
  },

  async removeFloor(projectId: number, floorNumber: number): Promise<void> {
    await api.delete(`/api/projects/${projectId}/floors/${floorNumber}`);
  },

  /* ------------------------------- Units ---------------------------------- */

  async createUnit(unit: UnitInput): Promise<PropertyUnit> {
    const created = await api.post<UnitDto>('/api/units', unit);
    return toPropertyUnit(created);
  },

  async updateUnit(unitId: string, unit: Partial<UnitInput>): Promise<PropertyUnit> {
    const updated = await api.put<UnitDto>(`/api/units/${encodeURIComponent(unitId)}`, unit);
    return toPropertyUnit(updated);
  },

  async removeUnit(unitId: string): Promise<void> {
    await api.delete(`/api/units/${encodeURIComponent(unitId)}`);
  },

  async updateUnitStatus(unitId: string, status: UnitStatus): Promise<PropertyUnit> {
    const updated = await api.patch<UnitDto>(`/api/units/${encodeURIComponent(unitId)}/status`, { status });
    return toPropertyUnit(updated);
  },

  /* ------------------------- Project with structure ----------------------- */

  /**
   * Creates a project together with its floors and units.
   *
   * The API models floors and units as separate resources, so the dashboard's
   * "add project" form has to fan out into three sequential calls. If a later
   * step fails the project is rolled back so we never leave orphan structures.
   */
  async createWithStructure(project: Property, floors: PropertyFloor[]): Promise<Property> {
    const created = await this.create(project);

    try {
      for (const floor of floors) {
        const createdFloor = await this.createFloor(created.id, {
          floorNumber: floor.floorNumber,
          floorNameAr: floor.floorNameAr,
          floorNameEn: floor.floorNameEn ?? null,
          descriptionAr: floor.descriptionAr ?? null,
          descriptionEn: floor.descriptionEn ?? null,
          totalArea: floor.totalArea ?? null,
        });

        for (const unit of floor.units) {
          await this.createUnit(toUnitInput(unit, createdFloor.id as number));
        }
      }
    } catch (error) {
      await this.remove(created.id).catch(() => undefined);
      throw error;
    }

    return this.getById(created.id);
  },
};

import type { Project, PropertyFloor, PropertyUnit } from '@prisma/client';

export interface SerializedUnit extends Omit<PropertyUnit, 'features' | 'featuresEn'> {
  features: string[] | null;
  featuresEn: string[] | null;
}

export interface SerializedFloor extends Omit<PropertyFloor, 'units'> {
  units: SerializedUnit[];
}

export interface SerializedProject extends Omit<Project, 'gallery' | 'features' | 'featuresEn' | 'locationHighlightsAr' | 'locationHighlightsEn' | 'floors'> {
  gallery: string[] | null;
  features: string[] | null;
  featuresEn: string[] | null;
  locationHighlightsAr: string[] | null;
  locationHighlightsEn: string[] | null;
  floors: SerializedFloor[];
}

export function parseJsonArray(value: string | null | undefined): string[] | null {
  if (value === null || value === undefined || value === '') return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as string[]) : null;
  } catch {
    return null;
  }
}

export function serializeUnit(unit: PropertyUnit): SerializedUnit {
  return {
    ...unit,
    features: parseJsonArray(unit.features),
    featuresEn: parseJsonArray(unit.featuresEn),
  };
}

export function serializeFloor(floor: PropertyFloor & { units?: PropertyUnit[] }): SerializedFloor {
  return {
    ...floor,
    units: (floor.units ?? []).map(serializeUnit),
  };
}

export function serializeProject(project: Project & { floors?: (PropertyFloor & { units?: PropertyUnit[] })[] }): SerializedProject {
  return {
    ...project,
    gallery: parseJsonArray(project.gallery),
    features: parseJsonArray(project.features),
    featuresEn: parseJsonArray(project.featuresEn),
    locationHighlightsAr: parseJsonArray(project.locationHighlightsAr),
    locationHighlightsEn: parseJsonArray(project.locationHighlightsEn),
    floors: (project.floors ?? []).map(serializeFloor),
  };
}
import type { CmsContactPageContent } from '../../../types/cms';

/** One editable bilingual row (a subject, or a trust bullet). */
export interface ContactPair {
  id: string;
  ar: string;
  en: string;
}

/** The contact panel's editable state, before it is turned into the stored shape. */
export interface ContactEditorState {
  data: CmsContactPageContent;
  subjectPairs: ContactPair[];
  trustEnabled: boolean;
  trustPairs: ContactPair[];
}

/** Trims both sides and drops a pair only when both sides are empty. */
export function trimSurvivingPairs(pairs: ContactPair[]): ContactPair[] {
  return pairs
    .map((p) => ({ ...p, ar: p.ar.trim(), en: p.en.trim() }))
    .filter((p) => p.ar.length > 0 || p.en.length > 0);
}

/**
 * Converts the editor state into the stored contact payload. Pure and never
 * throws, so it serves both the save request and the live preview draft (where
 * a half-filled pair simply renders with an empty side).
 */
export function buildContactPayload(state: ContactEditorState): CmsContactPageContent {
  const subjects = trimSurvivingPairs(state.subjectPairs);
  const trust = trimSurvivingPairs(state.trustPairs);

  return {
    ...state.data,
    subjectsAr: subjects.map((p) => p.ar),
    subjectsEn: subjects.map((p) => p.en),
    trustEnabled: state.trustEnabled,
    trustItems: trust.map((p) => ({ id: p.id, textAr: p.ar, textEn: p.en })),
  };
}

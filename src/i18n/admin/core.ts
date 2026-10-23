import type { Language } from '../../context/languageContextDef';
import type { AdminKey } from './index';

export type TranslationParams = Record<string, string | number>;

/** One area's AR/EN pair; the Arabic object is the source of truth for the key set. */
export interface AreaStrings<A extends Record<string, string>> {
  area: string;
  ar: A;
  en: Record<keyof A, string>;
}

/** Everything that reads admin strings: `useAdminT().t`, `translateAdmin`, `translateCurrent`. */
export type TranslateFn = (key: AdminKey, params?: TranslationParams) => string;

/**
 * `ar-SA` defaults to the Hijri calendar and Arabic-Indic digits; the admin shows
 * Gregorian dates with Latin digits so they line up with CSV exports and server logs.
 */
export const AR_LOCALE = 'ar-SA-u-ca-gregory-nu-latn';
export const EN_LOCALE = 'en-GB';

export function adminLocale(language: Language): string {
  return language === 'ar' ? AR_LOCALE : EN_LOCALE;
}

/** `<html lang>` is the single source of truth for the running language. */
export function documentLanguage(): Language {
  return typeof document !== 'undefined' && document.documentElement.lang === 'en' ? 'en' : 'ar';
}

/** `translateAdmin` bound to the document language, for code outside React. */
export const translateCurrent: TranslateFn = (key, params) => translateAdmin(documentLanguage(), key, params);

const areaRegistry = new Map<string, AreaStrings<Record<string, string>>>();

/**
 * Declares one area's AR/EN pair and registers it for `translateAdmin`. Registering
 * here (instead of a lookup table in `index.ts`) keeps `core.ts` free of an import
 * cycle with its own aggregate.
 */
export function defineStrings<A extends Record<string, string>>(
  area: string,
  ar: A,
  en: Record<keyof A, string>
): AreaStrings<A> {
  const pair: AreaStrings<A> = { area, ar, en };
  areaRegistry.set(area, pair);
  return pair;
}

const warnedKeys = new Set<string>();

function warnMissingKey(key: string): void {
  if (!import.meta.env.DEV || warnedKeys.has(key)) return;
  warnedKeys.add(key);
  console.warn(`[admin i18n] missing key "${key}"`);
}

const PLACEHOLDER = /\{(\w+)\}/g;

/** Fills `{name}` placeholders; an unknown one is left in place rather than blanked. */
function interpolate(template: string, params?: TranslationParams): string {
  if (!params) return template;
  return template.replace(PLACEHOLDER, (name) =>
    params[name] === undefined ? `{${name}}` : String(params[name])
  );
}

/** Reads `<area>.<key>` from the registered pairs; `t` in React wraps this. */
export function translateAdmin(language: Language, key: string, params?: TranslationParams): string {
  const [area, ...rest] = key.split('.');
  const pair = areaRegistry.get(area);
  const name = rest.join('.');
  const table = pair ? (language === 'ar' ? pair.ar : pair.en) : undefined;
  const template = name === '' ? undefined : table?.[name];
  if (template === undefined) {
    warnMissingKey(key);
    return key;
  }
  return interpolate(template, params);
}

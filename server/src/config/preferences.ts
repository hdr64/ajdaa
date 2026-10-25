import { z } from 'zod';

/**
 * Per-admin UI preferences, stored as JSON on `AdminUser.preferences`.
 *
 * `skipConfirm` lists the on/off actions this admin chose "don't ask again" for.
 * Only reversible toggles can be listed; permanent deletes always confirm, so
 * the enum is the guard, not the client.
 */
export const CONFIRMABLE_ACTIONS = [
  'user.status',
  'project.publish',
  'inquiry.status',
  'listener.enabled',
] as const;

export const preferencesSchema = z.object({
  skipConfirm: z.array(z.enum(CONFIRMABLE_ACTIONS)).max(CONFIRMABLE_ACTIONS.length),
});

export type AdminPreferences = z.infer<typeof preferencesSchema>;

export const DEFAULT_PREFERENCES: AdminPreferences = { skipConfirm: [] };

/** A malformed or outdated value falls back to the defaults, dropping unknown actions. */
export function parsePreferences(value: string | null | undefined): AdminPreferences {
  try {
    const parsed = JSON.parse(value ?? '{}') as { skipConfirm?: unknown };
    const known = new Set<string>(CONFIRMABLE_ACTIONS);
    const skipConfirm = Array.isArray(parsed.skipConfirm)
      ? [...new Set(parsed.skipConfirm.filter((item): item is AdminPreferences['skipConfirm'][number] =>
          typeof item === 'string' && known.has(item)
        ))]
      : [];
    return { skipConfirm };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

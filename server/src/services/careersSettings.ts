import { z } from 'zod';
import { prisma } from './prisma.js';

/**
 * Which fields the public careers form requires (owner note 5.1: "which
 * fields are required is configurable in admin").
 *
 * Stored as one `AppSetting` row under the key `careers.form`, whose value is
 * the JSON document `{ "required": { "name": true, ... } }`. A field that the
 * stored document does not mention falls back to its default, so a document
 * written by an older build keeps working.
 */

/** The applicant's identity: an application without it cannot be answered. */
export const ALWAYS_REQUIRED_FIELDS = ['name', 'email', 'phone'] as const;

/** Every field the public form can ask for. */
export const CAREERS_FORM_FIELDS = [
  'name',
  'email',
  'phone',
  'jobTitle',
  'message',
  'cv',
] as const;

const careersFormRequiredSchema = z.object({
  name: z.boolean(),
  email: z.boolean(),
  phone: z.boolean(),
  jobTitle: z.boolean(),
  message: z.boolean(),
  cv: z.boolean(),
});

export type CareersFormRequired = z.infer<typeof careersFormRequiredSchema>;

export interface CareersFormConfig {
  required: CareersFormRequired;
}

/** The values the form starts with: identity required, message and CV optional. */
export const CAREERS_FORM_DEFAULTS: CareersFormConfig = {
  required: {
    name: true,
    email: true,
    phone: true,
    jobTitle: true,
    message: false,
    cv: false,
  },
};

/** The admin form may send a subset; the rest keeps its default. */
const careersFormConfigSchema = z.object({
  required: careersFormRequiredSchema.partial(),
});

const SETTING_KEY = 'careers.form';

let cached: CareersFormConfig | undefined;

/** A fresh copy of the defaults, so a caller can never mutate the constant. */
function defaultConfig(): CareersFormConfig {
  return { required: { ...CAREERS_FORM_DEFAULTS.required } };
}

/** The identity fields are switched on whatever the stored document says. */
function withForcedRequired(config: CareersFormConfig): CareersFormConfig {
  const required = { ...config.required };
  for (const field of ALWAYS_REQUIRED_FIELDS) {
    required[field] = true;
  }
  return { required };
}

/** Reads the flags of a stored document, keeping the default of every missing field. */
function readRequired(raw: unknown): CareersFormRequired {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const required = { ...CAREERS_FORM_DEFAULTS.required };
  for (const field of CAREERS_FORM_FIELDS) {
    const value = source[field];
    if (typeof value === 'boolean') required[field] = value;
  }
  return required;
}

/**
 * The stored document over the defaults. A corrupted or unparsable row falls
 * back to the defaults, and the identity fields can never be switched off.
 */
export function parseCareersFormConfig(value: string | null | undefined): CareersFormConfig {
  if (!value) return defaultConfig();

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return defaultConfig();
  }

  const required = (parsed as { required?: unknown } | null)?.required;
  return withForcedRequired({ required: readRequired(required) });
}

export async function getCareersFormConfig(): Promise<CareersFormConfig> {
  if (cached) return cached;
  const row = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY } });
  cached = parseCareersFormConfig(row?.value);
  return cached;
}

/**
 * Stores the configuration. The identity fields are forced on before the write,
 * so the saved document never contradicts what the getter returns.
 */
export async function setCareersFormConfig(
  input: unknown,
  adminId: string
): Promise<CareersFormConfig> {
  const parsed = careersFormConfigSchema.safeParse(input);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'config'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid careers form config (${issues})`);
  }

  const normalized = withForcedRequired({
    required: { ...CAREERS_FORM_DEFAULTS.required, ...parsed.data.required },
  });
  const value = JSON.stringify(normalized);

  await prisma.appSetting.upsert({
    where: { key: SETTING_KEY },
    create: { key: SETTING_KEY, value, updatedById: adminId },
    update: { value, updatedById: adminId },
  });
  cached = undefined;
  return getCareersFormConfig();
}

/** Drops the cached copy, e.g. after a write that bypassed this module. */
export function clearCareersFormConfigCache(): void {
  cached = undefined;
}

import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/services/prisma.js';
import {
  CAREERS_FORM_DEFAULTS,
  clearCareersFormConfigCache,
  getCareersFormConfig,
  parseCareersFormConfig,
  setCareersFormConfig,
} from '../src/services/careersSettings.js';

const SETTING_KEY = 'careers.form';
const ADMIN_ID = 'admin_careers_test';

async function removeStoredConfig(): Promise<void> {
  await prisma.appSetting.deleteMany({ where: { key: SETTING_KEY } });
  clearCareersFormConfigCache();
}

beforeEach(removeStoredConfig);

afterEach(removeStoredConfig);

afterAll(async () => {
  await removeStoredConfig();
  await prisma.$disconnect();
});

describe('Careers form config', () => {
  it('falls back to the defaults when nothing is stored', async () => {
    const config = await getCareersFormConfig();

    expect(config).toEqual(CAREERS_FORM_DEFAULTS);
    expect(config.required).toEqual({
      name: true,
      email: true,
      phone: true,
      jobTitle: true,
      message: false,
      cv: false,
    });
  });

  it('saves and reads back the configuration', async () => {
    const saved = await setCareersFormConfig(
      { required: { message: true, cv: true, jobTitle: false } },
      ADMIN_ID
    );

    expect(saved.required).toEqual({
      name: true,
      email: true,
      phone: true,
      jobTitle: false,
      message: true,
      cv: true,
    });

    // The stored row is the source of truth for the next read.
    clearCareersFormConfigCache();
    const reloaded = await getCareersFormConfig();
    expect(reloaded).toEqual(saved);

    const row = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY } });
    expect(row?.updatedById).toBe(ADMIN_ID);

    // The stored document itself keeps the identity fields on.
    const stored = JSON.parse(row?.value ?? '{}');
    expect(stored.required).toMatchObject({ name: true, email: true, phone: true });
  });

  it('never lets the identity fields be switched off', async () => {
    const saved = await setCareersFormConfig(
      { required: { name: false, email: false, phone: false } },
      ADMIN_ID
    );

    expect(saved.required.name).toBe(true);
    expect(saved.required.email).toBe(true);
    expect(saved.required.phone).toBe(true);

    // Even a hand-edited row cannot turn them off.
    await prisma.appSetting.update({
      where: { key: SETTING_KEY },
      data: { value: JSON.stringify({ required: { name: false, email: false, phone: false } }) },
    });
    clearCareersFormConfigCache();

    const reloaded = await getCareersFormConfig();
    expect(reloaded.required.name).toBe(true);
    expect(reloaded.required.email).toBe(true);
    expect(reloaded.required.phone).toBe(true);
  });

  it('rejects a configuration whose flags are not booleans', async () => {
    await expect(
      setCareersFormConfig({ required: { message: 'yes' } }, ADMIN_ID)
    ).rejects.toThrow(/Invalid careers form config/);
    await expect(setCareersFormConfig({ required: null }, ADMIN_ID)).rejects.toThrow(
      /Invalid careers form config/
    );
  });
});

describe('parseCareersFormConfig', () => {
  it('returns the defaults for a missing or corrupted document', () => {
    expect(parseCareersFormConfig(null)).toEqual(CAREERS_FORM_DEFAULTS);
    expect(parseCareersFormConfig(undefined)).toEqual(CAREERS_FORM_DEFAULTS);
    expect(parseCareersFormConfig('not json')).toEqual(CAREERS_FORM_DEFAULTS);
    expect(parseCareersFormConfig('{"required":"nope"}')).toEqual(CAREERS_FORM_DEFAULTS);
  });

  it('keeps the default of every field the document does not mention', () => {
    const parsed = parseCareersFormConfig(JSON.stringify({ required: { cv: true } }));

    expect(parsed.required).toEqual({
      name: true,
      email: true,
      phone: true,
      jobTitle: true,
      message: false,
      cv: true,
    });
  });

  it('ignores values that are not booleans', () => {
    const parsed = parseCareersFormConfig(
      JSON.stringify({ required: { message: 'true', cv: true, jobTitle: 1 } })
    );

    expect(parsed.required.message).toBe(false);
    expect(parsed.required.cv).toBe(true);
    expect(parsed.required.jobTitle).toBe(true);
  });
});

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/services/prisma.js';
import { invalidateCmsCache } from '../src/services/cmsService.js';
import { DEFAULT_CONTACT, DEFAULT_FOOTER } from '../src/config/defaultCmsContent.js';
import { authInject, closeApp, getApp, inject, seedSession, SEED_ADMINS, type TestSession } from './helpers.js';

/**
 * CMS contract tests for the newer optional fields: the contact page trust
 * bullets (`trustEnabled` / `trustItems`) and the footer made-in-KSA line
 * (`madeInKsaEnabled`). Both are optional in the schema so rows and clients
 * saved before the fields existed keep validating; the service fills the
 * defaults when a stored row lacks them.
 */

let superSession: TestSession;

/** The subset of a stored section this file asserts on. */
interface CmsSectionShape {
  trustEnabled?: boolean;
  trustItems?: Array<{ id: string; textAr: string; textEn: string }>;
  madeInKsaEnabled?: boolean;
  madeInKsaAr?: string;
  madeInKsaEn?: string;
}

/** A full contact payload, as the admin panel sends it. */
function contactBody(overrides: Record<string, unknown> = {}) {
  return { ...DEFAULT_CONTACT, ...overrides };
}

/** A full footer payload, as the admin panel sends it. */
function footerBody(overrides: Record<string, unknown> = {}) {
  return { ...DEFAULT_FOOTER, ...overrides };
}

/**
 * Overwrites a stored section with JSON that predates the new fields, the way
 * a production `CmsSection` row saved by an older build looks.
 */
async function storeLegacySection(key: string, content: Record<string, unknown>): Promise<void> {
  await prisma.cmsSection.upsert({
    where: { key },
    create: { key, content: JSON.stringify(content), version: 1 },
    update: { content: JSON.stringify(content) },
  });
  invalidateCmsCache(key);
}

async function readSection(key: string): Promise<CmsSectionShape> {
  const response = await inject({ method: 'GET', url: `/api/cms/content/${key}` });
  expect(response.statusCode).toBe(200);
  return (response.json() as { content: CmsSectionShape }).content;
}

/** Reads just the two sections this file mutates out of the aggregated payload. */
async function readSections(): Promise<{ contact: CmsSectionShape; footer: CmsSectionShape }> {
  const response = await inject({ method: 'GET', url: '/api/cms/content' });
  expect(response.statusCode).toBe(200);
  const payload = response.json() as { contact: CmsSectionShape; footer: CmsSectionShape };
  return { contact: payload.contact, footer: payload.footer };
}

beforeAll(async () => {
  await getApp();
  superSession = await seedSession(SEED_ADMINS.superAdmin);
  // Makes sure the section rows exist before anything below reads or writes them.
  await readSections();
});

afterAll(async () => {
  // Leave the shared sections at their defaults so other files (and the next
  // run) see the seeded state, not this file's last write.
  for (const [key, content] of [
    ['contact', DEFAULT_CONTACT],
    ['footer', DEFAULT_FOOTER],
  ] as const) {
    await prisma.cmsSection.upsert({
      where: { key },
      create: { key, content: JSON.stringify(content), version: 1 },
      update: { content: JSON.stringify(content) },
    });
    invalidateCmsCache(key);
  }
  await closeApp();
});

describe('contact trust bullets', () => {
  const bullets = [
    { id: 'trust-a', textAr: 'نص أول للثقة', textEn: 'First trust bullet' },
    { id: 'trust-b', textAr: 'نص ثانٍ للثقة', textEn: 'Second trust bullet' },
  ];

  it('saves trust bullets and reads them back from both section endpoints', async () => {
    const saved = await authInject(superSession.token, {
      method: 'PUT',
      url: '/api/cms/content/contact',
      payload: contactBody({ trustEnabled: true, trustItems: bullets }),
    });
    expect(saved.statusCode).toBe(200);

    const section = await readSection('contact');
    expect(section.trustEnabled).toBe(true);
    expect(section.trustItems).toEqual(bullets);

    const aggregated = await readSections();
    expect(aggregated.contact.trustEnabled).toBe(true);
    expect(aggregated.contact.trustItems).toEqual(bullets);
  });

  it('rejects more than 6 bullets, an empty text and an over-long text with 400', async () => {
    const tooMany = Array.from({ length: 7 }, (_, i) => ({
      id: `trust-${i}`,
      textAr: 'نص',
      textEn: 'Text',
    }));
    const tooManyRes = await authInject(superSession.token, {
      method: 'PUT',
      url: '/api/cms/content/contact',
      payload: contactBody({ trustItems: tooMany }),
    });
    expect(tooManyRes.statusCode).toBe(400);

    const emptyRes = await authInject(superSession.token, {
      method: 'PUT',
      url: '/api/cms/content/contact',
      payload: contactBody({ trustItems: [{ id: 'trust-a', textAr: '', textEn: 'Text' }] }),
    });
    expect(emptyRes.statusCode).toBe(400);

    const tooLongRes = await authInject(superSession.token, {
      method: 'PUT',
      url: '/api/cms/content/contact',
      payload: contactBody({ trustItems: [{ id: 'trust-a', textAr: 'ن'.repeat(121), textEn: 'Text' }] }),
    });
    expect(tooLongRes.statusCode).toBe(400);
  });

  it('serves the defaults for a stored row saved before the trust fields existed', async () => {
    const { trustEnabled: _enabled, trustItems: _items, ...legacyContact } = DEFAULT_CONTACT;
    await storeLegacySection('contact', legacyContact as Record<string, unknown>);

    const section = await readSection('contact');
    expect(section.trustEnabled).toBe(DEFAULT_CONTACT.trustEnabled);
    expect(section.trustItems).toEqual(DEFAULT_CONTACT.trustItems);

    const aggregated = await readSections();
    expect(aggregated.contact.trustItems).toEqual(DEFAULT_CONTACT.trustItems);
  });
});

describe('footer made-in-KSA line', () => {
  it('round-trips the switch and both texts', async () => {
    const saved = await authInject(superSession.token, {
      method: 'PUT',
      url: '/api/cms/content/footer',
      payload: footerBody({
        madeInKsaEnabled: true,
        madeInKsaAr: 'صمم في المملكة العربية السعودية',
        madeInKsaEn: 'Made in Saudi Arabia',
      }),
    });
    expect(saved.statusCode).toBe(200);

    const section = await readSection('footer');
    expect(section.madeInKsaEnabled).toBe(true);
    expect(section.madeInKsaAr).toBe('صمم في المملكة العربية السعودية');
    expect(section.madeInKsaEn).toBe('Made in Saudi Arabia');

    const aggregated = await readSections();
    expect(aggregated.footer.madeInKsaEnabled).toBe(true);
    expect(aggregated.footer.madeInKsaEn).toBe('Made in Saudi Arabia');
  });

  it('serves the default (hidden) for a stored row saved before the field existed', async () => {
    const { madeInKsaEnabled: _enabled, ...legacyFooter } = DEFAULT_FOOTER;
    await storeLegacySection('footer', legacyFooter as Record<string, unknown>);

    const section = await readSection('footer');
    expect(section.madeInKsaEnabled).toBe(false);

    const aggregated = await readSections();
    expect(aggregated.footer.madeInKsaEnabled).toBe(false);
  });
});

describe('version history and rollback with the optional fields', () => {
  it('rolls a contact section back to a version that had trust bullets', async () => {
    const bullets = [
      { id: 'trust-roll', textAr: 'عنصر قبل الترقيع', textEn: 'Bullet before the patch' },
    ];
    const withBullets = await authInject(superSession.token, {
      method: 'PUT',
      url: '/api/cms/content/contact',
      payload: contactBody({ trustEnabled: true, trustItems: bullets }),
    });
    expect(withBullets.statusCode).toBe(200);
    const targetVersion = (withBullets.json() as { version: number }).version;

    // An older client sends the payload without the new keys at all.
    const { trustEnabled: _enabled, trustItems: _items, ...legacyContact } = DEFAULT_CONTACT;
    const withoutBullets = await authInject(superSession.token, {
      method: 'PUT',
      url: '/api/cms/content/contact',
      payload: legacyContact,
    });
    expect(withoutBullets.statusCode).toBe(200);
    expect((await readSection('contact')).trustItems).toEqual(DEFAULT_CONTACT.trustItems);

    const versionsRes = await authInject(superSession.token, {
      method: 'GET',
      url: '/api/cms/content/contact/versions',
    });
    expect(versionsRes.statusCode).toBe(200);
    const versions = versionsRes.json() as Array<{ version: number; content: { trustItems?: unknown } }>;
    expect(versions.some((v) => v.version === targetVersion)).toBe(true);

    const rolled = await authInject(superSession.token, {
      method: 'POST',
      url: `/api/cms/content/contact/rollback/${targetVersion}`,
    });
    expect(rolled.statusCode).toBe(200);
    expect((await readSection('contact')).trustItems).toEqual(bullets);
  });
});

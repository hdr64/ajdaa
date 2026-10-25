import { prisma } from './prisma.js';
import { loggerService } from './loggerService.js';

/**
 * Public website settings (contact details and social links), edited from the
 * admin settings page and read by the public site.
 *
 * Stored as one `AppSetting` row ("site"). Saved values are merged over
 * {@link SITE_DEFAULTS}, so a field added later starts with a sensible value
 * instead of an empty one. An empty social link hides that icon.
 */

export const SOCIAL_KEYS = ['x', 'instagram', 'tiktok', 'snapchat', 'linkedin', 'youtube'] as const;
export type SocialKey = (typeof SOCIAL_KEYS)[number];

/** A strip across the top of every public page. */
export interface Announcement {
  enabled: boolean;
  textAr: string;
  textEn: string;
  tone: 'info' | 'warning';
  /** Optional https link the strip points to; empty for none. */
  link: string;
}

/**
 * Replaces the public pages with a notice. The admin and its login stay
 * reachable so it can be switched off again; the public API keeps answering,
 * so this is a visitor-facing notice, not a lockdown.
 */
export interface Maintenance {
  enabled: boolean;
  messageAr: string;
  messageEn: string;
}

/** Whether the public site links to the careers page from the footer and from a floating button. */
export interface CareersVisibility {
  showFooterLink: boolean;
  showFloatingButton: boolean;
}

export interface SiteSettings {
  /** Shown as written, e.g. "+966 58 048 4528". */
  phone: string;
  /** International digits only, used for wa.me links, e.g. "966580484528". */
  whatsapp: string;
  email: string;
  addressAr: string;
  addressEn: string;
  hoursAr: string;
  hoursEn: string;
  socials: Record<SocialKey, string>;
  announcement: Announcement;
  maintenance: Maintenance;
  careers: CareersVisibility;
}

/** The values that were hard-coded in the site before this setting existed. */
export const SITE_DEFAULTS: SiteSettings = {
  phone: '+966 58 048 4528',
  whatsapp: '966580484528',
  email: 'info@ajdaa.sa',
  addressAr: 'الرياض، طريق الملك فهد',
  addressEn: 'Riyadh, King Fahd Road',
  hoursAr: 'الأحد – الخميس، 8ص – 4م',
  hoursEn: 'Sun – Thu, 8:00 AM – 4:00 PM',
  socials: {
    x: 'https://x.com/Ajdaa_RS',
    instagram: 'https://www.instagram.com/ajdaa_rs',
    tiktok: 'https://www.tiktok.com/@ajdaa_rs',
    snapchat: 'https://snapchat.com/t/sVxEBu75',
    linkedin: '',
    youtube: '',
  },
  announcement: { enabled: false, textAr: '', textEn: '', tone: 'info', link: '' },
  maintenance: {
    enabled: false,
    messageAr: 'الموقع قيد الصيانة حالياً، وسنعود قريباً.',
    messageEn: 'The site is under maintenance. We will be back shortly.',
  },
  careers: { showFooterLink: true, showFloatingButton: true },
};

const SETTING_KEY = 'site';

let cached: SiteSettings | undefined;
let corruptLogged = false;

/** Saved values over the defaults, block by block (exported for tests). */
export function withDefaults(stored: Partial<SiteSettings>): SiteSettings {
  return {
    ...SITE_DEFAULTS,
    ...stored,
    socials: { ...SITE_DEFAULTS.socials, ...(stored.socials ?? {}) },
    announcement: { ...SITE_DEFAULTS.announcement, ...(stored.announcement ?? {}) },
    maintenance: { ...SITE_DEFAULTS.maintenance, ...(stored.maintenance ?? {}) },
    careers: { ...SITE_DEFAULTS.careers, ...(stored.careers ?? {}) },
  };
}

export async function getSiteSettings(): Promise<SiteSettings> {
  if (cached) return cached;
  const row = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY } });
  if (!row) {
    cached = SITE_DEFAULTS;
    return cached;
  }
  let stored: Partial<SiteSettings> | null = null;
  try {
    stored = JSON.parse(row.value) as Partial<SiteSettings>;
  } catch {
    if (!corruptLogged) {
      corruptLogged = true;
      loggerService.warn('Stored site settings row is corrupt; falling back to defaults', {}, 'site');
    }
  }
  cached = stored ? withDefaults(stored) : SITE_DEFAULTS;
  return cached;
}

export async function saveSiteSettings(input: SiteSettings, adminId: string): Promise<SiteSettings> {
  const value = JSON.stringify(input);
  await prisma.appSetting.upsert({
    where: { key: SETTING_KEY },
    create: { key: SETTING_KEY, value, updatedById: adminId },
    update: { value, updatedById: adminId },
  });
  cached = undefined;
  return getSiteSettings();
}

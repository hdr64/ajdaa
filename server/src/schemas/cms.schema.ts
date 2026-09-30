import { z } from 'zod';

export const externalUrl = z.union([
  z.literal(''),
  z.string().trim().url().startsWith('https://', { message: 'Must start with https://' }),
]);

export const mediaPath = z.union([
  z.string().trim().startsWith('/', { message: 'Must be an internal path starting with / or an https:// URL' }),
  z.string().trim().url().startsWith('https://', { message: 'Must start with https://' }),
]);

// 1. Navigation Item
export const cmsNavItemSchema = z.object({
  id: z.string().min(1),
  labelAr: z.string().trim().min(1, 'Arabic label is required').max(100),
  labelEn: z.string().trim().min(1, 'English label is required').max(100),
  page: z.enum(['home', 'works', 'clients', 'booking', 'contact', 'custom']),
  url: externalUrl.optional(),
  order: z.number().int().min(0),
  enabled: z.boolean(),
  isCta: z.boolean().optional(),
});
export type CmsNavItem = z.infer<typeof cmsNavItemSchema>;

// 2. Social Media Item
export const cmsSocialItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(50),
  icon: z.enum(['x', 'instagram', 'tiktok', 'snapchat', 'linkedin', 'youtube', 'facebook', 'whatsapp', 'telegram', 'globe']),
  url: externalUrl,
  enabled: z.boolean(),
  order: z.number().int().min(0),
});
export type CmsSocialItem = z.infer<typeof cmsSocialItemSchema>;

// 3. Footer Section
export const cmsFooterSchema = z.object({
  brandDescAr: z.string().trim().max(500),
  brandDescEn: z.string().trim().max(500),
  phone: z.string().trim().max(40),
  phoneEnabled: z.boolean(),
  whatsapp: z.union([z.literal(''), z.string().trim().regex(/^\d{8,15}$/, 'Digits only')]),
  whatsappEnabled: z.boolean(),
  email: z.union([z.literal(''), z.string().trim().email()]),
  emailEnabled: z.boolean(),
  addressAr: z.string().trim().max(200),
  addressEn: z.string().trim().max(200),
  addressEnabled: z.boolean(),
  hoursAr: z.string().trim().max(120),
  hoursEn: z.string().trim().max(120),
  hoursEnabled: z.boolean(),
  quickLinksTitleAr: z.string().trim().max(100),
  quickLinksTitleEn: z.string().trim().max(100),
  servicesTitleAr: z.string().trim().max(100),
  servicesTitleEn: z.string().trim().max(100),
  servicesListAr: z.array(z.string().trim().min(1).max(150)).max(15),
  servicesListEn: z.array(z.string().trim().min(1).max(150)).max(15),
  newsletterTitleAr: z.string().trim().max(100),
  newsletterTitleEn: z.string().trim().max(100),
  newsletterDescAr: z.string().trim().max(250),
  newsletterDescEn: z.string().trim().max(250),
  newsletterEnabled: z.boolean(),
  copyrightAr: z.string().trim().max(200),
  copyrightEn: z.string().trim().max(200),
  madeInKsaAr: z.string().trim().max(100),
  madeInKsaEn: z.string().trim().max(100),
  socials: z.array(cmsSocialItemSchema).max(20),
});
export type CmsFooterSection = z.infer<typeof cmsFooterSchema>;

// 4. SEO Meta Schema
export const cmsSeoMetaSchema = z.object({
  metaTitleAr: z.string().trim().max(70).optional(),
  metaTitleEn: z.string().trim().max(70).optional(),
  metaDescriptionAr: z.string().trim().max(160).optional(),
  metaDescriptionEn: z.string().trim().max(160).optional(),
  keywordsAr: z.string().trim().max(300).optional(),
  keywordsEn: z.string().trim().max(300).optional(),
  ogImage: z.string().trim().optional(),
});
export type CmsSeoMeta = z.infer<typeof cmsSeoMetaSchema>;

// 5. Home Page Sections Schema
export const cmsHomeSchema = z.object({
  hero: z.object({
    enabled: z.boolean(),
    badgeAr: z.string().trim().max(100),
    badgeEn: z.string().trim().max(100),
    titleLine1Ar: z.string().trim().max(150),
    titleLine1En: z.string().trim().max(150),
    titleLine2Ar: z.string().trim().max(150),
    titleLine2En: z.string().trim().max(150),
    highlightWordAr: z.string().trim().max(50),
    highlightWordEn: z.string().trim().max(50),
    subtitleAr: z.string().trim().max(500),
    subtitleEn: z.string().trim().max(500),
    exploreBtnTextAr: z.string().trim().max(60),
    exploreBtnTextEn: z.string().trim().max(60),
    consultBtnTextAr: z.string().trim().max(60),
    consultBtnTextEn: z.string().trim().max(60),
    bgImage: mediaPath,
  }),
  marquee: z.object({
    enabled: z.boolean(),
    cities: z.array(z.object({
      id: z.string(),
      nameAr: z.string().trim().min(1).max(50),
      nameEn: z.string().trim().min(1).max(50),
    })).max(30),
  }),
  mapSection: z.object({
    enabled: z.boolean(),
    badgeAr: z.string().trim().max(100),
    badgeEn: z.string().trim().max(100),
    titleAr: z.string().trim().max(150),
    titleEn: z.string().trim().max(150),
    titleHighlightAr: z.string().trim().max(60),
    titleHighlightEn: z.string().trim().max(60),
    descAr: z.string().trim().max(500),
    descEn: z.string().trim().max(500),
  }),
  about: z.object({
    enabled: z.boolean(),
    badgeAr: z.string().trim().max(100),
    badgeEn: z.string().trim().max(100),
    titleAr: z.string().trim().max(150),
    titleEn: z.string().trim().max(150),
    titleHighlightAr: z.string().trim().max(60),
    titleHighlightEn: z.string().trim().max(60),
    descAr: z.string().trim().max(500),
    descEn: z.string().trim().max(500),
    videoShowcaseEnabled: z.boolean(),
    videoUrl: externalUrl,
    projectTitleAr: z.string().trim().max(150),
    projectTitleEn: z.string().trim().max(150),
    projectLocationAr: z.string().trim().max(150),
    projectLocationEn: z.string().trim().max(150),
    coverImage: mediaPath,
    visionTitleAr: z.string().trim().max(100),
    visionTitleEn: z.string().trim().max(100),
    visionDescAr: z.string().trim().max(500),
    visionDescEn: z.string().trim().max(500),
    missionTitleAr: z.string().trim().max(100),
    missionTitleEn: z.string().trim().max(100),
    missionDescAr: z.string().trim().max(500),
    missionDescEn: z.string().trim().max(500),
    valuesBadgeAr: z.string().trim().max(100),
    valuesBadgeEn: z.string().trim().max(100),
    valuesTitleAr: z.string().trim().max(150),
    valuesTitleEn: z.string().trim().max(150),
    values: z.array(z.object({
      id: z.string(),
      titleAr: z.string().trim().min(1).max(100),
      titleEn: z.string().trim().min(1).max(100),
      descAr: z.string().trim().max(300),
      descEn: z.string().trim().max(300),
      icon: z.string().trim(),
    })).max(12),
    stats: z.array(z.object({
      id: z.string(),
      number: z.string().trim().max(30),
      labelAr: z.string().trim().max(100),
      labelEn: z.string().trim().max(100),
    })).max(6),
  }),
  services: z.object({
    enabled: z.boolean(),
    badgeAr: z.string().trim().max(100),
    badgeEn: z.string().trim().max(100),
    titleAr: z.string().trim().max(150),
    titleEn: z.string().trim().max(150),
    titleHighlightAr: z.string().trim().max(60),
    titleHighlightEn: z.string().trim().max(60),
    descAr: z.string().trim().max(500),
    descEn: z.string().trim().max(500),
    items: z.array(z.object({
      id: z.string(),
      titleAr: z.string().trim().min(1).max(120),
      titleEn: z.string().trim().min(1).max(120),
      descAr: z.string().trim().max(400),
      descEn: z.string().trim().max(400),
      icon: z.string().trim(),
      order: z.number().int().min(0),
    })).max(12),
  }),
  process: z.object({
    enabled: z.boolean(),
    badgeAr: z.string().trim().max(100),
    badgeEn: z.string().trim().max(100),
    titleAr: z.string().trim().max(150),
    titleEn: z.string().trim().max(150),
    titleHighlightAr: z.string().trim().max(60),
    titleHighlightEn: z.string().trim().max(60),
    descAr: z.string().trim().max(500),
    descEn: z.string().trim().max(500),
    steps: z.array(z.object({
      id: z.string(),
      titleAr: z.string().trim().min(1).max(120),
      titleEn: z.string().trim().min(1).max(120),
      descAr: z.string().trim().max(400),
      descEn: z.string().trim().max(400),
      icon: z.string().trim(),
    })).max(8),
  }),
  portfolioSection: z.object({
    enabled: z.boolean(),
    badgeAr: z.string().trim().max(100),
    badgeEn: z.string().trim().max(100),
    titleAr: z.string().trim().max(150),
    titleEn: z.string().trim().max(150),
    titleHighlightAr: z.string().trim().max(60),
    titleHighlightEn: z.string().trim().max(60),
    descAr: z.string().trim().max(500),
    descEn: z.string().trim().max(500),
  }),
  clientsSection: z.object({
    enabled: z.boolean(),
    badgeAr: z.string().trim().max(100),
    badgeEn: z.string().trim().max(100),
    titleAr: z.string().trim().max(150),
    titleEn: z.string().trim().max(150),
    descAr: z.string().trim().max(500),
    descEn: z.string().trim().max(500),
  }),
  cta: z.object({
    enabled: z.boolean(),
    titleAr: z.string().trim().max(150),
    titleEn: z.string().trim().max(150),
    titleHighlightAr: z.string().trim().max(60),
    titleHighlightEn: z.string().trim().max(60),
    descAr: z.string().trim().max(500),
    descEn: z.string().trim().max(500),
    primaryBtnTextAr: z.string().trim().max(60),
    primaryBtnTextEn: z.string().trim().max(60),
    secondaryBtnTextAr: z.string().trim().max(60),
    secondaryBtnTextEn: z.string().trim().max(60),
  }),
  seo: cmsSeoMetaSchema.optional(),
});
export type CmsHomePageContent = z.infer<typeof cmsHomeSchema>;

// 6. Works Page Schema
export const cmsWorksSchema = z.object({
  badgeAr: z.string().trim().max(100),
  badgeEn: z.string().trim().max(100),
  titleAr: z.string().trim().max(150),
  titleEn: z.string().trim().max(150),
  subtitleAr: z.string().trim().max(500),
  subtitleEn: z.string().trim().max(500),
  featuredBannerEnabled: z.boolean(),
  featuredProjectId: z.number().int().positive().optional(),
  emptyState: z.object({
    titleAr: z.string().trim().max(120),
    titleEn: z.string().trim().max(120),
    descAr: z.string().trim().max(300),
    descEn: z.string().trim().max(300),
    resetBtnTextAr: z.string().trim().max(60),
    resetBtnTextEn: z.string().trim().max(60),
  }),
  ctaEnabled: z.boolean(),
  ctaTitleAr: z.string().trim().max(150),
  ctaTitleEn: z.string().trim().max(150),
  ctaDescAr: z.string().trim().max(500),
  ctaDescEn: z.string().trim().max(500),
  seo: cmsSeoMetaSchema.optional(),
});
export type CmsWorksPageContent = z.infer<typeof cmsWorksSchema>;

// 7. Clients Page Schema
export const cmsClientsPageSchema = z.object({
  badgeAr: z.string().trim().max(100),
  badgeEn: z.string().trim().max(100),
  titleAr: z.string().trim().max(150),
  titleEn: z.string().trim().max(150),
  subtitleAr: z.string().trim().max(500),
  subtitleEn: z.string().trim().max(500),
  stats: z.array(z.object({
    id: z.string(),
    valueAr: z.string().trim().max(30),
    valueEn: z.string().trim().max(30),
    labelAr: z.string().trim().max(100),
    labelEn: z.string().trim().max(100),
    order: z.number().int().min(0),
  })).max(8),
  ctaTitleAr: z.string().trim().max(150),
  ctaTitleEn: z.string().trim().max(150),
  ctaSubtitleAr: z.string().trim().max(500),
  ctaSubtitleEn: z.string().trim().max(500),
  ctaButtonTextAr: z.string().trim().max(60),
  ctaButtonTextEn: z.string().trim().max(60),
  seo: cmsSeoMetaSchema.optional(),
});
export type CmsClientsPageContent = z.infer<typeof cmsClientsPageSchema>;

// 8. Client Item Schema
export const cmsClientItemSchema = z.object({
  id: z.string().uuid().optional(),
  nameAr: z.string().trim().min(1, 'Arabic name required').max(150),
  nameEn: z.string().trim().min(1, 'English name required').max(150),
  sectorAr: z.string().trim().min(1).max(100),
  sectorEn: z.string().trim().min(1).max(100),
  descAr: z.string().trim().max(500),
  descEn: z.string().trim().max(500),
  logo: mediaPath,
  tagsAr: z.array(z.string().trim().max(50)).max(10),
  tagsEn: z.array(z.string().trim().max(50)).max(10),
  websiteUrl: externalUrl.optional(),
  order: z.number().int().min(0).default(0),
  visible: z.boolean().default(true),
});
export type CmsClientItem = z.infer<typeof cmsClientItemSchema>;

// 9. Contact Page Schema
export const cmsContactSchema = z.object({
  badgeAr: z.string().trim().max(100),
  badgeEn: z.string().trim().max(100),
  titleAr: z.string().trim().max(150),
  titleEn: z.string().trim().max(150),
  subtitleAr: z.string().trim().max(500),
  subtitleEn: z.string().trim().max(500),
  formTitleAr: z.string().trim().max(100),
  formTitleEn: z.string().trim().max(100),
  subjectsAr: z.array(z.string().trim().min(1).max(100)).max(15),
  subjectsEn: z.array(z.string().trim().min(1).max(100)).max(15),
  seo: cmsSeoMetaSchema.optional(),
});
export type CmsContactPageContent = z.infer<typeof cmsContactSchema>;

export const SECTION_SCHEMAS: Record<string, z.ZodTypeAny> = {
  nav: z.array(cmsNavItemSchema),
  footer: cmsFooterSchema,
  home: cmsHomeSchema,
  works: cmsWorksSchema,
  clientsPage: cmsClientsPageSchema,
  contact: cmsContactSchema,
};

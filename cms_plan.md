# 🌐 Ajda Real Estate Platform — Full Content Management System (CMS) & Dynamic Architecture Plan (v2.1 Final)

> **Document Purpose**: Comprehensive, production-grade architectural specification and implementation roadmap for the full-site Content Management System (CMS), granular permissions system, and high-performance caching engine for the Ajda Real Estate Platform.
> **Status**: Approved & Implementation-Ready (Refined with all Post-Review Feedback).
> **Date**: 2026-09-30
> **Target Branch**: `feat/backend-admin` (Worktree: `feat/opencode-worker`)

---

## 1. Executive Summary & Project Context

### 1.1 Platform Overview
**Ajda Real Estate (أجدا العقارية)** is an enterprise real estate development and asset management platform in the Kingdom of Saudi Arabia. It serves corporate investors, retail tenants, and logistics partners across prime corridors (Riyadh, Al-Ahsa, Dammam, Jeddah, etc.).

### 1.2 Technology Stack
- **Frontend**:
  - React 19 + TypeScript + Vite
  - Tailwind CSS v4 with bespoke RTL/LTR theme system
  - Lucide React icons
  - Interactive Map integration (Google Maps loader singleton + Leaflet)
  - Realtime client: `socket.io-client`
- **Backend**:
  - Node.js (v20+) runtime with native TypeScript
  - **Fastify** web framework (high throughput, native JSON Schema validation)
  - **Prisma ORM** (type-safe database client)
  - **Sharp** image processing pipeline (WebP conversion, quality optimization)
  - JWT authentication (`@fastify/jwt`) + Role-Based Access Control (RBAC)
  - Realtime engine: Socket.io
- **Database & Deployment Strategy**:
  - **Development**: SQLite (`server/prisma/schema.prisma`)
  - **Production**: Native PostgreSQL 16 on Ubuntu VPS, managed by `systemd`, with Caddy 2 reverse proxy and automated TLS (Cloudflare Origin CA). **No Docker containers** in production.
  - **Static Media**: Stored on disk under `server/uploads/` and served via `@fastify/static` at `/uploads/`.
- **Localization**:
  - Full bilingual architecture: Arabic (`ar`, RTL primary) and English (`en`, LTR secondary).

---

## 2. Problem Statement & Motivation

### 2.1 The Current Gap
1. **Hardcoded Public Content**: Most public pages (Home hero, marquee, about, services, process steps, portfolio highlights, CTA banners, works page text, contact page subjects, footer identity, and navigation items) are currently hardcoded in JSX or inline language ternaries (`isAr ? 'نص' : 'text'`).
2. **Scattered Contact & Identity Details**: Company phone, WhatsApp, email, physical addresses, working hours, and social media links are duplicated across 6+ frontend components (`Navbar.tsx`, `Footer.tsx`, `ContactPage.tsx`, `ClientsPage.tsx`, `InterestRegistrationView.tsx`).
3. **Static Partners Directory**: The Clients page and Home clients section rely on hardcoded client arrays and bundled images rather than a database-driven collection.
4. **Coarse Permissions**: Current admin permissions are grouped into broad categories (`manageProjects`, `viewInquiries`, etc.), preventing granular assignment (e.g. allowing an employee to create projects without the ability to edit or delete existing ones).

### 2.2 Core Objective
Convert **100% of the public frontend content** into an admin-manageable, database-stored CMS where:
- Every text string is editable in both Arabic and English.
- Every section can be toggled on/off (`enabled: boolean`).
- Dynamic collections (Clients/Partners, Services, Process Steps, Social Links, Marquee Cities) support full CRUD, reordering, and media uploads.
- The platform achieves **0ms first-paint latency** with zero layout shift via a multi-tier caching system.
- Granular, action-level permissions can be granted directly to individual users as well as roles.
- The data structures are **SEO-ready** for subsequent search-engine indexing without schema migrations.
- Full versioning and rollback are supported so mistakes can be undone in one click.

---

## 3. Database Architecture & Storage Models

In response to architectural review feedback, we discard generic, unindexed settings blobs for collections. Instead, we introduce **three dedicated Prisma models**:

```
┌─────────────────────────────────┐       ┌─────────────────────────────────┐
│           CmsSection            │       │        CmsSectionVersion        │
├─────────────────────────────────┤       ├─────────────────────────────────┤
│ key: String (PK)                │◄──┐   │ id: String (PK)                 │
│ content: String (JSON)          │   └───┤ sectionKey: String (FK)         │
│ version: Int                    │       │ content: String (JSON snapshot) │
│ updatedAt: DateTime             │       │ version: Int                    │
│ updatedById: String?            │       │ createdById: String?            │
└─────────────────────────────────┘       │ createdAt: DateTime             │
                                          └─────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────────┐
│                                 CmsClient                                 │
├───────────────────────────────────────────────────────────────────────────┤
│ id: String (PK)                     tagsAr: String (JSON Array)           │
│ nameAr: String                      tagsEn: String (JSON Array)           │
│ nameEn: String                      websiteUrl: String?                   │
│ sectorAr: String                    order: Int (default: 0)               │
│ sectorEn: String                    visible: Boolean (default: true)      │
│ descAr: String                      createdAt: DateTime                   │
│ descEn: String                      updatedAt: DateTime                   │
│ logo: String                                                              │
└───────────────────────────────────────────────────────────────────────────┘
```

### 3.1 Prisma Schema Definitions (`server/prisma/schema.prisma`)

```prisma
/// Stores document-style CMS content (e.g. "nav", "footer", "home", "works", "contact", "clientsPage").
model CmsSection {
  key         String              @id // e.g. "nav", "footer", "home", "works", "contact", "clientsPage"
  content     String              // Validated JSON string payload
  version     Int                 @default(1)
  updatedAt   DateTime            @updatedAt
  updatedById String?
  versions    CmsSectionVersion[]

  @@map("cms_sections")
}

/// Stores point-in-time snapshots for version history, audit logging, and 1-click rollback.
model CmsSectionVersion {
  id          String     @id @default(uuid())
  sectionKey  String
  section     CmsSection @relation(fields: [sectionKey], references: [key], onDelete: Cascade)
  content     String     // JSON snapshot of the section at this version
  version     Int
  createdById String?
  createdAt   DateTime   @default(now())

  @@unique([sectionKey, version])
  @@index([sectionKey])
  @@map("cms_section_versions")
}

/// Dedicated relational table for Partners & Corporate Clients with full CRUD, indexing, and sorting.
model CmsClient {
  id         String   @id @default(uuid())
  nameAr     String
  nameEn     String
  sectorAr   String
  sectorEn   String
  descAr     String
  descEn     String
  logo       String   // Relative URL e.g. "/clients/almanea.webp" or "/uploads/uuid.webp"
  tagsAr     String   // JSON string array e.g. '["معارض كبرى", "مستودعات لوجستية"]'
  tagsEn     String   // JSON string array e.g. '["Major Showrooms", "Logistics Hubs"]'
  websiteUrl String?
  order      Int      @default(0)
  visible    Boolean  @default(true)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([visible, order])
  @@map("cms_clients")
}
```

### 3.2 Concurrency Decision: Last-Write-Wins (LWW) with Automatic Version History
- **Chosen Strategy**: Last-Write-Wins (LWW) coupled with automatic point-in-time snapshot archiving in `CmsSectionVersion`.
- **Rationale**: For an internal real estate company admin team with low simultaneous edit contention, LWW is simple and frictionless. The `CmsSectionVersion` archive retains the last 10 versions, providing a complete audit trail and 1-click rollback safety net if an admin accidentally overwrites someone else's edit.

### 3.3 Known Limitations & Migration Paths
- **Client Tags**: `tagsAr` and `tagsEn` are stored as JSON string arrays. This is optimal for display chips in the UI without extra joins. If complex relational filtering by tag (e.g. `JOIN clients WHERE tag = 'x'`) is required in the future, a dedicated table `CmsClientTag (clientId, tag, lang)` can be migrated easily.

---

## 4. Single Source of Truth: Zod Schemas & TypeScript Types

To avoid drift between TypeScript interfaces and validation rules, **Zod schemas are the single source of truth**, and TypeScript types are inferred via `z.infer<typeof schema>`.

### 4.1 Schema Definitions (`server/src/schemas/cms.schema.ts`)

```typescript
import { z } from 'zod';

// Strict external HTTPS URL validator
export const externalUrl = z.union([
  z.literal(''),
  z.string().trim().url().startsWith('https://', { message: 'Must start with https://' }),
]);

// Internal media path or relative URL validator
export const mediaPath = z.string().trim().min(1, 'Media path or URL required');

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

// 4. SEO Meta Schema (Plug-and-play for later phase)
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
      // stepNumber removed: derived cleanly from array index in frontend
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

// 10. Aggregated CMS Payload
export interface CmsContent {
  nav: CmsNavItem[];
  footer: CmsFooterSection;
  home: CmsHomePageContent;
  works: CmsWorksPageContent;
  clientsPage: CmsClientsPageContent;
  contact: CmsContactPageContent;
}
```

---

## 5. High-Performance Caching, ETags & Realtime Sync

### 5.1 In-Memory Cache with Precise Invalidation
The backend maintains an in-memory `Map<string, { data: unknown; version: number; updatedAt: number }>`:
- When any section is updated via `PUT /api/cms/content/:key`:
  1. The section version is incremented.
  2. A snapshot is recorded in `CmsSectionVersion`.
  3. `cmsCache.delete(key)` and `cmsCache.delete('aggregated')` are executed.
  4. Socket.io broadcasts: `io.emit('cms:updated', { key, version, timestamp: Date.now() })`.

### 5.2 Deterministic ETag Specification
ETags are deterministic and avoid unstable object serialization hashing:
- For a section: `ETag: W/"sec-${key}-v${version}-${updatedAt.getTime()}"`
- For aggregated content: `ETag: W/"cms-agg-v${maxVersion}-${latestTimestamp}"`
- **Fastify Hook**: Checks `request.headers['if-none-match']`. If match, replies immediately with `304 Not Modified` and empty body (0ms latency, zero bandwidth).

### 5.3 Client-Side Multi-Tier Rendering (SWR) & Socket Reconnection
1. **Tier 1 (Instant Paint - 0ms)**: Static compiled `DEFAULT_CMS_CONTENT` renders synchronously on first tick. Zero layout shift, no blank screen.
2. **Tier 2 (LocalStorage Persistence)**: If a cached payload exists in `localStorage` (`ajda_cms_cache_v2`), the UI updates immediately.
3. **Tier 3 (Background Revalidation)**: `useCmsContent()` sends `If-None-Match: <etag>`. If 304, cache is fresh; if 200, state and `localStorage` update smoothly.
4. **Socket Reconnection Revalidation**:
   ```typescript
   // In useCmsContent.ts
   socket.on('connect', () => {
     // Always revalidate on connect/reconnect in case updates occurred while offline
     void revalidate();
   });
   socket.on('cms:updated', ({ key, version }) => {
     void revalidate();
   });
   ```

---

## 6. Action-Level Granular Permissions Model

### 6.1 Action-Level Permission Catalogue

```
                  ┌────────────────────────────────────────┐
                  │             SUPER_ADMIN                │
                  │        (Full System Access)            │
                  └───────────────────┬────────────────────┘
                                      │
              ┌───────────────────────┴───────────────────────┐
              ▼                                               ▼
┌───────────────────────────┐                   ┌───────────────────────────┐
│     PROJECTS DOMAIN       │                   │        CMS DOMAIN         │
├───────────────────────────┤                   ├───────────────────────────┤
│ viewProjects              │                   │ manageCms                 │
│ createProject             │                   │ manageClients             │
│ editProject               │                   │ rollbackCms               │
│ deleteProject             │                   │                           │
│ publishProject            │                   │                           │
└───────────────────────────┘                   └───────────────────────────┘
```

| Permission Key | Group | Label (AR) | Label (EN) | Description |
|---|---|---|---|---|
| `viewProjects` | Projects | استعراض المشاريع | View Projects | عرض قائمة المشاريع باللوحة (المسودات والمخفية) |
| `createProject` | Projects | إضافة مشاريع جديدة | Create Projects | إنشاء مشروع جديد كمسودة أو منشور |
| `editProject` | Projects | تعديل المشاريع | Edit Projects | تعديل بيانات وأسعار المشاريع القائمة |
| `deleteProject` | Projects | حذف المشاريع | Delete Projects | حذف مشروع من النظام |
| `publishProject` | Projects | نشر/إخفاء المشاريع | Publish Projects | تبديل حالة النشر (draft / published / hidden) |
| `manageCms` | CMS | إدارة محتوى الموقع | Manage CMS | تعديل نصوص الصفحات، القائمة، والتذييل |
| `manageClients` | CMS | إدارة الشركاء والعملاء | Manage Clients | إضافة وتعديل وحذف الشركاء والشعارات |
| `rollbackCms` | CMS | استعادة نسخ المحتوى | Rollback CMS | استعادة نسخة سابقة من محتوى الأقسام |
| `manageUnits` | Units | إدارة الوحدات والأدوار | Manage Units | تعديل الأدوار وحالة الوحدات |
| `viewInquiries` | Inquiries | استعراض الطلبات | View Inquiries | متابعة وتحديث حالات طلبات العملاء |
| `exportData` | Reports | تصدير البيانات | Export Data | تصدير التقارير وسجلات العملاء كـ CSV |
| `manageUsers` | Users | إدارة المستخدمين | Manage Users | إضافة مستخدمين وتعديل صلاحياتهم |
| `manageNotifications` | Settings | إدارة الإشعارات | Manage Notifications | إعداد مستمعي التنبيهات البريدية |

### 6.2 Per-User Direct Assignment & Inheritance Algorithm
```typescript
export function hasPermission(admin: AuthenticatedAdmin | undefined, permission: AdminPermission): boolean {
  if (!admin) return false;
  
  // 1. Super Admin bypass
  if (admin.role === 'super_admin') return true;

  // 2. Direct per-user override check (highest precedence)
  if (admin.permissions[permission] !== undefined) {
    return admin.permissions[permission] === true;
  }

  // 3. Backward-compatibility role mapping
  if (permission === 'createProject' || permission === 'editProject' || permission === 'deleteProject' || permission === 'publishProject') {
    if (admin.permissions.manageProjects === true) return true;
  }
  if (permission === 'manageClients') {
    if (admin.permissions.manageCms === true) return true;
  }

  // 4. Default deny
  return false;
}
```

---

## 7. Fastify API Routes Specification & Validation Guards

All routes are registered under `/api/cms`:

| Method | Endpoint | Rate Limit | Access Guard | Description |
|---|---|---|---|---|
| `GET` | `/api/cms/content` | 120 / min | **Public** (ETag + 304) | Full aggregated CMS content |
| `GET` | `/api/cms/content/:key` | 120 / min | **Public** (ETag + 304) | Single section content |
| `PUT` | `/api/cms/content/:key` | 60 / min (Burst-friendly) | `manageCms` | Update a section & increment version (checks `featuredProjectId` if key === 'works') |
| `GET` | `/api/cms/content/:key/versions` | 60 / min | `manageCms` | Fetch last 10 version snapshots |
| `POST` | `/api/cms/content/:key/rollback/:version` | 30 / min | `rollbackCms` | Roll back section to previous version |
| `GET` | `/api/cms/clients` | 120 / min | **Public** | Fetch visible sorted clients |
| `GET` | `/api/cms/clients/all` | 60 / min | `manageClients` | Fetch all clients including hidden |
| `POST` | `/api/cms/clients` | 60 / min | `manageClients` | Create a new partner record |
| `PUT` | `/api/cms/clients/:id` | 60 / min | `manageClients` | Update an existing partner record |
| `DELETE` | `/api/cms/clients/:id` | 60 / min | `manageClients` | Delete a partner record |
| `PUT` | `/api/cms/clients/reorder` | 60 / min | `manageClients` | Reorder partner records |
| `DELETE` | `/api/cms/clients/bulk` | 30 / min | `manageClients` | Bulk delete selected partners |
| `PATCH` | `/api/cms/clients/bulk-visibility` | 30 / min | `manageClients` | Bulk show/hide selected partners |
| `GET` | `/api/cms/export` | 20 / min | `super_admin` | Export complete CMS JSON backup |
| `POST` | `/api/cms/import` | 10 / min | `super_admin` | Import complete CMS JSON (staging→prod) |

### 7.1 Referential Integrity Guard for `featuredProjectId`
In `PUT /api/cms/content/works`:
```typescript
if (body.featuredProjectId) {
  const project = await prisma.project.findUnique({ where: { id: body.featuredProjectId } });
  if (!project) {
    return reply.status(400).send({
      error: `المشروع المميز المحدد برقم (${body.featuredProjectId}) غير موجود في النظام.`,
    });
  }
}
```

---

## 8. Admin Dashboard CMS Management Suite

A dedicated **إدارة محتوى الموقع (Site CMS)** navigation entry is added to `AdminSidebar.tsx` and `AdminDashboardPage.tsx`, divided into 6 intuitive panels:

1. **الهوية والتذييل (Identity & Footer Panel)**:
   - Text under logo in Arabic and English.
   - Contact info editor (Phone, WhatsApp, Email, Address, Working Hours).
   - Instant toggle switches (`enabled / disabled`) for each contact element.
   - **Dynamic Social Media Manager**: List of platforms with Add New, Edit Name/URL, Icon Selector, Reorder, and Enable/Disable.
   - Copyright and "Made in KSA" text editors.
2. **القائمة العلوية (Navbar Panel)**:
   - Reorderable list of navigation links with AR/EN labels.
   - Link destination selector (`home`, `works`, `clients`, `booking`, `contact`, or `custom URL`).
   - "Call to Action" button toggle.
   - Visibility switch.
3. **الصفحة الرئيسية (Home Page Sections Panel)**:
   - Master section toggles: Turn on/off Hero, Marquee, Map, About, Services, Process, Projects, Clients, or CTA.
   - Rich inputs for all headings, subheadings, badges, and button labels in AR & EN.
   - About section: YouTube video URL embed and values list editor.
   - Services & Process: Add, edit, remove, and reorder service cards and process steps.
4. **صفحة المشاريع (Works Page Panel)**:
   - Header titles and badges in AR & EN.
   - Featured Project Banner picker (with real DB project dropdown) and toggle.
   - Empty search results text customization.
5. **العملاء والشركاء (Clients & Partners Panel)**:
   - Header badge, title, subtitle, and stats bar editor.
   - Interactive Partner Cards & Table view.
   - Modal for Add / Edit Partner:
     - Logo uploader (integrates with `/api/media/upload`).
     - Partner name (AR & EN).
     - Business sector (AR & EN).
     - Bio / description (AR & EN).
     - Tags / badges (chip input).
     - Website link.
     - Active / Hidden toggle.
6. **صفحة التواصل (Contact Page Panel)**:
   - Header title, description, and form title.
   - Inquiry dropdown subjects list manager (Add/Edit/Remove subject options).

### 8.1 Version History & 1-Click Rollback Modal UI Spec
Each section panel includes a **"سجل التعديلات (Version History)"** button opening a modal:
- **List View**: Displays last 10 versions with: `[إصدار #]` `[التاريخ والوقت]` `[اسم المشرف]` `[شارة النسخة الحالية]`.
- **Read-Only Preview**: Side-by-side inspection of Arabic and English texts at that point in time.
- **Visual Diff Highlight**: Fields that differ from the current live version are highlighted with an accent badge.
- **Rollback Button**: `"استعادة هذه النسخة"` with confirmation dialog. Triggers `POST /api/cms/content/:key/rollback/:version`, restores the content, increments version, and live updates the public site.

---

## 9. Security, Sanitization & Media Lifecycle

### 9.1 Input Sanitization & XSS Prevention
- All string fields are validated via Zod with `.trim()`, `.min()`, `.max()`.
- External URLs are strictly validated to prevent `javascript:` or data-URI exploits: `externalUrl = z.union([z.literal(''), z.string().trim().url().startsWith('https://')])`.
- Plain textfields are escaped on render. No unsanitized `dangerouslySetInnerHTML` is used.

### 9.2 Rate Limiting
- Rate limiting is applied per-route via `@fastify/rate-limit`. Write endpoints (`PUT`, `POST`, `DELETE`) allow 60 requests/minute to allow rapid admin multi-field changes while guarding against brute-force attacks.

### 9.3 Media Lifecycle & Sharp Processing
- Image uploads (client logos, hero backgrounds, video cover images) go through `/api/media/upload`.
- The backend Sharp pipeline compresses images, strips EXIF metadata, and outputs standardized `.webp` assets.
- If a client is deleted, its logo path is inspected: if it resides under `/uploads/` and is unreferenced by other records, it is safely purged from disk during scheduled maintenance.

---

## 10. Phased Implementation Roadmap & Multi-Agent Execution

### Phase 1: Database Migration & Core Backend (Antigravity)
1. Add `CmsSection`, `CmsSectionVersion`, and `CmsClient` to `server/prisma/schema.prisma`.
2. Run `npx prisma db push` and `npx prisma generate`.
3. Create `server/src/schemas/cms.schema.ts` (Zod source of truth).
4. Update `server/src/config/permissions.ts` and `server/src/middleware/auth.ts` with granular permissions.
5. Create `server/src/services/cmsService.ts` (In-memory cache, versioning, rollback, client CRUD, initial auto-seed from `DEFAULT_CMS_CONTENT`).
6. Create `server/src/routes/cms.routes.ts` and register in `server/src/app.ts`.
7. Commit to `feat/backend-admin` and push/sync to `feat/opencode-worker`.

### Phase 2: Parallel Work Execution
- **OpenCode Worker (`D:\projects\html\ajda-opencode`)**:
  - Implement `src/services/cmsService.ts` and `src/hooks/useCmsContent.ts` (SWR + LocalStorage + socket reconnect revalidation).
  - Wire `Navbar.tsx` and `Footer.tsx` to dynamic CMS content.
  - Wire `HomePage.tsx` and all 9 section components (`HeroSection`, `Marquee`, `AboutSection`, `ServicesSection`, `ProcessSection`, `ProjectsSection`, `ClientsSection`, `CtaSection`) with `enabled` toggles.
  - Wire `WorksPage.tsx` and `ClientsPage.tsx` to dynamic data.
- **Antigravity Main Agent (`d:\projects\html\ajda`)**:
  - Build the Admin Dashboard CMS Suite (`src/pages/admin/sections/CmsSection.tsx` and sub-panels: Identity & Footer, Navbar, Home Sections, Works Page, Clients CRUD, and Contact Page).
  - Build Version History and Rollback UI modal.
  - Update user management with granular permission checkboxes.

### Phase 3: Review, Quality Gates & Integration
1. Review `git diff feat/backend-admin..feat/opencode-worker`.
2. Merge worktree into `feat/backend-admin`.
3. Run verification gates:
   - `npx tsc -p tsconfig.app.json --noEmit`
   - `tsc -p server/tsconfig.json --noEmit`
   - `npm run lint`
   - `npm run build`
4. Clean up `opencode-task.md` and `opencode-response.md`.
5. Update `refactor.md` and commit with descriptive milestone log.

---

*Architectural Plan v2.1 Final — Approved & Ready for Execution.*

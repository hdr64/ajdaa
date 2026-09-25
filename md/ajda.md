# Directory Structure: `ajda`

- **Source Folder**: `D:\projects\html\ajda`

## Directory Tree

```
ajda/
├── public/
├── screenshots/
├── server/
│   ├── prisma/
│   │   ├── migrations/
│   │   │   ├── 20260923190412_init/
│   │   │   │   └── migration.sql
│   │   │   └── migration_lock.toml
│   │   ├── seed-data/
│   │   │   └── projects.seed.ts
│   │   ├── schema.postgresql.prisma
│   │   ├── schema.prisma
│   │   └── seed.ts
│   ├── scripts/
│   │   ├── generate-prod-schema.mjs
│   │   └── sync-data.mjs
│   ├── src/
│   │   ├── config/
│   │   │   ├── constants.ts
│   │   │   └── env.ts
│   │   ├── middleware/
│   │   │   ├── auth.ts
│   │   │   └── validate.ts
│   │   ├── routes/
│   │   │   ├── auth.routes.ts
│   │   │   ├── inquiries.routes.ts
│   │   │   ├── media.routes.ts
│   │   │   ├── projects.routes.ts
│   │   │   └── units.routes.ts
│   │   ├── services/
│   │   │   ├── mediaService.ts
│   │   │   ├── prisma.ts
│   │   │   └── serializers.ts
│   │   ├── sockets/
│   │   │   └── index.ts
│   │   ├── types/
│   │   │   └── fastify.d.ts
│   │   ├── app.ts
│   │   └── server.ts
│   ├── uploads/
│   ├── package.json
│   └── tsconfig.json
├── src/
│   ├── assets/
│   │   ├── ajda/
│   │   │   ├── festa/
│   │   │   ├── line/
│   │   │   └── prime/
│   │   ├── ajda1/
│   │   ├── bg/
│   │   ├── clients/
│   │   ├── imgs/
│   │   └── logos/
│   ├── components/
│   │   ├── admin/
│   │   │   ├── BuildingVisualizer.tsx
│   │   │   └── UsersPermissionsManager.tsx
│   │   ├── booking/
│   │   │   ├── BookingView.tsx
│   │   │   └── InterestRegistrationView.tsx
│   │   ├── common/
│   │   │   ├── BackgroundDecor.tsx
│   │   │   ├── Footer.tsx
│   │   │   ├── LanguageToggle.tsx
│   │   │   ├── Navbar.tsx
│   │   │   ├── PropertyCard.tsx
│   │   │   ├── PropertyModal.tsx
│   │   │   ├── Reveal.tsx
│   │   │   ├── ThemeToggle.tsx
│   │   │   └── ThemeVariantToggle.tsx
│   │   ├── contact/
│   │   │   └── ContactPage.tsx
│   │   ├── home/
│   │   │   ├── AboutSection.tsx
│   │   │   ├── ClientsSection.tsx
│   │   │   ├── CtaSection.tsx
│   │   │   ├── HeroScene.tsx
│   │   │   ├── HeroSection.tsx
│   │   │   ├── InteractiveProjectsMap.tsx
│   │   │   ├── Marquee.tsx
│   │   │   ├── ProcessSection.tsx
│   │   │   ├── ProjectsSec.tsx
│   │   │   ├── ProjectsSection.tsx
│   │   │   ├── ServicesSection.tsx
│   │   │   ├── StatsSection.tsx
│   │   │   ├── Testimonials.tsx
│   │   │   └── VideoSection.tsx
│   │   └── works/
│   │       └── WorksPage.tsx
│   ├── context/
│   │   ├── LanguageContext.tsx
│   │   ├── languageContextDef.ts
│   │   ├── themeContextDef.ts
│   │   └── ThemeProvider.tsx
│   ├── hooks/
│   │   ├── useCounter.ts
│   │   ├── useIntersection.ts
│   │   ├── useLanguage.ts
│   │   └── useTheme.ts
│   ├── i18n/
│   │   └── translations.ts
│   ├── pages/
│   │   ├── admin/
│   │   │   ├── AdminDashboardPage.tsx
│   │   │   └── AdminLoginPage.tsx
│   │   ├── ClientsPage.tsx
│   │   ├── HomePage.tsx
│   │   ├── index.ts
│   │   └── ProjectDetailPage.tsx
│   ├── services/
│   │   ├── adminStorage.ts
│   │   └── googleMaps.ts
│   ├── types/
│   │   └── property.ts
│   ├── App.css
│   ├── App.tsx
│   ├── index.css
│   ├── main.tsx
│   └── vite-env.d.ts
├── a.txt
├── docker-compose.dev.yml
├── g.py
├── index.html
├── package.json
├── tsconfig.app.json
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts
```


# Public site content inventory (Phase 9, step 1)

> Goal of Phase 9: every piece of public content editable from the admin dashboard, every
> change logged with its author, and any change undoable. This file is the input for the
> content model; review it before anything is built. Audited 2026-09-29 on `feat/backend-admin`.

## 1. Key findings

| # | Finding | Impact |
|---|---|---|
| F1 | **The contact form and footer newsletter are fake.** `ContactPage.handleSubmit` waits 900 ms and shows "تم إرسال رسالتك بنجاح"; the newsletter shows a success toast. Neither sends anything. | Every contact-form lead is lost today. **Fix before launch**, independent of the CMS. |
| F2 | Content lives in **four different styles**: `i18n/translations.ts`; ~450 inline `isAr ? 'نص' : 'text'` pairs; hard-coded arrays inside components; data from the API (projects only). | A CMS can't point at one place; content must be consolidated first. |
| F3 | `translations.ts` is **mostly dead**: ~49 of ~186 keys per language are used. The `services`, `process`, `stats`, `projects`, `clients`, `cta`, `booking`, `contact`, `modal` sections are defined but the pages repeat the text inline instead. | Editing the file changes nothing on those pages; two copies drift. |
| F4 | **Contact details are duplicated in 6 files** (Navbar, Footer, ContactPage, CTA/clients sections, InterestRegistrationView, ProjectDetail): phone `+966 58 048 4528`, WhatsApp `966580484528`, `info@ajdaa.sa`, 5 social links. | Changing the phone number means editing 6 files. First candidate for "site settings". |
| F5 | **The client list is defined twice** (`ClientsSection` 6 clients, `ClientsPage` `CLIENTS_LIST`), plus a stats list in `ClientsPage`. | Same partner can differ between home and clients page. |
| F6 | **Cities are hard-coded three different ways**: map switcher (Riyadh, Al-Ahsa centres), marquee strip (9 names), and free-text `project.city`. | Matches the requested curated cities list. |
| F7 | **~1,300 lines of dead UI**: `StatsSection`, `Testimonials`, `VideoSection` (commented out), `ProjectsSec`, `BookingView`, `PropertyModal` (rendered but nothing ever opens it). | Delete before the CMS work; also removes 3 of the 4 lint warnings. |
| F8 | `ContactPage` is **Arabic-only** (no English strings at all) although the site has a language switch. | English visitors see Arabic. |
| F9 | `AboutSection` hard-codes a video (`Ti7MQxfmNWY`) labelled "أجدا برايم", but Ajda Prime's video is now `fAK0waC6yDc`. | Stale content; would be fixed by pointing the section at a project record. |
| F10 | SEO is one static `<title>` in `index.html`; no description, no Open Graph, no per-page titles. | Should be editable per page. |

## 2. Content types the model needs

| Type | Examples | Storage proposal |
|---|---|---|
| **Site settings** (singleton) | phones, WhatsApp, email, address, working hours, social links, logos (AR/EN × light/dark), default SEO | `SiteSetting` rows keyed `contact.phone`, `social.instagram`, … (typed value, AR/EN where text) |
| **Page copy** | hero title/subtitle, section headings, button labels, CTA text | `SiteContent` rows keyed `home.hero.title` with `ar` / `en` values |
| **Collections** (ordered lists) | services, process steps, values, stats, clients/partners, footer service links, contact-page highlights & subjects, marquee cities | One table per collection or typed JSON blocks with a zod schema per key; each item has `order` and `visible` |
| **Media** | hero image, about image, client logos, logos | Already have `/api/media/upload`; content stores the `/uploads/...` URL |
| **Section layout** | show/hide and order of home sections | `PageSection` rows: page, key, order, visible |
| **Reference data** | cities, project types, sub-categories | Dedicated tables (already in the TODO) |
| **Records** | projects, floors, units, inquiries | Already in the database |

## 3. Page-by-page inventory

Legend for **Source today**: `T` = translations.ts, `I` = inline AR/EN pair in the component, `H` = hard-coded array in the component, `API` = database, `A` = imported asset, `AR` = Arabic only.

### Global chrome

| Section | Content | Source today | Proposed |
|---|---|---|---|
| Navbar | brand name/tagline, menu labels, phone, WhatsApp, "book now" | T + I | page copy + site settings |
| Navbar | 4 logo variants (AR/EN × light/dark) | A | site settings (media) |
| Footer | brand description, link labels, services list (5), address, phone, email, hours, copyright, "made in" | T | page copy + site settings + collection |
| Footer | 5 social links + WhatsApp | H (duplicated) | site settings |
| Footer | newsletter | **fake** (F1) | real endpoint + subscribers list in admin, or remove |

### Home (`/`)

| Order | Section | Content | Source today | Proposed |
|---|---|---|---|---|
| 1 | Hero | badge, 2-line title, subtitle, 2 buttons, filter labels | T | page copy |
| 1 | Hero | background image | A | media |
| 2 | Marquee | 9 city names | H, AR | cities list (F6) |
| 3 | Projects map | heading, filter chips, legend | I | page copy; types from project-types table |
| 3 | Projects map | region switcher (Riyadh, Al-Ahsa) | H | cities list with coordinates |
| 3 | Projects map | projects, videos, coordinates | API | — |
| 4 | About | badge, title, story paragraphs ×3, vision, mission | T | page copy |
| 4 | About | values (5 items), official stats (3 items) | T (arrays) | collections |
| 4 | About | featured image + video + caption | A + H (stale, F9) | pick a featured project, or media + video URL |
| 5 | Services | heading, intro, 4 services (title, text, icon), button | H + I | collection + page copy |
| 6 | Process | heading, intro, 4 steps | H + I | collection + page copy |
| 7 | Projects | heading, filter chips | I | page copy; project types |
| 7 | Projects | project cards | API | — |
| 8 | Clients | heading, intro, 6 partners (logo, name, sector), CTA | H + I (duplicate of F5) | partners collection |
| 9 | CTA | text, 2 buttons | I | page copy |

### Works (`/works`)

| Section | Content | Source today | Proposed |
|---|---|---|---|
| Filters | labels, city/type/price options | I (+4 T keys) | page copy; cities + types from tables |
| Featured banner | chosen project, texts | API + I | "featured project" setting |
| Grid / list | project cards | API | — |

### Project detail (`/projects/:id`)

| Section | Content | Source today | Proposed |
|---|---|---|---|
| All data | title, gallery, video, description, features, location highlights, floors/units | API | already editable in the admin |
| Labels | ~63 inline pairs (tabs, buttons, "3D tour coming soon", section titles) | I | page copy (shared "project page" namespace) |

### Clients (`/clients`)

| Section | Content | Source today | Proposed |
|---|---|---|---|
| Header | title, intro | I | page copy |
| Partners directory | `CLIENTS_LIST` (logo, name, sector, description…) | H (duplicate, F5) | partners collection (same as home) |
| Stats | 4 stats (value + label) | H | collection |
| CTA | heading, text, WhatsApp | I + H | page copy + site settings |

### Register interest (`/booking`)

| Section | Content | Source today | Proposed |
|---|---|---|---|
| Header, stepper, form labels, success text | ~28 inline pairs | I | page copy |
| Filters | 6 type chips | I | project types table |
| WhatsApp link | `966580484528` | H (F4) | site settings |

### Contact (`/contact`)

| Section | Content | Source today | Proposed |
|---|---|---|---|
| Header, form labels, success text | 28 literals | I, **AR only** (F8) | page copy (add English) |
| Contact items (phone, email, address, hours) | `contactItems` | H (F4) | site settings |
| Social links | `socialLinks` | H (F4) | site settings |
| Highlights, form subjects | `highlights`, `subjects` | H | collections |
| Form submit | **fake** (F1) | — | real endpoint → admin inquiries (or a separate "messages" inbox) |

### SEO

| Page | Today | Proposed |
|---|---|---|
| All pages | one static `<title>` | per-page title + description (AR/EN) + share image, in page copy |

## 4. Recommended order

1. **Fix F1 now** (small, independent): contact form → `POST /api/inquiries` with `interestType: general` and the subject/message, so messages land in the admin inquiries list; newsletter → store subscribers or remove the form.
2. **Delete dead code (F7)**, then **fix F8** (English contact page).
3. **Site settings** (F4) — smallest CMS slice with the biggest payoff: one admin screen for contact details, social links and logos, used by all 6 places.
4. **Reference data** already in the TODO: cities (F6), project types, sub-categories.
5. **Collections**: partners (merging F5), services, process, values, stats.
6. **Page copy** + section order/visibility, replacing `translations.ts` and the inline pairs page by page (current text becomes the seed and the fallback, so the site never renders blank).
7. **Activity log + undo** across all of the above and the existing admin writes (plan in `refactor.md`, Phase 9 §3–4).

## 5. Decisions needed from the owner

- Contact-form messages: into the existing **inquiries** list (simplest, one inbox) or a separate **messages** inbox?
- Newsletter: keep it (then who sends newsletters, with what tool?) or remove the form?
- Should the About section show a chosen **project** (image + video follow that project) or free media?
- Is English required for **every** page before launch (Contact page is Arabic-only today)?

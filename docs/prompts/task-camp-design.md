# Campaign manager: decided design (owner request 2026-11-14)

Single source of truth for prompts `task-camp-a`, `task-camp-b`, `task-camp-c`. Do not copy this text elsewhere; link to it.

## Goal
An admin creates a **campaign** for a project (for example a newly launched one) that is shown on the public site for a fixed period, in up to four placements, with impression and click counts per placement.

## Data model (task a)
`Campaign` (`@@map("campaigns")`):

| Field | Type | Notes |
|---|---|---|
| id | Int autoincrement | |
| projectId | Int | relation to `Project`, `onDelete: Cascade`, indexed |
| headline, headlineEn | String, String? | headline required (Arabic), 1 to 120 chars |
| subline, sublineEn | String?, String? | max 240 chars |
| ctaLabel, ctaLabelEn | String?, String? | max 40 chars; empty means the client default label |
| image | String? | same URL rule as `PastProject.image` (`https://` or `/uploads/`); null means use the project image |
| showHero, showBadge, showBar, showPopup | Boolean | defaults true, true, false, false; at least one must be true |
| startsAt, endsAt | DateTime | both required, `endsAt` strictly after `startsAt` |
| active | Boolean | default true (admin pause switch) |
| sortOrder | Int | default 0, lower first |
| createdAt, updatedAt | DateTime | |

Index `[active, startsAt, endsAt]`.

`CampaignStat` (`@@map("campaign_stats")`): id Int autoincrement, campaignId Int (relation, `onDelete: Cascade`), `day` String (UTC `YYYY-MM-DD`, a string so SQLite and PostgreSQL behave the same), `placement` String (`hero` | `badge` | `bar` | `popup`), `impressions` Int default 0, `clicks` Int default 0, `@@unique([campaignId, day, placement])`.

Status is derived, never stored: `paused` (active false), `scheduled` (now before startsAt), `live`, `ended` (now after endsAt).

Permission: new `manageCampaigns` (group `cms`, AR "إدارة الحملات التسويقية", EN "Manage Campaigns"), registered everywhere `managePastProjects` is.

## API contract (task a builds it; b and c consume it)
Prefix `/api/campaigns`. Register `/admin...` routes so they are not shadowed by `/:id`.

Public:
- `GET /api/campaigns/active`: campaigns with `active`, `startsAt <= now <= endsAt`, and `project.publishStatus = 'published'`, ordered `sortOrder asc, id desc`, max 20. Header `Cache-Control: public, max-age=60`. Item shape:
  `{ id, projectId, headline, headlineEn, subline, sublineEn, ctaLabel, ctaLabelEn, image, placements: { hero, badge, bar, popup }, startsAt, endsAt }` where `image` is already resolved (`campaign.image ?? project.image`). No stats, no admin fields.
- `POST /api/campaigns/:id/events`, body `{ placement: 'hero'|'badge'|'bar'|'popup', type: 'impression'|'click' }`. Rate limited per IP with a new env pair `RATE_LIMIT_CAMPAIGN_EVENTS_MAX` (default 120) and `RATE_LIMIT_CAMPAIGN_EVENTS_WINDOW_MS` (default 60000), wired like the newsletter limits (env.ts, `.env.example`, docs). Malformed body gives 400. A valid body for an unknown, not-live, or placement-disabled campaign gives 204 and changes nothing (do not reveal state). Otherwise upsert the `(campaignId, today UTC, placement)` row and increment, answer 204. No cookies, no IP stored, no user data.

Admin (`authenticate` + `requirePermission('manageCampaigns')`):
- `GET /api/campaigns/admin`: all campaigns, newest first, each with `project: { id, title, titleEn }`, derived `status`, and `totals: { impressions, clicks }` summed over all placements and days.
- `GET /api/campaigns/admin/:id/stats?days=30` (1 to 365, default 30): `{ rows: [{ day, placement, impressions, clicks }], totals: { [placement]: { impressions, clicks } } }`.
- `POST /api/campaigns`, `PUT /api/campaigns/:id` (partial), `PATCH /api/campaigns/:id/active` (`{ active }`), `DELETE /api/campaigns/:id`. Create and update return the same shape as an item of the admin list. The project must exist (404-style validation error otherwise).

## Public behaviour (task c)
- **Hero**: ONE banner, the first live campaign with `placements.hero`, right after the home hero section.
- **Badge**: a "New" / "جديد" ribbon on every project card (home and `PropertyCard`) whose project has a live campaign with `placements.badge`.
- **Bar**: ONE line in the top announcement stack from the first live campaign with `placements.bar`. The site announcement (settings) wins: the campaign bar shows only when the announcement is not visible.
- **Popup**: ONE non-blocking card from the first live campaign with `placements.popup`: bottom sheet on mobile, bottom-corner card on desktop, no backdrop and no scroll lock. Appears 6 seconds after load, at most once per browser session; closing it suppresses that campaign for 7 days (`localStorage`). Never on the campaign's own project page, never in the admin shell or the CMS preview iframe.
- A click on any placement opens the campaign's project page through the app's existing project navigation and records a `click` event.
- Impressions: once per browser session per (campaign, placement), recorded when the placement is actually visible (hero and badge at 50% in the viewport, bar and popup when shown). Nothing is recorded inside the CMS preview iframe.
- All text is bilingual with fallback to the other language when one is empty; default CTA label "Explore the project" / "استكشف المشروع".

## Admin behaviour (task b)
New sidebar item "Campaigns" / "الحملات التسويقية" (permission `manageCampaigns`): list with status badge, project, period, placements, impressions, clicks, CTR; create/edit dialog (project select, headline and subline AR/EN, CTA labels, optional image from the media picker with the project image as the visible default, four placement checkboxes, start and end `datetime-local`, active, sort order); pause/resume; stats dialog (last 30 days table per placement, totals); delete with confirmation. No chart library.

## Out of scope for the whole feature
UTM/external links, A/B tests, per-user targeting, emails, a campaign for non-project targets, scheduled push, chart libraries, editing the existing announcement bar settings.

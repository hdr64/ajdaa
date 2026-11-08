---
trigger: "when working on media, uploads, storage, projects, CMS, or database migrations"
always_on: true
description: "Rules for permanent media URLs, strict SEO image protection, unlinking vs deleting, and zero live data destruction."
---

# SEO Asset Permanence, Unlinking, and Data Safety Rules

## 1. Permanent Media URLs (Google SEO Stability)
- Media URLs (e.g. `/uploads/...`) are indexed directly by Google Search and Google Images.
- Never change or break existing media URLs. Keep URL formats consistent and permanent.
- Never delete any media file that is linked to an active entity (`Project`, `PastProject`, `CmsClient`, `CmsSection`, `AdminUser`, `DeveloperNote`, `AppSetting`).
- Backend routes must return `409 Conflict` if deletion of a referenced media asset is attempted, listing referencing entity names.
- Physical media deletion is only permitted for orphaned assets (`usageCount === 0`) directly from the Media Library.

## 2. Unlink vs. Delete Discipline
- In form editors (e.g., `ProjectEditSection`, `ProjectCreateModal`, `PastProjectFormDialog`, `CmsClientsPanel`), clicking "Remove" or "X" on an image, brochure, or model **MUST ONLY UNLINK** the field in the form state.
- Unlinking from a project must NEVER call `DELETE /api/media/:id` or delete the underlying file from disk. The asset remains preserved in the Media Library for future reuse.

## 3. Live Data Safety & Database Changes
- Never drop existing tables, columns, or files containing live user/project data.
- All migrations must be additive and include backward-compatible default values or backfill SQL for existing records (e.g. backfilling permissions for super admins).
- Tests must strictly run in isolated temporary environments and never connect to `dev.db` or production databases.

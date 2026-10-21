-- Sanitize a copy of the production database for the TEST instance.
--
--   sudo -u postgres psql -d ajda_test -f /srv/ajda/test/deploy/sanitize-test-db.sql
--
-- Run it only against `ajda_test`, never against `ajda`. It is idempotent, so
-- it can be re-run after every reseed. It never touches production data.
--
-- What it does:
--   * replaces every admin identity with a test identity and a known password
--   * deletes every one-time code / password-reset token
--   * anonymizes customer leads (name, e-mail, phone, message)
--   * anonymizes newsletter subscribers
--   * deletes stored SMTP credentials and notification configuration
--   * strips admin names / e-mails from developer notes
--   * deletes every job application (personal data: name, e-mail, phone, CV)
--
-- The admin password below is the bcrypt hash of "AjdaTest!2026" (cost 10).
-- The same value can be produced by the seed with
--   SEED_ADMIN_PASSWORD='AjdaTest!2026' npm --prefix server run db:seed
-- (run the seed BEFORE this script: the seed rewrites the admin e-mails to
-- their real values).

\set ON_ERROR_STOP on

BEGIN;

-- 1. Admin accounts ------------------------------------------------------------
-- "id" is a uuid, so the generated e-mail stays unique.
UPDATE "AdminUser" SET
  "email" = 'test-admin-' || "id" || '@example.test',
  "passwordHash" = '$2b$10$7FEvGHJZfG8o/rJcwfqWSOBcBkvHgpTxvrrh8P1dvKlbgC/joxj6S',
  "name" = 'Test Admin',
  "phone" = NULL,
  "lastLogin" = NULL,
  "passwordChangedAt" = NULL,
  "loginOtpEnabled" = false;

-- 2. One-time codes and password-reset tokens ---------------------------------
DELETE FROM "OtpChallenge";

-- 3. Customer inquiries (leads) ------------------------------------------------
UPDATE "CustomerInquiry" SET
  "name" = 'Test Lead ' || "id",
  "email" = 'test-lead-' || "id" || '@example.test',
  "phone" = NULL,
  "message" = NULL,
  "notes" = NULL;

-- 4. Newsletter subscribers ----------------------------------------------------
UPDATE "NewsletterSubscriber" SET
  "email" = 'test-subscriber-' || "id" || '@example.test';

-- 5. Stored secrets ------------------------------------------------------------
-- "mail" holds the SMTP credentials (encrypted with SETTINGS_ENCRYPTION_KEY);
-- "notifications" holds the notification listener configuration, which can
-- contain real e-mail addresses. Both are deleted — the admin UI recreates
-- them, empty, on the test instance.
DELETE FROM "AppSetting" WHERE "key" IN ('mail', 'notifications');

-- 6. Notification listeners ----------------------------------------------------
-- Disabled and emptied: no real recipient can ever be notified from the test
-- instance.
UPDATE "NotificationListener" SET
  "enabled" = false,
  "config" = '{}';

-- 7. Developer notes ------------------------------------------------------------
-- Internal notes can carry the reporting admin's name, e-mail and a browser
-- fingerprint. (The model DeveloperNote is mapped to the table
-- "developer_notes".)
UPDATE "developer_notes" SET
  "adminName" = NULL,
  "adminEmail" = NULL,
  "metadata" = NULL;

-- 8. Foundation tables (may not exist yet) -------------------------------------
-- The tables of the foundation lane are handled defensively: each statement is
-- skipped when the table is not in the database, so the script also runs on a
-- database that has not been migrated with the new schema yet.
--
-- Job applications are personal data (name, e-mail, phone, cover letter, CV):
-- they must never be copied to the test instance, so the rows are deleted
-- instead of anonymized. The CV files themselves live in the upload directory
-- and are not touched here - remove them by hand from the copied uploads.
DO $$
BEGIN
  IF to_regclass('public.job_applications') IS NOT NULL THEN
    DELETE FROM job_applications;
  END IF;
END $$;

-- "past_projects" holds the published portfolio entries (title, images, PDF):
-- no personal data, so the rows are kept as they are.

COMMIT;

-- Sanity check: run this after the script.
--   SELECT count(*) FROM "AdminUser" WHERE "email" LIKE '%@ajdaa.sa';
--   SELECT count(*) FROM "CustomerInquiry" WHERE "email" LIKE '%@ajdaa.sa';
-- Both must be 0.

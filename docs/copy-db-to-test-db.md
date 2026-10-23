1. Create the test DB once (skip if it exists):
sudo -u postgres psql <<'SQL'
CREATE ROLE ajda_test LOGIN PASSWORD '<long random password>';
CREATE DATABASE ajda_test OWNER ajda_test ENCODING 'UTF8';
SQL

2. Dump production (read-only):
sudo -u postgres pg_dump -Fc -d ajda --file=/tmp/ajda-prod.dump

3. Restore into the test DB, never ajda:
sudo -u postgres pg_restore --no-owner --no-privileges --role=ajda_test -d ajda_test /tmp/ajda-prod.dump
sudo rm -f /tmp/ajda-prod.dump

4. Sanitize, which you must always do after step 3:
sudo -u postgres psql -d ajda_test -f /srv/ajda/test/deploy/sanitize-test-db.sql
The script:
- rewrites all admin emails to test-admin-<uuid>@example.test with the test password AjdaTest!2026;
- anonymizes inquiries and newsletter subscribers;
- deletes OTP codes, the stored SMTP credentials and job applications;
- disables the notification listeners.

Check afterwards that both of these counts are 0:
sudo -u postgres psql -d ajda_test -c "SELECT count(*) FROM \"AdminUser\" WHERE email LIKE '%@ajdaa.sa';"
sudo -u postgres psql -d ajda_test -c "SELECT count(*) FROM \"CustomerInquiry\" WHERE email LIKE '%@ajdaa.sa';"

5. Copy the uploads once, as a real copy, never a symlink:
sudo cp -a /srv/ajda/app/server/uploads/. /srv/ajda/test/server/uploads/

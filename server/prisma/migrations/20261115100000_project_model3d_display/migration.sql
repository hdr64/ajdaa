-- Per-project display of the interactive experience: 'modal' (window on the
-- page, the default) or 'tab' (new browser tab). Existing rows keep 'modal'.
ALTER TABLE "Project" ADD COLUMN "model3dDisplay" TEXT NOT NULL DEFAULT 'modal';

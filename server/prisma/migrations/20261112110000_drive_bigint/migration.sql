-- Drive files may be up to 5 GB: a 32-bit INTEGER tops out near 2.1 GB.
ALTER TABLE "drive_files" ALTER COLUMN "size" SET DATA TYPE BIGINT;

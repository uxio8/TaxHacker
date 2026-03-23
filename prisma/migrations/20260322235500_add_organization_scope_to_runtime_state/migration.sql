ALTER TABLE "files" ADD COLUMN "organization_id" UUID;
UPDATE "files" SET "organization_id" = "user_id" WHERE "organization_id" IS NULL;
ALTER TABLE "files" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "files"
  ADD CONSTRAINT "files_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "files_organization_id_idx" ON "files"("organization_id");
CREATE INDEX "files_organization_id_is_reviewed_created_at_idx"
  ON "files"("organization_id", "is_reviewed", "created_at");

ALTER TABLE "app_data" ADD COLUMN "organization_id" UUID;
UPDATE "app_data" SET "organization_id" = "user_id" WHERE "organization_id" IS NULL;
ALTER TABLE "app_data" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "app_data"
  ADD CONSTRAINT "app_data_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "app_data_organization_id_app_key" ON "app_data"("organization_id", "app");
CREATE INDEX "app_data_organization_id_idx" ON "app_data"("organization_id");

ALTER TABLE "progress" ADD COLUMN "organization_id" UUID;
UPDATE "progress" SET "organization_id" = "user_id" WHERE "organization_id" IS NULL;
ALTER TABLE "progress" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "progress"
  ADD CONSTRAINT "progress_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "progress_organization_id_idx" ON "progress"("organization_id");

ALTER TABLE "analysis_jobs" ADD COLUMN "organization_id" UUID;
UPDATE "analysis_jobs" SET "organization_id" = "user_id" WHERE "organization_id" IS NULL;
ALTER TABLE "analysis_jobs" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "analysis_jobs"
  ADD CONSTRAINT "analysis_jobs_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "analysis_jobs_organization_id_created_at_idx"
  ON "analysis_jobs"("organization_id", "created_at");

ALTER TABLE "settings" ADD COLUMN "organization_id" UUID;
UPDATE "settings" SET "organization_id" = "user_id" WHERE "organization_id" IS NULL;
ALTER TABLE "settings" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "settings" ADD CONSTRAINT "settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "settings_organization_id_idx" ON "settings"("organization_id");
CREATE UNIQUE INDEX "settings_organization_id_code_key" ON "settings"("organization_id", "code");

ALTER TABLE "categories" ADD COLUMN "organization_id" UUID;
UPDATE "categories" SET "organization_id" = "user_id" WHERE "organization_id" IS NULL;
ALTER TABLE "categories" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "categories" ADD CONSTRAINT "categories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "categories_organization_id_idx" ON "categories"("organization_id");
CREATE UNIQUE INDEX "categories_organization_id_code_key" ON "categories"("organization_id", "code");

ALTER TABLE "projects" ADD COLUMN "organization_id" UUID;
UPDATE "projects" SET "organization_id" = "user_id" WHERE "organization_id" IS NULL;
ALTER TABLE "projects" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "projects_organization_id_idx" ON "projects"("organization_id");
CREATE UNIQUE INDEX "projects_organization_id_code_key" ON "projects"("organization_id", "code");

ALTER TABLE "fields" ADD COLUMN "organization_id" UUID;
UPDATE "fields" SET "organization_id" = "user_id" WHERE "organization_id" IS NULL;
ALTER TABLE "fields" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "fields" ADD CONSTRAINT "fields_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "fields_organization_id_idx" ON "fields"("organization_id");
CREATE UNIQUE INDEX "fields_organization_id_code_key" ON "fields"("organization_id", "code");

ALTER TABLE "currencies" ADD COLUMN "organization_id" UUID;
UPDATE "currencies" SET "organization_id" = COALESCE("user_id", "organization_id") WHERE "organization_id" IS NULL;
ALTER TABLE "currencies" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "currencies" ADD CONSTRAINT "currencies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "currencies_organization_id_idx" ON "currencies"("organization_id");
CREATE UNIQUE INDEX "currencies_organization_id_code_key" ON "currencies"("organization_id", "code");

ALTER TABLE "transactions"
ADD COLUMN "organization_id" UUID;

UPDATE "transactions"
SET "organization_id" = "user_id"
WHERE "organization_id" IS NULL;

ALTER TABLE "transactions"
ALTER COLUMN "organization_id" SET NOT NULL;

ALTER TABLE "transactions"
ADD CONSTRAINT "transactions_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "transactions"
DROP CONSTRAINT "transactions_category_code_user_id_fkey";

ALTER TABLE "transactions"
DROP CONSTRAINT "transactions_project_code_user_id_fkey";

ALTER TABLE "transactions"
ADD CONSTRAINT "transactions_category_code_organization_id_fkey"
FOREIGN KEY ("category_code", "organization_id") REFERENCES "categories"("code", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "transactions"
ADD CONSTRAINT "transactions_project_code_organization_id_fkey"
FOREIGN KEY ("project_code", "organization_id") REFERENCES "projects"("code", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "transactions_id_organization_id_key"
ON "transactions"("id", "organization_id");

CREATE INDEX "transactions_organization_id_idx"
ON "transactions"("organization_id");

CREATE INDEX "transactions_organization_id_project_code_idx"
ON "transactions"("organization_id", "project_code");

CREATE INDEX "transactions_organization_id_category_code_idx"
ON "transactions"("organization_id", "category_code");

CREATE INDEX "transactions_organization_id_issued_at_idx"
ON "transactions"("organization_id", "issued_at");

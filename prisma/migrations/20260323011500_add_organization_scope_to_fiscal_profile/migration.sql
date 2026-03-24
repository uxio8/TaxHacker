ALTER TABLE "fiscal_profiles"
ADD COLUMN "organization_id" UUID;

UPDATE "fiscal_profiles" AS "fp"
SET "organization_id" = COALESCE("u"."default_organization_id", "u"."id")
FROM "users" AS "u"
WHERE "u"."id" = "fp"."user_id";

ALTER TABLE "fiscal_profiles"
ALTER COLUMN "organization_id" SET NOT NULL;

DROP INDEX IF EXISTS "fiscal_profiles_user_id_key";

CREATE UNIQUE INDEX "fiscal_profiles_organization_id_key"
ON "fiscal_profiles"("organization_id");

CREATE INDEX "fiscal_profiles_user_id_idx"
ON "fiscal_profiles"("user_id");

ALTER TABLE "fiscal_profiles"
ADD CONSTRAINT "fiscal_profiles_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

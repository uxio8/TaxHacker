-- CreateEnum
CREATE TYPE "Role" AS ENUM ('owner', 'admin', 'member');

-- AlterTable
ALTER TABLE "users"
    ADD COLUMN "default_organization_id" UUID;

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "role" "Role" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "memberships_user_id_organization_id_key" ON "memberships"("user_id", "organization_id");

-- CreateIndex
CREATE INDEX "memberships_user_id_idx" ON "memberships"("user_id");

-- CreateIndex
CREATE INDEX "memberships_organization_id_role_idx" ON "memberships"("organization_id", "role");

-- Backfill organizations
INSERT INTO "organizations" (
    "id",
    "name",
    "created_at",
    "updated_at"
)
SELECT
    "id",
    COALESCE(
        NULLIF(BTRIM("business_name"), ''),
        NULLIF(BTRIM("name"), ''),
        NULLIF(BTRIM(SPLIT_PART("email", '@', 1)), ''),
        'Organization'
    ),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "users"
WHERE NOT EXISTS (
    SELECT 1
    FROM "organizations"
    WHERE "organizations"."id" = "users"."id"
);

-- Backfill memberships
INSERT INTO "memberships" (
    "id",
    "user_id",
    "organization_id",
    "role",
    "created_at",
    "updated_at"
)
SELECT
    "id",
    "id",
    "id",
    'owner'::"Role",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "users"
WHERE NOT EXISTS (
    SELECT 1
    FROM "memberships"
    WHERE "memberships"."user_id" = "users"."id"
      AND "memberships"."organization_id" = "users"."id"
);

-- Backfill default organization reference
UPDATE "users"
SET "default_organization_id" = "id"
WHERE "default_organization_id" IS NULL;

-- AddForeignKey
ALTER TABLE "users"
    ADD CONSTRAINT "users_default_organization_id_fkey"
    FOREIGN KEY ("default_organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships"
    ADD CONSTRAINT "memberships_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships"
    ADD CONSTRAINT "memberships_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

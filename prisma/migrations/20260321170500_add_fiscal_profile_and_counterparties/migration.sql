-- CreateTable
CREATE TABLE "fiscal_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "company_name" TEXT NOT NULL,
    "tax_id" TEXT NOT NULL,
    "tax_id_normalized" TEXT NOT NULL,
    "country_code" TEXT NOT NULL DEFAULT 'ES',
    "currency_code" TEXT NOT NULL DEFAULT 'EUR',
    "legal_entity_type" TEXT NOT NULL DEFAULT 'spanish_sl',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fiscal_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "counterparties" (
    "id" UUID NOT NULL,
    "owner_scope_id" UUID NOT NULL,
    "canonical_identity_key" TEXT NOT NULL,
    "identity_basis" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "tax_id" TEXT,
    "tax_id_normalized" TEXT NOT NULL DEFAULT 'none',
    "country_code" TEXT NOT NULL DEFAULT 'ES',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "counterparties_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fiscal_profiles_user_id_key" ON "fiscal_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "counterparties_owner_scope_id_canonical_identity_key_key" ON "counterparties"("owner_scope_id", "canonical_identity_key");

-- CreateIndex
CREATE INDEX "counterparties_owner_scope_id_display_name_idx" ON "counterparties"("owner_scope_id", "display_name");

-- CreateIndex
CREATE INDEX "counterparties_owner_scope_id_tax_id_normalized_idx" ON "counterparties"("owner_scope_id", "tax_id_normalized");

-- Backfill
INSERT INTO "fiscal_profiles" (
    "id",
    "user_id",
    "company_name",
    "tax_id",
    "tax_id_normalized",
    "country_code",
    "currency_code",
    "legal_entity_type",
    "created_at",
    "updated_at"
)
SELECT
    "id",
    "id",
    COALESCE(NULLIF(BTRIM("business_name"), ''), NULLIF(BTRIM("name"), '')),
    UPPER(REGEXP_REPLACE(BTRIM("business_tax_id"), '[^A-Za-z0-9]+', '', 'g')),
    UPPER(REGEXP_REPLACE(BTRIM("business_tax_id"), '[^A-Za-z0-9]+', '', 'g')),
    'ES',
    'EUR',
    'spanish_sl',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "users"
WHERE NULLIF(BTRIM("business_tax_id"), '') IS NOT NULL
  AND COALESCE(NULLIF(BTRIM("business_name"), ''), NULLIF(BTRIM("name"), '')) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "fiscal_profiles"
    WHERE "fiscal_profiles"."user_id" = "users"."id"
  );

-- AddForeignKey
ALTER TABLE "fiscal_profiles" ADD CONSTRAINT "fiscal_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counterparties" ADD CONSTRAINT "counterparties_owner_scope_id_fkey" FOREIGN KEY ("owner_scope_id") REFERENCES "fiscal_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddCheckConstraint
ALTER TABLE "fiscal_profiles"
    ADD CONSTRAINT "fiscal_profiles_company_name_check" CHECK (length(BTRIM("company_name")) > 0),
    ADD CONSTRAINT "fiscal_profiles_country_code_check" CHECK ("country_code" = 'ES'),
    ADD CONSTRAINT "fiscal_profiles_currency_code_check" CHECK ("currency_code" = 'EUR'),
    ADD CONSTRAINT "fiscal_profiles_legal_entity_type_check" CHECK ("legal_entity_type" = 'spanish_sl'),
    ADD CONSTRAINT "fiscal_profiles_tax_id_check" CHECK (
      length(BTRIM("tax_id")) > 0
      AND length(BTRIM("tax_id_normalized")) > 0
      AND "tax_id" = "tax_id_normalized"
    );

-- AddCheckConstraint
ALTER TABLE "counterparties"
    ADD CONSTRAINT "counterparties_canonical_identity_key_check" CHECK (length(BTRIM("canonical_identity_key")) > 0),
    ADD CONSTRAINT "counterparties_country_code_check" CHECK ("country_code" = 'ES'),
    ADD CONSTRAINT "counterparties_display_name_check" CHECK (length(BTRIM("display_name")) > 0),
    ADD CONSTRAINT "counterparties_identity_basis_check" CHECK (
      (
        "identity_basis" = 'tax_id'
        AND "canonical_identity_key" LIKE 'ES:NIF:%'
        AND "tax_id" IS NOT NULL
        AND length(BTRIM("tax_id")) > 0
        AND "tax_id_normalized" <> 'none'
        AND "tax_id" = "tax_id_normalized"
      )
      OR (
        "identity_basis" = 'name_fallback'
        AND "canonical_identity_key" LIKE 'ES:NAME:%'
        AND "tax_id" IS NULL
        AND "tax_id_normalized" = 'none'
        AND length(BTRIM("normalized_name")) > 0
      )
    );

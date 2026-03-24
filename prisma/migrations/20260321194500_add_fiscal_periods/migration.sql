-- CreateTable
CREATE TABLE "fiscal_periods" (
    "id" UUID NOT NULL,
    "owner_scope_id" UUID NOT NULL,
    "fiscal_year" INTEGER NOT NULL,
    "quarter" INTEGER NOT NULL,
    "period_key" TEXT NOT NULL,
    "starts_on" DATE NOT NULL,
    "ends_on" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "country_code" TEXT NOT NULL DEFAULT 'ES',
    "currency_code" TEXT NOT NULL DEFAULT 'EUR',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fiscal_periods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fiscal_periods_owner_scope_id_period_key_key" ON "fiscal_periods"("owner_scope_id", "period_key");

-- CreateIndex
CREATE UNIQUE INDEX "fiscal_periods_owner_scope_id_fiscal_year_quarter_key" ON "fiscal_periods"("owner_scope_id", "fiscal_year", "quarter");

-- CreateIndex
CREATE INDEX "fiscal_periods_owner_scope_id_fiscal_year_idx" ON "fiscal_periods"("owner_scope_id", "fiscal_year");

-- CreateIndex
CREATE INDEX "fiscal_periods_owner_scope_id_status_idx" ON "fiscal_periods"("owner_scope_id", "status");

-- AddForeignKey
ALTER TABLE "fiscal_periods"
    ADD CONSTRAINT "fiscal_periods_owner_scope_id_fkey"
    FOREIGN KEY ("owner_scope_id") REFERENCES "fiscal_profiles"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddCheckConstraint
ALTER TABLE "fiscal_periods"
    ADD CONSTRAINT "fiscal_periods_fiscal_year_check" CHECK ("fiscal_year" >= 2000 AND "fiscal_year" <= 9999),
    ADD CONSTRAINT "fiscal_periods_quarter_check" CHECK ("quarter" >= 1 AND "quarter" <= 4),
    ADD CONSTRAINT "fiscal_periods_status_check" CHECK (
      "status" IN ('open', 'in_review', 'ready', 'presented', 'closed')
    ),
    ADD CONSTRAINT "fiscal_periods_country_code_check" CHECK ("country_code" = 'ES'),
    ADD CONSTRAINT "fiscal_periods_currency_code_check" CHECK ("currency_code" = 'EUR'),
    ADD CONSTRAINT "fiscal_periods_period_key_check" CHECK (
      "period_key" = ("fiscal_year"::text || '-Q' || "quarter"::text)
    ),
    ADD CONSTRAINT "fiscal_periods_date_range_check" CHECK ("starts_on" <= "ends_on");

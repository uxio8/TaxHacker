ALTER TABLE "fiscal_profiles"
ADD COLUMN "has_employees" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "has_rent_withholding" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "has_professional_withholding" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "has_intra_eu_operations" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "issues_invoices" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "annual_close_month" INTEGER NOT NULL DEFAULT 12;

CREATE TABLE "fiscal_obligations" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "owner_scope_id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "fiscal_year" INTEGER NOT NULL,
  "quarter" INTEGER,
  "period_key" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'waiting_on_documents',
  "due_date" DATE,
  "owner" TEXT NOT NULL DEFAULT 'advisor',
  "blocking_reasons" JSONB NOT NULL DEFAULT '[]',
  "required_evidence" JSONB NOT NULL DEFAULT '[]',
  "filing_reference" TEXT,
  "filed_at" TIMESTAMP(3),
  "filed_by_user_id" UUID,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "fiscal_obligations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "fiscal_obligations_organization_id_code_period_key_key"
ON "fiscal_obligations"("organization_id", "code", "period_key");

CREATE INDEX "fiscal_obligations_organization_id_period_key_idx"
ON "fiscal_obligations"("organization_id", "period_key");

CREATE INDEX "fiscal_obligations_owner_scope_id_fiscal_year_idx"
ON "fiscal_obligations"("owner_scope_id", "fiscal_year");

CREATE INDEX "fiscal_obligations_organization_id_status_idx"
ON "fiscal_obligations"("organization_id", "status");

ALTER TABLE "fiscal_obligations"
ADD CONSTRAINT "fiscal_obligations_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "fiscal_obligations"
ADD CONSTRAINT "fiscal_obligations_owner_scope_id_fkey"
FOREIGN KEY ("owner_scope_id") REFERENCES "fiscal_profiles"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "fiscal_obligations"
ADD CONSTRAINT "fiscal_obligations_filed_by_user_id_fkey"
FOREIGN KEY ("filed_by_user_id") REFERENCES "users"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

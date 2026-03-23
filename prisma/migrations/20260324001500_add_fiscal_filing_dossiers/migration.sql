CREATE TABLE "fiscal_filing_dossiers" (
    "id" UUID NOT NULL,
    "fiscal_obligation_id" UUID NOT NULL,
    "draft_snapshot" JSONB NOT NULL DEFAULT '{}',
    "evidence_manifest" JSONB NOT NULL DEFAULT '{}',
    "checklist_state" JSONB NOT NULL DEFAULT '{}',
    "filing_reference" TEXT,
    "filed_at" TIMESTAMP(3),
    "filed_by_user_id" UUID,
    "filing_receipt_file_id" UUID,
    "filing_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fiscal_filing_dossiers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "fiscal_filing_dossiers_fiscal_obligation_id_key" ON "fiscal_filing_dossiers"("fiscal_obligation_id");
CREATE INDEX "fiscal_filing_dossiers_filed_by_user_id_idx" ON "fiscal_filing_dossiers"("filed_by_user_id");
CREATE INDEX "fiscal_filing_dossiers_filing_receipt_file_id_idx" ON "fiscal_filing_dossiers"("filing_receipt_file_id");

ALTER TABLE "fiscal_filing_dossiers"
ADD CONSTRAINT "fiscal_filing_dossiers_fiscal_obligation_id_fkey"
FOREIGN KEY ("fiscal_obligation_id") REFERENCES "fiscal_obligations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "fiscal_filing_dossiers"
ADD CONSTRAINT "fiscal_filing_dossiers_filed_by_user_id_fkey"
FOREIGN KEY ("filed_by_user_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "fiscal_filing_dossiers"
ADD CONSTRAINT "fiscal_filing_dossiers_filing_receipt_file_id_fkey"
FOREIGN KEY ("filing_receipt_file_id") REFERENCES "files"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "fiscal_audit_logs" (
    "id" UUID NOT NULL,
    "owner_scope_id" UUID NOT NULL,
    "fiscal_period_id" UUID,
    "fiscal_document_id" TEXT,
    "event" TEXT NOT NULL,
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fiscal_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fiscal_audit_logs_owner_scope_id_occurred_at_id_idx"
    ON "fiscal_audit_logs"("owner_scope_id", "occurred_at", "id");

-- CreateIndex
CREATE INDEX "fiscal_audit_logs_owner_scope_id_fiscal_period_id_occurred_at_id_idx"
    ON "fiscal_audit_logs"("owner_scope_id", "fiscal_period_id", "occurred_at", "id");

-- CreateIndex
CREATE INDEX "fiscal_audit_logs_owner_scope_id_fiscal_document_id_occurred_at_id_idx"
    ON "fiscal_audit_logs"("owner_scope_id", "fiscal_document_id", "occurred_at", "id");

-- CreateIndex
CREATE INDEX "fiscal_audit_logs_owner_scope_id_event_occurred_at_id_idx"
    ON "fiscal_audit_logs"("owner_scope_id", "event", "occurred_at", "id");

-- AddForeignKey
ALTER TABLE "fiscal_audit_logs"
    ADD CONSTRAINT "fiscal_audit_logs_owner_scope_id_fkey"
    FOREIGN KEY ("owner_scope_id") REFERENCES "fiscal_profiles"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_audit_logs"
    ADD CONSTRAINT "fiscal_audit_logs_fiscal_period_id_fkey"
    FOREIGN KEY ("fiscal_period_id") REFERENCES "fiscal_periods"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_audit_logs"
    ADD CONSTRAINT "fiscal_audit_logs_fiscal_document_id_fkey"
    FOREIGN KEY ("fiscal_document_id") REFERENCES "transaction_fiscals"("fiscal_document_id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- AddCheckConstraint
ALTER TABLE "fiscal_audit_logs"
    ADD CONSTRAINT "fiscal_audit_logs_event_check" CHECK (
        "event" IN ('fiscal_document_edited', 'period_closed', 'period_reopened')
    ),
    ADD CONSTRAINT "fiscal_audit_logs_schema_version_check" CHECK ("schema_version" = 1),
    ADD CONSTRAINT "fiscal_audit_logs_payload_object_check" CHECK (jsonb_typeof("payload") = 'object');

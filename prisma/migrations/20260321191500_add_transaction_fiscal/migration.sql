-- CreateTable
CREATE TABLE "transaction_fiscals" (
    "fiscal_document_id" TEXT NOT NULL,
    "owner_scope_id" UUID NOT NULL,
    "source_transaction_id" UUID NOT NULL,
    "document_kind" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "invoice_number" TEXT,
    "invoice_series" TEXT,
    "issue_date" DATE NOT NULL,
    "operation_date" DATE,
    "currency_code" TEXT NOT NULL DEFAULT 'EUR',
    "counterparty_id" UUID,
    "counterparty_role" TEXT NOT NULL DEFAULT 'unknown',
    "counterparty_name" TEXT,
    "counterparty_tax_id" TEXT,
    "counterparty_country_code" TEXT NOT NULL DEFAULT 'ES',
    "company_tax_id" TEXT,
    "review_status" TEXT NOT NULL DEFAULT 'pending',
    "review_reasons" JSONB NOT NULL DEFAULT '[]',
    "vat_period_assignment" JSONB,
    "withholding_period_assignment" JSONB,
    "observed_amount_cents" INTEGER NOT NULL DEFAULT 0,
    "total_net_cents" INTEGER NOT NULL DEFAULT 0,
    "total_vat_cents" INTEGER NOT NULL DEFAULT 0,
    "total_withholding_cents" INTEGER NOT NULL DEFAULT 0,
    "total_gross_cents" INTEGER NOT NULL DEFAULT 0,
    "total_payable_cents" INTEGER NOT NULL DEFAULT 0,
    "source_confidence" TEXT NOT NULL DEFAULT 'manual',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transaction_fiscals_pkey" PRIMARY KEY ("fiscal_document_id")
);

-- CreateTable
CREATE TABLE "transaction_fiscal_lines" (
    "line_id" TEXT NOT NULL,
    "transaction_fiscal_id" TEXT NOT NULL,
    "line_number" INTEGER NOT NULL,
    "concept" TEXT NOT NULL,
    "base_amount_cents" INTEGER NOT NULL DEFAULT 0,
    "vat_treatment" TEXT NOT NULL DEFAULT 'out_of_scope',
    "vat_rate_bps" INTEGER NOT NULL DEFAULT 0,
    "vat_amount_cents" INTEGER NOT NULL DEFAULT 0,
    "withholding_applicable" BOOLEAN NOT NULL DEFAULT false,
    "withholding_regime" TEXT NOT NULL DEFAULT 'none',
    "withholding_base_cents" INTEGER NOT NULL DEFAULT 0,
    "withholding_rate_bps" INTEGER NOT NULL DEFAULT 0,
    "withholding_amount_cents" INTEGER NOT NULL DEFAULT 0,
    "deductibility_percent_bps" INTEGER NOT NULL DEFAULT 0,
    "deductibility_reason" TEXT NOT NULL DEFAULT 'not_applicable',
    "expense_family" TEXT NOT NULL DEFAULT 'none',
    "is_ready_for_vat_books" BOOLEAN NOT NULL DEFAULT false,
    "is_ready_for_withholding_books" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transaction_fiscal_lines_pkey" PRIMARY KEY ("line_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "transaction_fiscals_source_transaction_id_key" ON "transaction_fiscals"("source_transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "transaction_fiscals_owner_scope_id_source_transaction_id_key" ON "transaction_fiscals"("owner_scope_id", "source_transaction_id");

-- CreateIndex
CREATE INDEX "transaction_fiscals_owner_scope_id_review_status_issue_date_idx" ON "transaction_fiscals"("owner_scope_id", "review_status", "issue_date");

-- CreateIndex
CREATE INDEX "transaction_fiscals_counterparty_id_idx" ON "transaction_fiscals"("counterparty_id");

-- CreateIndex
CREATE UNIQUE INDEX "transaction_fiscal_lines_transaction_fiscal_id_line_number_key" ON "transaction_fiscal_lines"("transaction_fiscal_id", "line_number");

-- CreateIndex
CREATE INDEX "transaction_fiscal_lines_vat_ready_idx" ON "transaction_fiscal_lines"("transaction_fiscal_id", "is_ready_for_vat_books");

-- CreateIndex
CREATE INDEX "transaction_fiscal_lines_withholding_ready_idx" ON "transaction_fiscal_lines"("transaction_fiscal_id", "is_ready_for_withholding_books");

-- AddForeignKey
ALTER TABLE "transaction_fiscals"
    ADD CONSTRAINT "transaction_fiscals_owner_scope_id_fkey"
    FOREIGN KEY ("owner_scope_id") REFERENCES "fiscal_profiles"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_fiscals"
    ADD CONSTRAINT "transaction_fiscals_source_transaction_id_fkey"
    FOREIGN KEY ("source_transaction_id") REFERENCES "transactions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_fiscals"
    ADD CONSTRAINT "transaction_fiscals_counterparty_id_fkey"
    FOREIGN KEY ("counterparty_id") REFERENCES "counterparties"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_fiscal_lines"
    ADD CONSTRAINT "transaction_fiscal_lines_transaction_fiscal_id_fkey"
    FOREIGN KEY ("transaction_fiscal_id") REFERENCES "transaction_fiscals"("fiscal_document_id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddCheckConstraint
ALTER TABLE "transaction_fiscals"
    ADD CONSTRAINT "transaction_fiscals_document_kind_check" CHECK (
      "document_kind" IN ('issued_invoice', 'received_invoice', 'payroll_placeholder')
    ),
    ADD CONSTRAINT "transaction_fiscals_direction_check" CHECK (
      "direction" IN ('incoming', 'outgoing')
    ),
    ADD CONSTRAINT "transaction_fiscals_currency_code_check" CHECK ("currency_code" = 'EUR'),
    ADD CONSTRAINT "transaction_fiscals_counterparty_country_code_check" CHECK ("counterparty_country_code" = 'ES'),
    ADD CONSTRAINT "transaction_fiscals_review_status_check" CHECK (
      "review_status" IN ('pending', 'needs_review', 'ready', 'blocked')
    ),
    ADD CONSTRAINT "transaction_fiscals_document_direction_combo_check" CHECK (
      (
        "document_kind" = 'issued_invoice'
        AND "direction" = 'outgoing'
      )
      OR (
        "document_kind" = 'received_invoice'
        AND "direction" = 'incoming'
      )
      OR (
        "document_kind" = 'payroll_placeholder'
        AND "direction" = 'incoming'
      )
    ),
    ADD CONSTRAINT "transaction_fiscals_total_formula_check" CHECK (
      "total_gross_cents" = "total_net_cents" + "total_vat_cents"
      AND "total_payable_cents" = "total_gross_cents" - "total_withholding_cents"
    );

-- AddCheckConstraint
ALTER TABLE "transaction_fiscal_lines"
    ADD CONSTRAINT "transaction_fiscal_lines_line_number_check" CHECK ("line_number" > 0),
    ADD CONSTRAINT "transaction_fiscal_lines_deductibility_percent_bps_check" CHECK (
      "deductibility_percent_bps" >= 0 AND "deductibility_percent_bps" <= 10000
    ),
    ADD CONSTRAINT "transaction_fiscal_lines_vat_treatment_check" CHECK (
      "vat_treatment" IN ('taxable', 'exempt', 'non_subject', 'out_of_scope')
    ),
    ADD CONSTRAINT "transaction_fiscal_lines_withholding_regime_check" CHECK (
      "withholding_regime" IN ('rent', 'salary', 'none')
    ),
    ADD CONSTRAINT "transaction_fiscal_lines_withholding_shape_check" CHECK (
      (
        "withholding_applicable" = false
        AND "withholding_regime" = 'none'
        AND "withholding_base_cents" = 0
        AND "withholding_rate_bps" = 0
        AND "withholding_amount_cents" = 0
      )
      OR (
        "withholding_applicable" = true
        AND "withholding_regime" IN ('rent', 'salary')
      )
    );

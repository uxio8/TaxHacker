ALTER TABLE "fiscal_profiles"
ADD COLUMN "vat_cash_accounting_enabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "transaction_fiscals"
ADD COLUMN "payment_date" DATE;

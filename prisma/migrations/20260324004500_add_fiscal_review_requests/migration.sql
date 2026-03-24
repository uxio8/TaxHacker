CREATE TABLE "fiscal_review_requests" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "owner_scope_id" UUID NOT NULL,
  "fiscal_document_id" TEXT NOT NULL,
  "created_by_user_id" UUID NOT NULL,
  "actor_type" TEXT NOT NULL,
  "owner" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "due_date" DATE,
  "status" TEXT NOT NULL DEFAULT 'open',
  "resolved_at" TIMESTAMP(3),
  "resolved_by_user_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "fiscal_review_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "fiscal_review_requests_organization_id_status_idx"
  ON "fiscal_review_requests"("organization_id", "status");

CREATE INDEX "fiscal_review_requests_owner_scope_id_status_due_date_idx"
  ON "fiscal_review_requests"("owner_scope_id", "status", "due_date");

CREATE INDEX "fiscal_review_requests_fiscal_document_id_status_idx"
  ON "fiscal_review_requests"("fiscal_document_id", "status");

ALTER TABLE "fiscal_review_requests"
  ADD CONSTRAINT "fiscal_review_requests_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "fiscal_review_requests"
  ADD CONSTRAINT "fiscal_review_requests_owner_scope_id_fkey"
  FOREIGN KEY ("owner_scope_id") REFERENCES "fiscal_profiles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "fiscal_review_requests"
  ADD CONSTRAINT "fiscal_review_requests_fiscal_document_id_fkey"
  FOREIGN KEY ("fiscal_document_id") REFERENCES "transaction_fiscals"("fiscal_document_id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "fiscal_review_requests"
  ADD CONSTRAINT "fiscal_review_requests_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "fiscal_review_requests"
  ADD CONSTRAINT "fiscal_review_requests_resolved_by_user_id_fkey"
  FOREIGN KEY ("resolved_by_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

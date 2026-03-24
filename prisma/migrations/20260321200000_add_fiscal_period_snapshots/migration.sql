-- CreateTable
CREATE TABLE "fiscal_period_snapshots" (
    "id" UUID NOT NULL,
    "owner_scope_id" UUID NOT NULL,
    "fiscal_period_id" UUID NOT NULL,
    "snapshot_kind" TEXT NOT NULL,
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fiscal_period_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fiscal_period_snapshots_owner_scope_id_fiscal_period_id_snapshot_kind_key"
    ON "fiscal_period_snapshots"("owner_scope_id", "fiscal_period_id", "snapshot_kind");

-- CreateIndex
CREATE INDEX "fiscal_period_snapshots_owner_scope_id_fiscal_period_id_updated_at_idx"
    ON "fiscal_period_snapshots"("owner_scope_id", "fiscal_period_id", "updated_at");

-- CreateIndex
CREATE INDEX "fiscal_period_snapshots_owner_scope_id_snapshot_kind_updated_at_idx"
    ON "fiscal_period_snapshots"("owner_scope_id", "snapshot_kind", "updated_at");

-- AddForeignKey
ALTER TABLE "fiscal_period_snapshots"
    ADD CONSTRAINT "fiscal_period_snapshots_owner_scope_id_fkey"
    FOREIGN KEY ("owner_scope_id") REFERENCES "fiscal_profiles"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_period_snapshots"
    ADD CONSTRAINT "fiscal_period_snapshots_fiscal_period_id_fkey"
    FOREIGN KEY ("fiscal_period_id") REFERENCES "fiscal_periods"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddCheckConstraint
ALTER TABLE "fiscal_period_snapshots"
    ADD CONSTRAINT "fiscal_period_snapshots_snapshot_kind_check" CHECK (btrim("snapshot_kind") <> ''),
    ADD CONSTRAINT "fiscal_period_snapshots_schema_version_check" CHECK ("schema_version" = 1),
    ADD CONSTRAINT "fiscal_period_snapshots_payload_hash_check" CHECK (btrim("payload_hash") <> '');

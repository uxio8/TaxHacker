-- CreateEnum
CREATE TYPE "BillingStatus" AS ENUM ('trial', 'active', 'past_due', 'cancelled', 'archived');

-- CreateEnum
CREATE TYPE "AccessStatus" AS ENUM ('enabled', 'grace_period', 'restricted', 'suspended');

-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('platform_owner', 'platform_admin', 'platform_support', 'platform_finance');

-- CreateEnum
CREATE TYPE "OrganizationOverrideType" AS ENUM ('capability', 'limit', 'access_status');

-- CreateEnum
CREATE TYPE "SupportAccessMode" AS ENUM ('read_only', 'read_write');

-- CreateTable
CREATE TABLE "organization_invitations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "email_normalized" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "token" TEXT NOT NULL,
    "invited_by_user_id" UUID NOT NULL,
    "accepted_by_user_id" UUID,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_subscriptions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "plan_code" TEXT NOT NULL,
    "catalog_version" INTEGER NOT NULL DEFAULT 1,
    "billing_status" "BillingStatus" NOT NULL DEFAULT 'trial',
    "access_status" "AccessStatus" NOT NULL DEFAULT 'enabled',
    "stripe_customer_id" TEXT,
    "stripe_subscription_id" TEXT,
    "current_period_starts_at" TIMESTAMP(3),
    "current_period_ends_at" TIMESTAMP(3),
    "grace_period_ends_at" TIMESTAMP(3),
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "scheduled_plan_code" TEXT,
    "scheduled_catalog_version" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_subscription_addons" (
    "id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "addon_code" TEXT NOT NULL,
    "catalog_version" INTEGER NOT NULL DEFAULT 1,
    "stripe_subscription_item_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "effective_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "scheduled_removal_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_subscription_addons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_usage" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "metric_key" TEXT NOT NULL,
    "period_key" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_overrides" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "type" "OrganizationOverrideType" NOT NULL,
    "key" TEXT NOT NULL,
    "bool_value" BOOLEAN,
    "number_value" INTEGER,
    "access_status_value" "AccessStatus",
    "reason" TEXT NOT NULL,
    "created_by_user_id" UUID,
    "effective_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_events" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "external_event_id" TEXT,
    "payload" JSONB NOT NULL,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_admin_assignments" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "PlatformRole" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_admin_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_audit_logs" (
    "id" UUID NOT NULL,
    "actor_user_id" UUID,
    "target_user_id" UUID,
    "organization_id" UUID,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_access_sessions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "mode" "SupportAccessMode" NOT NULL,
    "reason" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_access_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organization_invitations_token_key" ON "organization_invitations"("token");

-- CreateIndex
CREATE INDEX "organization_invitations_organization_id_email_normalized_idx" ON "organization_invitations"("organization_id", "email_normalized");

-- CreateIndex
CREATE INDEX "organization_invitations_organization_id_revoked_at_expires_idx" ON "organization_invitations"("organization_id", "revoked_at", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "organization_subscriptions_organization_id_key" ON "organization_subscriptions"("organization_id");

-- CreateIndex
CREATE INDEX "organization_subscriptions_billing_status_access_status_idx" ON "organization_subscriptions"("billing_status", "access_status");

-- CreateIndex
CREATE INDEX "organization_subscriptions_stripe_customer_id_idx" ON "organization_subscriptions"("stripe_customer_id");

-- CreateIndex
CREATE INDEX "organization_subscription_addons_addon_code_is_active_idx" ON "organization_subscription_addons"("addon_code", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "organization_subscription_addons_subscription_id_addon_code_key" ON "organization_subscription_addons"("subscription_id", "addon_code");

-- CreateIndex
CREATE INDEX "organization_usage_organization_id_metric_key_idx" ON "organization_usage"("organization_id", "metric_key");

-- CreateIndex
CREATE UNIQUE INDEX "organization_usage_organization_id_metric_key_period_key_key" ON "organization_usage"("organization_id", "metric_key", "period_key");

-- CreateIndex
CREATE INDEX "organization_overrides_organization_id_type_key_idx" ON "organization_overrides"("organization_id", "type", "key");

-- CreateIndex
CREATE INDEX "organization_overrides_organization_id_expires_at_idx" ON "organization_overrides"("organization_id", "expires_at");

-- CreateIndex
CREATE INDEX "billing_events_organization_id_created_at_idx" ON "billing_events"("organization_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "billing_events_provider_external_event_id_key" ON "billing_events"("provider", "external_event_id");

-- CreateIndex
CREATE INDEX "platform_admin_assignments_role_idx" ON "platform_admin_assignments"("role");

-- CreateIndex
CREATE UNIQUE INDEX "platform_admin_assignments_user_id_role_key" ON "platform_admin_assignments"("user_id", "role");

-- CreateIndex
CREATE INDEX "platform_audit_logs_organization_id_created_at_idx" ON "platform_audit_logs"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "platform_audit_logs_actor_user_id_created_at_idx" ON "platform_audit_logs"("actor_user_id", "created_at");

-- CreateIndex
CREATE INDEX "platform_audit_logs_action_created_at_idx" ON "platform_audit_logs"("action", "created_at");

-- CreateIndex
CREATE INDEX "support_access_sessions_organization_id_expires_at_idx" ON "support_access_sessions"("organization_id", "expires_at");

-- CreateIndex
CREATE INDEX "support_access_sessions_user_id_expires_at_idx" ON "support_access_sessions"("user_id", "expires_at");

-- AddForeignKey
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_invited_by_user_id_fkey" FOREIGN KEY ("invited_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_accepted_by_user_id_fkey" FOREIGN KEY ("accepted_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_subscriptions" ADD CONSTRAINT "organization_subscriptions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_subscription_addons" ADD CONSTRAINT "organization_subscription_addons_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "organization_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_usage" ADD CONSTRAINT "organization_usage_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_overrides" ADD CONSTRAINT "organization_overrides_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_overrides" ADD CONSTRAINT "organization_overrides_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_admin_assignments" ADD CONSTRAINT "platform_admin_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_audit_logs" ADD CONSTRAINT "platform_audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_audit_logs" ADD CONSTRAINT "platform_audit_logs_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_audit_logs" ADD CONSTRAINT "platform_audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_access_sessions" ADD CONSTRAINT "support_access_sessions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_access_sessions" ADD CONSTRAINT "support_access_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "fiscal_audit_logs_owner_scope_id_fiscal_document_id_occurred_at" RENAME TO "fiscal_audit_logs_owner_scope_id_fiscal_document_id_occurre_idx";

-- RenameIndex
ALTER INDEX "fiscal_audit_logs_owner_scope_id_fiscal_period_id_occurred_at_i" RENAME TO "fiscal_audit_logs_owner_scope_id_fiscal_period_id_occurred__idx";

-- RenameIndex
ALTER INDEX "fiscal_period_snapshots_owner_scope_id_fiscal_period_id_snapsho" RENAME TO "fiscal_period_snapshots_owner_scope_id_fiscal_period_id_sna_key";

-- RenameIndex
ALTER INDEX "fiscal_period_snapshots_owner_scope_id_fiscal_period_id_updated" RENAME TO "fiscal_period_snapshots_owner_scope_id_fiscal_period_id_upd_idx";

-- RenameIndex
ALTER INDEX "fiscal_period_snapshots_owner_scope_id_snapshot_kind_updated_at" RENAME TO "fiscal_period_snapshots_owner_scope_id_snapshot_kind_update_idx";

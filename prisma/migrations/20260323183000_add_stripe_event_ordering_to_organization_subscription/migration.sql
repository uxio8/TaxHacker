ALTER TABLE "organization_subscriptions"
ADD COLUMN "last_stripe_event_id" TEXT,
ADD COLUMN "last_stripe_event_created_at" TIMESTAMP(3);

CREATE INDEX "organization_subscriptions_last_stripe_event_created_at_idx"
ON "organization_subscriptions"("last_stripe_event_created_at");

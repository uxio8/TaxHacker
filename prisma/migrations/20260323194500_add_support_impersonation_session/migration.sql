ALTER TABLE "support_access_sessions"
ADD COLUMN "assumed_user_id" UUID;

CREATE INDEX "support_access_sessions_assumed_user_id_expires_at_idx"
ON "support_access_sessions"("assumed_user_id", "expires_at");

ALTER TABLE "support_access_sessions"
ADD CONSTRAINT "support_access_sessions_assumed_user_id_fkey"
FOREIGN KEY ("assumed_user_id") REFERENCES "users"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

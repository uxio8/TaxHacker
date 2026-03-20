-- CreateTable
CREATE TABLE "analysis_jobs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "file_id" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "schema" JSONB NOT NULL,
    "attachments" JSONB NOT NULL,
    "providers" JSONB NOT NULL,
    "selected_provider" TEXT,
    "tokens_used" INTEGER NOT NULL DEFAULT 0,
    "result" JSONB,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analysis_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "analysis_jobs_user_id_created_at_idx" ON "analysis_jobs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "analysis_jobs_file_id_status_idx" ON "analysis_jobs"("file_id", "status");

-- AddForeignKey
ALTER TABLE "analysis_jobs" ADD CONSTRAINT "analysis_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_jobs" ADD CONSTRAINT "analysis_jobs_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

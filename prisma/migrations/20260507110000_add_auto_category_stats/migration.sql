CREATE TABLE "auto_category_stats" (
    "id" TEXT NOT NULL,
    "type" "CategoryType" NOT NULL,
    "phrase" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "hits" INTEGER NOT NULL DEFAULT 0,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auto_category_stats_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "auto_category_stats_type_phrase_idx" ON "auto_category_stats"("type", "phrase");

CREATE INDEX "auto_category_stats_type_hits_idx" ON "auto_category_stats"("type", "hits");

CREATE UNIQUE INDEX "auto_category_stats_type_phrase_category_key" ON "auto_category_stats"("type", "phrase", "category");

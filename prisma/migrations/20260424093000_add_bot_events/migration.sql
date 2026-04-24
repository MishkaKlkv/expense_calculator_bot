-- CreateTable
CREATE TABLE "bot_events" (
    "id" TEXT NOT NULL,
    "telegram_user_id" BIGINT,
    "update_type" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "event_name" TEXT,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bot_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bot_events_created_at_idx" ON "bot_events"("created_at");

-- CreateIndex
CREATE INDEX "bot_events_telegram_user_id_created_at_idx" ON "bot_events"("telegram_user_id", "created_at");

-- CreateIndex
CREATE INDEX "bot_events_event_type_event_name_created_at_idx" ON "bot_events"("event_type", "event_name", "created_at");

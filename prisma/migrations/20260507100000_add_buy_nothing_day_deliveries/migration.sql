CREATE TABLE "buy_nothing_day_deliveries" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "event_year" INTEGER NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "buy_nothing_day_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "buy_nothing_day_deliveries_event_year_idx" ON "buy_nothing_day_deliveries"("event_year");

CREATE UNIQUE INDEX "buy_nothing_day_deliveries_user_id_event_year_key" ON "buy_nothing_day_deliveries"("user_id", "event_year");

ALTER TABLE "buy_nothing_day_deliveries" ADD CONSTRAINT "buy_nothing_day_deliveries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "telegram_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

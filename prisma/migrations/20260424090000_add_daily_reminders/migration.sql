-- CreateTable
CREATE TABLE "daily_reminders" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "time_of_day" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Moscow',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_sent_date" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "daily_reminders_user_id_key" ON "daily_reminders"("user_id");

-- CreateIndex
CREATE INDEX "daily_reminders_enabled_time_of_day_idx" ON "daily_reminders"("enabled", "time_of_day");

-- AddForeignKey
ALTER TABLE "daily_reminders" ADD CONSTRAINT "daily_reminders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "telegram_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

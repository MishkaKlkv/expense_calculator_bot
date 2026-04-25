ALTER TABLE "planned_payments"
ADD COLUMN "reminder_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "reminder_time_of_day" TEXT NOT NULL DEFAULT '10:00',
ADD COLUMN "last_reminder_sent_month" TEXT;

CREATE INDEX "planned_payments_reminder_enabled_day_of_month_idx" ON "planned_payments"("reminder_enabled", "day_of_month");

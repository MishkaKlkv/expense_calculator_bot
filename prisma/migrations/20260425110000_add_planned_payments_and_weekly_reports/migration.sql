CREATE TABLE "planned_payments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" "Currency" NOT NULL,
    "day_of_month" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "planned_payments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "weekly_report_deliveries" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "last_sent_week" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weekly_report_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "weekly_report_deliveries_user_id_key" ON "weekly_report_deliveries"("user_id");
CREATE INDEX "planned_payments_user_id_enabled_idx" ON "planned_payments"("user_id", "enabled");

ALTER TABLE "planned_payments" ADD CONSTRAINT "planned_payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "telegram_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "weekly_report_deliveries" ADD CONSTRAINT "weekly_report_deliveries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "telegram_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

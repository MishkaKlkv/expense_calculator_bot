CREATE TYPE "TrackedDaySource" AS ENUM ('TRANSACTION', 'MANUAL_DONE');

CREATE TABLE "user_gamification" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "current_streak" INTEGER NOT NULL DEFAULT 0,
    "best_streak" INTEGER NOT NULL DEFAULT 0,
    "last_tracked_date" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_gamification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tracked_days" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "date_key" TEXT NOT NULL,
    "source" "TrackedDaySource" NOT NULL,
    "xp_awarded" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracked_days_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_achievements" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "unlocked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_achievements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_gamification_user_id_key" ON "user_gamification"("user_id");
CREATE UNIQUE INDEX "tracked_days_user_id_date_key_key" ON "tracked_days"("user_id", "date_key");
CREATE INDEX "tracked_days_user_id_date_key_idx" ON "tracked_days"("user_id", "date_key");
CREATE UNIQUE INDEX "user_achievements_user_id_code_key" ON "user_achievements"("user_id", "code");
CREATE INDEX "user_achievements_user_id_idx" ON "user_achievements"("user_id");

ALTER TABLE "user_gamification" ADD CONSTRAINT "user_gamification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "telegram_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tracked_days" ADD CONSTRAINT "tracked_days_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "telegram_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "telegram_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

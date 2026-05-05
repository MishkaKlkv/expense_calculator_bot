-- CreateTable
CREATE TABLE "reminder_suggestion_prompts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reminder_suggestion_prompts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reminder_suggestion_prompts_user_id_key" ON "reminder_suggestion_prompts"("user_id");

-- AddForeignKey
ALTER TABLE "reminder_suggestion_prompts" ADD CONSTRAINT "reminder_suggestion_prompts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "telegram_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('RUB', 'USD');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('EXPENSE', 'INCOME');

-- CreateEnum
CREATE TYPE "DialogStateType" AS ENUM ('IDLE', 'ADD_EXPENSE_WAITING_FOR_CATEGORY', 'ADD_EXPENSE_WAITING_FOR_DETAILS', 'ADD_INCOME_WAITING_FOR_CATEGORY', 'ADD_INCOME_WAITING_FOR_DETAILS', 'EDIT_TRANSACTION_WAITING_FOR_FIELD', 'DELETE_TRANSACTION_CONFIRMATION');

-- CreateTable
CREATE TABLE "telegram_users" (
    "id" TEXT NOT NULL,
    "telegram_user_id" BIGINT NOT NULL,
    "username" TEXT,
    "first_name" TEXT,
    "last_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "telegram_user_id" BIGINT NOT NULL,
    "type" "TransactionType" NOT NULL DEFAULT 'EXPENSE',
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" "Currency" NOT NULL,
    "expense_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dialog_states" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "state" "DialogStateType" NOT NULL DEFAULT 'IDLE',
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dialog_states_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "telegram_users_telegram_user_id_key" ON "telegram_users"("telegram_user_id");

-- CreateIndex
CREATE INDEX "expenses_telegram_user_id_expense_date_idx" ON "expenses"("telegram_user_id", "expense_date");

-- CreateIndex
CREATE INDEX "expenses_user_id_type_expense_date_idx" ON "expenses"("user_id", "type", "expense_date");

-- CreateIndex
CREATE UNIQUE INDEX "dialog_states_user_id_key" ON "dialog_states"("user_id");

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "telegram_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dialog_states" ADD CONSTRAINT "dialog_states_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "telegram_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

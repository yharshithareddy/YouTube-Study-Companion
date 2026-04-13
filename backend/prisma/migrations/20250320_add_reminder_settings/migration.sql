-- AlterTable
ALTER TABLE "PomodoroState" ADD COLUMN "reminderScreenEveryMin" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN "reminderWaterEveryMin" INTEGER NOT NULL DEFAULT 30;

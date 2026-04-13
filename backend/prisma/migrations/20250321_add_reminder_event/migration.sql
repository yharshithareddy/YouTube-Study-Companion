-- Phase 7: Add ReminderEvent table for reminder logging
CREATE TYPE "ReminderType" AS ENUM ('WATER', 'SCREEN');

CREATE TABLE "ReminderEvent" (
  "id" SERIAL NOT NULL,
  "sessionId" TEXT NOT NULL,
  "type" "ReminderType" NOT NULL,
  "phase" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ReminderEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReminderEvent_sessionId_idx" ON "ReminderEvent"("sessionId");
CREATE INDEX "ReminderEvent_sessionId_createdAt_idx" ON "ReminderEvent"("sessionId", "createdAt");

ALTER TABLE "ReminderEvent"
ADD CONSTRAINT "ReminderEvent_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "Session"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Phase 2: Add YouTube-aware timestamp fields to Note
ALTER TABLE "Note" ADD COLUMN "videoId" TEXT;
ALTER TABLE "Note" ADD COLUMN "videoTimestampSec" INTEGER;

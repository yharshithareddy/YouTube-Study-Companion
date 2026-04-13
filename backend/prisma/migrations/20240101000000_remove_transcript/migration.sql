-- Migration: remove_transcript
-- Drops the TranscriptChunk table and its indexes cleanly.
-- Existing sessions, notes, pomodoro_states, and reminder_events are unaffected.

DROP INDEX IF EXISTS "TranscriptChunk_sessionId_startSec_idx";
DROP INDEX IF EXISTS "TranscriptChunk_sessionId_idx";
DROP TABLE IF EXISTS "TranscriptChunk";

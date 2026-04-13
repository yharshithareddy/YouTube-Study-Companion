import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();
router.post('/:sessionId/notes', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { timestampSec, text, videoTimestampSec } = req.body;
    if (typeof timestampSec !== 'number' || !text || text.trim() === '') {
      return res.status(400).json({ 
        error: 'Invalid input. timestampSec must be a number and text must not be empty.' 
      });
    }
    if (videoTimestampSec !== undefined && videoTimestampSec !== null) {
      if (!Number.isInteger(videoTimestampSec) || videoTimestampSec < 0) {
        return res.status(400).json({
          error: 'Invalid videoTimestampSec. Must be a non-negative integer (seconds).'
        });
      }
    }
    const session = await prisma.session.findUnique({
      where: { id: sessionId }
    });
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    const note = await prisma.note.create({
      data: {
        sessionId,
        timestampSec,
        text: text.trim(),
        videoId: session.videoId || null,  // Copy from session (or null)
        videoTimestampSec: videoTimestampSec ?? null  // User-provided or null (fixed: use ?? to preserve 0)
      }
    });
    
    res.status(201).json(note);
  } catch (error) {
    console.error('Error creating note:', error);
    res.status(500).json({ error: 'Failed to create note' });
  }
});
router.get('/:sessionId/notes', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await prisma.session.findUnique({
      where: { id: sessionId }
    });
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    const notes = await prisma.note.findMany({
      where: { sessionId },
      orderBy: { timestampSec: 'asc' }
    });
    
    res.json(notes);
  } catch (error) {
    console.error('Error fetching notes:', error);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});
router.delete('/:sessionId/notes/:noteId', async (req, res) => {
  try {
    const { sessionId, noteId } = req.params;
    const session = await prisma.session.findUnique({
      where: { id: sessionId }
    });
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    const note = await prisma.note.findUnique({
      where: { id: noteId }
    });
    
    if (!note || note.sessionId !== sessionId) {
      return res.status(404).json({ error: 'Note not found' });
    }
    await prisma.note.delete({
      where: { id: noteId }
    });
    
    res.json({ message: 'Note deleted successfully' });
  } catch (error) {
    console.error('Error deleting note:', error);
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

export default router;


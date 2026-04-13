import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();
router.post('/', async (req, res) => {
  try {
    const { videoId } = req.body;
    
    const session = await prisma.session.create({
      data: {
        videoId: videoId || null,
        status: 'active'
      }
    });
    
    res.status(201).json(session);
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});
router.get('/', async (req, res) => {
  try {
    const sessions = await prisma.session.findMany({
      orderBy: {
        startedAt: 'desc'
      }
    });
    
    res.json(sessions);
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const session = await prisma.session.findUnique({
      where: { id },
      include: {
        notes: {
          orderBy: { timestampSec: 'asc' }
        }
      }
    });
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    res.json(session);
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});
router.patch('/:id/end', async (req, res) => {
  try {
    const { id } = req.params;
    
    const session = await prisma.session.update({
      where: { id },
      data: {
        endedAt: new Date(),
        status: 'ended'
      }
    });
    
    res.json(session);
  } catch (error) {
    console.error('Error ending session:', error);
    res.status(500).json({ error: 'Failed to end session' });
  }
});
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.session.delete({
      where: { id }
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

export default router;


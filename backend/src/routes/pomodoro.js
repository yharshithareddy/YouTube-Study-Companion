import express from 'express';
import { PrismaClient, PomodoroPhase } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

const DEFAULT_FOCUS_SEC = 1500;
const DEFAULT_BREAK_SEC = 300;
router.get('/:sessionId/pomodoro', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const existing = await prisma.pomodoroState.findUnique({
      where: { sessionId }
    });

    if (existing) return res.json(existing);

    const created = await prisma.pomodoroState.create({
      data: {
        sessionId,
        focusDurationSec: DEFAULT_FOCUS_SEC,
        breakDurationSec: DEFAULT_BREAK_SEC,
        currentPhase: PomodoroPhase.FOCUS,
        isRunning: false,
        remainingSec: DEFAULT_FOCUS_SEC,
        totalFocusedSec: 0,
        totalBreakSec: 0,
        pauseCount: 0,
        lastTickAt: null,
        resumeTimestamps: [],
        reminderScreenEveryMin: 50,
        reminderWaterEveryMin: 30
      }
    });

    res.json(created);
  } catch (error) {
    console.error('Error fetching/creating pomodoro state:', error);
    res.status(500).json({ error: 'Failed to fetch pomodoro state' });
  }
});
router.put('/:sessionId/pomodoro', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const body = req.body || {};

    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    const data = {
      sessionId,
      focusDurationSec: Number(body.focusDurationSec),
      breakDurationSec: Number(body.breakDurationSec),
      currentPhase: body.currentPhase,
      isRunning: Boolean(body.isRunning),
      remainingSec: Number(body.remainingSec),
      totalFocusedSec: Number(body.totalFocusedSec),
      totalBreakSec: Number(body.totalBreakSec),
      pauseCount: Number(body.pauseCount),
      lastTickAt: body.lastTickAt ? new Date(body.lastTickAt) : null,
      resumeTimestamps: body.resumeTimestamps ?? [],
      reminderScreenEveryMin: Number(body.reminderScreenEveryMin) || 50,
      reminderWaterEveryMin: Number(body.reminderWaterEveryMin) || 30
    };

    const upserted = await prisma.pomodoroState.upsert({
      where: { sessionId },
      create: {
        ...data,
        focusDurationSec: Number.isFinite(data.focusDurationSec) ? data.focusDurationSec : DEFAULT_FOCUS_SEC,
        breakDurationSec: Number.isFinite(data.breakDurationSec) ? data.breakDurationSec : DEFAULT_BREAK_SEC,
        currentPhase: data.currentPhase || PomodoroPhase.FOCUS,
        remainingSec: Number.isFinite(data.remainingSec) ? data.remainingSec : (data.currentPhase === PomodoroPhase.BREAK ? DEFAULT_BREAK_SEC : DEFAULT_FOCUS_SEC),
        totalFocusedSec: Number.isFinite(data.totalFocusedSec) ? data.totalFocusedSec : 0,
        totalBreakSec: Number.isFinite(data.totalBreakSec) ? data.totalBreakSec : 0,
        pauseCount: Number.isFinite(data.pauseCount) ? data.pauseCount : 0,
        isRunning: Boolean(body.isRunning),
        lastTickAt: body.lastTickAt ? new Date(body.lastTickAt) : null,
        resumeTimestamps: body.resumeTimestamps ?? [],
        reminderScreenEveryMin: Number.isFinite(data.reminderScreenEveryMin) ? data.reminderScreenEveryMin : 50,
        reminderWaterEveryMin: Number.isFinite(data.reminderWaterEveryMin) ? data.reminderWaterEveryMin : 30
      },
      update: {
        focusDurationSec: data.focusDurationSec,
        breakDurationSec: data.breakDurationSec,
        currentPhase: data.currentPhase,
        isRunning: data.isRunning,
        remainingSec: data.remainingSec,
        totalFocusedSec: data.totalFocusedSec,
        totalBreakSec: data.totalBreakSec,
        pauseCount: data.pauseCount,
        lastTickAt: data.lastTickAt,
        resumeTimestamps: data.resumeTimestamps,
        reminderScreenEveryMin: data.reminderScreenEveryMin,
        reminderWaterEveryMin: data.reminderWaterEveryMin
      }
    });

    res.json(upserted);
  } catch (error) {
    console.error('Error upserting pomodoro state:', error);
    res.status(500).json({ error: 'Failed to save pomodoro state' });
  }
});
router.post('/:sessionId/reminders', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { type, phase } = req.body;
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    const reminder = await prisma.reminderEvent.create({
      data: {
        sessionId,
        type: type || 'SCREEN',
        phase: phase || 'FOCUS'
      }
    });

    res.json(reminder);
  } catch (error) {
    console.error('Error logging reminder event:', error);
    res.status(500).json({ error: 'Failed to log reminder' });
  }
});

export default router;


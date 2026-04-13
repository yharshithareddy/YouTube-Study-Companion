const SESSION_SUMMARY_STORAGE_KEY = 'studycomp_session_summaries_v1';
const TASK_STORAGE_KEY = 'studycomp_todos_v1';

export function generateSessionInsight({
  focusMinutesCompleted,
  plannedFocusMinutes,
  pauseCount,
  notesCount,
  tasksCompletedCount,
  noteTimestamps = []
}) {
  const hasEarlyNotePattern = (() => {
    if (!noteTimestamps.length || !plannedFocusMinutes) return false;
    const earlyThreshold = plannedFocusMinutes * 60 * 0.4;
    const earlyNotes = noteTimestamps.filter((t) => t <= earlyThreshold).length;
    return earlyNotes >= Math.ceil(noteTimestamps.length / 2);
  })();

  if (pauseCount >= 3) {
    return {
      insightType: 'interrupted_block',
      insightText: 'This session had a few interruptions. A shorter cycle may help next time.'
    };
  }

  if (plannedFocusMinutes > 0 && focusMinutesCompleted < plannedFocusMinutes * 0.6) {
    return {
      insightType: 'short_incomplete',
      insightText: 'This session ended early. Try a smaller target to build consistency.'
    };
  }

  if (tasksCompletedCount >= 2) {
    return {
      insightType: 'task_completion',
      insightText: 'You turned focus into action by closing out multiple tasks.'
    };
  }

  if (notesCount >= 3) {
    return {
      insightType: 'strong_note_capture',
      insightText: 'You captured several ideas during this session. Review them before starting the next one.'
    };
  }

  if (hasEarlyNotePattern) {
    return {
      insightType: 'early_note_activity',
      insightText: 'Most notes were captured early, then focus became more consistent.'
    };
  }

  if ((pauseCount === 0 || pauseCount === 1) && focusMinutesCompleted >= 25) {
    return {
      insightType: 'steady_focus',
      insightText: 'You stayed steady through most of this session.'
    };
  }

  if (notesCount === 0 && focusMinutesCompleted >= 25) {
    return {
      insightType: 'quiet_focus',
      insightText: 'You held focus without switching into capture mode much this time.'
    };
  }

  return {
    insightType: 'fallback',
    insightText: 'Another session complete. Keep the rhythm going.'
  };
}

export function getCompletedTaskCountForSession(sessionId) {
  try {
    const raw = window.localStorage.getItem(TASK_STORAGE_KEY);
    const tasks = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(tasks)) return 0;
    return tasks.filter((task) => task.completedSessionId === sessionId).length;
  } catch {
    return 0;
  }
}

export function storeSessionSummary(sessionId, summary) {
  try {
    const raw = window.localStorage.getItem(SESSION_SUMMARY_STORAGE_KEY);
    const current = raw ? JSON.parse(raw) : {};
    const next = { ...current, [sessionId]: summary };
    window.localStorage.setItem(SESSION_SUMMARY_STORAGE_KEY, JSON.stringify(next));
  } catch {
  }
}

export function getStoredSessionSummary(sessionId) {
  try {
    const raw = window.localStorage.getItem(SESSION_SUMMARY_STORAGE_KEY);
    const summaries = raw ? JSON.parse(raw) : {};
    return summaries?.[sessionId] || null;
  } catch {
    return null;
  }
}


import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import DashboardHeader from './components/DashboardHeader';
import Notes from './components/Notes';
import Pomodoro from './components/Pomodoro';
import Reminders from './components/Reminders';
import ReminderWatcher from './components/ReminderWatcher';
import SessionOverviewCard from './components/SessionOverviewCard';
import SessionSidebar from './components/SessionSidebar';
import SessionSummaryModal from './components/SessionSummaryModal';
import StartSessionModal from './components/StartSessionModal';
import TodoSticky from './components/TodoSticky';
import WorkspaceHome from './components/WorkspaceHome';
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  InlineAlert,
  SkeletonBlock,
  ToastStack
} from './components/ui';
import {
  generateSessionInsight,
  getCompletedTaskCountForSession,
  storeSessionSummary
} from './utils/sessionInsights';

const API_URL = 'http://localhost:3000';
const SETTINGS_STORAGE_KEY = 'studycomp_workspace_settings_v1';
const DEFAULT_WORKSPACE_SETTINGS = {
  appearance: 'dark'
};

function resolveAppearance(mode) {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return mode;
}

function applyInitialAppearance() {
  if (typeof window === 'undefined') return;

  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const appearance = parsed?.appearance || DEFAULT_WORKSPACE_SETTINGS.appearance;
    const resolved = resolveAppearance(appearance);
    document.documentElement.dataset.theme = resolved;
    document.documentElement.style.colorScheme = resolved;
  } catch {
    document.documentElement.dataset.theme = DEFAULT_WORKSPACE_SETTINGS.appearance;
    document.documentElement.style.colorScheme = DEFAULT_WORKSPACE_SETTINGS.appearance;
  }
}

function App() {
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [viewMode, setViewMode] = useState('manage');
  const [loading, setLoading] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [pendingEndSessionId, setPendingEndSessionId] = useState(null);
  const [pendingDeleteSessionId, setPendingDeleteSessionId] = useState(null);
  const [startSessionOpen, setStartSessionOpen] = useState(false);
  const [focusSetupOpen, setFocusSetupOpen] = useState(false);
  const [focusSetupInitial, setFocusSetupInitial] = useState({ focusMinutes: 25, breakMinutes: 5 });
  const [completedSummary, setCompletedSummary] = useState(null);
  const [error, setError] = useState(null);
  const [toasts, setToasts] = useState([]);
  const initialModeResolvedRef = useRef(false);

  const addToast = (title, message = '') => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setToasts((current) => [...current, { id, title, message }]);
  };

  const dismissToast = (id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  };

  const broadcastExtensionBreakState = () => {
    if (typeof window === 'undefined') return;

    window.postMessage(
      {
        type: 'STUDYCOMP_FOCUS_STATE',
        phase: 'BREAK',
        paused: true,
        remainingSec: 0,
        phaseDurationSec: 0,
        progressPercent: 0,
        timestamp: Date.now()
      },
      window.location.origin
    );
  };

  useEffect(() => {
    if (!toasts.length) return undefined;

    const timers = toasts.map((toast) =>
      window.setTimeout(() => {
        dismissToast(toast.id);
      }, 4000)
    );

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [toasts]);

  const fetchSessions = async ({ preserveSelection = true } = {}) => {
    try {
      setLoadingSessions(true);
      const response = await fetch(`${API_URL}/sessions`);
      if (!response.ok) throw new Error('Failed to fetch sessions');
      const data = await response.json();
      setSessions(data);
      if (preserveSelection && selectedSession?.id) {
        const refreshedSelection = data.find((session) => session.id === selectedSession.id);
        if (!refreshedSelection) {
          setSelectedSession(null);
        }
      }
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingSessions(false);
    }
  };

  const startSession = async ({ focusMinutes = 25, breakMinutes = 5 } = {}) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      if (!response.ok) throw new Error('Failed to create session');
      const newSession = await response.json();

      const pomodoroResponse = await fetch(`${API_URL}/sessions/${newSession.id}/pomodoro`);
      if (!pomodoroResponse.ok) throw new Error('Failed to initialize session timing');
      const pomodoroState = await pomodoroResponse.json();

      const focusDurationSec = focusMinutes * 60;
      const breakDurationSec = breakMinutes * 60;

      const saveTimingResponse = await fetch(`${API_URL}/sessions/${newSession.id}/pomodoro`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...pomodoroState,
          focusDurationSec,
          breakDurationSec,
          remainingSec: focusDurationSec
        })
      });

      if (!saveTimingResponse.ok) throw new Error('Failed to save session timing');

      setSessions((current) => [newSession, ...current]);
      setSelectedSession(newSession);
      setViewMode('focus');
      setStartSessionOpen(false);
      setError(null);
      addToast('Session started', 'A new study session is ready.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const endSession = async (sessionId) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/sessions/${sessionId}/end`, {
        method: 'PATCH'
      });
      if (!response.ok) throw new Error('Failed to end session');
      const [updatedSession, pomodoroState, notes] = await Promise.all([
        fetch(`${API_URL}/sessions/${sessionId}`).then((r) => {
          if (!r.ok) throw new Error('Failed to fetch session');
          return r.json();
        }),
        fetch(`${API_URL}/sessions/${sessionId}/pomodoro`).then((r) => {
          if (!r.ok) throw new Error('Failed to fetch pomodoro state');
          return r.json();
        }),
        fetch(`${API_URL}/sessions/${sessionId}/notes`).then((r) => {
          if (!r.ok) throw new Error('Failed to fetch notes');
          return r.json();
        })
      ]);

      const focusMinutesCompleted = Math.round((pomodoroState.totalFocusedSec || 0) / 60);
      const plannedFocusMinutes = Math.round((pomodoroState.focusDurationSec || 0) / 60);
      const pauseCount = pomodoroState.pauseCount || 0;
      const notesCount = notes.length;
      const tasksCompletedCount = getCompletedTaskCountForSession(sessionId);
      const noteTimestamps = notes.map((note) => note.timestampSec).filter((value) => Number.isFinite(value));
      const insight = generateSessionInsight({
        focusMinutesCompleted,
        plannedFocusMinutes,
        pauseCount,
        notesCount,
        tasksCompletedCount,
        noteTimestamps
      });

      const sessionSummary = {
        sessionId,
        summary: {
          focusMinutes: focusMinutesCompleted,
          pauses: pauseCount,
          notes: notesCount,
          tasksCompleted: tasksCompletedCount
        },
        insight,
        startedAt: updatedSession.startedAt,
        endedAt: updatedSession.endedAt,
        plannedFocusMinutes,
        noteTimestamps
      };

      storeSessionSummary(sessionId, sessionSummary);
      setCompletedSummary(sessionSummary);
      await fetchSessions();
      setSelectedSession(updatedSession);
      setViewMode('manage');
      broadcastExtensionBreakState();
      setError(null);
      addToast('Session ended', 'This session has been closed and saved.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setPendingEndSessionId(null);
    }
  };

  const deleteSession = async (sessionId) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/sessions/${sessionId}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete session');

      setSessions((current) => current.filter((session) => session.id !== sessionId));
      if (selectedSession?.id === sessionId) {
        setSelectedSession(null);
      }
      setError(null);
      addToast('Session deleted', 'The saved session has been removed.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setPendingDeleteSessionId(null);
    }
  };

  const viewSession = async (sessionId) => {
    try {
      const response = await fetch(`${API_URL}/sessions/${sessionId}`);
      if (!response.ok) throw new Error('Failed to fetch session');
      const session = await response.json();
      setSelectedSession(session);
      setViewMode(session.status === 'active' ? 'focus' : 'manage');
    } catch (err) {
      setError(err.message);
    }
  };

  const calculateDuration = (startedAt, endedAt) => {
    const start = new Date(startedAt);
    const end = endedAt ? new Date(endedAt) : new Date();
    const durationMs = end - start;
    const minutes = Math.floor(durationMs / 60000);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (hours > 0) {
      return `${hours}h ${remainingMinutes}m`;
    }
    return `${minutes}m`;
  };

  useEffect(() => {
    applyInitialAppearance();
  }, []);

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session');

    if (sessionId) {
      viewSession(sessionId);
    }
  }, []);

  const activeSessions = useMemo(
    () => sessions.filter((session) => session.status === 'active'),
    [sessions]
  );

  const completedSessions = useMemo(
    () => sessions.filter((session) => session.status !== 'active'),
    [sessions]
  );

  const activeSession = useMemo(
    () => activeSessions[0] || null,
    [activeSessions]
  );

  const selectedOrActiveSession = selectedSession || activeSession;
  const hasActiveSelection = selectedOrActiveSession?.status === 'active';
  const isCompletedSelection = selectedOrActiveSession && selectedOrActiveSession.status !== 'active';

  const openFocusSetup = async (sessionId) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/sessions/${sessionId}/pomodoro`);
      if (!response.ok) throw new Error('Failed to load session timing');
      const pomodoroState = await response.json();
      setFocusSetupInitial({
        focusMinutes: Math.round((pomodoroState.focusDurationSec || 1500) / 60),
        breakMinutes: Math.round((pomodoroState.breakDurationSec || 300) / 60)
      });
      setFocusSetupOpen(true);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const applyFocusSetupAndEnter = async ({ focusMinutes, breakMinutes }) => {
    if (!selectedOrActiveSession?.id) return;

    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/sessions/${selectedOrActiveSession.id}/pomodoro`);
      if (!response.ok) throw new Error('Failed to load session timing');
      const pomodoroState = await response.json();

      const focusDurationSec = focusMinutes * 60;
      const breakDurationSec = breakMinutes * 60;

      const saveResponse = await fetch(`${API_URL}/sessions/${selectedOrActiveSession.id}/pomodoro`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...pomodoroState,
          focusDurationSec,
          breakDurationSec,
          remainingSec: pomodoroState.currentPhase === 'BREAK' ? breakDurationSec : focusDurationSec
        })
      });

      if (!saveResponse.ok) throw new Error('Failed to save session timing');

      setFocusSetupOpen(false);
      setViewMode('focus');
      setError(null);
      addToast('Session timing updated', 'Focus Mode is ready with your selected timing.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!initialModeResolvedRef.current && activeSession && !selectedSession) {
      setViewMode('focus');
      initialModeResolvedRef.current = true;
    }

    if (!initialModeResolvedRef.current && !loadingSessions) {
      initialModeResolvedRef.current = true;
    }
  }, [activeSession, loadingSessions, selectedSession]);

  return (
    <>
      <AnimatePresence mode="wait">
        {hasActiveSelection && viewMode === 'focus' ? (
          <motion.div
            key="focus-mode"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.42, ease: 'easeInOut' }}
          >
            <Pomodoro
              sessionId={selectedOrActiveSession.id}
              onNotify={addToast}
              onOpenManagement={() => setViewMode('manage')}
              onCloseSession={() => setPendingEndSessionId(selectedOrActiveSession.id)}
              closingBusy={loading && pendingEndSessionId === selectedOrActiveSession.id}
            />
          </motion.div>
        ) : (
          <motion.div
            key="workspace"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28, ease: 'easeInOut' }}
          >
            <WorkspaceHome
              sessions={sessions}
              selectedSession={selectedSession}
              activeSession={activeSession}
              onSelectSession={viewSession}
              onStartSession={startSession}
              onOpenCustomTiming={() => setStartSessionOpen(true)}
              onEnterFocusMode={() => selectedOrActiveSession?.id && openFocusSetup(selectedOrActiveSession.id)}
              onDeleteSession={(sessionId) => setPendingDeleteSessionId(sessionId)}
              onNotify={addToast}
              formatDuration={calculateDuration}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      <ReminderWatcher onNotify={addToast} />

      <ConfirmDialog
        open={Boolean(pendingEndSessionId)}
        title="End this session?"
        description="The session timeline will be sealed and the focus cycle will stop writing into it."
        confirmLabel="End session"
        onConfirm={() => endSession(pendingEndSessionId)}
        onCancel={() => setPendingEndSessionId(null)}
        busy={loading && Boolean(pendingEndSessionId)}
      />

      <ConfirmDialog
        open={Boolean(pendingDeleteSessionId)}
        title="Delete this session?"
        description="This will permanently remove the saved session and its notes."
        confirmLabel="Delete session"
        onConfirm={() => deleteSession(pendingDeleteSessionId)}
        onCancel={() => setPendingDeleteSessionId(null)}
        busy={loading && Boolean(pendingDeleteSessionId)}
      />

      <StartSessionModal
        open={startSessionOpen}
        busy={loading}
        onCancel={() => setStartSessionOpen(false)}
        onConfirm={(timing) => startSession(timing)}
      />

      <StartSessionModal
        open={focusSetupOpen}
        busy={loading}
        title="Set Pomodoro timing"
        subtitle="Choose the focus and break length before entering Focus Mode."
        confirmLabel="Enter focus mode"
        initialFocusMinutes={focusSetupInitial.focusMinutes}
        initialBreakMinutes={focusSetupInitial.breakMinutes}
        onCancel={() => setFocusSetupOpen(false)}
        onConfirm={applyFocusSetupAndEnter}
      />

      <SessionSummaryModal
        open={Boolean(completedSummary)}
        summary={completedSummary}
        loading={loading}
        onStartNextBlock={async () => {
          setCompletedSummary(null);
          setStartSessionOpen(true);
        }}
        onReviewNotes={() => {
          setCompletedSummary(null);
          setViewMode('manage');
        }}
        onClose={() => setCompletedSummary(null)}
      />
    </>
  );
}

export default App;

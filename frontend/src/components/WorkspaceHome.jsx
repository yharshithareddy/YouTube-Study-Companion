import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BrandMark } from './AppLogo';
import Notes from './Notes';
import Reminders from './Reminders';
import RecommendationPanel from './RecommendationPanel';
import SettingsPanel from './SettingsPanel';
import TodoSticky from './TodoSticky';
import { EmptyState, Icon } from './ui';

const TODO_STORAGE_KEY = 'studycomp_todos_v1';
const REMINDERS_STORAGE_KEY = 'studycomp_reminders_v1';
const SETTINGS_STORAGE_KEY = 'studycomp_workspace_settings_v1';

const PRESETS = [
  { label: '25 / 5', focusMinutes: 25, breakMinutes: 5 },
  { label: '45 / 10', focusMinutes: 45, breakMinutes: 10 },
  { label: '60 / 10', focusMinutes: 60, breakMinutes: 10 }
];

function formatSessionDate(value) {
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric'
  });
}

function isToday(dateValue) {
  const today = new Date();
  const date = new Date(dateValue);
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

function WorkspaceHome({
  sessions,
  selectedSession,
  activeSession,
  onSelectSession,
  onStartSession,
  onOpenCustomTiming,
  onEnterFocusMode,
  onDeleteSession,
  onNotify,
  formatDuration
}) {
  const [activePanel, setActivePanel] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState(PRESETS[0]);
  const [quickTask, setQuickTask] = useState('');
  const [tasksLeft, setTasksLeft] = useState(0);
  const [reminders, setReminders] = useState([]);
  const [settingsSnapshot, setSettingsSnapshot] = useState({
    defaultFocusMinutes: 25,
    defaultBreakMinutes: 5,
    longBreakMinutes: 15
  });

  useEffect(() => {
    const syncWorkspaceState = () => {
      try {
        const storedTodos = JSON.parse(window.localStorage.getItem(TODO_STORAGE_KEY) || '[]');
        const openTodos = Array.isArray(storedTodos) ? storedTodos.filter((todo) => !todo.done) : [];
        setTasksLeft(openTodos.length);
      } catch {
        setTasksLeft(0);
      }

      try {
        const storedReminders = JSON.parse(window.localStorage.getItem(REMINDERS_STORAGE_KEY) || '[]');
        const sorted = Array.isArray(storedReminders)
          ? storedReminders
              .filter((reminder) => reminder?.dueAt)
              .sort((a, b) => a.dueAt - b.dueAt)
          : [];
        setReminders(sorted);
      } catch {
        setReminders([]);
      }

      try {
        const storedSettings = JSON.parse(window.localStorage.getItem(SETTINGS_STORAGE_KEY) || '{}');
        setSettingsSnapshot((current) => ({ ...current, ...storedSettings }));
      } catch {
        setSettingsSnapshot({
          defaultFocusMinutes: 25,
          defaultBreakMinutes: 5,
          longBreakMinutes: 15
        });
      }
    };

    syncWorkspaceState();

    const handleStorageUpdate = (event) => {
      if (!event?.key || [TODO_STORAGE_KEY, REMINDERS_STORAGE_KEY, SETTINGS_STORAGE_KEY].includes(event.key)) {
        syncWorkspaceState();
      }
    };

    const handleCustomStorageUpdate = () => {
      syncWorkspaceState();
    };

    window.addEventListener('storage', handleStorageUpdate);
    window.addEventListener('studycomp:reminders-updated', handleCustomStorageUpdate);

    return () => {
      window.removeEventListener('storage', handleStorageUpdate);
      window.removeEventListener('studycomp:reminders-updated', handleCustomStorageUpdate);
    };
  }, []);

  useEffect(() => {
    try {
      const storedTodos = JSON.parse(window.localStorage.getItem(TODO_STORAGE_KEY) || '[]');
      const openTodos = Array.isArray(storedTodos) ? storedTodos.filter((todo) => !todo.done) : [];
      setTasksLeft(openTodos.length);
    } catch {
      setTasksLeft(0);
    }

    try {
      const storedReminders = JSON.parse(window.localStorage.getItem(REMINDERS_STORAGE_KEY) || '[]');
      const sorted = Array.isArray(storedReminders)
        ? storedReminders
            .filter((reminder) => reminder?.dueAt)
            .sort((a, b) => a.dueAt - b.dueAt)
        : [];
      setReminders(sorted);
    } catch {
      setReminders([]);
    }

    try {
      const storedSettings = JSON.parse(window.localStorage.getItem(SETTINGS_STORAGE_KEY) || '{}');
      setSettingsSnapshot((current) => ({ ...current, ...storedSettings }));
    } catch {
      setSettingsSnapshot({
        defaultFocusMinutes: 25,
        defaultBreakMinutes: 5,
        longBreakMinutes: 15
      });
    }
  }, [activePanel, historyOpen]);

  const historySessions = useMemo(
    () => sessions.filter((session) => session.status !== 'active'),
    [sessions]
  );

  const todaySummary = useMemo(() => {
    const todaySessions = sessions.filter((session) => isToday(session.startedAt));
    const focusedMinutes = todaySessions.reduce((total, session) => {
      if (!session.endedAt) return total;
      const started = new Date(session.startedAt).getTime();
      const ended = new Date(session.endedAt).getTime();
      return total + Math.max(0, Math.round((ended - started) / 60000));
    }, 0);

    return {
      focusedMinutes,
      sessionCount: todaySessions.length
    };
  }, [sessions]);

  const recentActivity = useMemo(() => historySessions.slice(0, 4), [historySessions]);
  const nextReminder = reminders[0] || null;
  const currentDate = useMemo(
    () =>
      new Date().toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
      }),
    []
  );

  const openPanel = (panel) => {
    setActivePanel((current) => (current === panel ? null : panel));
  };

  const addQuickTask = (event) => {
    event.preventDefault();
    const text = quickTask.trim();
    if (!text) return;

    try {
      const stored = JSON.parse(window.localStorage.getItem(TODO_STORAGE_KEY) || '[]');
      const todos = Array.isArray(stored) ? stored : [];
      const nextTodo = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        text,
        done: false,
        createdAt: Date.now(),
        sessionId: activeSession?.id || selectedSession?.id || null,
        completedAt: null,
        completedSessionId: null
      };
      const updated = [...todos, nextTodo];
      window.localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(updated));
      setTasksLeft(updated.filter((todo) => !todo.done).length);
      setQuickTask('');
      onNotify?.('Task added', 'A new next action has been captured.');
    } catch {
      onNotify?.('Task not saved', 'Local storage is unavailable right now.');
    }
  };

  const renderPanel = () => {
    switch (activePanel) {
      case 'todo':
        return (
          <TodoSticky
            onNotify={onNotify}
            sessionId={selectedSession?.id || activeSession?.id || null}
            forcedTab="todo"
            hideToggle
            compactHeader
          />
        );
      case 'quick-notes':
        return (
          <TodoSticky
            onNotify={onNotify}
            sessionId={selectedSession?.id || activeSession?.id || null}
            forcedTab="sticky"
            hideToggle
            compactHeader
          />
        );
      case 'reminders':
        return <Reminders onNotify={onNotify} />;
      case 'timestamp-notes':
        return selectedSession ? (
          <Notes sessionId={selectedSession.id} selectedSession={selectedSession} onNotify={onNotify} />
        ) : (
          <EmptyState
            title="No session selected"
            copy="Choose a session from history or start a new one to open timestamp notes."
          />
        );
      case 'settings':
        return <SettingsPanel />;
      case 'discover':
        return <RecommendationPanel />;
      default:
        return null;
    }
  };

  return (
    <div className="relative h-screen overflow-hidden bg-[#121018] text-[#F5F2EE]">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#15131B_0%,#121018_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_22%,rgba(186,106,255,0.14)_0%,transparent_28%),radial-gradient(circle_at_78%_18%,rgba(255,163,72,0.12)_0%,transparent_26%),radial-gradient(circle_at_62%_78%,rgba(111,91,255,0.10)_0%,transparent_30%)]" />
      <div className="absolute inset-0 shadow-[inset_0_0_140px_rgba(0,0,0,0.28)]" />

      <header className="sticky top-0 z-40 flex h-[76px] items-center justify-between border-b border-white/6 bg-[rgba(18,16,24,0.72)] px-7 backdrop-blur-[14px]">
        <div className="flex items-center gap-3">
          <div className="flex h-[42px] w-[42px] items-center justify-center rounded-[12px] border border-white/7 bg-white/4">
            <BrandMark className="brand-mark-mini !h-[42px] !w-[42px] !rounded-[12px] !border-none !bg-transparent !shadow-none" />
          </div>
          <div className="flex flex-col">
            <span className="text-[18px] font-bold text-[#F5F2EE]">Study Companion</span>
            <span className="text-[12px] font-medium text-[rgba(245,242,238,0.48)]">Quiet structure for deliberate study</span>
          </div>
        </div>

        <nav className="hidden items-center gap-7 lg:flex">
          {[
            ['todo', 'To-Do'],
            ['quick-notes', 'Quick Notes'],
            ['reminders', 'Reminders'],
            ['timestamp-notes', 'Timestamp Notes'],
            ['discover', 'Discover'],
            ['settings', 'Settings']
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => openPanel(key)}
              className={`relative pb-1 text-[15px] font-medium transition ${
                activePanel === key ? 'text-[#F5F2EE]' : 'text-[rgba(245,242,238,0.72)] hover:text-[#F5F2EE]'
              }`}
            >
              {label}
              <span
                className={`absolute bottom-0 left-0 h-[2px] rounded-full bg-[#FF8A3D] transition-all ${
                  activePanel === key ? 'w-full opacity-100' : 'w-full opacity-0'
                }`}
              />
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {activeSession ? (
            <button
              type="button"
              onClick={onEnterFocusMode}
              className="h-[42px] rounded-[14px] border border-white/7 bg-white/5 px-[18px] text-[14px] font-semibold text-[#F5F2EE] transition hover:bg-white/8"
            >
              Focus Mode
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="flex h-[42px] w-[42px] items-center justify-center rounded-[14px] border border-white/7 bg-white/5 text-[#F5F2EE] transition hover:bg-white/8"
            aria-label="Open session history"
          >
            <Icon name="list" size={18} />
          </button>
        </div>
      </header>

      <main className="relative z-10 grid h-[calc(100vh-76px)] grid-cols-[280px_minmax(0,1fr)_320px] gap-6 p-6">
        <aside className="h-full rounded-[24px] border border-white/5 bg-white/3 p-5 backdrop-blur-[8px]">
          <div>
            <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[rgba(245,242,238,0.45)]">Today</p>
            <div className="mt-4 space-y-1">
              {[
                ['Focused', `${todaySummary.focusedMinutes} min`],
                ['Sessions', `${todaySummary.sessionCount}`],
                ['Tasks left', `${tasksLeft}`]
              ].map(([label, value]) => (
                <div key={label} className="flex h-9 items-center justify-between border-b border-white/4 text-[14px] font-medium">
                  <span className="text-[rgba(245,242,238,0.62)]">{label}</span>
                  <span className="text-[#F5F2EE]">{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6">
            <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[rgba(245,242,238,0.45)]">Quick add</p>
            <form className="mt-4" onSubmit={addQuickTask}>
              <input
                value={quickTask}
                onChange={(event) => setQuickTask(event.target.value)}
                className="h-11 w-full rounded-[14px] border border-white/6 bg-[rgba(12,11,17,0.72)] px-[14px] text-[#F5F2EE] outline-none placeholder:text-[rgba(245,242,238,0.34)] focus:border-[rgba(255,138,61,0.55)] focus:shadow-[0_0_0_4px_rgba(255,138,61,0.10)]"
                placeholder="Add a task"
              />
            </form>
            <p className="mt-3 text-[13px] font-medium text-[rgba(245,242,238,0.42)]">Press Enter to add</p>
          </div>

          <div className="mt-6">
            <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[rgba(245,242,238,0.45)]">Current reminders</p>
            <div className="mt-4 space-y-3">
              {reminders.slice(0, 3).length ? (
                reminders.slice(0, 3).map((reminder) => (
                  <div key={reminder.id} className="border-b border-white/4 pb-3">
                    <p className="text-[14px] font-medium text-[#F5F2EE]">{reminder.title}</p>
                    <p className="mt-1 text-[13px] font-medium text-[rgba(245,242,238,0.48)]">
                      {new Date(reminder.dueAt).toLocaleString()}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-[14px] font-medium text-[rgba(245,242,238,0.42)]">No reminders yet</p>
              )}
            </div>
          </div>
        </aside>

        <section className="h-full rounded-[28px] border border-white/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.035)_0%,rgba(255,255,255,0.025)_100%)] px-8 py-7 backdrop-blur-[10px]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[rgba(245,242,238,0.45)]">Workspace</p>
              <h1 className="mt-3 text-[26px] font-semibold text-[#F5F2EE]">{currentDate}</h1>
            </div>
            <span className="inline-flex h-[30px] items-center rounded-full border border-white/7 bg-white/4 px-3 text-[13px] font-semibold text-[rgba(245,242,238,0.72)]">
              {activeSession ? 'Active' : 'Idle'}
            </span>
          </div>

          <div className="mt-10">
            <h2 className="max-w-[540px] text-[44px] font-bold leading-[1.05] text-[#F5F2EE]">Start a study session</h2>
            <p className="mt-3 max-w-[500px] text-[17px] font-medium leading-[1.5] text-[rgba(245,242,238,0.62)]">
              Set your focus time, then enter your workspace.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              {PRESETS.map((preset) => {
                const selected = selectedPreset.label === preset.label;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setSelectedPreset(preset)}
                    className={`h-[38px] rounded-full border px-4 text-[14px] font-semibold transition ${
                      selected
                        ? 'border-[rgba(255,138,61,0.6)] bg-[rgba(255,255,255,0.06)] text-white shadow-[inset_0_0_16px_rgba(255,138,61,0.12)]'
                        : 'border-white/6 bg-white/4 text-[rgba(245,242,238,0.72)] hover:text-white'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => onStartSession(selectedPreset)}
                className="h-[52px] rounded-[16px] bg-[linear-gradient(135deg,#FF8A3D_0%,#FF5C7A_100%)] px-[22px] text-[15px] font-bold text-white shadow-[0_12px_28px_rgba(255,108,76,0.24)] transition hover:-translate-y-px"
              >
                Start Session
              </button>
              <button
                type="button"
                onClick={onOpenCustomTiming}
                className="h-[52px] rounded-[16px] border border-white/6 bg-white/4 px-[18px] text-[15px] font-semibold text-[#F5F2EE] transition hover:bg-white/7"
              >
                Custom timing
              </button>
            </div>
          </div>

          <div className="mt-9 grid h-[240px] grid-cols-[58%_42%] gap-5">
            <div className="rounded-[22px] border border-white/5 bg-[rgba(10,10,14,0.38)] p-5">
              <p className="text-[18px] font-semibold text-[#F5F2EE]">Recent activity</p>
              <p className="mt-1 text-[13px] font-medium text-[rgba(245,242,238,0.42)]">Your last study actions</p>

              <div className="mt-5">
                {recentActivity.length ? (
                  recentActivity.map((session) => (
                    <button
                      key={session.id}
                      type="button"
                      onClick={() => onSelectSession(session.id)}
                      className="flex h-11 w-full items-center justify-between border-b border-white/4 text-left transition hover:text-white"
                    >
                      <span className="text-[14px] font-medium text-[rgba(245,242,238,0.78)]">
                        {formatSessionDate(session.startedAt)} — {formatDuration(session.startedAt, session.endedAt)}
                      </span>
                      <span className="rounded-full border border-white/6 bg-white/4 px-3 py-1 text-[12px] font-semibold text-[rgba(245,242,238,0.62)]">
                        {session.status}
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="pt-8">
                    <p className="text-[14px] font-medium text-[#F5F2EE]">No recent session yet</p>
                    <p className="mt-2 text-[13px] font-medium text-[rgba(245,242,238,0.42)]">
                      Your completed sessions will appear here.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[22px] border border-white/5 bg-[rgba(10,10,14,0.38)] p-5">
              <p className="text-[18px] font-semibold text-[#F5F2EE]">Open tools</p>
              <p className="mt-1 text-[13px] font-medium text-[rgba(245,242,238,0.42)]">Jump into the part you need</p>

              <div className="mt-5 grid grid-cols-2 gap-4">
                {[
                  ['todo', 'To-Do', 'Plan your next tasks'],
                  ['quick-notes', 'Quick Notes', 'Capture loose thoughts'],
                  ['reminders', 'Reminders', 'Track what comes next'],
                  ['timestamp-notes', 'Timestamp Notes', 'Review timed notes']
                ].map(([key, title, subtitle]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => openPanel(key)}
                    className="flex h-[76px] flex-col items-start justify-center rounded-[18px] border border-white/5 bg-white/4 px-4 text-left transition hover:bg-white/7"
                  >
                    <span className="text-[15px] font-semibold text-[#F5F2EE]">{title}</span>
                    <span className="mt-1 text-[13px] font-medium text-[rgba(245,242,238,0.42)]">{subtitle}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <aside className="h-full rounded-[24px] border border-white/5 bg-white/3 p-5 backdrop-blur-[8px]">
          <div>
            <p className="text-[18px] font-semibold text-[#F5F2EE]">Session defaults</p>
            <div className="mt-4 space-y-2">
              {[
                ['Focus', `${settingsSnapshot.defaultFocusMinutes} min`],
                ['Break', `${settingsSnapshot.defaultBreakMinutes} min`],
                ['Long break', `${settingsSnapshot.longBreakMinutes} min`]
              ].map(([label, value]) => (
                <div key={label} className="flex h-[34px] items-center justify-between text-[14px] font-medium">
                  <span className="text-[rgba(245,242,238,0.56)]">{label}</span>
                  <span className="text-[#F5F2EE]">{value}</span>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => openPanel('settings')}
              className="mt-4 text-[13px] font-semibold text-[#FF8A3D] transition hover:text-[#ffab75]"
            >
              Edit settings
            </button>
          </div>

          <div className="mt-8">
            <p className="text-[18px] font-semibold text-[#F5F2EE]">Timestamp notes</p>
            {activeSession ? (
              <button
                type="button"
                onClick={() => {
                  onSelectSession(activeSession.id);
                  openPanel('timestamp-notes');
                }}
                className="mt-3 text-left"
              >
                <p className="text-[14px] font-medium text-[#F5F2EE]">Open session notes</p>
                <p className="mt-1 text-[13px] font-medium text-[rgba(245,242,238,0.42)]">Add or review notes with timestamps.</p>
              </button>
            ) : (
              <p className="mt-3 text-[14px] font-medium text-[rgba(245,242,238,0.42)]">Available during a session</p>
            )}
          </div>

          <div className="mt-8">
            <p className="text-[18px] font-semibold text-[#F5F2EE]">Reminder summary</p>
            {nextReminder ? (
              <div className="mt-3">
                <p className="text-[14px] font-medium text-[#F5F2EE]">
                  {new Date(nextReminder.dueAt).toLocaleString(undefined, {
                    weekday: 'short',
                    hour: 'numeric',
                    minute: '2-digit'
                  })}
                </p>
                <p className="mt-1 text-[13px] font-medium text-[rgba(245,242,238,0.42)]">{nextReminder.title}</p>
              </div>
            ) : (
              <p className="mt-3 text-[14px] font-medium text-[rgba(245,242,238,0.42)]">No upcoming reminder</p>
            )}
          </div>
        </aside>
      </main>

      <AnimatePresence>
        {activePanel ? (
          <>
            <motion.button
              type="button"
              aria-label="Close panel"
              className="fixed inset-0 z-20 bg-black/28"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActivePanel(null)}
            />
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="fixed left-1/2 top-[100px] z-30 h-[calc(100vh-124px)] w-[min(1120px,calc(100%-48px))] -translate-x-1/2 overflow-auto rounded-[28px] border border-white/6 bg-[rgba(18,16,24,0.9)] p-7 shadow-[0_30px_90px_rgba(0,0,0,0.34)] backdrop-blur-[18px]"
            >
              {renderPanel()}
            </motion.section>
          </>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {historyOpen ? (
          <>
            <motion.button
              type="button"
              aria-label="Close history"
              className="fixed inset-0 z-20 bg-black/28"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setHistoryOpen(false)}
            />
            <motion.aside
              initial={{ x: 380 }}
              animate={{ x: 0 }}
              exit={{ x: 380 }}
              transition={{ duration: 0.24, ease: 'easeOut' }}
              className="fixed right-0 top-0 z-30 flex h-screen w-[360px] flex-col border-l border-white/8 bg-[rgba(18,16,24,0.92)] p-6 backdrop-blur-[18px]"
            >
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-[#F5F2EE]">Session History</h2>
                <button
                  type="button"
                  onClick={() => setHistoryOpen(false)}
                  className="text-sm font-medium text-[rgba(245,242,238,0.56)] transition hover:text-[#F5F2EE]"
                >
                  Close
                </button>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                {historySessions.length === 0 ? (
                  <EmptyState title="No past sessions" copy="Completed sessions will appear here." />
                ) : (
                  historySessions.map((session) => (
                    <div
                      key={session.id}
                      className="rounded-[14px] border border-white/6 bg-white/4 px-4 py-4 transition hover:bg-white/8"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            onSelectSession(session.id);
                            setHistoryOpen(false);
                            setActivePanel('timestamp-notes');
                          }}
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm font-medium text-white/90">{formatSessionDate(session.startedAt)}</span>
                            <span className="rounded-full bg-white/8 px-2.5 py-1 text-xs text-white/70">{session.status}</span>
                          </div>
                          <p className="mt-2 text-sm text-white/72">{formatDuration(session.startedAt, session.endedAt)}</p>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteSession?.(session.id)}
                          className="shrink-0 rounded-[10px] border border-white/8 bg-white/6 px-3 py-2 text-xs font-semibold text-[rgba(245,242,238,0.72)] transition hover:border-[rgba(255,92,122,0.34)] hover:bg-[rgba(255,92,122,0.12)] hover:text-white"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export default WorkspaceHome;

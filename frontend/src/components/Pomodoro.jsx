import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BrandMark } from './AppLogo';
import PremiumChefPomodoroScene from './PremiumChefPomodoroScene';
import { InlineAlert } from './ui';

const API_URL = 'http://localhost:3000';

function formatMMSS(totalSec) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function clampInt(n, min, max) {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v)) return min;
  return Math.min(max, Math.max(min, v));
}

function getPhaseDurationSec(state) {
  return state.currentPhase === 'BREAK' ? state.breakDurationSec : state.focusDurationSec;
}

function applyElapsedSeconds(state, elapsedSec) {
  let s = { ...state };
  let elapsed = Math.max(0, Math.floor(elapsedSec));

  while (elapsed > 0) {
    const phaseDuration = getPhaseDurationSec(s);
    if (!Number.isFinite(s.remainingSec) || s.remainingSec <= 0) {
      s.remainingSec = phaseDuration;
    }

    if (elapsed < s.remainingSec) {
      s.remainingSec -= elapsed;
      if (s.currentPhase === 'FOCUS') s.totalFocusedSec += elapsed;
      else s.totalBreakSec += elapsed;
      elapsed = 0;
    } else {
      const consumed = s.remainingSec;
      if (s.currentPhase === 'FOCUS') s.totalFocusedSec += consumed;
      else s.totalBreakSec += consumed;
      elapsed -= consumed;

      s.currentPhase = s.currentPhase === 'FOCUS' ? 'BREAK' : 'FOCUS';
      s.remainingSec = getPhaseDurationSec(s);
    }
  }

  return s;
}

function getPhaseCopy(phase, progressPercent, isRunning) {
  if (phase === 'BREAK') {
    return {
      label: 'Resting',
      line: 'Let the kitchen settle.'
    };
  }

  if (!isRunning && progressPercent === 0) {
    return {
      label: 'Focus',
      line: 'One task at a time.'
    };
  }

  if (progressPercent < 25) {
    return {
      label: 'Preparation',
      line: 'Stay with this session.'
    };
  }

  if (progressPercent < 70) {
    return {
      label: 'Cooking steadily',
      line: 'One task at a time.'
    };
  }

  return {
    label: 'Serving soon',
    line: 'Stay with this session.'
  };
}

function Pomodoro({ sessionId, onNotify, onOpenManagement, onCloseSession, closingBusy }) {
  const [state, setState] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [screenEveryMin, setScreenEveryMin] = useState(50);
  const [waterEveryMin, setWaterEveryMin] = useState(30);
  const [toast, setToast] = useState(null);

  const tickIntervalRef = useRef(null);
  const saveIntervalRef = useRef(null);
  const focusSinceScreenRef = useRef(0);
  const focusSinceWaterRef = useRef(0);
  const snoozeUntilRef = useRef({ screen: 0, water: 0 });

  const phaseDuration = useMemo(() => {
    if (!state) return 1500;
    return getPhaseDurationSec(state);
  }, [state]);

  const progressPercent = useMemo(() => {
    if (!state) return 0;
    const denom = Math.max(1, phaseDuration);
    return Math.max(0, Math.min(100, ((phaseDuration - state.remainingSec) / denom) * 100));
  }, [phaseDuration, state]);

  const progress = useMemo(() => {
    if (!state) return 0;
    return Math.max(0, Math.min(1, progressPercent / 100));
  }, [progressPercent, state]);

  const phaseInfo = useMemo(
    () => getPhaseCopy(state?.currentPhase || 'FOCUS', progressPercent, Boolean(state?.isRunning)),
    [progressPercent, state]
  );

  useEffect(() => {
    if (!state || typeof window === 'undefined') return;

    const phase = state.currentPhase === 'BREAK' ? 'BREAK' : 'FOCUS';
    const paused = !state.isRunning;
    const payload = {
      type: 'STUDYCOMP_FOCUS_STATE',
      phase,
      paused,
      remainingSec: state.remainingSec,
      phaseDurationSec: phaseDuration,
      progressPercent,
      timestamp: Date.now()
    };

    console.log('Posting focus state to extension:', payload);
    window.postMessage(payload, window.location.origin);
  }, [state?.currentPhase, state?.isRunning]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 8000);
    return () => clearTimeout(timer);
  }, [toast]);

  const stopIntervals = () => {
    if (tickIntervalRef.current) {
      clearInterval(tickIntervalRef.current);
      tickIntervalRef.current = null;
    }
    if (saveIntervalRef.current) {
      clearInterval(saveIntervalRef.current);
      saveIntervalRef.current = null;
    }
  };

  const saveToBackend = async (nextState, { updateLastTick } = { updateLastTick: false }) => {
    const nowIso = new Date().toISOString();
    const payload = {
      ...nextState,
      lastTickAt: updateLastTick ? nowIso : nextState.lastTickAt
    };

    try {
      const res = await fetch(`${API_URL}/sessions/${sessionId}/pomodoro`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Failed to save pomodoro state');
      const saved = await res.json();
      setState(saved);
      return saved;
    } catch (e) {
      setError(e.message);
      return null;
    }
  };

  const startTicking = () => {
    stopIntervals();

    tickIntervalRef.current = setInterval(() => {
      setState((prev) => {
        if (!prev || !prev.isRunning) return prev;

        const next = { ...prev };
        next.remainingSec = Math.max(0, next.remainingSec - 1);
        if (next.currentPhase === 'FOCUS') next.totalFocusedSec += 1;
        else next.totalBreakSec += 1;

        if (prev.currentPhase === 'FOCUS') {
          focusSinceScreenRef.current += 1;
          focusSinceWaterRef.current += 1;

          const screenThresholdSec = (prev.reminderScreenEveryMin || 50) * 60;
          const waterThresholdSec = (prev.reminderWaterEveryMin || 30) * 60;
          const now = Date.now();

          if (
            focusSinceScreenRef.current >= screenThresholdSec &&
            now >= snoozeUntilRef.current.screen &&
            (!toast || toast.type !== 'screen')
          ) {
            setToast({
              type: 'screen',
              message: 'Rest your eyes for a moment.'
            });
            focusSinceScreenRef.current = 0;
          }

          if (
            focusSinceWaterRef.current >= waterThresholdSec &&
            now >= snoozeUntilRef.current.water &&
            (!toast || toast.type !== 'water')
          ) {
            setToast({
              type: 'water',
              message: 'Take a few sips and reset.'
            });
            focusSinceWaterRef.current = 0;
          }
        }

        if (next.remainingSec === 0) {
          next.currentPhase = next.currentPhase === 'FOCUS' ? 'BREAK' : 'FOCUS';
          next.remainingSec = getPhaseDurationSec(next);
          saveToBackend({ ...next, lastTickAt: new Date().toISOString() }, { updateLastTick: false });

          onNotify?.(
            next.currentPhase === 'BREAK' ? 'Break started' : 'Focus started',
            next.currentPhase === 'BREAK'
              ? 'Use the break intentionally.'
              : 'Break complete. Time to focus again.'
          );
        }

        return next;
      });
    }, 1000);

    saveIntervalRef.current = setInterval(() => {
      setState((prev) => {
        if (!prev || !prev.isRunning) return prev;
        const toSave = { ...prev, lastTickAt: new Date().toISOString() };
        saveToBackend(toSave, { updateLastTick: false });
        return prev;
      });
    }, 12000);
  };

  const onStart = async () => {
    if (!state) return;
    const nowIso = new Date().toISOString();
    const next = { ...state, isRunning: true, lastTickAt: nowIso };
    setState(next);
    await saveToBackend(next);
    startTicking();
    onNotify?.('Timer started', 'The focus session is running.');
  };

  const onPause = async () => {
    if (!state) return;
    stopIntervals();
    const next = {
      ...state,
      isRunning: false,
      lastTickAt: null,
      pauseCount: (state.pauseCount || 0) + 1
    };
    setState(next);
    await saveToBackend(next);
  };

  const onResume = async () => {
    if (!state) return;
    const nowIso = new Date().toISOString();
    const next = {
      ...state,
      isRunning: true,
      lastTickAt: nowIso,
      resumeTimestamps: Array.isArray(state.resumeTimestamps)
        ? [...state.resumeTimestamps, nowIso]
        : [nowIso]
    };
    setState(next);
    await saveToBackend(next);
    startTicking();
  };

  const onReset = async () => {
    if (!state) return;
    stopIntervals();
    const next = {
      ...state,
      isRunning: false,
      lastTickAt: null,
      remainingSec: getPhaseDurationSec(state)
    };
    setState(next);
    await saveToBackend(next);
    focusSinceScreenRef.current = 0;
    focusSinceWaterRef.current = 0;
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      stopIntervals();

      try {
        const res = await fetch(`${API_URL}/sessions/${sessionId}/pomodoro`);
        if (!res.ok) throw new Error('Failed to load pomodoro state');
        const data = await res.json();
        if (cancelled) return;

        setScreenEveryMin(data.reminderScreenEveryMin || 50);
        setWaterEveryMin(data.reminderWaterEveryMin || 30);

        let corrected = { ...data };

        if (data.isRunning && data.lastTickAt) {
          const last = new Date(data.lastTickAt).getTime();
          const now = Date.now();
          const elapsedSec = Math.floor((now - last) / 1000);
          if (elapsedSec > 0) {
            corrected = applyElapsedSeconds(corrected, elapsedSec);
          }
          corrected.lastTickAt = new Date().toISOString();
          setState(corrected);
          await saveToBackend(corrected);
          startTicking();
        } else {
          setState(corrected);
        }
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
      stopIntervals();
    };
  }, [sessionId]);

  if (loading) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#17111f] text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(244,114,182,0.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(251,191,36,0.14),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.14),transparent_28%),linear-gradient(180deg,#17111f_0%,#1d1526_45%,#141821_100%)]" />
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative z-10 text-center">
          <p className="text-sm uppercase tracking-[0.32em] text-slate-400">Focus mode</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.05em]">Loading session</h1>
        </motion.div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#17111f] p-6 text-white">
        <InlineAlert tone="danger">Failed to load Pomodoro state.</InlineAlert>
      </div>
    );
  }

  const radius = 150;
  const stroke = 12;
  const normalizedRadius = radius - stroke * 0.5;
  const circumference = 2 * Math.PI * normalizedRadius;
  const dashOffset = circumference * (1 - progress);
  const hasEverStarted =
    (state.totalFocusedSec || 0) + (state.totalBreakSec || 0) > 0 ||
    (state.pauseCount || 0) > 0 ||
    state.remainingSec !== phaseDuration;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#17111f] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(244,114,182,0.2),transparent_30%),radial-gradient(circle_at_top_right,rgba(251,191,36,0.12),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.16),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(249,115,22,0.12),transparent_24%),linear-gradient(180deg,#17111f_0%,#1d1526_48%,#141821_100%)]" />
      <div className="absolute inset-0">
        <PremiumChefPomodoroScene progress={progress} phase={state.currentPhase} paused={!state.isRunning} />
      </div>
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(23,17,31,0.18)_0%,rgba(23,17,31,0.08)_28%,rgba(20,24,33,0.42)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_44%,rgba(255,255,255,0.08),transparent_22%),radial-gradient(circle_at_50%_75%,rgba(255,255,255,0.05),transparent_28%)]" />
      <div className="absolute -left-24 top-16 h-72 w-72 rounded-full bg-rose-400/16 blur-3xl" />
      <div className="absolute right-0 top-1/3 h-80 w-80 rounded-full bg-orange-400/15 blur-3xl" />

      <div className="relative z-10 flex min-h-screen flex-col">
        <motion.header
          initial={{ opacity: 0, y: -24 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between px-6 py-5 md:px-10"
        >
          <div className="flex items-center gap-3">
            <BrandMark className="!h-11 !w-11 rounded-2xl !border-white/10 !bg-white/10 backdrop-blur-xl" />
            <div>
              <p className="text-sm font-medium text-white/90">Study Companion</p>
              <p className="text-xs uppercase tracking-[0.28em] text-white/45">Focus mode</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onOpenManagement}
              className="rounded-full border border-white/15 bg-white/8 px-4 py-2 text-sm text-white/70 backdrop-blur-xl transition hover:bg-white/14 hover:text-white"
            >
              Back to workspace
            </button>
            <button
              type="button"
              onClick={onCloseSession}
              disabled={closingBusy}
              className="rounded-full border border-white/15 bg-white/8 px-4 py-2 text-sm text-white/70 backdrop-blur-xl transition hover:bg-white/14 hover:text-white disabled:opacity-50"
            >
              End session
            </button>
          </div>
        </motion.header>

        <main className="flex flex-1 items-stretch px-6 pb-10 md:px-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut', delay: 0.4 }}
            className="w-full"
          >
            <div className="mx-auto flex h-full w-full max-w-6xl items-center justify-center">
              <div className="flex h-full w-full flex-col items-center justify-between py-4 text-center">
                <div className="min-h-[48px]">{error ? <InlineAlert tone="danger">{error}</InlineAlert> : null}</div>

                <div className="flex flex-1 flex-col items-center justify-center">
                  <motion.div
                    animate={{ scale: state.isRunning ? 1 : 0.992 }}
                    transition={{ duration: 0.8, ease: 'easeInOut' }}
                    className="relative flex items-center justify-center"
                  >
                    <div className="absolute h-[22rem] w-[22rem] rounded-full bg-white/10 blur-3xl" />
                    <div className="absolute h-[16rem] w-[16rem] rounded-full border border-white/6 bg-black/12 backdrop-blur-[4px]" />
                    <svg viewBox={`0 0 ${radius * 2} ${radius * 2}`} className="h-[20rem] w-[20rem] -rotate-90 md:h-[22rem] md:w-[22rem]">
                      <circle
                        stroke="rgba(255,255,255,0.12)"
                        fill="transparent"
                        strokeWidth={stroke}
                        r={normalizedRadius}
                        cx={radius}
                        cy={radius}
                      />
                      <motion.circle
                        stroke={state.currentPhase === 'BREAK' ? 'rgba(226,232,240,0.92)' : 'url(#focusRing)'}
                        fill="transparent"
                        strokeWidth={stroke}
                        strokeLinecap="round"
                        strokeDasharray={`${circumference} ${circumference}`}
                        animate={{ strokeDashoffset: dashOffset }}
                        transition={{ duration: 0.8, ease: 'easeInOut' }}
                        r={normalizedRadius}
                        cx={radius}
                        cy={radius}
                      />
                      <defs>
                        <linearGradient id="focusRing" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#F97316" />
                          <stop offset="55%" stopColor="#FB7185" />
                          <stop offset="100%" stopColor="#A78BFA" />
                        </linearGradient>
                      </defs>
                    </svg>

                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <div className="text-[4rem] font-semibold tracking-[-0.08em] md:text-[5rem]">
                        {formatMMSS(state.remainingSec)}
                      </div>
                      <p className="mt-4 text-sm font-medium uppercase tracking-[0.26em] text-white/58">
                        {phaseInfo.label}
                      </p>
                      <p className="mt-2 text-sm text-white/68">{phaseInfo.line}</p>
                    </div>
                  </motion.div>
                </div>

                <div className="flex w-full flex-wrap items-center justify-center gap-3">
                  {!state.isRunning && !hasEverStarted ? (
                    <motion.button
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      type="button"
                      onClick={onStart}
                      className="rounded-full bg-[linear-gradient(135deg,#F97316_0%,#FB7185_100%)] px-7 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(249,115,22,0.28)]"
                    >
                      Start session
                    </motion.button>
                  ) : null}

                  {state.isRunning ? (
                    <motion.button
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      type="button"
                      onClick={onPause}
                      className="rounded-full border border-white/20 bg-white/10 px-7 py-3 text-sm font-medium text-white backdrop-blur-xl"
                    >
                      Pause
                    </motion.button>
                  ) : null}

                  {!state.isRunning && hasEverStarted ? (
                    <motion.button
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      type="button"
                      onClick={onResume}
                      className="rounded-full bg-[linear-gradient(135deg,#F97316_0%,#FB7185_100%)] px-7 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(249,115,22,0.28)]"
                    >
                      Resume
                    </motion.button>
                  ) : null}

                  {!state.isRunning && hasEverStarted ? (
                    <motion.button
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      type="button"
                      onClick={onReset}
                      className="rounded-full border border-white/15 bg-white/8 px-7 py-3 text-sm font-medium text-white/80 backdrop-blur-xl"
                    >
                      Reset
                    </motion.button>
                  ) : null}
                </div>
              </div>
            </div>
          </motion.div>
        </main>
      </div>

      <AnimatePresence>
        {toast ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="absolute bottom-6 left-1/2 z-20 -translate-x-1/2 rounded-full border border-white/12 bg-white/10 px-5 py-3 text-sm text-white/80 backdrop-blur-xl"
          >
            {toast.message}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export default Pomodoro;

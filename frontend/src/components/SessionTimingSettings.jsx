import { useEffect, useState } from 'react';
import { Button, InlineAlert, SectionHeader } from './ui';

const API_URL = 'http://localhost:3000';

function clampInt(value, min, max) {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed)) return min;
  return Math.min(max, Math.max(min, parsed));
}

function SessionTimingSettings({ sessionId, onNotify }) {
  const [state, setState] = useState(null);
  const [focusMinutes, setFocusMinutes] = useState(25);
  const [breakMinutes, setBreakMinutes] = useState(5);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_URL}/sessions/${sessionId}/pomodoro`);
        if (!response.ok) throw new Error('Failed to load session timing');
        const data = await response.json();
        if (cancelled) return;
        setState(data);
        setFocusMinutes(Math.round((data.focusDurationSec || 1500) / 60));
        setBreakMinutes(Math.round((data.breakDurationSec || 300) / 60));
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const saveTiming = async () => {
    if (!state) return;

    try {
      setSaving(true);
      setError(null);

      const nextFocusSec = clampInt(focusMinutes, 1, 240) * 60;
      const nextBreakSec = clampInt(breakMinutes, 1, 120) * 60;
      const isBreak = state.currentPhase === 'BREAK';

      const payload = {
        ...state,
        focusDurationSec: nextFocusSec,
        breakDurationSec: nextBreakSec,
        remainingSec: isBreak ? nextBreakSec : nextFocusSec
      };

      const response = await fetch(`${API_URL}/sessions/${sessionId}/pomodoro`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error('Failed to save session timing');

      const saved = await response.json();
      setState(saved);
      setFocusMinutes(Math.round((saved.focusDurationSec || nextFocusSec) / 60));
      setBreakMinutes(Math.round((saved.breakDurationSec || nextBreakSec) / 60));
      onNotify?.('Session timing updated', 'Focus and break minutes were saved.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="stack-md">
        <SectionHeader
          eyebrow="Session timing"
          title="Session timing"
          subtitle="Loading timing settings."
        />
      </div>
    );
  }

  return (
    <div className="stack-md">
      <SectionHeader
        eyebrow="Session timing"
        title="Session timing"
        subtitle="Set the focus and break length for this session."
      />

      {error ? <InlineAlert tone="danger">{error}</InlineAlert> : null}

      <div className="list-card stack-md">
        <div className="notes-timestamp-row">
          <div className="field">
            <label className="field-label">Focus minutes</label>
            <input
              className="input"
              type="number"
              min={1}
              max={240}
              value={focusMinutes}
              onChange={(e) => setFocusMinutes(e.target.value)}
            />
          </div>

          <div className="field">
            <label className="field-label">Break minutes</label>
            <input
              className="input"
              type="number"
              min={1}
              max={120}
              value={breakMinutes}
              onChange={(e) => setBreakMinutes(e.target.value)}
            />
          </div>
        </div>

        <Button variant="primary" onClick={saveTiming} busy={saving} disabled={saving}>
          Save timing
        </Button>
      </div>
    </div>
  );
}

export default SessionTimingSettings;

import { Badge, Button } from './ui';

function SessionOverviewCard({
  session,
  formatDuration,
  onEndSession,
  endingBusy,
  onStartNextBlock,
  loading,
  compact = false
}) {
  if (!session) return null;

  const statusTone = session.status === 'active' ? 'success' : 'neutral';

  if (compact) {
    return (
      <div className="session-overview-compact">
        <div className="space-between" style={{ alignItems: 'flex-start' }}>
          <div className="stack-sm">
            <div className="chip-row">
              <Badge tone={statusTone}>{session.status}</Badge>
              <span className="session-detail-meta">Session {session.id.slice(0, 8)}</span>
            </div>
            <h2 className="section-title" style={{ fontSize: '1.4rem' }}>You&apos;re in a live session.</h2>
            <p className="section-subtitle">Keep the timer, notes, and next actions close while you work.</p>
          </div>

          <Button variant="danger" onClick={onEndSession} busy={endingBusy} disabled={endingBusy}>
            End session
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="session-overview-review">
      <div className="stack-md">
        <div className="space-between" style={{ alignItems: 'flex-start' }}>
          <div className="stack-sm">
            <Badge tone={statusTone}>{session.status}</Badge>
            <h2 className="hero-title">This session is complete.</h2>
            <p className="page-subtitle">
              Review what happened here, then begin the next session when you&apos;re ready.
            </p>
          </div>
          <Button variant="primary" onClick={onStartNextBlock} busy={loading} disabled={loading}>
            Start next session
          </Button>
        </div>

        <div className="detail-list">
          <div className="detail-item">
            <div className="detail-label">Duration</div>
            <div className="detail-value">{formatDuration(session.startedAt, session.endedAt)}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Started</div>
            <div className="detail-value">{new Date(session.startedAt).toLocaleString()}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Ended</div>
            <div className="detail-value">{session.endedAt ? new Date(session.endedAt).toLocaleString() : 'Still active'}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Session ID</div>
            <div className="detail-value mono">{session.id}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SessionOverviewCard;

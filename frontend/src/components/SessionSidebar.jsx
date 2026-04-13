import AppLogo from './AppLogo';
import { Button, Card, EmptyState, Icon } from './ui';

function SessionSidebar({
  sessions,
  selectedSessionId,
  onSelectSession,
  onStartSession,
  loading,
  formatDuration
}) {
  const activeSession = sessions.find((session) => session.status === 'active') || null;
  const completedSessions = sessions.filter((session) => session.status !== 'active');
  const recentSessions = completedSessions.slice(0, 5);
  const olderSessions = completedSessions.slice(5);

  const renderSessionButton = (session, variant = 'compact') => {
    const isSelected = selectedSessionId === session.id;
    const classes = [
      'session-item',
      variant === 'active' ? 'session-item-active-card' : '',
      variant === 'older' ? 'session-item-row' : '',
      isSelected ? 'is-active' : ''
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <button
        key={session.id}
        type="button"
        className={classes}
        onClick={() => onSelectSession(session.id)}
      >
        <div className="session-item-glow" />
        <div className="space-between" style={{ alignItems: 'flex-start' }}>
          <div className="session-meta">
            <div className="meta-row">
              <span className="session-icon">
                <Icon name={session.status === 'active' ? 'timer' : 'list'} size={14} />
              </span>
              <p className="session-title">Session {session.id.slice(0, 8)}</p>
            </div>
            <span className="session-date">{new Date(session.startedAt).toLocaleString()}</span>
            {variant !== 'older' ? (
              <span className="session-date">Duration {formatDuration(session.startedAt, session.endedAt)}</span>
            ) : null}
          </div>
          <span className={`text-pill ${session.status === 'active' ? 'text-pill-accent' : ''}`}>
            {session.status === 'active' ? 'Active' : 'Done'}
          </span>
        </div>
      </button>
    );
  };

  return (
    <div className="sidebar-column">
      <Card className="sidebar-surface">
        <div className="stack-lg">
          <div className="sidebar-brand stack-md">
            <AppLogo />
              <Button variant="primary" onClick={onStartSession} busy={loading} disabled={loading} fullWidth>
                <Icon name="plus" size={14} />
              Start session
              </Button>
          </div>

          {sessions.length === 0 ? (
            <EmptyState
              title="No sessions yet"
              copy="Choose a session to continue or review."
              action={
                <Button variant="secondary" onClick={onStartSession} busy={loading} disabled={loading}>
                  Start the first session
                </Button>
              }
            />
          ) : (
            <div className="stack-lg">
              {activeSession ? (
                <div className="stack-sm">
                  <p className="eyebrow">Active</p>
                  {renderSessionButton(activeSession, 'active')}
                </div>
              ) : null}

              <div className="stack-sm">
                <p className="eyebrow">Recent</p>
                {recentSessions.length ? (
                  <div className="session-list">
                    {recentSessions.map((session) => renderSessionButton(session))}
                  </div>
                ) : (
                  <p className="section-subtitle">Choose a session to continue or review.</p>
                )}
              </div>

              {olderSessions.length ? (
                <details className="older-session-group" open={false}>
                  <summary className="older-session-toggle">Older</summary>
                  <div className="session-list session-list-older">
                    {olderSessions.map((session) => renderSessionButton(session, 'older'))}
                  </div>
                </details>
              ) : null}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

export default SessionSidebar;

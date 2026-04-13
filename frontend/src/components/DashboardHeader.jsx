import { Badge, Button, Icon, Card } from './ui';

function DashboardHeader({ activeSession, totalSessions, activeCount, completedCount, onStartSession, loading }) {
  return (
    <Card className="hero-panel app-hero-shell">
      <div className="hero-topline">
        <Badge tone={activeSession ? 'success' : 'neutral'}>
          {activeSession ? 'A live study session is underway' : 'Ready when you start'}
        </Badge>
        <Button variant="primary" onClick={onStartSession} busy={loading} disabled={loading}>
          <Icon name="plus" size={16} />
          Start session
        </Button>
      </div>

      <div className="stack-sm">
        <h1 className="page-title">Stay focused in one calm place.</h1>
        <div className="chip-row">
          <span className="text-pill">{totalSessions} logged</span>
          <span className="text-pill text-pill-accent">{activeCount} active</span>
          <span className="text-pill">{completedCount} done</span>
        </div>
      </div>
    </Card>
  );
}

export default DashboardHeader;

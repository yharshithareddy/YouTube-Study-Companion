import { Button } from './ui';

function SessionSummaryModal({ open, summary, onStartNextBlock, onReviewNotes, onClose, loading }) {
  if (!open || !summary) return null;

  const stats = [
    { label: 'Focused', value: `${summary.summary.focusMinutes} min` },
    { label: 'Notes', value: `${summary.summary.notes}` },
    { label: 'Tasks done', value: `${summary.summary.tasksCompleted}` },
    { label: 'Pauses', value: `${summary.summary.pauses}` }
  ];

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="session-summary-modal stack-md">
        <div className="stack-sm">
          <div className="session-summary-mark" aria-hidden="true">+</div>
          <p className="session-summary-kicker">Session complete</p>
          <h2 className="session-summary-title">You stayed with it.</h2>
        </div>

        <div className="session-summary-grid">
          {stats.map((stat) => (
            <div key={stat.label} className="session-summary-stat">
              <p className="session-summary-stat-label">{stat.label}</p>
              <p className="session-summary-stat-value">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="session-summary-insight">
          <p className="section-title">Insight</p>
          <p className="section-subtitle">{summary.insight.insightText}</p>
        </div>

        <div className="inline-actions">
          <Button variant="primary" onClick={onStartNextBlock} busy={loading} disabled={loading}>
            Start next session
          </Button>
          <Button variant="secondary" onClick={onReviewNotes}>
            Review notes
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

export default SessionSummaryModal;

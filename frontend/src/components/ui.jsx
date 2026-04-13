import { BrandMark } from './AppLogo';

function cn(...parts) {
  return parts.filter(Boolean).join(' ');
}

export function Icon({ name, size = 18, className = '' }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '1.8',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    className
  };

  const icons = {
    plus: (
      <path d="M12 5v14M5 12h14" />
    ),
    play: (
      <path d="M8 6l10 6-10 6z" />
    ),
    pause: (
      <>
        <path d="M9 6v12" />
        <path d="M15 6v12" />
      </>
    ),
    rotate: (
      <>
        <path d="M3 12a9 9 0 101.9-5.6" />
        <path d="M3 4v4h4" />
      </>
    ),
    skip: (
      <>
        <path d="M5 6l8 6-8 6z" />
        <path d="M17 6v12" />
      </>
    ),
    timer: (
      <>
        <circle cx="12" cy="13" r="8" />
        <path d="M12 13l3-2" />
        <path d="M9 2h6" />
      </>
    ),
    spark: (
      <>
        <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z" />
      </>
    ),
    chevron: (
      <path d="M9 6l6 6-6 6" />
    ),
    list: (
      <>
        <path d="M9 6h11" />
        <path d="M9 12h11" />
        <path d="M9 18h11" />
        <path d="M4 6h.01" />
        <path d="M4 12h.01" />
        <path d="M4 18h.01" />
      </>
    )
  };

  return <svg {...common}>{icons[name] || icons.spark}</svg>;
}

export function Button({
  children,
  className,
  variant = 'secondary',
  size,
  fullWidth = false,
  busy = false,
  ...props
}) {
  return (
    <button
      className={cn(
        'button',
        `button-${variant}`,
        size ? `button-${size}` : '',
        fullWidth ? 'button-full' : '',
        className
      )}
      {...props}
    >
      {busy && <span className={cn('spinner', variant === 'secondary' || variant === 'ghost' ? 'spinner-dark' : '')} />}
      {children}
    </button>
  );
}

export function Card({ children, className = '', padded = true }) {
  return <section className={cn('glass-card', padded ? 'card-section' : '', className)}>{children}</section>;
}

export function Badge({ children, tone = 'neutral', className = '' }) {
  return <span className={cn('badge', `badge-${tone}`, className)}>{children}</span>;
}

export function SectionHeader({ eyebrow, title, subtitle, action }) {
  return (
    <div className="space-between">
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h2 className="section-title">{title}</h2>
        {subtitle ? <p className="section-subtitle">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ title, copy, action }) {
  return (
    <div className="empty-state">
      <div className="empty-icon" aria-hidden="true">
        <BrandMark className="brand-mark-mini" />
      </div>
      <p className="empty-title">{title}</p>
      {copy ? <p className="empty-copy">{copy}</p> : null}
      {action ? <div style={{ marginTop: 14 }}>{action}</div> : null}
    </div>
  );
}

export function ToastStack({ toasts, onDismiss }) {
  if (!toasts?.length) return null;

  return (
    <div className="app-toast-stack" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <div key={toast.id} className="toast">
          <div className="space-between" style={{ alignItems: 'flex-start' }}>
            <div>
              <p className="toast-title">{toast.title}</p>
              {toast.message ? <p className="toast-copy">{toast.message}</p> : null}
            </div>
            <Button variant="ghost" size="sm" onClick={() => onDismiss(toast.id)}>
              <Icon name="chevron" size={14} />
              Close
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  onConfirm,
  onCancel,
  busy = false
}) {
  if (!open) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card stack-md">
        <div className="stack-sm">
          <p className="eyebrow">Confirm action</p>
          <h2 className="section-title" style={{ fontSize: '1.4rem' }}>{title}</h2>
          <p className="muted-copy">{description}</p>
        </div>
        <div className="inline-actions">
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button variant={tone} onClick={onConfirm} busy={busy} disabled={busy}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function InlineAlert({ children, tone = 'danger' }) {
  return <div className={cn('alert', `alert-${tone}`)}>{children}</div>;
}

export function SkeletonBlock({ height = 18 }) {
  return <div className="skeleton" style={{ height }} />;
}

export { cn };

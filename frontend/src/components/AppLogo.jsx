export function BrandMark({ className = '' }) {
  return (
    <div className={`brand-mark ${className}`.trim()} aria-hidden="true">
      <svg viewBox="0 0 64 64" className="brand-mark-svg">
        <defs>
          <linearGradient id="brandFocus" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4f46e5" />
            <stop offset="100%" stopColor="#2563eb" />
          </linearGradient>
          <clipPath id="headShape">
            <path d="M39 12c-9.8 0-17 7.7-17 18.5 0 5.1 1.7 9.4 5.2 12.7 1.6 1.5 2.8 3.2 2.8 5.1V52h10.6v-4.5c0-1.7 1-3.2 2.4-4.6 2.3-2.2 3.8-5 4.4-8.5-.7-.1-1.4-.4-2-.9-1.5-1-2.4-2.6-2.4-4.3 0-1.9 1-3.6 2.8-4.6-.7-6.8-6.2-12-14.8-12z" />
          </clipPath>
        </defs>
        <rect x="8" y="8" width="48" height="48" rx="18" fill="rgba(255,255,255,0.94)" stroke="rgba(79,70,229,0.12)" />
        <g clipPath="url(#headShape)">
          <rect x="18" y="12" width="14" height="40" fill="rgba(148,163,184,0.08)" />
          <rect x="32" y="12" width="16" height="40" fill="rgba(79,70,229,0.08)" />

          <circle cx="27" cy="22" r="1.9" fill="rgba(148,163,184,0.72)" />
          <circle cx="24" cy="27.5" r="1.5" fill="rgba(148,163,184,0.54)" />
          <circle cx="29.4" cy="31" r="1.6" fill="rgba(148,163,184,0.56)" />
          <circle cx="25.5" cy="36.2" r="1.8" fill="rgba(148,163,184,0.5)" />
          <circle cx="30.6" cy="40.5" r="1.4" fill="rgba(148,163,184,0.46)" />
          <path d="M24.7 29.2l4.2 1.8" stroke="rgba(148,163,184,0.42)" strokeWidth="1.3" strokeLinecap="round" />
          <path d="M26 36l3.8-4.6" stroke="rgba(148,163,184,0.4)" strokeWidth="1.3" strokeLinecap="round" />

          <circle cx="35.4" cy="22.2" r="1.7" fill="url(#brandFocus)" />
          <circle cx="40.8" cy="22.2" r="1.7" fill="url(#brandFocus)" />
          <circle cx="35.4" cy="27.6" r="1.7" fill="url(#brandFocus)" />
          <circle cx="40.8" cy="27.6" r="1.7" fill="url(#brandFocus)" />
          <circle cx="35.4" cy="33" r="1.7" fill="url(#brandFocus)" />
          <circle cx="40.8" cy="33" r="1.7" fill="url(#brandFocus)" />
          <circle cx="35.4" cy="38.4" r="1.7" fill="url(#brandFocus)" />
          <circle cx="40.8" cy="38.4" r="1.7" fill="url(#brandFocus)" />
          <path d="M35.4 22.2h5.4M35.4 27.6h5.4M35.4 33h5.4M35.4 38.4h5.4" stroke="url(#brandFocus)" strokeWidth="1.2" strokeLinecap="round" opacity="0.85" />
        </g>
        <path d="M39 12c-9.8 0-17 7.7-17 18.5 0 5.1 1.7 9.4 5.2 12.7 1.6 1.5 2.8 3.2 2.8 5.1V52h10.6v-4.5c0-1.7 1-3.2 2.4-4.6 2.3-2.2 3.8-5 4.4-8.5-.7-.1-1.4-.4-2-.9-1.5-1-2.4-2.6-2.4-4.3 0-1.9 1-3.6 2.8-4.6-.7-6.8-6.2-12-14.8-12z" fill="none" stroke="rgba(79,70,229,0.92)" strokeWidth="2.6" strokeLinejoin="round" />
        <path d="M30.5 52h10" stroke="rgba(79,70,229,0.92)" strokeWidth="2.6" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function AppLogo({ compact = false }) {
  return (
    <div className={`brand-lockup ${compact ? 'brand-lockup-compact' : ''}`}>
      <BrandMark />
      <div className="brand-copy">
        <span className="brand-name">Study Companion</span>
        {!compact ? <span className="brand-tagline">Quiet structure for deliberate study</span> : null}
      </div>
    </div>
  );
}

export default AppLogo;

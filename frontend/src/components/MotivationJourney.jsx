import { useEffect, useMemo, useRef, useState } from 'react';

function MotivationJourney({ phase, focusDurationSec, remainingSec, isRunning }) {
  const prevPhaseRef = useRef(phase);
  const milestoneTimerRef = useRef(null);

  const [frozenFocusProgress, setFrozenFocusProgress] = useState(0);
  const [showServeMoment, setShowServeMoment] = useState(false);

  const focusProgress = useMemo(() => {
    if (phase !== 'FOCUS') return null;
    if (focusDurationSec <= 0) return 0;
    if (remainingSec >= focusDurationSec) return 0;
    if (remainingSec <= 0) return 1;

    return Math.min(1, Math.max(0, (focusDurationSec - remainingSec) / focusDurationSec));
  }, [phase, focusDurationSec, remainingSec]);

  useEffect(() => {
    const prevPhase = prevPhaseRef.current;

    if (prevPhase === 'BREAK' && phase === 'FOCUS') {
      setShowServeMoment(false);
      if (milestoneTimerRef.current) {
        clearTimeout(milestoneTimerRef.current);
        milestoneTimerRef.current = null;
      }
    }

    prevPhaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    if (phase === 'FOCUS' && focusProgress !== null) {
      setFrozenFocusProgress(focusProgress);

      if (focusProgress === 0 && showServeMoment) {
        setShowServeMoment(false);
      }

      if (focusProgress >= 0.98 && !showServeMoment) {
        setShowServeMoment(true);
        if (milestoneTimerRef.current) {
          clearTimeout(milestoneTimerRef.current);
        }
        milestoneTimerRef.current = setTimeout(() => {
          setShowServeMoment(false);
          milestoneTimerRef.current = null;
        }, 2600);
      }
    }
  }, [phase, focusProgress, showServeMoment]);

  useEffect(() => () => {
    if (milestoneTimerRef.current) {
      clearTimeout(milestoneTimerRef.current);
    }
  }, []);

  const displayProgress =
    phase === 'FOCUS' && focusProgress !== null
      ? focusProgress
      : phase === 'BREAK'
        ? frozenFocusProgress
        : 0;

  const prepOpacity = 1 - Math.min(1, displayProgress * 1.6);
  const simmerOpacity = Math.max(0.18, Math.min(1, (displayProgress - 0.12) * 2.1));
  const platingOpacity = Math.max(0, Math.min(1, (displayProgress - 0.58) * 2.5));
  const serveOpacity = Math.max(0, Math.min(1, (displayProgress - 0.82) * 5));
  const steamScale = phase === 'FOCUS' ? 0.65 + displayProgress * 0.55 : 0.45;
  const mealFill = Math.max(14, 14 + displayProgress * 36);
  const plateX = 188 + displayProgress * 84;
  const queueOpacity = phase === 'BREAK' ? 0.45 : 0.72 + displayProgress * 0.22;
  const ladleLift = phase === 'FOCUS' ? Math.max(0, Math.min(1, (displayProgress - 0.48) * 2.1)) : 0;
  const garnishOpacity = Math.max(0, Math.min(1, (displayProgress - 0.72) * 3.6));

  return (
    <div className={`list-card kitchen-card ${phase === 'FOCUS' ? 'kitchen-card-focus' : 'kitchen-card-break'}`}>
      <div className="stack-sm">
        <div className="meta-row">
          <span className="text-pill text-pill-accent">Focus ritual</span>
          <span className="session-detail-meta">
            {phase === 'FOCUS' ? (isRunning ? 'Preparing the meal' : 'Kitchen paused') : 'Kitchen resting'}
          </span>
        </div>

        <div className="kitchen-scene-wrap">
          <svg className="kitchen-scene" viewBox="0 0 420 220" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="wallGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f8fafc" />
                <stop offset="100%" stopColor="#eef2ff" />
              </linearGradient>
              <linearGradient id="counterTop" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#d6c6b0" />
                <stop offset="100%" stopColor="#eadfce" />
              </linearGradient>
              <linearGradient id="potFill" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#dc2626" />
              </linearGradient>
              <linearGradient id="bowlMeal" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fbbf24" />
                <stop offset="100%" stopColor="#fb923c" />
              </linearGradient>
              <linearGradient id="potMetal" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#475569" />
                <stop offset="50%" stopColor="#334155" />
                <stop offset="100%" stopColor="#1e293b" />
              </linearGradient>
              <linearGradient id="ladleMetal" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#e2e8f0" />
                <stop offset="100%" stopColor="#94a3b8" />
              </linearGradient>
              <linearGradient id="apron" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#93c5fd" />
                <stop offset="100%" stopColor="#60a5fa" />
              </linearGradient>
            </defs>

            <rect x="14" y="18" width="392" height="132" rx="26" fill="url(#wallGlow)" />
            <ellipse cx="96" cy="44" rx="48" ry="22" className="kitchen-light kitchen-light-a" />
            <ellipse cx="318" cy="38" rx="60" ry="26" className="kitchen-light kitchen-light-b" />
            <rect x="44" y="40" width="78" height="10" rx="5" className="kitchen-shelf" />
            <rect x="58" y="52" width="12" height="26" rx="6" className="shelf-jar" />
            <rect x="76" y="48" width="14" height="30" rx="7" className="shelf-jar shelf-jar-warm" />
            <rect x="96" y="54" width="10" height="24" rx="5" className="shelf-jar" />
            <rect x="300" y="42" width="72" height="10" rx="5" className="kitchen-shelf" />
            <rect x="314" y="52" width="12" height="24" rx="6" className="shelf-jar" />
            <rect x="332" y="48" width="14" height="28" rx="7" className="shelf-jar shelf-jar-warm" />

            <rect x="24" y="136" width="372" height="18" rx="9" fill="url(#counterTop)" />
            <rect x="18" y="152" width="384" height="34" rx="12" className="counter-front" />
            <rect x="274" y="94" width="106" height="8" rx="4" className="service-ledger" />

            <g opacity={prepOpacity}>
              <rect x="46" y="104" width="62" height="22" rx="11" className="ingredient-board" />
              <circle cx="62" cy="114" r="7" fill="#f59e0b" />
              <circle cx="79" cy="113" r="7" fill="#22c55e" />
              <circle cx="95" cy="114" r="7" fill="#ef4444" />
              <path d="M118 106h22" stroke="#64748b" strokeWidth="5" strokeLinecap="round" />
              <path d="M134 101l10 10" stroke="#64748b" strokeWidth="4" strokeLinecap="round" />
            </g>

            <g transform="translate(135 52)">
              <rect x="18" y="70" width="96" height="12" rx="6" fill="#64748b" opacity="0.22" />
              <rect x="28" y="54" width="76" height="12" rx="6" fill="#1e293b" opacity="0.9" />
              <rect x="22" y="20" width="88" height="44" rx="22" fill="url(#potMetal)" />
              <path d={`M30 ${64 - mealFill * 0.65} C46 ${56 - mealFill * 0.35}, 84 ${56 - mealFill * 0.4}, 102 ${64 - mealFill * 0.55} L102 64 L30 64 Z`} fill="url(#potFill)" opacity={simmerOpacity} />
              <rect x="52" y="10" width="28" height="8" rx="4" fill="#475569" opacity="0.8" />
              <path d="M16 42 C6 38 6 28 16 24" fill="none" stroke="#64748b" strokeWidth="5" strokeLinecap="round" />
              <path d="M116 42 C126 38 126 28 116 24" fill="none" stroke="#64748b" strokeWidth="5" strokeLinecap="round" />
              <ellipse cx="66" cy="82" rx="44" ry="8" fill="#fb923c" opacity={phase === 'FOCUS' ? 0.16 + displayProgress * 0.12 : 0.08} />
              <ellipse cx="66" cy="30" rx="30" ry="8" fill="rgba(255,255,255,0.09)" />

              <g transform={`translate(0 ${phase === 'FOCUS' && isRunning ? 0 : 3}) scale(${steamScale})`} opacity={phase === 'FOCUS' ? 0.4 + displayProgress * 0.45 : 0.22}>
                <path className="steam-line steam-line-a" d="M48 20 C42 8 56 0 48 -14" />
                <path className="steam-line steam-line-b" d="M66 16 C58 4 74 -2 64 -18" />
                <path className="steam-line steam-line-c" d="M84 22 C78 8 90 2 84 -12" />
              </g>
            </g>

            <g transform={`translate(${162 + ladleLift * 18} ${94 - ladleLift * 18}) rotate(${-28 + ladleLift * 24})`} opacity={Math.max(0.28, platingOpacity + 0.18)}>
              <path d="M0 0 L34 -18" stroke="url(#ladleMetal)" strokeWidth="5" strokeLinecap="round" />
              <circle cx="38" cy="-20" r="9" fill="url(#ladleMetal)" />
              <path d="M34 -20 C39 -25 46 -22 46 -16 C46 -10 38 -8 34 -12 Z" fill="url(#bowlMeal)" opacity={0.9} />
            </g>

            <g opacity={platingOpacity}>
              <ellipse cx={plateX} cy="132" rx="28" ry="9" fill="#94a3b8" opacity="0.16" />
              <ellipse cx={plateX} cy="126" rx="31" ry="12" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2" />
              <ellipse cx={plateX} cy="120" rx="21" ry="9.5" fill="url(#bowlMeal)" />
              <path d={`M${plateX - 16} 118 C${plateX - 10} ${111 - platingOpacity * 3} ${plateX + 10} ${111 - platingOpacity * 2} ${plateX + 16} 118`} fill="none" stroke="#fef3c7" strokeWidth="2.8" strokeLinecap="round" opacity={0.68 + platingOpacity * 0.2} />
              <circle cx={plateX - 7} cy="118" r="2.2" fill="#16a34a" opacity={garnishOpacity} />
              <circle cx={plateX + 2} cy="116" r="2.1" fill="#16a34a" opacity={garnishOpacity} />
              <circle cx={plateX + 9} cy="119" r="1.8" fill="#16a34a" opacity={garnishOpacity} />
            </g>

            <g opacity={queueOpacity}>
              <rect x="286" y="86" width="82" height="40" rx="12" className="serve-window" />
              <path d="M286 118h82" stroke="rgba(148,163,184,0.32)" strokeWidth="3" />
              <g transform="translate(282 92)" opacity={0.8}>
                <path d="M0 18c8-10 14-12 22-12" className="arm-line" />
                <path d="M22 6c8 0 16 3 22 10" className="arm-line" />
              </g>
              <g transform="translate(294 132)">
                <circle cx="0" cy="0" r="8" className="queue-person" />
                <path d="M-8 22c1-8 5-12 8-12s7 4 8 12" className="queue-body" />
              </g>
              <g transform="translate(324 132)">
                <circle cx="0" cy="0" r="8" className="queue-person" />
                <path d="M-8 22c1-8 5-12 8-12s7 4 8 12" className="queue-body" />
              </g>
              <g transform="translate(354 132)">
                <circle cx="0" cy="0" r="8" className="queue-person" />
                <path d="M-8 22c1-8 5-12 8-12s7 4 8 12" className="queue-body" />
              </g>
              <g transform="translate(240 100)" opacity={0.92}>
                <circle cx="0" cy="0" r="10" className="server-head" />
                <path d="M-12 30c2-11 6-16 12-16s10 5 12 16" className="server-body" />
                <path d="M8 18c14 0 24-5 36-12" className="server-arm" />
              </g>
            </g>

            <g opacity={serveOpacity}>
              <path d={`M${plateX + 20} 118 C${plateX + 34} 111 ${264 + serveOpacity * 6} 105 ${286 + serveOpacity * 8} 112`} stroke="#f59e0b" strokeWidth="3.2" strokeLinecap="round" strokeDasharray="6 8" />
            </g>
          </svg>

          {showServeMoment ? (
            <div className="kitchen-moment">
              <span className="text-pill text-pill-primary">A meal is ready to be served</span>
            </div>
          ) : null}
        </div>

        <div className="journey-status-row">
          <span className="journey-status-pill">
            {phase === 'FOCUS'
              ? displayProgress < 0.28
                ? 'Setting up ingredients'
                : displayProgress < 0.7
                  ? 'Cooking steadily'
                  : displayProgress < 0.92
                    ? 'Plating the meal'
                    : 'Serving is near'
              : 'Kitchen resting between rounds'}
          </span>
          <span className="session-detail-meta">
            {Math.round(displayProgress * 100)}% of the current focus cycle
          </span>
        </div>
      </div>
    </div>
  );
}

export default MotivationJourney;

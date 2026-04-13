
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://localhost:5173',
  'https://127.0.0.1:5173',
  'https://localhost:3000',
  'https://127.0.0.1:3000'
];

window.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.source !== window) return;
  if (!ALLOWED_ORIGINS.includes(event.origin)) return;
  if (event.data.type !== 'STUDYCOMP_FOCUS_STATE') {
    return;
  }
  const { phase, paused, remainingSec, phaseDurationSec, progressPercent, timestamp } = event.data;
  
  if (!['FOCUS', 'BREAK'].includes(phase)) {
    console.warn('Invalid phase:', phase);
    return;
  }

  if (typeof paused !== 'boolean') {
    console.warn('Invalid paused:', paused);
    return;
  }

  console.log('Relaying focus state to background:', { phase, paused });
  chrome.runtime.sendMessage(
    {
      type: 'STUDYCOMP_FOCUS_STATE',
      phase,
      paused,
      remainingSec: Number.isFinite(remainingSec) ? remainingSec : null,
      phaseDurationSec: Number.isFinite(phaseDurationSec) ? phaseDurationSec : null,
      progressPercent: Number.isFinite(progressPercent) ? progressPercent : null,
      timestamp: timestamp || Date.now()
    },
    (response) => {
      if (chrome.runtime.lastError) {
        console.error('Failed to send message to background:', chrome.runtime.lastError);
      } else {
        console.log('Message relayed to background');
      }
    }
  );
});


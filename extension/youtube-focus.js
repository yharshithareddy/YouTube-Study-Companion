const FOCUS_STYLE_ID = 'study-focus-style';
const REFRESH_INTERVAL_MS = 1500;

let lastUrl = location.href;
let lastSignature = '';
let refreshTimerId = null;

function getVideoIdFromUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get('v');
  } catch (error) {
    return null;
  }
}

function isWatchPage(url = location.href) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.endsWith('youtube.com') && parsed.pathname === '/watch';
  } catch (error) {
    return false;
  }
}

function removeFocusStyles() {
  const existingStyle = document.getElementById(FOCUS_STYLE_ID);
  if (existingStyle) {
    existingStyle.remove();
  }
}

function injectFocusStyles() {
  if (document.getElementById(FOCUS_STYLE_ID)) {
    return;
  }

  const style = document.createElement('style');
  style.id = FOCUS_STYLE_ID;
  style.textContent = `
    /* Right rail / recommendations */
    #secondary,
    #secondary-inner,
    #related,
    ytd-watch-next-secondary-results-renderer,
    ytd-playlist-panel-renderer,

    /* Comments */
    #comments,
    ytd-comments,
    ytd-comments-header-renderer,

    /* Below-video metadata / engagement */
    #below,
    #meta,
    #title,
    #description,
    #description-inline-expander,
    #actions,
    #menu,
    #owner,
    #subscribe-button,
    #info,
    ytd-watch-metadata,
    ytd-video-primary-info-renderer,
    ytd-video-secondary-info-renderer,

    /* Recommendation / shelf modules */
    ytd-reel-shelf-renderer,
    ytd-merch-shelf-renderer,
    ytd-rich-section-renderer,
    ytd-horizontal-card-list-renderer,
    ytd-compact-video-renderer,
    ytd-compact-playlist-renderer,

    /* Live chat */
    #chat,
    #chat-container,
    ytd-live-chat-frame,

    /* End-screen recommendations over the player */
    .ytp-endscreen-content,
    .ytp-ce-element,
    .ytp-show-tiles .ytp-videowall-still {
      display: none !important;
    }
  `;

  (document.head || document.documentElement).appendChild(style);
}

function shouldRun(state) {
  if (!state || state.phase !== 'FOCUS') {
    return false;
  }

  if (!state.cleanYouTubeDuringFocus) {
    return false;
  }

  return isWatchPage();
}

function applyFocusMode(state) {
  if (isWatchPage() && shouldRun(state)) {
    injectFocusStyles();
    return;
  }

  removeFocusStyles();
}

function getPersistedState() {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(
        [
          'studyCompFocusState',
          'activeSessionVideoId',
          'activeSessionVideoUrl',
          'focusBlockingSettings'
        ],
        (result) => {
          if (chrome.runtime.lastError) {
            resolve(null);
            return;
          }

          const focusState = result.studyCompFocusState || {};
          const settings = result.focusBlockingSettings || {};

          resolve({
            phase: focusState.phase || 'BREAK',
            paused: Boolean(focusState.paused),
            cleanYouTubeDuringFocus:
              settings.cleanYouTubeDuringFocus !== undefined
                ? settings.cleanYouTubeDuringFocus
                : true,
            sessionVideoId: result.activeSessionVideoId || focusState.sessionVideoId || null,
            sessionVideoUrl: result.activeSessionVideoUrl || focusState.sessionVideoUrl || null
          });
        }
      );
    } catch (error) {
      resolve(null);
    }
  });
}

async function refreshFocusMode(force = false) {
  const state = await getPersistedState();
  const signature = JSON.stringify({
    url: location.href,
    phase: state?.phase || null,
    cleanYouTubeDuringFocus: state?.cleanYouTubeDuringFocus || false,
    sessionVideoId: state?.sessionVideoId || null,
    sessionVideoUrl: state?.sessionVideoUrl || null
  });

  if (!force && signature === lastSignature) {
    return;
  }

  lastSignature = signature;
  applyFocusMode(state);
}

function initialize() {
  refreshFocusMode(true);

  window.addEventListener('yt-navigate-finish', () => {
    lastUrl = location.href;
    refreshFocusMode(true);
  });

  window.addEventListener('popstate', () => {
    lastUrl = location.href;
    refreshFocusMode(true);
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') {
      return;
    }

    if (
      changes.studyCompFocusState ||
      changes.activeSessionVideoId ||
      changes.activeSessionVideoUrl ||
      changes.focusBlockingSettings
    ) {
      refreshFocusMode(true);
    }
  });

  refreshTimerId = setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      refreshFocusMode(true);
      return;
    }

    refreshFocusMode(false);
  }, REFRESH_INTERVAL_MS);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize, { once: true });
} else {
  initialize();
}

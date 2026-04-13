
console.log('Study Companion background service worker loaded');

const DEFAULT_BACKEND_URL = 'http://localhost:3000';
const DEFAULT_FRONTEND_URL = 'http://localhost:5173';
const RULE_ID_START = 1000;
const RULE_ID_END = 1199;

let focusState = {
  phase: 'BREAK',
  paused: false,
  remainingSec: null,
  phaseDurationSec: null,
  progressPercent: null,
  timestamp: Date.now(),
  sessionTabId: null,
  sessionUrl: null,
  sessionVideoId: null,
  sessionVideoUrl: null
};

async function hydrateFocusState() {
  const stored = await chrome.storage.local.get([
    'studyCompFocusState',
    'activeSessionTabId',
    'activeSessionUrl',
    'activeSessionVideoId',
    'activeSessionVideoUrl'
  ]);

  if (stored.studyCompFocusState) {
    focusState = {
      ...focusState,
      ...stored.studyCompFocusState
    };
  }

  focusState.sessionTabId = stored.activeSessionTabId ?? focusState.sessionTabId ?? null;
  focusState.sessionUrl = stored.activeSessionUrl ?? focusState.sessionUrl ?? null;
  focusState.sessionVideoId = stored.activeSessionVideoId ?? focusState.sessionVideoId ?? null;
  focusState.sessionVideoUrl = stored.activeSessionVideoUrl ?? focusState.sessionVideoUrl ?? null;
}

function normalizeDomain(domain) {
  if (typeof domain !== 'string') return '';
  return domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
    .replace(/:\d+$/, '');
}

async function getUrls() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['backendUrl', 'frontendUrl'], (result) => {
      resolve({
        backendUrl: result.backendUrl || DEFAULT_BACKEND_URL,
        frontendUrl: result.frontendUrl || DEFAULT_FRONTEND_URL
      });
    });
  });
}

async function getBlockingSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['focusBlockingSettings'], (result) => {
      const defaults = {
        focusBlockingEnabled: true,
        blockedDomains: [],
        restrictYouTubeWatchOnly: false,
        disableBlockingOnPause: true,
        cleanYouTubeDuringFocus: true
      };
      resolve({
        ...defaults,
        ...(result.focusBlockingSettings || {})
      });
    });
  });
}

async function syncBlockingRules() {
  try {
    const settings = await getBlockingSettings();
    const runtimeState = {
      phase: focusState.phase,
      paused: focusState.paused
    };

    const blockingActive =
      settings.focusBlockingEnabled &&
      runtimeState.phase === 'FOCUS' &&
      !(runtimeState.paused && settings.disableBlockingOnPause);

    console.log('SYNC TRIGGERED', { settings, runtimeState, blockingActive });

    const existing = await chrome.declarativeNetRequest.getDynamicRules();
    const removeRuleIds = existing
      .map(rule => rule.id)
      .filter(id => id >= RULE_ID_START && id <= RULE_ID_END);

    const newRules = [];
    let ruleId = RULE_ID_START;

    if (blockingActive) {
      const domains = (settings.blockedDomains || [])
        .map(normalizeDomain)
        .filter(Boolean);

      console.log('Building rules for domains:', domains);

      for (const domain of domains) {
        newRules.push({
          id: ruleId++,
          priority: 1,
          action: {
            type: 'redirect',
            redirect: {
              extensionPath: `/blocked.html?domain=${encodeURIComponent(domain)}&reason=BLOCKED_DOMAIN`
            }
          },
          condition: {
            requestDomains: [domain],
            resourceTypes: ['main_frame']
          }
        });
      }

      if (settings.restrictYouTubeWatchOnly) {
        const ytRedirect = {
          type: 'redirect',
          redirect: {
            extensionPath: '/blocked.html?domain=youtube.com&reason=YOUTUBE_RESTRICTION'
          }
        };

        newRules.push({
          id: ruleId++,
          priority: 2,
          action: ytRedirect,
          condition: {
            requestDomains: ['youtube.com'],
            regexFilter: '^https?://(www\\.)?youtube\\.com/?$',
            resourceTypes: ['main_frame']
          }
        });

        newRules.push({
          id: ruleId++,
          priority: 2,
          action: ytRedirect,
          condition: {
            requestDomains: ['youtube.com'],
            regexFilter: '^https?://(www\\.)?youtube\\.com/shorts(/.*)?$',
            resourceTypes: ['main_frame']
          }
        });

        newRules.push({
          id: ruleId++,
          priority: 2,
          action: ytRedirect,
          condition: {
            requestDomains: ['youtube.com'],
            regexFilter: '^https?://(www\\.)?youtube\\.com/feed(/.*)?$',
            resourceTypes: ['main_frame']
          }
        });

        newRules.push({
          id: ruleId++,
          priority: 2,
          action: ytRedirect,
          condition: {
            requestDomains: ['youtube.com'],
            regexFilter: '^https?://(www\\.)?youtube\\.com/results(\\?.*)?$',
            resourceTypes: ['main_frame']
          }
        });
      }
    }

    console.log('Rules to apply:', {
      addRules: newRules.length,
      removeRules: removeRuleIds.length,
      blockingActive
    });

    if (newRules.length === 0 && removeRuleIds.length === 0) {
      console.log('No rule changes needed');
      return;
    }

    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds,
      addRules: newRules
    });

    const afterRules = await chrome.declarativeNetRequest.getDynamicRules();

    console.log('DNR rules updated:', {
      blockingActive,
      rulesAdded: newRules.length,
      rulesRemoved: removeRuleIds.length,
      phase: focusState.phase,
      paused: focusState.paused
    });
    console.log('Active DNR rules after sync:', afterRules);

  } catch (error) {
    console.error('Failed to sync DNR rules:', error);
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  
  if (message.type === 'START_SESSION') {
    console.log('Received START_SESSION');
    const { videoId, videoUrl, title } = message;
    
    handleStartSession(videoId, videoUrl, title)
      .then(result => {
        console.log('Session started:', result.sessionId);
        sendResponse({ success: true, sessionId: result.sessionId });
      })
      .catch(error => {
        console.error('Session failed:', error);
        sendResponse({ success: false, error: error.message });
      });
    
    return true;
  }

  if (message.type === 'STUDYCOMP_FOCUS_STATE') {
    console.log('Focus state update:', {
      phase: message.phase,
      paused: message.paused
    });
    
    focusState = {
      phase: message.phase,
      paused: !!message.paused,
      remainingSec: Number.isFinite(message.remainingSec) ? message.remainingSec : null,
      phaseDurationSec: Number.isFinite(message.phaseDurationSec) ? message.phaseDurationSec : null,
      progressPercent: Number.isFinite(message.progressPercent) ? message.progressPercent : null,
      timestamp: message.timestamp || Date.now(),
      sessionTabId: sender?.tab?.id ?? focusState.sessionTabId ?? null,
      sessionUrl: sender?.tab?.url ?? focusState.sessionUrl ?? null,
      sessionVideoId: focusState.sessionVideoId ?? null,
      sessionVideoUrl: focusState.sessionVideoUrl ?? null
    };

    chrome.storage.local.set({
      studyCompFocusState: focusState,
      activeSessionTabId: focusState.sessionTabId,
      activeSessionUrl: focusState.sessionUrl,
      activeSessionVideoId: focusState.sessionVideoId,
      activeSessionVideoUrl: focusState.sessionVideoUrl
    });

    syncBlockingRules()
      .then(() => sendResponse({ success: true }))
      .catch((error) => {
        console.error('Failed to sync rules:', error);
        sendResponse({ success: false, error: error.message });
      });

    return true;
  }

  if (message.type === 'GET_FOCUS_STATE') {
    Promise.all([
      chrome.storage.local.get([
        'studyCompFocusState',
        'activeSessionTabId',
        'activeSessionUrl',
        'activeSessionVideoId',
        'activeSessionVideoUrl'
      ]),
      getBlockingSettings()
    ])
      .then(([stored, settings]) => {
        const persisted = stored.studyCompFocusState || {};
        sendResponse({
          phase: persisted.phase ?? focusState.phase,
          paused: persisted.paused ?? focusState.paused,
          remainingSec: persisted.remainingSec ?? focusState.remainingSec,
          phaseDurationSec: persisted.phaseDurationSec ?? focusState.phaseDurationSec,
          progressPercent: persisted.progressPercent ?? focusState.progressPercent,
          timestamp: persisted.timestamp ?? focusState.timestamp,
          sessionTabId: stored.activeSessionTabId ?? persisted.sessionTabId ?? focusState.sessionTabId,
          sessionUrl: stored.activeSessionUrl ?? persisted.sessionUrl ?? focusState.sessionUrl,
          sessionVideoId: stored.activeSessionVideoId ?? persisted.sessionVideoId ?? focusState.sessionVideoId,
          sessionVideoUrl: stored.activeSessionVideoUrl ?? persisted.sessionVideoUrl ?? focusState.sessionVideoUrl,
          restrictYouTubeWatchOnly: settings.restrictYouTubeWatchOnly,
          disableBlockingOnPause: settings.disableBlockingOnPause,
          cleanYouTubeDuringFocus: settings.cleanYouTubeDuringFocus
        });
      })
      .catch((error) => {
        console.error('Failed to resolve focus state:', error);
        sendResponse({
          phase: focusState.phase,
          paused: focusState.paused,
          remainingSec: focusState.remainingSec,
          phaseDurationSec: focusState.phaseDurationSec,
          progressPercent: focusState.progressPercent,
          timestamp: focusState.timestamp,
          sessionTabId: focusState.sessionTabId,
          sessionUrl: focusState.sessionUrl,
          sessionVideoId: focusState.sessionVideoId,
          sessionVideoUrl: focusState.sessionVideoUrl,
          restrictYouTubeWatchOnly: false,
          disableBlockingOnPause: true,
          cleanYouTubeDuringFocus: true
        });
      });
    return true;
  }

  if (message.type === 'RETURN_TO_SESSION') {
    handleReturnToSession(sender)
      .then((result) => sendResponse({ success: true, ...result }))
      .catch((error) => {
        console.error('Failed to return to session:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (message.type === 'FOCUS_BLOCKING_SETTINGS_UPDATED') {
    console.log('Settings updated');
    syncBlockingRules()
      .then(() => sendResponse({ success: true }))
      .catch((error) => {
        console.error('Failed to sync rules:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  return true;
});

async function handleStartSession(videoId, videoUrl, title) {
  console.log('Starting session for video:', videoId);
  
  try {
    const { backendUrl, frontendUrl } = await getUrls();
    
    console.log('Creating session in backend...');
    const sessionResponse = await fetch(`${backendUrl}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId, videoUrl, title })
    });
    
    if (!sessionResponse.ok) {
      throw new Error(`Failed to create session: ${sessionResponse.status}`);
    }
    
    const session = await sessionResponse.json();
    console.log('Session created:', session.id);
    
    console.log('Opening frontend session page...');
    const sessionUrl = `${frontendUrl}?session=${session.id}`;
    const createdTab = await chrome.tabs.create({
      url: sessionUrl
    });

    focusState.sessionTabId = createdTab?.id ?? null;
    focusState.sessionUrl = sessionUrl;

    await chrome.storage.local.set({
      activeSessionId: session.id,
      activeSessionUrl: sessionUrl,
      activeSessionTabId: createdTab?.id ?? null,
      activeSessionVideoId: videoId,
      activeSessionVideoUrl: videoUrl
    });

    focusState.sessionVideoId = videoId;
    focusState.sessionVideoUrl = videoUrl;
    
    console.log('Session flow complete');
    return { sessionId: session.id };
    
  } catch (error) {
    console.error('Error in session flow:', error);
    throw error;
  }
}

async function handleReturnToSession(sender) {
  const { frontendUrl } = await getUrls();
  const stored = await chrome.storage.local.get(['activeSessionTabId', 'activeSessionUrl', 'activeSessionId']);
  const fallbackUrl =
    stored.activeSessionUrl ||
    (stored.activeSessionId ? `${frontendUrl}?session=${stored.activeSessionId}` : frontendUrl);

  const targetTabId = focusState.sessionTabId || stored.activeSessionTabId;

  if (targetTabId) {
    try {
      await chrome.tabs.update(targetTabId, { active: true });
      const targetTab = await chrome.tabs.get(targetTabId);
      if (targetTab.windowId) {
        await chrome.windows.update(targetTab.windowId, { focused: true });
      }

      if (sender?.tab?.id && sender.tab.id !== targetTabId) {
        await chrome.tabs.remove(sender.tab.id);
      }

      return { mode: 'focus-tab', tabId: targetTabId };
    } catch (error) {
      console.warn('Stored session tab could not be focused, reopening session URL instead:', error);
    }
  }

  if (sender?.tab?.id && fallbackUrl) {
    const updatedTab = await chrome.tabs.update(sender.tab.id, {
      url: fallbackUrl,
      active: true
    });

    if (updatedTab?.windowId) {
      await chrome.windows.update(updatedTab.windowId, { focused: true });
    }

    if (updatedTab?.id) {
      focusState.sessionTabId = updatedTab.id;
      focusState.sessionUrl = fallbackUrl;
      await chrome.storage.local.set({
        activeSessionTabId: updatedTab.id,
        activeSessionUrl: fallbackUrl
      });
    }

    return { mode: 'current-tab', tabId: updatedTab?.id ?? null };
  }

  const newTab = await chrome.tabs.create({ url: fallbackUrl });
  if (newTab?.id) {
    focusState.sessionTabId = newTab.id;
    focusState.sessionUrl = fallbackUrl;
    await chrome.storage.local.set({
      activeSessionTabId: newTab.id,
      activeSessionUrl: fallbackUrl
    });
  }

  return { mode: 'new-tab', tabId: newTab?.id ?? null };
}

chrome.runtime.onStartup.addListener(() => {
  console.log('Extension startup - syncing rules');
  hydrateFocusState().then(syncBlockingRules).catch(err => {
    console.error('Failed to sync rules on startup:', err);
  });
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed - syncing rules');
  hydrateFocusState().then(syncBlockingRules).catch(err => {
    console.error('Failed to sync rules on install:', err);
  });
});

console.log('Initial sync on load');
hydrateFocusState().then(syncBlockingRules).catch(err => {
  console.error('Failed to sync rules on initial load:', err);
});

console.log('Background worker ready');


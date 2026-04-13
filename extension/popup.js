
let currentVideo = null;
const videoIdEl = document.getElementById('videoId');
const videoTitleEl = document.getElementById('videoTitle');
const videoInfoEl = document.getElementById('videoInfo');
const startButton = document.getElementById('startButton');
const backendUrlInput = document.getElementById('backendUrl');
const frontendUrlInput = document.getElementById('frontendUrl');
const saveBackendBtn = document.getElementById('saveBackend');
const saveFrontendBtn = document.getElementById('saveFrontend');
const successMessage = document.getElementById('successMessage');
const focusBlockingEnabledEl = document.getElementById('focusBlockingEnabled');
const blockedDomainsEl = document.getElementById('blockedDomains');
const restrictYouTubeEl = document.getElementById('restrictYouTubeWatchOnly');
const disableBlockingOnPauseEl = document.getElementById('disableBlockingOnPause');
const cleanYouTubeDuringFocusEl = document.getElementById('cleanYouTubeDuringFocus');
const saveFocusSettingsBtn = document.getElementById('saveFocusSettings');

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

function extractYouTubeVideoId(url) {
  try {
    const urlObj = new URL(url);
    const videoId = urlObj.searchParams.get('v');
    return videoId || null;
  } catch (error) {
    return null;
  }
}

async function detectCurrentVideo() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tabs || tabs.length === 0) {
      console.log('No active tab found');
      setVideoError('No active tab');
      return;
    }

    const tab = tabs[0];
    const url = tab.url;
    const title = tab.title;

    if (!url) {
      console.log('Active tab has no URL');
      setVideoError('Tab has no URL');
      return;
    }
    if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
      console.log('Not a YouTube URL:', url);
      setVideoError('Not a YouTube page');
      return;
    }
    const videoId = extractYouTubeVideoId(url);
    
    if (!videoId) {
      console.log('Could not extract video ID from URL:', url);
      setVideoError('Not a YouTube watch page');
      return;
    }
    currentVideo = {
      videoId,
      videoUrl: url,
      title: title || 'YouTube Video'
    };
    videoInfoEl.classList.remove('error');
    videoIdEl.textContent = videoId;
    videoTitleEl.textContent = currentVideo.title;
    startButton.disabled = false;

    console.log('Video detected:', { videoId, title: currentVideo.title });

  } catch (error) {
    console.error('Error detecting video:', error);
    setVideoError('Error detecting video');
  }
}

function setVideoError(message) {
  currentVideo = null;
  videoInfoEl.classList.add('error');
  videoIdEl.textContent = 'No supported video';
  videoTitleEl.textContent = message || 'Open a YouTube watch page to start a session.';
  startButton.disabled = true;
}

function showMessage(message, isError = false) {
  successMessage.textContent = message;
  successMessage.style.background = isError ? 'rgba(255, 59, 48, 0.2)' : 'rgba(52, 199, 89, 0.2)';
  successMessage.style.display = 'block';
  setTimeout(() => {
    successMessage.style.display = 'none';
  }, 2000);
}

function showSuccess(message) {
  showMessage(message, false);
}

function showError(message) {
  showMessage(message, true);
}

function setStartButtonLoading(loading) {
  startButton.disabled = loading || !currentVideo;
  startButton.classList.toggle('loading', loading);
}

async function initialize() {
  await detectCurrentVideo();
  const result = await chrome.storage.local.get(['backendUrl', 'frontendUrl']);
  backendUrlInput.value = result.backendUrl || 'http://localhost:3000';
  frontendUrlInput.value = result.frontendUrl || 'http://localhost:5173';
  const focusSettings = await chrome.storage.local.get(['focusBlockingSettings']);
  if (focusSettings.focusBlockingSettings) {
    const config = focusSettings.focusBlockingSettings;
    focusBlockingEnabledEl.checked = config.focusBlockingEnabled !== undefined ? config.focusBlockingEnabled : true;
    blockedDomainsEl.value = (config.blockedDomains || []).join('\n');
    restrictYouTubeEl.checked = config.restrictYouTubeWatchOnly !== undefined ? config.restrictYouTubeWatchOnly : false;
    disableBlockingOnPauseEl.checked = config.disableBlockingOnPause !== undefined ? config.disableBlockingOnPause : true;
    cleanYouTubeDuringFocusEl.checked = config.cleanYouTubeDuringFocus !== undefined ? config.cleanYouTubeDuringFocus : true;
  } else {
    focusBlockingEnabledEl.checked = true;
    disableBlockingOnPauseEl.checked = true;
    cleanYouTubeDuringFocusEl.checked = true;
  }
}

saveBackendBtn.addEventListener('click', async () => {
  const url = backendUrlInput.value.trim();
  await chrome.storage.local.set({ backendUrl: url });
  showSuccess('Backend URL saved!');
});

saveFrontendBtn.addEventListener('click', async () => {
  const url = frontendUrlInput.value.trim();
  await chrome.storage.local.set({ frontendUrl: url });
  showSuccess('Frontend URL saved!');
});

startButton.addEventListener('click', async () => {
  if (!currentVideo) {
    showError('No video selected');
    return;
  }

  try {
    setStartButtonLoading(true);

    const { backendUrl, frontendUrl } = await chrome.storage.local.get(['backendUrl', 'frontendUrl']);
    const resolvedBackendUrl = (backendUrl || 'http://localhost:3000').trim().replace(/\/+$/, '');
    const resolvedFrontendUrl = (frontendUrl || 'http://localhost:5173').trim().replace(/\/+$/, '');

    const sessionResponse = await fetch(`${resolvedBackendUrl}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoId: currentVideo.videoId,
        videoUrl: currentVideo.videoUrl,
        title: currentVideo.title
      })
    });

    if (!sessionResponse.ok) {
      let errorText = `Failed to create session (${sessionResponse.status})`;
      try {
        const payload = await sessionResponse.json();
        if (payload?.error) errorText = payload.error;
      } catch {
      }
      throw new Error(errorText);
    }

    const session = await sessionResponse.json();
    if (!session?.id) {
      throw new Error('Backend did not return a session ID');
    }

    const sessionUrl = `${resolvedFrontendUrl}?session=${session.id}`;
    const createdTab = await chrome.tabs.create({
      url: sessionUrl
    });

    await chrome.storage.local.set({
      activeSessionId: session.id,
      activeSessionUrl: sessionUrl,
      activeSessionTabId: createdTab?.id ?? null,
      activeSessionVideoId: currentVideo.videoId,
      activeSessionVideoUrl: currentVideo.videoUrl
    });

    showSuccess('Session started!');
    window.close();
  } catch (error) {
    console.error('Failed to start session from popup:', error);
    showError(error.message || 'Failed to start session');
  } finally {
    setStartButtonLoading(false);
  }
});

saveFocusSettingsBtn.addEventListener('click', async () => {
  const domainText = blockedDomainsEl.value;
  const blockedDomains = domainText
    .split('\n')
    .map(d => normalizeDomain(d))
    .filter(d => d.length > 0);
  const uniqueDomains = [...new Set(blockedDomains)];

  const settings = {
    focusBlockingEnabled: focusBlockingEnabledEl.checked,
    blockedDomains: uniqueDomains,
    restrictYouTubeWatchOnly: restrictYouTubeEl.checked,
    disableBlockingOnPause: disableBlockingOnPauseEl.checked,
    cleanYouTubeDuringFocus: cleanYouTubeDuringFocusEl.checked
  };

  await chrome.storage.local.set({ focusBlockingSettings: settings });
  chrome.runtime.sendMessage(
    { type: 'FOCUS_BLOCKING_SETTINGS_UPDATED' },
    (response) => {
      if (response && response.success) {
        showSuccess('Focus settings saved & rules updated!');
      } else {
        showSuccess('Focus settings saved!');
      }
    }
  );

  console.log('Focus blocking settings saved:', settings);
});

document.addEventListener('DOMContentLoaded', initialize);

console.log('Popup loaded');


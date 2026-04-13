
function normalizeHostname(hostname) {
  if (typeof hostname !== 'string') return '';
  
  const lowercased = hostname.toLowerCase();
  if (lowercased.startsWith('www.')) {
    return lowercased.slice(4);
  }
  
  return lowercased;
}

function normalizeDomain(domain) {
  if (typeof domain !== 'string') return '';

  return domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')  // Remove protocol
    .replace(/^www\./, '')         // Remove www
    .replace(/\/.*$/, '')          // Remove paths
    .replace(/:\d+$/, '');         // Remove ports
}

function matchesDomain(normalizedHostname, normalizedDomain) {
  if (!normalizedHostname || !normalizedDomain) return false;
  if (normalizedHostname === normalizedDomain) {
    return true;
  }
  if (normalizedHostname.endsWith('.' + normalizedDomain)) {
    return true;
  }
  
  return false;
}

function isYouTube(normalizedHostname) {
  return normalizedHostname === 'youtube.com' || normalizedHostname === 'm.youtube.com';
}

function parseUrl(url) {
  try {
    const urlObj = new URL(url);
    return {
      hostname: urlObj.hostname,
      pathname: urlObj.pathname
    };
  } catch (error) {
    return null;
  }
}

function isBlockingActive(settings, runtimeState) {
  if (settings.focusBlockingEnabled !== true) {
    return false;
  }
  if (runtimeState.phase !== 'FOCUS') {
    return false;
  }
  if (runtimeState.paused === true && settings.disableBlockingOnPause === true) {
    return false;
  }
  return true;
}

function evaluateYouTubeRestriction(normalizedHostname, pathname, restrictYouTubeWatchOnly) {
  if (!restrictYouTubeWatchOnly) {
    return null;
  }
  if (!isYouTube(normalizedHostname)) {
    return null;
  }
  if (pathname.startsWith('/watch')) {
    return false; // Allow /watch
  }
  return true; // Block
}

function matchesBlockedDomain(normalizedHostname, blockedDomains) {
  if (!Array.isArray(blockedDomains) || blockedDomains.length === 0) {
    return false;
  }
  
  for (const domain of blockedDomains) {
    const normalizedDomain = normalizeDomain(domain);
    
    if (matchesDomain(normalizedHostname, normalizedDomain)) {
      return true;
    }
  }
  
  return false;
}

function shouldBlockNavigation(url, settings, runtimeState) {
  if (typeof url !== 'string' || !settings || !runtimeState) {
    return false;
  }
  if (!isBlockingActive(settings, runtimeState)) {
    return false; // Allow - blocking not active
  }
  const parsed = parseUrl(url);
  if (!parsed) {
    return false; // Invalid URL - allow by default
  }
  
  const normalizedHostname = normalizeHostname(parsed.hostname);
  const youtubeResult = evaluateYouTubeRestriction(
    normalizedHostname,
    parsed.pathname,
    settings.restrictYouTubeWatchOnly
  );
  
  if (youtubeResult !== null) {
    return youtubeResult; // YouTube rule applies, return its result
  }
  const isBlocked = matchesBlockedDomain(
    normalizedHostname,
    settings.blockedDomains
  );
  
  if (isBlocked) {
    return true; // Block
  }
  return false;
}

function getBlockedReason(url, settings, runtimeState) {
  if (!shouldBlockNavigation(url, settings, runtimeState)) {
    return null;
  }
  if (!isBlockingActive(settings, runtimeState)) {
    return 'FOCUS_MODE'; // Shouldn't happen, but safe default
  }
  const parsed = parseUrl(url);
  if (!parsed) {
    return null;
  }
  
  const normalizedHostname = normalizeHostname(parsed.hostname);
  const youtubeResult = evaluateYouTubeRestriction(
    normalizedHostname,
    parsed.pathname,
    settings.restrictYouTubeWatchOnly
  );
  
  if (youtubeResult === true) {
    return 'YOUTUBE_RESTRICTION';
  }
  if (matchesBlockedDomain(normalizedHostname, settings.blockedDomains)) {
    return 'BLOCKED_DOMAIN';
  }
  return 'FOCUS_MODE';
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    shouldBlockNavigation,
    getBlockedReason,
    normalizeHostname,
    normalizeDomain,
    matchesDomain,
    isYouTube,
    parseUrl,
    isBlockingActive,
    evaluateYouTubeRestriction,
    matchesBlockedDomain
  };
}


const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'build', 'by', 'course', 'for', 'from', 'guide', 'how',
  'i', 'in', 'into', 'is', 'it', 'learn', 'of', 'on', 'or', 'that', 'the', 'this', 'to', 'tutorial',
  'video', 'with', 'you', 'your'
]);

const NOISE_TOKENS = new Set([
  'http', 'https', 'www', 'com', 'youtu', 'youtube', 'youtu.be', 'watch', 'about', 'one', 'new', 'more',
  'official', 'channel', 'subscribe', 'link', 'links', 'click', 'today', 'review', 'vs', 'which', 'should',
  'choose', 'best', 'top', 'full', 'complete'
]);

export function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

export function tokenize(value) {
  return normalize(value)
    .split(/[^a-z0-9+#.]+/)
    .filter(Boolean);
}

export function isMeaningfulToken(token) {
  const value = normalize(token);
  if (!value) return false;
  if (value.length < 3) return false;
  if (STOPWORDS.has(value) || NOISE_TOKENS.has(value)) return false;
  if (/^\d+$/.test(value)) return false;
  if (value.includes('http') || value.includes('youtu')) return false;
  return true;
}

export function toUniqueList(values) {
  return [...new Set((values || []).map((value) => String(value || '').trim()).filter(Boolean))];
}

export function listFromInput(value) {
  if (Array.isArray(value)) {
    return toUniqueList(value);
  }

  return toUniqueList(
    String(value || '')
      .split(/[\n,;|]+/)
      .map((item) => item.trim())
  );
}

export function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

export function average(values) {
  const numbers = (values || []).filter((value) => Number.isFinite(value));
  if (!numbers.length) return 0;
  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
}

export function parseDurationIsoToSeconds(durationIso) {
  if (!durationIso) return null;

  const match = String(durationIso).match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return null;

  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  return hours * 3600 + minutes * 60 + seconds;
}

export function extractFrequentConcepts(text, limit = 12) {
  const counts = new Map();

  tokenize(text).forEach((token) => {
    if (!isMeaningfulToken(token)) return;
    counts.set(token, (counts.get(token) || 0) + 1);
  });

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([token]) => token);
}

export function tokenOverlapScore(left, right) {
  const leftTokens = new Set(tokenize(left).filter(isMeaningfulToken));
  const rightTokens = new Set(tokenize(right).filter(isMeaningfulToken));

  if (!leftTokens.size || !rightTokens.size) return 0;

  let overlap = 0;
  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) overlap += 1;
  });

  return overlap / leftTokens.size;
}

export function keywordSet(value) {
  return new Set(tokenize(value).filter(isMeaningfulToken));
}

export function keywordOverlap(left, right) {
  const leftTokens = keywordSet(left);
  const rightTokens = keywordSet(right);
  if (!leftTokens.size || !rightTokens.size) return 0;

  let overlap = 0;
  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) overlap += 1;
  });

  return overlap / leftTokens.size;
}

export function parseDurationPreference(rawText) {
  const text = normalize(rawText);
  if (!text) return null;

  const underMinutes = text.match(/under\s+(\d+)\s*(minute|min)/);
  if (underMinutes) return Number(underMinutes[1]);

  const withinMinutes = text.match(/within\s+(\d+)\s*(minute|min)/);
  if (withinMinutes) return Number(withinMinutes[1]);

  const exactMinutes = text.match(/(\d+)\s*(minute|min)\b/);
  if (exactMinutes) return Number(exactMinutes[1]);

  const hourMinutes = text.match(/(\d+)\s*hour/);
  if (hourMinutes) return Number(hourMinutes[1]) * 60;

  return null;
}

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';
const MIN_RECOMMENDATION_DURATION_SEC = 240;
const YOUTUBE_VIDEOS_LIST_BATCH_SIZE = 50;

function requireApiKey() {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error('YOUTUBE_API_KEY is not configured');
  }
  return apiKey;
}

function buildUrl(path, params) {
  const url = new URL(`${YOUTUBE_API_BASE}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}

function normalizeCandidate(searchItem, detail, querySource) {
  return {
    videoId: searchItem.id.videoId,
    title: detail?.snippet?.title || searchItem.snippet?.title || '',
    description: detail?.snippet?.description || searchItem.snippet?.description || '',
    channelTitle: detail?.snippet?.channelTitle || searchItem.snippet?.channelTitle || '',
    thumbnailUrl:
      detail?.snippet?.thumbnails?.high?.url ||
      detail?.snippet?.thumbnails?.medium?.url ||
      searchItem.snippet?.thumbnails?.high?.url ||
      searchItem.snippet?.thumbnails?.medium?.url ||
      '',
    publishedAt: detail?.snippet?.publishedAt || searchItem.snippet?.publishedAt || null,
    durationIso: detail?.contentDetails?.duration || null,
    durationSeconds: parseDurationIsoToSeconds(detail?.contentDetails?.duration || null),
    viewCount: Number(detail?.statistics?.viewCount || 0),
    querySource,
    tags: detail?.snippet?.tags || []
  };
}

function parseDurationIsoToSeconds(durationIso) {
  if (!durationIso) {
    return null;
  }

  const match = durationIso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) {
    return null;
  }

  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  return hours * 3600 + minutes * 60 + seconds;
}

function isLikelyShortOrLowValue(candidate) {
  const title = `${candidate.title} ${candidate.description || ''}`.toLowerCase();
  const durationSec = parseDurationIsoToSeconds(candidate.durationIso);

  if (/#shorts\b|\bshorts\b|\bshort\b|\breel\b/.test(title)) {
    return true;
  }

  if (/\blive\b|\bstream\b/.test(title)) {
    return true;
  }

  if (durationSec !== null && durationSec < MIN_RECOMMENDATION_DURATION_SEC) {
    return true;
  }

  return false;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`YouTube API request failed (${response.status}): ${text}`);
  }
  return response.json();
}

async function fetchVideoDetails(apiKey, videoIds) {
  const detailItems = [];

  for (let index = 0; index < videoIds.length; index += YOUTUBE_VIDEOS_LIST_BATCH_SIZE) {
    const batchIds = videoIds.slice(index, index + YOUTUBE_VIDEOS_LIST_BATCH_SIZE);
    const detailsUrl = buildUrl('/videos', {
      key: apiKey,
      part: 'snippet,contentDetails,statistics',
      id: batchIds.join(',')
    });

    const detailPayload = await fetchJson(detailsUrl);
    detailItems.push(...(detailPayload.items || []));
  }

  return detailItems;
}

function extractChapters(description) {
  const lines = String(description || '').split('\n');
  return lines
    .map((line) => line.trim())
    .filter((line) => /^\d{1,2}:\d{2}(?::\d{2})?\s+/.test(line))
    .slice(0, 12)
    .map((line) => line.replace(/^\d{1,2}:\d{2}(?::\d{2})?\s+/, '').trim());
}

export async function fetchRecommendationCandidates(queries, language, options = {}) {
  const apiKey = requireApiKey();
  const rawItems = [];
  const maxQueries = Number(options.maxQueries) || 20;
  const perQueryResults = Number(options.perQueryResults) || 12;
  const metrics = options.metrics || null;

  if (metrics) {
    metrics.queriesGenerated = queries.length;
  }

  for (const query of queries.slice(0, maxQueries)) {
    const searchUrl = buildUrl('/search', {
      key: apiKey,
      part: 'snippet',
      type: 'video',
      maxResults: perQueryResults,
      q: query,
      safeSearch: 'moderate',
      relevanceLanguage: language?.slice(0, 2)?.toLowerCase()
    });

    const searchPayload = await fetchJson(searchUrl);
    rawItems.push(
      ...(searchPayload.items || [])
        .filter((item) => item?.id?.videoId)
        .map((item) => ({ item, querySource: query }))
    );
  }

  if (metrics) {
    metrics.candidatesBeforeDedup = rawItems.length;
  }

  const dedupedMap = new Map();
  rawItems.forEach(({ item, querySource }) => {
    const existing = dedupedMap.get(item.id.videoId);
    if (existing) {
      existing.querySources.push(querySource);
      return;
    }

    dedupedMap.set(item.id.videoId, {
      item,
      querySources: [querySource]
    });
  });

  const deduped = [...dedupedMap.values()];
  if (metrics) {
    metrics.candidatesAfterDedup = deduped.length;
  }
  const videoIds = deduped.map((entry) => entry.item.id.videoId).slice(0, 120);

  if (videoIds.length === 0) {
    return [];
  }

  const detailItems = await fetchVideoDetails(apiKey, videoIds);
  const detailMap = new Map(detailItems.map((item) => [item.id, item]));

  return deduped
    .map(({ item, querySources }) => ({
      ...normalizeCandidate(item, detailMap.get(item.id.videoId), querySources[0]),
      querySources,
      chapters: extractChapters(detailMap.get(item.id.videoId)?.snippet?.description || item.snippet?.description || ''),
      commentsSample: []
    }))
    .filter((candidate) => candidate.title)
    .filter((candidate) => !isLikelyShortOrLowValue(candidate));
}

export async function fetchTranscriptText(videoId) {
  const { default: TranscriptAPI } = await import('youtube-transcript-api');

  try {
    const transcript = await TranscriptAPI.getTranscript(videoId);
    if (!Array.isArray(transcript) || transcript.length === 0) {
      return null;
    }

    return transcript
      .map((chunk) => String(chunk?.text || '').trim())
      .filter(Boolean)
      .join(' ')
      .slice(0, 12000);
  } catch (error) {
    return null;
  }
}

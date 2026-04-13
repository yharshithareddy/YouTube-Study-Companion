import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..', '..', '..');

const DEFAULT_PATHS = {
  corpus: path.join(repoRoot, 'data', 'discover', 'corpus', 'real-videos.sample.json'),
  labels: path.join(repoRoot, 'data', 'discover', 'labels', 'requests.sample.json')
};

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function readOptionalJson(repoRelativePath) {
  if (!repoRelativePath) return null;
  const filePath = path.join(repoRoot, repoRelativePath);
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

export async function loadDiscoverCorpus(options = {}) {
  const corpusPath = options.corpusPath || DEFAULT_PATHS.corpus;
  const labelsPath = options.labelsPath || DEFAULT_PATHS.labels;

  const corpusDoc = await readJson(corpusPath);
  const labelDoc = await readJson(labelsPath);
  const videos = await Promise.all(
    (corpusDoc.videos || []).map(async (video) => ({
      ...video,
      transcriptData: video.transcript?.path ? await readOptionalJson(video.transcript.path) : null,
      analysisData: video.analysis?.path ? await readOptionalJson(video.analysis.path) : null
    }))
  );

  return {
    repoRoot,
    corpusPath,
    labelsPath,
    version: corpusDoc.version || 1,
    videos,
    requests: labelDoc.requests || []
  };
}

export function buildDiscoverCorpusIndex(corpus) {
  const byVideoId = new Map();
  corpus.videos.forEach((video) => {
    byVideoId.set(video.videoId, video);
  });

  const requestIndex = corpus.requests.map((request) => ({
    ...request,
    resolvedLabels: (request.labels || []).map((label) => ({
      ...label,
      video: byVideoId.get(label.videoId) || null
    }))
  }));

  return {
    ...corpus,
    byVideoId,
    requestIndex
  };
}

export function summarizeDiscoverCorpus(corpus) {
  const transcriptCount = corpus.videos.filter((video) => video.transcript?.available).length;
  const metadataOnlyCount = corpus.videos.filter((video) => video.analysis?.analysisMode === 'metadata').length;
  const broadRequests = corpus.requests.filter((request) => request.requestType === 'broad_exploration').length;
  const conceptRequests = corpus.requests.filter((request) => request.requestType === 'concept_clarity').length;
  const projectRequests = corpus.requests.filter((request) => request.requestType === 'build_project').length;
  const beginnerRequests = corpus.requests.filter((request) => request.requestType === 'learn_basics').length;

  return {
    videoCount: corpus.videos.length,
    requestCount: corpus.requests.length,
    transcriptCount,
    metadataOnlyCount,
    broadRequests,
    conceptRequests,
    projectRequests,
    beginnerRequests
  };
}

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const corpusPath = path.join(repoRoot, 'data', 'discover', 'corpus', 'real-videos.sample.json');
const labelsPath = path.join(repoRoot, 'data', 'discover', 'labels', 'requests.sample.json');

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isOptionalString(value) {
  return value == null || typeof value === 'string';
}

function isArrayOfStrings(value) {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

function rel(filePath) {
  return path.relative(repoRoot, filePath) || '.';
}

function addError(errors, message) {
  errors.push(message);
}

async function validateTranscriptFile(video, errors) {
  const transcript = video.transcript || {};
  if (!transcript.available) {
    if (transcript.path !== null) {
      addError(errors, `[${video.videoId}] transcript.available=false but transcript.path is not null`);
    }
    return;
  }

  if (!isNonEmptyString(transcript.path)) {
    addError(errors, `[${video.videoId}] transcript.available=true but transcript.path is missing`);
    return;
  }

  const transcriptPath = path.join(repoRoot, transcript.path);

  try {
    const data = await readJson(transcriptPath);
    if (!isNonEmptyString(data.videoId)) {
      addError(errors, `[${video.videoId}] transcript file ${rel(transcriptPath)} is missing videoId`);
    }
    if (!isNonEmptyString(data.text)) {
      addError(errors, `[${video.videoId}] transcript file ${rel(transcriptPath)} is missing text`);
    }
  } catch (error) {
    addError(errors, `[${video.videoId}] transcript file not readable: ${rel(transcriptPath)} (${error.message})`);
  }
}

async function validateAnalysisFile(video, errors) {
  const analysis = video.analysis || {};
  if (!isNonEmptyString(analysis.path)) {
    addError(errors, `[${video.videoId}] analysis.path is missing`);
    return;
  }

  const analysisPath = path.join(repoRoot, analysis.path);

  try {
    const data = await readJson(analysisPath);
    if (data.videoId !== video.videoId) {
      addError(errors, `[${video.videoId}] analysis file ${rel(analysisPath)} videoId mismatch`);
    }
    if (!isNonEmptyString(data.summary)) {
      addError(errors, `[${video.videoId}] analysis file ${rel(analysisPath)} is missing summary`);
    }
    if (!Array.isArray(data.conceptsCovered)) {
      addError(errors, `[${video.videoId}] analysis file ${rel(analysisPath)} is missing conceptsCovered array`);
    }
  } catch (error) {
    addError(errors, `[${video.videoId}] analysis file not readable: ${rel(analysisPath)} (${error.message})`);
  }
}

async function validateCorpus() {
  const errors = [];
  const corpus = await readJson(corpusPath);

  if (!Array.isArray(corpus.videos)) {
    addError(errors, `${rel(corpusPath)} must contain a videos array`);
    return { errors, videoIds: new Set(), corpus };
  }

  const seenIds = new Set();
  const videoIds = new Set();

  for (const video of corpus.videos) {
    const prefix = `[${video?.videoId || 'unknown-video'}]`;

    if (!isNonEmptyString(video.id)) addError(errors, `${prefix} id is required`);
    if (!isNonEmptyString(video.videoId)) addError(errors, `${prefix} videoId is required`);
    if (!isNonEmptyString(video.url)) addError(errors, `${prefix} url is required`);
    if (!isNonEmptyString(video.title)) addError(errors, `${prefix} title is required`);
    if (!isNonEmptyString(video.description)) addError(errors, `${prefix} description is required`);
    if (!isNonEmptyString(video.channelTitle)) addError(errors, `${prefix} channelTitle is required`);
    if (!Number.isInteger(video.durationSeconds) || video.durationSeconds <= 0) {
      addError(errors, `${prefix} durationSeconds must be a positive integer`);
    }
    if (!isNonEmptyString(video.language)) addError(errors, `${prefix} language is required`);
    if (!isArrayOfStrings(video.tags)) addError(errors, `${prefix} tags must be an array of strings`);
    if (!isOptionalString(video.publishedAt)) addError(errors, `${prefix} publishedAt must be a string or null`);

    if (!video.transcript || typeof video.transcript !== 'object') {
      addError(errors, `${prefix} transcript object is required`);
    }

    if (!video.analysis || typeof video.analysis !== 'object') {
      addError(errors, `${prefix} analysis object is required`);
    }

    if (isNonEmptyString(video.videoId)) {
      if (seenIds.has(video.videoId)) {
        addError(errors, `${prefix} duplicate videoId`);
      }
      seenIds.add(video.videoId);
      videoIds.add(video.videoId);
    }

    await validateTranscriptFile(video, errors);
    await validateAnalysisFile(video, errors);
  }

  return { errors, videoIds, corpus };
}

function validateLabelsShape(labelsDoc, videoIds) {
  const errors = [];

  if (!Array.isArray(labelsDoc.requests)) {
    addError(errors, `${rel(labelsPath)} must contain a requests array`);
    return errors;
  }

  for (const request of labelsDoc.requests) {
    const prefix = `[${request?.id || 'unknown-request'}]`;

    if (!isNonEmptyString(request.id)) addError(errors, `${prefix} id is required`);
    if (!isNonEmptyString(request.requestType)) addError(errors, `${prefix} requestType is required`);
    if (!request.learnerRequest || typeof request.learnerRequest !== 'object') {
      addError(errors, `${prefix} learnerRequest object is required`);
    } else if (!isNonEmptyString(request.learnerRequest.rawRequirement)) {
      addError(errors, `${prefix} learnerRequest.rawRequirement is required`);
    }
    if (!isNonEmptyString(request.expectedTopic)) addError(errors, `${prefix} expectedTopic is required`);
    if (!Array.isArray(request.mustHaveConcepts)) addError(errors, `${prefix} mustHaveConcepts must be an array`);
    if (!Array.isArray(request.labels)) {
      addError(errors, `${prefix} labels must be an array`);
      continue;
    }

    for (const label of request.labels) {
      const labelPrefix = `${prefix} label`;
      if (!isNonEmptyString(label.videoId)) {
        addError(errors, `${labelPrefix} videoId is required`);
        continue;
      }
      if (!videoIds.has(label.videoId)) {
        addError(errors, `${labelPrefix} references unknown videoId ${label.videoId}`);
      }
      if (!isNonEmptyString(label.label)) addError(errors, `${labelPrefix} label value is required`);
      if (!isNonEmptyString(label.reason)) addError(errors, `${labelPrefix} reason is required`);
    }
  }

  return errors;
}

async function main() {
  const { errors: corpusErrors, videoIds, corpus } = await validateCorpus();
  const labelsDoc = await readJson(labelsPath);
  const labelErrors = validateLabelsShape(labelsDoc, videoIds);
  const errors = [...corpusErrors, ...labelErrors];

  console.log('Discover Corpus Validation');
  console.log(`Corpus file: ${rel(corpusPath)}`);
  console.log(`Label file: ${rel(labelsPath)}`);
  console.log(`Stored videos: ${Array.isArray(corpus.videos) ? corpus.videos.length : 0}`);
  console.log(`Labeled requests: ${Array.isArray(labelsDoc.requests) ? labelsDoc.requests.length : 0}`);

  if (errors.length) {
    console.log('\nValidation errors:');
    errors.forEach((error) => console.log(`  - ${error}`));
    process.exitCode = 1;
    return;
  }

  console.log('\nValidation passed.');
}

main().catch((error) => {
  console.error('Discover corpus validation failed:', error);
  process.exitCode = 1;
});

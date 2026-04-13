import { PrismaClient } from '@prisma/client';
import { fetchTranscriptText } from '../youtubeService.js';
import {
  average,
  clamp,
  extractFrequentConcepts,
  normalize,
  parseDurationIsoToSeconds,
  toUniqueList
} from './common.js';
import { extractConceptSignals } from './conceptSignals.js';
import {
  NO_TRANSCRIPT_VIDEO_ANALYSIS_PROMPT,
  TRANSCRIPT_AGGREGATION_PROMPT,
  TRANSCRIPT_CHUNK_ANALYSIS_PROMPT
} from './prompts.js';
import { fillPrompt } from './promptUtils.js';
import { defaultLLMClient } from './llmClient.js';
import IntentDetector from './intentDetector.js';
import TeachingQualityAnalyzer from './teachingQualityAnalyzer.js';

const prisma = new PrismaClient();
const ANALYSIS_VERSION = 'v5';
const DEPTH_ORDER = ['intro', 'medium', 'deep'];
const MIN_TRANSCRIPT_LENGTH = 250;
const intentDetector = new IntentDetector();
const teachingQualityAnalyzer = new TeachingQualityAnalyzer();
const EMPTY_STYLE = {
  project_based: 0,
  conceptual: 0,
  theory_heavy: 0,
  hands_on: 0
};

function cleanTranscriptText(text) {
  return String(text || '')
    .replace(/\[[^\]]+\]/g, ' ')
    .replace(/\([^)]*music[^)]*\)/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function chunkTranscriptText(text, chunkSize = 3000, overlap = 300) {
  const value = cleanTranscriptText(text);
  if (!value) return [];

  const chunks = [];
  let start = 0;

  while (start < value.length) {
    const end = Math.min(value.length, start + chunkSize);
    const chunk = value.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end === value.length) break;
    start = Math.max(0, end - overlap);
  }

  return chunks;
}

function inferDifficulty(text) {
  const lowered = normalize(text);
  if (/(internals|optimiz|architecture|scalab|advanced|deep dive|production)/.test(lowered)) return 'advanced';
  if (/(assume|already know|hooks|state management|practical|intermediate)/.test(lowered)) return 'intermediate';
  return 'beginner';
}

function inferDepth(text) {
  const lowered = normalize(text);
  if (/(deep dive|internals|architecture|optimization|performance)/.test(lowered)) return 'deep';
  if (/(project|build|real world|hands on|medium)/.test(lowered)) return 'medium';
  return 'intro';
}

function inferPace(text) {
  const lowered = normalize(text);
  if (/(quick|fast|rapid|crash course)/.test(lowered)) return 'fast';
  if (/(step by step|slowly|carefully)/.test(lowered)) return 'slow';
  return 'medium';
}

function inferTeachingStyle(text) {
  const lowered = normalize(text);
  return {
    project_based: /(project|build|app|clone)/.test(lowered) ? 0.85 : 0.2,
    conceptual: /(why|concept|understand|explain|fundamental)/.test(lowered) ? 0.75 : 0.3,
    theory_heavy: /(theory|architecture|definition)/.test(lowered) ? 0.7 : 0.15,
    hands_on: /(code|implement|let's build|hands on|exercise)/.test(lowered) ? 0.85 : 0.2
  };
}

function extractPrerequisites(text) {
  const lowered = normalize(text);
  const prerequisites = [];

  if (/\bjavascript\b/.test(lowered)) prerequisites.push('JavaScript basics');
  if (/\bhtml\b/.test(lowered)) prerequisites.push('HTML basics');
  if (/\bcss\b/.test(lowered)) prerequisites.push('CSS basics');
  if (/\btypescript\b/.test(lowered)) prerequisites.push('TypeScript basics');
  if (/\bnode\b/.test(lowered)) prerequisites.push('Node.js basics');

  return prerequisites;
}

function extractOutdatedSignals(text) {
  const lowered = normalize(text);
  const signals = [];

  if (/\bclass components\b/.test(lowered)) signals.push('Mentions class components');
  if (/\bcomponentwillmount\b|\bcomponentwillreceiveprops\b/.test(lowered)) {
    signals.push('Uses deprecated lifecycle methods');
  }
  if (/\bcreateclass\b/.test(lowered)) signals.push('Uses legacy React.createClass');

  return signals;
}

function estimateMetadataTeachingQuality(sourceText, chunkAnalyses, teachingStyle, dominantDifficulty) {
  const text = normalize(sourceText);
  const clarityEstimate = clamp(average(chunkAnalyses.map((chunk) => chunk.clarityScore)), 0.35, 0.92);
  const examplesScore = clamp(
    0.3 +
      (/\bexample\b|\bexamples\b|\bexercise\b|\bpractice\b/.test(text) ? 0.22 : 0) +
      (teachingStyle.hands_on >= 0.6 ? 0.16 : 0),
    0.25,
    0.9
  );
  const structureScore = clamp(
    0.35 +
      (/\bfull course\b|\bcourse\b|\blesson\b|\bpart\s*\d+\b|\bchapter\b|\bmodule\b/.test(text) ? 0.24 : 0) +
      (/\bstep by step\b|\bfrom scratch\b/.test(text) ? 0.16 : 0),
    0.3,
    0.92
  );
  const engagementScore = clamp(
    0.32 +
      (/\bbeginner\b|\bfor beginners\b|\bexplained\b|\btutorial\b/.test(text) ? 0.18 : 0),
    0.25,
    0.8
  );
  const completenessScore = clamp(
    0.28 +
      (/\bfull course\b|\bcomplete\b|\bfundamentals?\b|\bbasics?\b/.test(text) ? 0.25 : 0) +
      (dominantDifficulty === 'beginner' ? 0.08 : 0),
    0.2,
    0.82
  );

  const overallQuality = clamp(
    average([clarityEstimate, examplesScore, structureScore, engagementScore, completenessScore]),
    0.35,
    0.88
  );

  return {
    overallQuality,
    qualityTier: overallQuality >= 0.72 ? 'GOOD' : overallQuality >= 0.52 ? 'FAIR' : 'LIMITED',
    dimensions: {
      clarity: { score: clarityEstimate },
      examples: { score: examplesScore },
      structure: { score: structureScore },
      engagement: { score: engagementScore },
      completeness: { score: completenessScore },
      pace: {
        score: 0.5,
        verdict: average(chunkAnalyses.map((chunk) => (chunk.pace === 'slow' ? 0.7 : chunk.pace === 'fast' ? 0.45 : 0.55))) >= 0.55 ? 'medium' : 'fast'
      },
      vocabulary: {
        score: dominantDifficulty === 'beginner' ? 0.68 : dominantDifficulty === 'intermediate' ? 0.58 : 0.45,
        level: dominantDifficulty === 'advanced' ? 'ADVANCED' : dominantDifficulty === 'intermediate' ? 'MODERATE' : 'ACCESSIBLE'
      }
    },
    strengths: [
      /\bfor beginners\b|\bbeginner\b/.test(text) ? 'Clearly aimed at beginners' : null,
      /\bexplained\b|\btutorial\b|\blesson\b/.test(text) ? 'Strong teaching framing in metadata' : null,
      /\bfull course\b|\bfrom scratch\b|\bstep by step\b/.test(text) ? 'Appears structured and comprehensive' : null
    ].filter(Boolean),
    weaknesses: [
      'Metadata-only estimate'
    ],
    recommendations: []
  };
}

function heuristicAnalyzeChunk(chunk, chunkIndex) {
  const concepts = extractFrequentConcepts(chunk, 10);
  const difficulty = inferDifficulty(chunk);
  return {
    chunkIndex,
    summary: chunk.split(/[.!?]/).slice(0, 2).join('. ').slice(0, 240),
    conceptsTaught: concepts,
    difficulty,
    teachingStyle: inferTeachingStyle(chunk),
    depth: inferDepth(chunk),
    prerequisitesImplied: extractPrerequisites(chunk),
    clarityScore: clamp(
      0.55
        + (/\bstep by step\b|\bfor example\b|\blet's\b/.test(normalize(chunk)) ? 0.18 : 0)
        - (/\buh\b|\bum\b|\byou know\b/.test(normalize(chunk)) ? 0.08 : 0),
      0.25,
      0.95
    ),
    pace: inferPace(chunk),
    outdatedSignals: extractOutdatedSignals(chunk),
    usefulnessForBeginner: difficulty === 'beginner' ? 0.85 : difficulty === 'intermediate' ? 0.55 : 0.2,
    usefulnessForIntermediate: difficulty === 'intermediate' ? 0.85 : difficulty === 'advanced' ? 0.55 : 0.7,
    usefulnessForAdvanced: difficulty === 'advanced' ? 0.85 : 0.35,
    embeddingText: chunk.slice(0, 500)
  };
}

function buildDifficultyDistribution(chunks) {
  if (!chunks.length) {
    return { beginner: 0.34, intermediate: 0.33, advanced: 0.33 };
  }

  const counts = { beginner: 0, intermediate: 0, advanced: 0 };
  chunks.forEach((chunk) => {
    counts[chunk.difficulty] += 1;
  });

  const total = chunks.length;
  return {
    beginner: counts.beginner / total,
    intermediate: counts.intermediate / total,
    advanced: counts.advanced / total
  };
}

function heuristicAggregateProfile(candidate, transcriptText, chunkAnalyses) {
  const sourceText = `${candidate.title} ${candidate.description || ''} ${transcriptText || ''}`;
  const allConcepts = toUniqueList(chunkAnalyses.flatMap((chunk) => chunk.conceptsTaught));
  const explicitConceptSignals = extractConceptSignals(sourceText);
  const conceptDepthMap = {};

  chunkAnalyses.forEach((chunk) => {
    chunk.conceptsTaught.forEach((concept) => {
      const existing = conceptDepthMap[concept];
      if (!existing || DEPTH_ORDER.indexOf(chunk.depth) > DEPTH_ORDER.indexOf(existing)) {
        conceptDepthMap[concept] = chunk.depth;
      }
    });
  });

  const difficultyDistribution = buildDifficultyDistribution(chunkAnalyses);
  const dominantDifficulty = Object.entries(difficultyDistribution).sort((a, b) => b[1] - a[1])[0]?.[0] || 'beginner';
  const paceWeights = { slow: 0, medium: 0, fast: 0 };
  chunkAnalyses.forEach((chunk) => {
    paceWeights[chunk.pace] += 1;
  });

  const teachingStyle = {
    project_based: average(chunkAnalyses.map((chunk) => chunk.teachingStyle.project_based)),
    conceptual: average(chunkAnalyses.map((chunk) => chunk.teachingStyle.conceptual)),
    theory_heavy: average(chunkAnalyses.map((chunk) => chunk.teachingStyle.theory_heavy)),
    hands_on: average(chunkAnalyses.map((chunk) => chunk.teachingStyle.hands_on))
  };

  const outdatedSignals = toUniqueList(chunkAnalyses.flatMap((chunk) => chunk.outdatedSignals));
  const metadataTeachingQuality = estimateMetadataTeachingQuality(
    sourceText,
    chunkAnalyses,
    teachingStyle,
    dominantDifficulty
  );
  return {
    videoId: candidate.videoId,
    globalSummary:
      chunkAnalyses[0]?.summary ||
      `${candidate.title}. ${String(candidate.description || '').slice(0, 180)}`.trim(),
    conceptsCovered: toUniqueList([
      ...explicitConceptSignals,
      ...(allConcepts.length ? allConcepts : extractFrequentConcepts(sourceText, 10))
    ]),
    conceptDepthMap,
    dominantDifficulty,
    difficultyDistribution,
    teachingStyle,
    prerequisites: toUniqueList(chunkAnalyses.flatMap((chunk) => chunk.prerequisitesImplied)),
    clarityScore: clamp(average(chunkAnalyses.map((chunk) => chunk.clarityScore)), 0.3, 0.95),
    pace: Object.entries(paceWeights).sort((a, b) => b[1] - a[1])[0]?.[0] || 'medium',
    outdatedRiskScore: clamp(outdatedSignals.length * 0.15, 0, 0.9),
    outdatedSignals,
    bestForGoals: [
      teachingStyle.project_based >= 0.6 ? 'build_project' : null,
      dominantDifficulty === 'beginner' ? 'learn_basics' : null,
      teachingStyle.conceptual >= 0.65 ? 'concept_clarity' : null
    ].filter(Boolean),
    notIdealFor: [
      dominantDifficulty === 'advanced' ? 'Absolute beginners' : null,
      teachingStyle.theory_heavy >= 0.7 ? 'Users who want only hands-on work' : null
    ].filter(Boolean),
    coverageGaps: [],
    confidence: transcriptText ? 0.85 : 0.58,
    teachingQuality: transcriptText
      ? teachingQualityAnalyzer.analyzeQuality(transcriptText, allConcepts)
      : metadataTeachingQuality,
    videoEmbeddingText: [
      candidate.title,
      candidate.description || '',
      allConcepts.join(' '),
      dominantDifficulty,
      teachingStyle.project_based >= 0.6 ? 'project based' : '',
      teachingStyle.conceptual >= 0.6 ? 'conceptual' : ''
    ].join(' '),
    analysisProvider: 'heuristic'
  };
}

function normalizeStyle(style) {
  return {
    project_based: clamp(style?.project_based),
    conceptual: clamp(style?.conceptual),
    theory_heavy: clamp(style?.theory_heavy),
    hands_on: clamp(style?.hands_on)
  };
}

function normalizeChunkAnalysis(parsed, chunkIndex, fallbackChunk) {
  const heuristic = heuristicAnalyzeChunk(fallbackChunk, chunkIndex);

  return {
    chunkIndex,
    summary: String(parsed?.summary || heuristic.summary).slice(0, 280),
    conceptsTaught: toUniqueList(parsed?.conceptsTaught || heuristic.conceptsTaught).slice(0, 16),
    difficulty: ['beginner', 'intermediate', 'advanced'].includes(parsed?.difficulty) ? parsed.difficulty : heuristic.difficulty,
    teachingStyle: normalizeStyle(parsed?.teachingStyle || heuristic.teachingStyle),
    depth: ['intro', 'medium', 'deep'].includes(parsed?.depth) ? parsed.depth : heuristic.depth,
    prerequisitesImplied: toUniqueList(parsed?.prerequisitesImplied || heuristic.prerequisitesImplied).slice(0, 12),
    clarityScore: clamp(parsed?.clarityScore ?? heuristic.clarityScore),
    pace: ['slow', 'medium', 'fast'].includes(parsed?.pace) ? parsed.pace : heuristic.pace,
    outdatedSignals: toUniqueList(parsed?.outdatedSignals || heuristic.outdatedSignals).slice(0, 8),
    usefulnessForBeginner: clamp(parsed?.usefulnessForBeginner ?? heuristic.usefulnessForBeginner),
    usefulnessForIntermediate: clamp(parsed?.usefulnessForIntermediate ?? heuristic.usefulnessForIntermediate),
    usefulnessForAdvanced: clamp(parsed?.usefulnessForAdvanced ?? heuristic.usefulnessForAdvanced),
    embeddingText: String(parsed?.embeddingText || heuristic.embeddingText).slice(0, 800)
  };
}

function normalizeDifficultyDistribution(distribution, heuristicDistribution) {
  const beginner = clamp(distribution?.beginner ?? heuristicDistribution.beginner);
  const intermediate = clamp(distribution?.intermediate ?? heuristicDistribution.intermediate);
  const advanced = clamp(distribution?.advanced ?? heuristicDistribution.advanced);
  const total = beginner + intermediate + advanced;

  if (!total) return heuristicDistribution;

  return {
    beginner: beginner / total,
    intermediate: intermediate / total,
    advanced: advanced / total
  };
}

function normalizeVideoProfile(candidate, profile, heuristicProfile, chunkAnalyses = [], transcriptText = '') {
  const difficultyDistribution = normalizeDifficultyDistribution(
    profile?.difficultyDistribution,
    heuristicProfile.difficultyDistribution
  );

  return {
    videoId: candidate.videoId,
    globalSummary: String(profile?.globalSummary || heuristicProfile.globalSummary).slice(0, 400),
    conceptsCovered: toUniqueList(profile?.conceptsCovered || heuristicProfile.conceptsCovered).slice(0, 20),
    conceptDepthMap: Object.fromEntries(
      Object.entries(profile?.conceptDepthMap || heuristicProfile.conceptDepthMap || {}).filter(([, value]) =>
        ['intro', 'medium', 'deep'].includes(value)
      )
    ),
    dominantDifficulty: ['beginner', 'intermediate', 'advanced'].includes(profile?.dominantDifficulty)
      ? profile.dominantDifficulty
      : heuristicProfile.dominantDifficulty,
    difficultyDistribution,
    teachingStyle: normalizeStyle(profile?.teachingStyle || heuristicProfile.teachingStyle || EMPTY_STYLE),
    prerequisites: toUniqueList(profile?.prerequisites || heuristicProfile.prerequisites).slice(0, 12),
    clarityScore: clamp(profile?.clarityScore ?? heuristicProfile.clarityScore),
    pace: ['slow', 'medium', 'fast'].includes(profile?.pace) ? profile.pace : heuristicProfile.pace,
    outdatedRiskScore: clamp(profile?.outdatedRiskScore ?? heuristicProfile.outdatedRiskScore),
    outdatedSignals: toUniqueList(profile?.outdatedSignals || heuristicProfile.outdatedSignals).slice(0, 8),
    bestForGoals: toUniqueList(profile?.bestForGoals || heuristicProfile.bestForGoals).slice(0, 6),
    notIdealFor: toUniqueList(profile?.notIdealFor || heuristicProfile.notIdealFor).slice(0, 8),
    coverageGaps: toUniqueList(profile?.coverageGaps || heuristicProfile.coverageGaps).slice(0, 8),
    confidence: clamp(profile?.confidence ?? heuristicProfile.confidence),
    teachingQuality: profile?.teachingQuality || heuristicProfile.teachingQuality,
    videoEmbeddingText: String(profile?.videoEmbeddingText || heuristicProfile.videoEmbeddingText).slice(0, 1200),
    analysisMode: transcriptText ? 'transcript' : 'metadata',
    chunkAnalyses,
    analysisProvider: 'openai'
  };
}

async function analyzeChunkWithLLM(candidate, chunk, chunkIndex) {
  const prompt = fillPrompt(TRANSCRIPT_CHUNK_ANALYSIS_PROMPT, {
    CHUNK_INDEX: chunkIndex,
    VIDEO_TITLE: candidate.title,
    TRANSCRIPT_CHUNK: chunk
  });

  const parsed = await defaultLLMClient.completeJson(prompt);
  return normalizeChunkAnalysis(parsed, chunkIndex, chunk);
}

async function aggregateWithLLM(candidate, transcriptText, chunkAnalyses) {
  const prompt = fillPrompt(TRANSCRIPT_AGGREGATION_PROMPT, {
    VIDEO_ID: candidate.videoId,
    VIDEO_TITLE: candidate.title,
    CHUNK_ANALYSES_JSON: JSON.stringify(chunkAnalyses)
  });

  const parsed = await defaultLLMClient.completeJson(prompt);
  const heuristicProfile = heuristicAggregateProfile(candidate, transcriptText, chunkAnalyses);
  return normalizeVideoProfile(candidate, parsed, heuristicProfile, chunkAnalyses, transcriptText);
}

async function analyzeMetadataWithLLM(candidate) {
  const prompt = fillPrompt(NO_TRANSCRIPT_VIDEO_ANALYSIS_PROMPT, {
    VIDEO_ID: candidate.videoId,
    TITLE: candidate.title,
    DESCRIPTION: candidate.description || '',
    CHAPTERS: JSON.stringify(candidate.chapters || []),
    TAGS: JSON.stringify(candidate.tags || [])
  });

  const parsed = await defaultLLMClient.completeJson(prompt);
  const heuristicProfile = heuristicAggregateProfile(
    candidate,
    '',
    [heuristicAnalyzeChunk(`${candidate.title} ${candidate.description || ''} ${(candidate.chapters || []).join(' ')}`, 0)]
  );
  return normalizeVideoProfile(candidate, parsed, heuristicProfile, [], '');
}

async function buildTranscriptProfile(candidate, transcriptText) {
  const chunks = chunkTranscriptText(transcriptText).slice(0, 8);
  const heuristicChunks = chunks.map((chunk, index) => heuristicAnalyzeChunk(chunk, index));

  if (!defaultLLMClient.enabled || !chunks.length) {
    return heuristicAggregateProfile(candidate, transcriptText, heuristicChunks);
  }

  try {
    const chunkAnalyses = await Promise.all(
      chunks.map((chunk, index) => analyzeChunkWithLLM(candidate, chunk, index))
    );
    return await aggregateWithLLM(candidate, transcriptText, chunkAnalyses);
  } catch {
    return heuristicAggregateProfile(candidate, transcriptText, heuristicChunks);
  }
}

async function buildMetadataOnlyProfile(candidate) {
  const text = `${candidate.title} ${candidate.description || ''} ${(candidate.chapters || []).join(' ')}`;
  const heuristicProfile = heuristicAggregateProfile(candidate, '', [heuristicAnalyzeChunk(text, 0)]);

  if (!defaultLLMClient.enabled) {
    return heuristicProfile;
  }

  try {
    return await analyzeMetadataWithLLM(candidate);
  } catch {
    return heuristicProfile;
  }
}

function mapDominantDifficultyToEnum(value) {
  if (value === 'advanced') return 'ADVANCED';
  if (value === 'intermediate') return 'INTERMEDIATE';
  return 'BEGINNER';
}

function mapLearningMode(profile) {
  if (profile.teachingStyle.hands_on > profile.teachingStyle.conceptual + 0.15) return 'PRACTICAL';
  if (profile.teachingStyle.conceptual > profile.teachingStyle.hands_on + 0.15) return 'THEORY';
  return 'BOTH';
}

function mapTeachingStyle(profile) {
  if (profile.teachingStyle.project_based >= 0.7) return 'FUN';
  if (profile.teachingStyle.theory_heavy >= 0.65) return 'SERIOUS';
  return 'BALANCED';
}

function mapPace(profile) {
  if (profile.pace === 'slow') return 'SLOW';
  if (profile.pace === 'fast') return 'FAST';
  return 'MEDIUM';
}

function toStoredRecord(candidate, transcriptText, profile) {
  return {
    title: candidate.title,
    description: candidate.description || null,
    channelTitle: candidate.channelTitle || null,
    thumbnailUrl: candidate.thumbnailUrl || null,
    publishedAt: candidate.publishedAt ? new Date(candidate.publishedAt) : null,
    durationIso: candidate.durationIso || null,
    durationSeconds: candidate.durationSeconds || parseDurationIsoToSeconds(candidate.durationIso),
    viewCount: Number(candidate.viewCount || 0),
    transcriptText: transcriptText || null,
    chapters: candidate.chapters || [],
    commentsSample: candidate.commentsSample || [],
    querySources: candidate.querySources || [],
    topic: candidate.title,
    topicTags: profile.conceptsCovered,
    difficultyLevel: mapDominantDifficultyToEnum(profile.dominantDifficulty),
    language: candidate.language || 'English',
    learningMode: mapLearningMode(profile),
    projectBased: profile.teachingStyle.project_based >= 0.6,
    teachingStyle: mapTeachingStyle(profile),
    pace: mapPace(profile),
    beginnerFriendliness: clamp(1 - profile.difficultyDistribution.advanced * 0.7),
    confidenceScore: profile.confidence,
    summary: profile.globalSummary,
    analysisSource: transcriptText
      ? profile.analysisProvider === 'openai'
        ? 'transcript-openai'
        : 'transcript-heuristic'
      : profile.analysisProvider === 'openai'
        ? 'metadata-openai'
        : 'metadata-heuristic',
    analysisVersion: ANALYSIS_VERSION,
    profileJson: profile
  };
}

function requiresTeachingIntent(userProfile) {
  return ['learn_basics', 'concept_clarity', 'build_project'].includes(userProfile?.intent);
}

function incrementMetrics(metrics, field) {
  if (!metrics) return;
  metrics[field] = Number(metrics[field] || 0) + 1;
}

function trackAnalysisMode(metrics, analysisMode) {
  if (!metrics) return;
  if (analysisMode === 'transcript') {
    incrementMetrics(metrics, 'transcriptCount');
    return;
  }
  incrementMetrics(metrics, 'metadataOnlyCount');
}

export async function getOrCreateVideoProfile(candidate, logger, userProfile, metrics = null) {
  const existing = await prisma.cachedVideoAnalysis.findUnique({
    where: { videoId: candidate.videoId }
  });

  if (existing?.analysisVersion === ANALYSIS_VERSION && existing.profileJson) {
    incrementMetrics(metrics, 'cacheHit');
    trackAnalysisMode(metrics, existing.profileJson?.analysisMode);
    if (logger) {
      logger.logAnalysis(
        existing.videoId,
        existing.title,
        existing.profileJson?.analysisMode === 'transcript' ? 'TRANSCRIPT_BASED' : 'METADATA_ONLY',
        existing.profileJson?.confidence ?? existing.confidenceScore ?? 0
      );
    }
    return {
      record: existing,
      profile: existing.profileJson,
      excluded: false
    };
  }

  incrementMetrics(metrics, 'cacheMiss');

  const transcriptText = cleanTranscriptText(await fetchTranscriptText(candidate.videoId));
  if (logger) {
    if (transcriptText && transcriptText.length >= MIN_TRANSCRIPT_LENGTH) {
      logger.logTranscriptSuccess(candidate.videoId, candidate.title, transcriptText.length);
    } else {
      logger.logTranscriptFailed(candidate.videoId, candidate.title, 'No transcript or too short');
    }
  }
  const usableTranscriptText = transcriptText && transcriptText.length >= MIN_TRANSCRIPT_LENGTH ? transcriptText : '';

  if (usableTranscriptText) {
    const intentAnalysis = intentDetector.detectIntent(transcriptText);
    if (logger) {
      logger.logIntentDetection(candidate.videoId, candidate.title, intentAnalysis);
    }

    if (requiresTeachingIntent(userProfile)) {
      const shouldDowngradeToMetadata =
        intentAnalysis.intent !== 'TEACHING' || intentAnalysis.confidence < 0.3;

      if (shouldDowngradeToMetadata) {
        if (logger) {
          logger.logNotMatched(
            candidate.videoId,
            candidate.title,
            `Transcript intent weak; using metadata fallback: ${intentAnalysis.intent} (${intentAnalysis.confidence})`
          );
        }
        const fallbackProfile = await buildMetadataOnlyProfile(candidate);
        const fallbackRecord = existing
          ? await prisma.cachedVideoAnalysis.update({
              where: { id: existing.id },
              data: {
                videoId: candidate.videoId,
                ...toStoredRecord(candidate, '', fallbackProfile)
              }
            })
          : await prisma.cachedVideoAnalysis.create({
              data: {
                videoId: candidate.videoId,
                ...toStoredRecord(candidate, '', fallbackProfile)
              }
            });
        trackAnalysisMode(metrics, 'metadata');

        return {
          record: fallbackRecord,
          profile: fallbackProfile,
          excluded: false
        };
      }
    }
  }

  const profile = usableTranscriptText
    ? await buildTranscriptProfile(candidate, usableTranscriptText)
    : await buildMetadataOnlyProfile(candidate);
  if (usableTranscriptText && profile?.teachingQuality?.overallQuality < 0.25 && requiresTeachingIntent(userProfile)) {
    if (logger) {
      logger.logNotMatched(
        candidate.videoId,
        candidate.title,
        `Transcript teaching quality weak; using metadata fallback: ${profile.teachingQuality.overallQuality}`
      );
    }
    const fallbackProfile = await buildMetadataOnlyProfile(candidate);
    const fallbackRecord = existing
      ? await prisma.cachedVideoAnalysis.update({
          where: { id: existing.id },
          data: {
            videoId: candidate.videoId,
            ...toStoredRecord(candidate, '', fallbackProfile)
          }
        })
      : await prisma.cachedVideoAnalysis.create({
          data: {
            videoId: candidate.videoId,
            ...toStoredRecord(candidate, '', fallbackProfile)
          }
        });
    trackAnalysisMode(metrics, 'metadata');

    return {
      record: fallbackRecord,
      profile: fallbackProfile,
      excluded: false
    };
  }
  trackAnalysisMode(metrics, profile.analysisMode);
  if (logger) {
    logger.logAnalysis(
      candidate.videoId,
      candidate.title,
      profile.analysisMode === 'transcript' ? 'TRANSCRIPT_BASED' : 'METADATA_ONLY',
      profile.confidence
    );
    if (profile.teachingQuality) {
      logger.logTeachingQuality(candidate.videoId, candidate.title, profile.teachingQuality);
    }
  }

  const data = {
    videoId: candidate.videoId,
    ...toStoredRecord(candidate, usableTranscriptText, profile)
  };

  const record = existing
    ? await prisma.cachedVideoAnalysis.update({
        where: { id: existing.id },
        data
      })
    : await prisma.cachedVideoAnalysis.create({
        data
      });

  return { record, profile, excluded: false };
}

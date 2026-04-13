import express from 'express';
import { PrismaClient } from '@prisma/client';
import { buildUserProfile } from '../services/recommendations/userUnderstander.js';
import { buildRecommendationQueries } from '../services/recommendations/queryGenerator.js';
import { getOrCreateVideoProfile } from '../services/recommendations/videoUnderstander.js';
import { scoreVideoMatch } from '../services/recommendations/matcher.js';
import { rankRecommendations } from '../services/recommendations/ranker.js';
import { evaluateCandidateByPolicy } from '../services/recommendations/matchingPolicy.js';
import { fetchRecommendationCandidates } from '../services/youtubeService.js';
import PipelineLogger from '../services/logging/PipelineLogger.js';

const prisma = new PrismaClient();
const router = express.Router();
const CANDIDATE_ANALYSIS_CONCURRENCY = 4;
const RESPONSE_CACHE_TTL_MS = 1000 * 60 * 20;
const recommendationResponseCache = new Map();

function validateInput(body) {
  if (!String(body?.topic || '').trim() && !String(body?.rawRequirement || '').trim()) {
    return { error: 'Topic or rawRequirement is required.' };
  }

  return null;
}

function createRequestSignature(userProfile) {
  return JSON.stringify({
    rawRequirement: userProfile.rawRequirement || '',
    topic: userProfile.topic || '',
    level: userProfile.level || '',
    goal: userProfile.goal || '',
    language: userProfile.language || '',
    maxDurationMinutes: userProfile.maxDurationMinutes ?? null,
    mustHaveConcepts: userProfile.mustHaveConcepts || [],
    avoid: userProfile.avoid || [],
    knownPrerequisites: userProfile.knownPrerequisites || [],
    preferredStyle: userProfile.preferredStyle || {},
    intent: userProfile.intent || ''
  });
}

function getCachedResponse(signature) {
  const cached = recommendationResponseCache.get(signature);
  if (!cached) return null;
  if (Date.now() - cached.createdAt > RESPONSE_CACHE_TTL_MS) {
    recommendationResponseCache.delete(signature);
    return null;
  }
  return cached.payload;
}

function setCachedResponse(signature, payload) {
  recommendationResponseCache.set(signature, {
    createdAt: Date.now(),
    payload
  });
}

async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => runWorker()
  );

  await Promise.all(workers);
  return results;
}

router.post('/', async (req, res) => {
  const metrics = {
    queriesGenerated: 0,
    candidatesBeforeDedup: 0,
    candidatesAfterDedup: 0,
    candidatesAfterFilter: 0,
    transcriptCount: 0,
    metadataOnlyCount: 0,
    cacheHit: 0,
    cacheMiss: 0,
    analyzedCandidates: 0,
    rankedResults: 0,
    startTime: Date.now()
  };

  try {
    const validationError = validateInput(req.body);
    if (validationError) {
      return res.status(400).json(validationError);
    }

    const userProfile = buildUserProfile(req.body);
    if (!userProfile.topic) {
      return res.status(400).json({ error: 'Could not infer a valid learning topic from the request.' });
    }
    const requestSignature = createRequestSignature(userProfile);
    const cachedResponse = getCachedResponse(requestSignature);
    if (cachedResponse) {
      const cachedMetrics = cachedResponse.metrics || null;
      console.log('RECOMMENDATION_METRICS:', cachedMetrics || {
        ...metrics,
        totalTime: Date.now() - metrics.startTime,
        responseCacheHit: true
      });
      return res.json({
        ...cachedResponse,
        cached: true
      });
    }
    const logger = new PipelineLogger(`req_${Date.now()}`);

    const requestRecord = await prisma.recommendationRequest.create({
      data: {
        rawRequirement: userProfile.rawRequirement || null,
        topic: userProfile.topic,
        level: userProfile.level,
        goal: userProfile.goal || null,
        language: userProfile.language,
        learningMode: userProfile.legacy.learningMode,
        projectBased: userProfile.legacy.projectBased,
        teachingStyle: userProfile.legacy.teachingStyle,
        pace: userProfile.legacy.pace,
        maxDurationMinutes: userProfile.maxDurationMinutes,
        mustHave: userProfile.mustHaveConcepts,
        avoid: userProfile.avoid,
        knownPrerequisites: userProfile.knownPrerequisites,
        structuredProfile: {
          ...userProfile,
          contentConstraints: {
            excludeShorts: true,
            excludeOutdated: true,
            preferRecentIfTopicChangesFast: true
          }
        }
      }
    });
    logger.requestId = requestRecord.id;

    const queries = buildRecommendationQueries(userProfile);
    logger.logSearchStart(userProfile.topic);
    const candidates = await fetchRecommendationCandidates(queries, userProfile.language, {
      maxQueries: 24,
      perQueryResults: 10,
      metrics
    });
    logger.logSearchResult(userProfile.topic, candidates.length);
    const filteredCandidates = candidates.filter((candidate) => {
      const decision = evaluateCandidateByPolicy(userProfile, candidate);
      if (!decision.pass) {
        logger.logEarlyFilterReject(candidate.videoId, candidate.title, decision.reason, decision.pattern);
        return false;
      }
      logger.logEarlyFilterAccept(candidate.videoId, candidate.title);
      return true;
    });
    metrics.candidatesAfterFilter = filteredCandidates.length;

    const candidateBatch = filteredCandidates.slice(0, 60);
    metrics.analyzedCandidates = candidateBatch.length;
    const scoredItems = (await mapWithConcurrency(
      candidateBatch,
      CANDIDATE_ANALYSIS_CONCURRENCY,
      async (candidate) => {
      const { record, profile, excluded, reason } = await getOrCreateVideoProfile(candidate, logger, userProfile, metrics);
      if (excluded) {
        logger.logNotMatched(candidate.videoId, candidate.title, reason || 'Excluded before scoring');
        return null;
      }
      const match = scoreVideoMatch(userProfile, {
        ...profile,
        durationSeconds: candidate.durationSeconds || record.durationSeconds || null
      });

      if (match.gateFailure) {
        logger.logNotMatched(
          candidate.videoId,
          candidate.title,
          `${match.gateFailure}: ${match.warnings?.[0] || 'Rejected by hard gate'}`
        );
      } else if (match.shouldInclude) {
        logger.logMatched(candidate.videoId, candidate.title, match.finalScore);
      } else {
        logger.logNotMatched(candidate.videoId, candidate.title, 'Below score threshold');
      }

      return {
        candidate,
        record,
        profile,
        match,
        userProfile
      };
    }
    )).filter(Boolean);

    const ranked = rankRecommendations(scoredItems, 12);
    metrics.rankedResults = ranked.length;

    ranked.forEach((item) => {
      logger.logRanked(item.record.videoId, item.record.title, item.rank, item.match.finalScore);
    });

    if (ranked.length) {
      await prisma.recommendationResult.createMany({
        data: ranked.map((item) => ({
          requestId: requestRecord.id,
          videoAnalysisId: item.record.id,
          rank: item.rank,
          matchScore: item.match.finalScore,
          whyMatched: item.match.whyItMatches,
          warnings: item.match.warnings,
          scoreBreakdown: {
            topicMatch: item.match.topicMatch,
            conceptCoverageMatch: item.match.conceptCoverageMatch,
            subtypeFit: item.match.subtypeFit,
            difficultyMatch: item.match.difficultyMatch,
            prerequisiteCompatibility: item.match.prerequisiteCompatibility,
            teachingStyleMatch: item.match.teachingStyleMatch,
            depthMatch: item.match.depthMatch,
            durationFit: item.match.durationFit,
            clarityFit: item.match.clarityFit,
            outdatedPenalty: item.match.outdatedPenalty,
            semanticSimilarity: item.match.semanticSimilarity,
            confidenceBonus: item.match.confidenceBonus,
            teachingQuality: item.match.teachingQuality,
            teachingEffectiveness: item.match.teachingEffectiveness,
            avoidConceptPenalty: item.match.avoidConceptPenalty,
            avoidStylePenalty: item.match.avoidStylePenalty,
            metadataPenalty: item.match.metadataPenalty
          }
        }))
      });
    }

    const responsePayload = {
      requestId: requestRecord.id,
      queryCount: queries.length,
      candidateCount: filteredCandidates.length,
      metrics: {
        ...metrics,
        totalTime: Date.now() - metrics.startTime
      },
      debug: logger.getDetailedLog(),
      userProfile: {
        topic: userProfile.topic,
        level: userProfile.level,
        goal: userProfile.goal,
        intent: userProfile.intent,
        mustHaveConcepts: userProfile.mustHaveConcepts,
        avoid: userProfile.avoid,
        maxDurationMinutes: userProfile.maxDurationMinutes
      },
      results: ranked.map((item) => ({
        rank: item.rank,
        videoId: item.record.videoId,
        title: item.record.title,
        url: `https://www.youtube.com/watch?v=${item.record.videoId}`,
        thumbnailUrl: item.record.thumbnailUrl,
        channelTitle: item.record.channelTitle,
        durationSeconds: item.record.durationSeconds,
        finalScore: item.match.finalScore,
        matchScore: item.match.finalScore,
        whyMatched: item.match.whyItMatches,
        warnings: item.match.warnings,
        summary: item.profile.globalSummary,
        conceptsCovered: item.profile.conceptsCovered,
        dominantDifficulty: item.profile.dominantDifficulty,
        scoreBreakdown: {
          topicMatch: item.match.topicMatch,
          conceptCoverageMatch: item.match.conceptCoverageMatch,
          subtypeFit: item.match.subtypeFit,
          difficultyMatch: item.match.difficultyMatch,
          prerequisiteCompatibility: item.match.prerequisiteCompatibility,
          teachingStyleMatch: item.match.teachingStyleMatch,
          depthMatch: item.match.depthMatch,
          durationFit: item.match.durationFit,
          clarityFit: item.match.clarityFit,
          outdatedPenalty: item.match.outdatedPenalty,
          semanticSimilarity: item.match.semanticSimilarity,
          confidenceBonus: item.match.confidenceBonus,
          teachingQuality: item.match.teachingQuality,
          teachingEffectiveness: item.match.teachingEffectiveness,
          avoidConceptPenalty: item.match.avoidConceptPenalty,
          avoidStylePenalty: item.match.avoidStylePenalty,
          metadataPenalty: item.match.metadataPenalty
        },
        attributes: {
          summary: item.profile.globalSummary,
          difficultyLevel: item.profile.dominantDifficulty,
          learningMode: item.record.learningMode,
          teachingStyle: item.record.teachingStyle,
          pace: item.record.pace,
          language: item.record.language,
          clarityScore: item.profile.clarityScore,
          outdatedRiskScore: item.profile.outdatedRiskScore,
          confidence: item.profile.confidence,
          teachingQuality: item.profile.teachingQuality,
          analysisMode: item.profile.analysisMode,
          analysisSource: item.record.analysisSource
        }
      }))
    };

    console.log('RECOMMENDATION_METRICS:', responsePayload.metrics);
    setCachedResponse(requestSignature, responsePayload);
    return res.json(responsePayload);
  } catch (error) {
    console.error('Error generating recommendations:', error);
    return res.status(500).json({
      error: error.message || 'Failed to generate recommendations'
    });
  }
});

export default router;

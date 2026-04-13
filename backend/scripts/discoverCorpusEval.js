import { buildUserProfile } from '../src/services/recommendations/userUnderstander.js';
import { buildRecommendationQueries } from '../src/services/recommendations/queryGenerator.js';
import { extractFrequentConcepts, toUniqueList } from '../src/services/recommendations/common.js';
import { evaluateCandidateByPolicy } from '../src/services/recommendations/matchingPolicy.js';
import { scoreVideoMatch } from '../src/services/recommendations/matcher.js';
import { rankRecommendations } from '../src/services/recommendations/ranker.js';
import { buildDiscoverCorpusIndex, loadDiscoverCorpus } from '../src/services/recommendations/discoverCorpus.js';

function educationalIntentToQuality(intent) {
  if (intent === 'high') {
    return {
      overallQuality: 0.82,
      dimensions: {
        clarity: { score: 0.84 },
        examples: { score: 0.8 },
        structure: { score: 0.82 }
      }
    };
  }

  if (intent === 'medium') {
    return {
      overallQuality: 0.62,
      dimensions: {
        clarity: { score: 0.64 },
        examples: { score: 0.58 },
        structure: { score: 0.61 }
      }
    };
  }

  return {
    overallQuality: 0.3,
    dimensions: {
      clarity: { score: 0.32 },
      examples: { score: 0.28 },
      structure: { score: 0.3 }
    }
  };
}

function inferEducationalIntent(video) {
  const stored = video.analysisData?.educationalIntent;
  if (stored) return stored;
  return video.analysis?.analysisMode === 'transcript' ? 'high' : 'medium';
}

function buildVideoProfile(video) {
  const analysis = video.analysisData || {};
  const transcriptText = video.transcriptData?.text || '';
  const combinedText = [
    video.title,
    video.description,
    ...(video.tags || []),
    analysis.summary || '',
    transcriptText
  ].join(' ');

  const concepts = toUniqueList([
    ...(analysis.conceptsCovered || []),
    ...extractFrequentConcepts(combinedText, 12)
  ]).slice(0, 14);

  const difficulty = String(analysis.dominantDifficulty || 'beginner').toLowerCase();
  const conceptDepth = difficulty === 'advanced' ? 'deep' : difficulty === 'intermediate' ? 'medium' : 'intro';
  const educationalIntent = inferEducationalIntent(video);
  const quality = analysis.teachingQuality || educationalIntentToQuality(educationalIntent);

  return {
    globalSummary: analysis.summary || video.description || video.title,
    conceptsCovered: concepts,
    conceptDepthMap: Object.fromEntries(concepts.slice(0, 10).map((concept) => [concept, conceptDepth])),
    dominantDifficulty: difficulty,
    teachingStyle: analysis.teachingStyle || {
      project_based: 0.2,
      conceptual: 0.5,
      theory_heavy: 0.2,
      hands_on: 0.3
    },
    prerequisites: analysis.prerequisites || [],
    clarityScore: Number(quality.dimensions?.clarity?.score || 0.5),
    pace: analysis.pace || 'medium',
    outdatedRiskScore: Array.isArray(analysis.notIdealFor) && analysis.notIdealFor.some((item) => /outdated|legacy/i.test(item))
      ? 0.55
      : 0.1,
    outdatedSignals: Array.isArray(analysis.notIdealFor) ? analysis.notIdealFor.filter((item) => /outdated|legacy/i.test(item)) : [],
    bestForGoals: analysis.bestForRequestTypes || [],
    notIdealFor: analysis.notIdealFor || [],
    coverageGaps: analysis.coverageGaps || [],
    confidence: Number(analysis.confidence ?? video.analysis?.confidence ?? 0.5),
    teachingQuality: quality,
    videoEmbeddingText: combinedText,
    analysisMode: video.analysis?.analysisMode || 'metadata',
    durationSeconds: video.durationSeconds
  };
}

function buildVideoRecord(video) {
  return {
    id: video.id,
    videoId: video.videoId,
    title: video.title,
    channelTitle: video.channelTitle,
    durationSeconds: video.durationSeconds,
    language: video.language,
    analysisSource: video.analysis?.analysisMode === 'transcript' ? 'stored-transcript' : 'stored-metadata'
  };
}

function buildRequestInput(request) {
  return {
    ...request.learnerRequest,
    topic: request.expectedTopic,
    mustHave: request.mustHaveConcepts || [],
    intent: request.requestType
  };
}

function evaluateRequest(request, corpus) {
  const userProfile = {
    ...buildUserProfile(buildRequestInput(request)),
    intent: request.requestType
  };
  const queries = buildRecommendationQueries(userProfile);

  const filtered = [];
  const rejected = [];

  for (const video of corpus.videos) {
    const decision = evaluateCandidateByPolicy(userProfile, video);
    if (!decision.pass) {
      rejected.push({ videoId: video.videoId, title: video.title, reason: decision.reason });
      continue;
    }
    filtered.push(video);
  }

  const scoredItems = filtered.map((video) => {
    const profile = buildVideoProfile(video);
    const record = buildVideoRecord(video);
    const match = scoreVideoMatch(userProfile, profile);

    return {
      record,
      profile,
      match,
      userProfile,
      sourceVideo: video
    };
  });

  const ranked = rankRecommendations(scoredItems, 12);
  const rankedIds = ranked.map((item) => item.record.videoId);
  const highIds = request.labels.filter((label) => label.label === 'should_rank_high').map((label) => label.videoId);
  const mediumIds = request.labels.filter((label) => label.label === 'should_rank_medium').map((label) => label.videoId);
  const rejectIds = request.labels.filter((label) => label.label === 'should_reject').map((label) => label.videoId);

  const missingHigh = highIds.filter((id) => !rankedIds.includes(id));
  const mediumMisses = mediumIds.filter((id) => !rankedIds.includes(id));
  const rejectLeaks = rejectIds.filter((id) => rankedIds.includes(id));
  const topRankedId = rankedIds[0] || null;
  const highPriorityMiss = highIds.length > 0 && topRankedId && !highIds.includes(topRankedId) ? topRankedId : null;
  const passed =
    missingHigh.length === 0 &&
    mediumMisses.length === 0 &&
    rejectLeaks.length === 0 &&
    !highPriorityMiss;

  return {
    id: request.id,
    topic: userProfile.topic,
    requestType: request.requestType,
    mustHaveConcepts: userProfile.mustHaveConcepts,
    queryCount: queries.length,
    filteredCount: filtered.length,
    rankedCount: ranked.length,
    rankedIds,
    topRankedId,
    missingHigh,
    mediumMisses,
    rejectLeaks,
    highPriorityMiss,
    rejected,
    scoredDiagnostics: scoredItems.map((item) => ({
      id: item.record.videoId,
      title: item.record.title,
      finalScore: Number(item.match.finalScore.toFixed(3)),
      topicMatch: Number(item.match.topicMatch.toFixed(3)),
      conceptCoverageMatch: Number(item.match.conceptCoverageMatch.toFixed(3)),
      subtypeFit: Number(item.match.subtypeFit.toFixed(3)),
      teachingQuality: Number(item.match.teachingQuality.toFixed(3)),
      teachingEffectiveness: Number(item.match.teachingEffectiveness.toFixed(3)),
      gateFailure: item.match.gateFailure || null,
      shouldInclude: item.match.shouldInclude
    })),
    passed
  };
}

function printResult(result) {
  const status = result.passed ? 'PASS' : 'FAIL';
  console.log(`\n[${status}] ${result.id}`);
  console.log(`  Topic: ${result.topic}`);
  console.log(`  Must-have concepts: ${result.mustHaveConcepts.join(', ') || 'none'}`);
  console.log(`  Queries: ${result.queryCount}`);
  console.log(`  Filtered candidates: ${result.filteredCount}`);
  console.log(`  Ranked results: ${result.rankedCount}`);
  console.log(`  Ranked IDs: ${result.rankedIds.join(', ') || 'none'}`);

  if (result.missingHigh.length) {
    console.log(`  Missing expected high-rank items: ${result.missingHigh.join(', ')}`);
  }

  if (result.mediumMisses.length) {
    console.log(`  Medium items not included: ${result.mediumMisses.join(', ')}`);
  }

  if (result.rejectLeaks.length) {
    console.log(`  Rejected items that leaked into ranking: ${result.rejectLeaks.join(', ')}`);
  }

  if (result.highPriorityMiss) {
    console.log(`  Top-ranked result was not an expected high match: ${result.highPriorityMiss}`);
  }

  if (!result.passed) {
    if (result.rejected.length) {
      console.log('  Early rejections:');
      result.rejected.slice(0, 8).forEach((item) => {
        console.log(`    - ${item.videoId}: ${item.reason}`);
      });
    }

    if (result.scoredDiagnostics.length) {
      console.log('  Scored candidates:');
      result.scoredDiagnostics.forEach((item) => {
        console.log(
          `    - ${item.id}: score=${item.finalScore}, topic=${item.topicMatch}, concepts=${item.conceptCoverageMatch}, subtype=${item.subtypeFit}, gate=${item.gateFailure || 'none'}, include=${item.shouldInclude}`
        );
      });
    }
  }
}

async function main() {
  const corpus = buildDiscoverCorpusIndex(await loadDiscoverCorpus());
  const results = corpus.requests.map((request) => evaluateRequest(request, corpus));

  console.log('Discover Corpus Evaluation');
  console.log(`Stored videos: ${corpus.videos.length}`);
  console.log(`Labeled requests: ${corpus.requests.length}`);

  results.forEach(printResult);

  const passedCount = results.filter((result) => result.passed).length;
  const failedCount = results.length - passedCount;

  console.log('\nSummary');
  console.log(`  Passed: ${passedCount}`);
  console.log(`  Failed: ${failedCount}`);

  if (failedCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('Discover corpus evaluation failed:', error);
  process.exitCode = 1;
});

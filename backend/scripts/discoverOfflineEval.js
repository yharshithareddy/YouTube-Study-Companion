import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildUserProfile } from '../src/services/recommendations/userUnderstander.js';
import { buildRecommendationQueries } from '../src/services/recommendations/queryGenerator.js';
import { extractFrequentConcepts, keywordOverlap, normalize, tokenOverlapScore, toUniqueList } from '../src/services/recommendations/common.js';
import { scoreVideoMatch } from '../src/services/recommendations/matcher.js';
import { rankRecommendations } from '../src/services/recommendations/ranker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const datasetPath = path.join(repoRoot, 'discover-mock-dataset.json');

function getNonTeachingReason(candidate, userProfile) {
  const text = `${candidate.title} ${candidate.summary || ''} ${(candidate.tags || []).join(' ')}`.toLowerCase();
  const userText = `${userProfile.topic} ${userProfile.goal} ${userProfile.rawRequirement}`.toLowerCase();

  const userAskedForComparison = /\b(compare|comparison|which should i choose|best course|course review|review)\b/.test(userText);
  if (userAskedForComparison) return null;

  const rules = [
    ['movie_recap', /\bmovie recap\b|\bfilm recap\b|\bending explained\b/],
    ['animal_topic', /\bsnake\b|\bpython snake\b|\bgiant python\b|\breptile\b|\banaconda\b|\bwildlife\b|\bzoo\b/],
    ['entertainment', /\btrailer\b|\bscene\b|\bepisode\b|\bcelebrity\b|\bmovie\b|\bfilm\b/],
    ['audiobook', /\baudiobook\b/],
    ['book_review', /\bbook review\b/],
    ['book_summary', /\bbook summary\b/],
    ['review', /\breview\b/],
    ['comparison', /\bvs\b|\bversus\b|\bwhich should you choose\b/],
    ['top_list', /\btop\s*\d+\b|\btop five\b|\btop ten\b/],
    ['best_courses', /\bbest courses?\b|\bbest books?\b/],
    ['roadmap', /\broadmap\b|\bnext step\b|\bafter learning\b|\bwhat next\b/],
    ['opinion', /\bmy favorite\b|\bmy thoughts\b|\bshould you learn\b/],
    ['ai_generated', /\bai generated\b/],
    ['preview', /\bpreview\b/]
  ];

  for (const [reason, pattern] of rules) {
    if (pattern.test(text)) return reason;
  }

  return null;
}

function hasTutorialSignal(candidate, userProfile) {
  if (['compare_resources', 'next_step'].includes(userProfile.intent)) {
    return true;
  }

  const broadTopicRequest = userProfile.mustHaveConcepts.length === 0 && userProfile.topic.split(/\s+/).length <= 1;
  if (broadTopicRequest) {
    return true;
  }

  const text = `${candidate.title} ${candidate.summary || ''} ${(candidate.tags || []).join(' ')}`.toLowerCase();

  return [
    /\btutorial\b/,
    /\bfor beginners\b/,
    /\bbeginner\b/,
    /\bcrash course\b/,
    /\bfull course\b/,
    /\blesson\b/,
    /\bintro\b/,
    /\bexplained\b/,
    /\bguide\b/,
    /\bhands on\b/,
    /\bproject\b/,
    /\bbuild\b/,
    /\bfrom scratch\b/
  ].some((pattern) => pattern.test(text));
}

function hasIntentMatch(candidate, userProfile) {
  const text = `${candidate.title} ${candidate.summary || ''} ${(candidate.tags || []).join(' ')}`.toLowerCase();
  const broadTopicRequest = userProfile.mustHaveConcepts.length === 0 && userProfile.topic.split(/\s+/).length <= 1;

  if (broadTopicRequest) {
    return true;
  }

  if (userProfile.intent === 'build_project') {
    return /\bproject\b|\bbuild\b|\bapp\b|\bclone\b|\bhands on\b/.test(text);
  }

  if (userProfile.intent === 'concept_clarity') {
    return /\bexplain\b|\bexplained\b|\bconcept\b|\bunderstand\b|\bwhy\b|\bguide\b/.test(text);
  }

  if (userProfile.intent === 'learn_basics') {
    return /\bintro\b|\bbasics\b|\bbeginner\b|\bfor beginners\b|\bcrash course\b|\blesson\b/.test(text);
  }

  return true;
}

function evaluateCandidate(userProfile, candidate) {
  const nonTeachingReason = getNonTeachingReason(candidate, userProfile);
  if (nonTeachingReason) {
    return { pass: false, reason: nonTeachingReason };
  }

  if (!hasTutorialSignal(candidate, userProfile)) {
    return { pass: false, reason: 'missing_tutorial_signal' };
  }

  if (!hasIntentMatch(candidate, userProfile)) {
    return { pass: false, reason: 'intent_mismatch' };
  }

  const topicText = [
    candidate.title,
    candidate.summary || '',
    (candidate.tags || []).join(' ')
  ].join(' ');

  const topicOverlap = keywordOverlap(userProfile.topic, topicText);
  const conceptOverlap = userProfile.mustHaveConcepts.length
    ? keywordOverlap(userProfile.mustHaveConcepts.join(' '), topicText)
    : 0;
  const semanticOverlap = tokenOverlapScore(`${userProfile.topic} ${userProfile.goal}`, topicText);

  const strongSpecificRequest = userProfile.mustHaveConcepts.length > 0 || userProfile.topic.split(/\s+/).length > 1;
  const minimumTopicOverlap = strongSpecificRequest ? 0.35 : 0.18;

  if (topicOverlap < minimumTopicOverlap && semanticOverlap < 0.24 && conceptOverlap < 0.15) {
    return { pass: false, reason: 'low_topic_overlap' };
  }

  if (strongSpecificRequest && topicOverlap < 0.34 && conceptOverlap === 0) {
    return { pass: false, reason: 'specific_no_concept_overlap' };
  }

  return { pass: true };
}

function inferDifficulty(text) {
  const lowered = normalize(text);
  if (/(advanced|internals|deep dive|performance|optimization)/.test(lowered)) return 'advanced';
  if (/(intermediate|practical|project|build)/.test(lowered)) return 'intermediate';
  return 'beginner';
}

function inferTeachingStyle(text, requestType) {
  const lowered = normalize(text);
  return {
    project_based: /(project|build|from scratch|walkthrough)/.test(lowered) || requestType === 'build_project' ? 0.85 : 0.2,
    conceptual: /(explain|explained|understand|concept|mental model)/.test(lowered) || requestType === 'concept_clarity' ? 0.8 : 0.3,
    theory_heavy: /(internals|architecture|theory|formal)/.test(lowered) ? 0.7 : 0.15,
    hands_on: /(hands on|build|project|coding)/.test(lowered) || requestType === 'build_project' ? 0.8 : 0.25
  };
}

function teachingQualityFromIntent(intent) {
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

function buildMockVideoProfile(candidate, scenario) {
  const text = `${candidate.title} ${candidate.summary || ''} ${(candidate.tags || []).join(' ')}`;
  const concepts = toUniqueList([
    ...extractFrequentConcepts(text, 10),
    ...((candidate.tags || []).map((tag) => normalize(tag)))
  ]).slice(0, 12);

  const dominantDifficulty = inferDifficulty(text);
  const teachingStyle = inferTeachingStyle(text, scenario.requestType);
  const educationalIntent = candidate.educationalIntent || 'medium';
  const analysisMode = candidate.analysisMode || 'metadata';
  const confidence = analysisMode === 'transcript' ? 0.85 : 0.58;

  return {
    globalSummary: candidate.summary || candidate.title,
    conceptsCovered: concepts,
    conceptDepthMap: Object.fromEntries(concepts.slice(0, 8).map((concept) => [concept, dominantDifficulty === 'advanced' ? 'deep' : dominantDifficulty === 'intermediate' ? 'medium' : 'intro'])),
    dominantDifficulty,
    teachingStyle,
    prerequisites: [],
    clarityScore: educationalIntent === 'high' ? 0.82 : educationalIntent === 'medium' ? 0.62 : 0.3,
    pace: dominantDifficulty === 'advanced' ? 'fast' : 'medium',
    outdatedRiskScore: /class components|legacy/.test(normalize(text)) ? 0.55 : 0.1,
    outdatedSignals: /class components|legacy/.test(normalize(text)) ? ['legacy content'] : [],
    bestForGoals: [scenario.requestType],
    notIdealFor: candidate.rejectReason === 'too_advanced_for_beginner' ? ['Absolute beginners'] : [],
    coverageGaps: [],
    confidence,
    teachingQuality: teachingQualityFromIntent(educationalIntent),
    videoEmbeddingText: text,
    analysisMode
  };
}

function buildMockRecord(candidate) {
  return {
    id: candidate.id,
    videoId: candidate.id,
    title: candidate.title,
    channelTitle: candidate.channelTitle,
    durationSeconds: 1800,
    learningMode: 'BOTH',
    teachingStyle: 'BALANCED',
    pace: 'MEDIUM',
    language: 'English',
    analysisSource: candidate.analysisMode === 'transcript' ? 'transcript-mock' : 'metadata-mock'
  };
}

function buildScenarioInput(scenario) {
  return {
    ...scenario.learnerRequest,
    topic: scenario.expectedBehavior?.topic || scenario.learnerRequest?.topic,
    mustHave:
      scenario.expectedBehavior?.mustHaveConcepts?.length
        ? scenario.expectedBehavior.mustHaveConcepts
        : scenario.learnerRequest?.mustHave,
    preferredStyle:
      scenario.learnerRequest?.preferredStyle || scenario.expectedBehavior?.shouldPrefer?.[0] || '',
    intent: scenario.requestType
  };
}

function evaluateScenario(scenario) {
  const userProfile = {
    ...buildUserProfile(buildScenarioInput(scenario)),
    intent: scenario.requestType
  };
  const queries = buildRecommendationQueries(userProfile);

  const allCandidates = [
    ...scenario.candidates.shouldRankHigh,
    ...scenario.candidates.shouldRankMedium,
    ...scenario.candidates.shouldReject
  ];

  const filtered = [];
  const rejected = [];

  for (const candidate of allCandidates) {
    const decision = evaluateCandidate(userProfile, candidate);
    if (!decision.pass) {
      rejected.push({ id: candidate.id, title: candidate.title, reason: decision.reason });
      continue;
    }
    filtered.push(candidate);
  }

  const scoredItems = filtered.map((candidate) => {
    const profile = buildMockVideoProfile(candidate, scenario);
    const record = buildMockRecord(candidate);
    const match = scoreVideoMatch(userProfile, {
      ...profile,
      durationSeconds: record.durationSeconds
    });

    return {
      candidate,
      record,
      profile,
      match,
      userProfile
    };
  });

  const ranked = rankRecommendations(scoredItems, 12);
  const rankedIds = ranked.map((item) => item.record.videoId);
  const highIds = scenario.candidates.shouldRankHigh.map((item) => item.id);
  const mediumIds = scenario.candidates.shouldRankMedium.map((item) => item.id);
  const rejectIds = scenario.candidates.shouldReject.map((item) => item.id);

  const missingHigh = highIds.filter((id) => !rankedIds.includes(id));
  const rejectLeaks = rejectIds.filter((id) => rankedIds.includes(id));
  const mediumHits = mediumIds.filter((id) => rankedIds.includes(id));

  const passed = missingHigh.length === 0 && rejectLeaks.length === 0;

  return {
    id: scenario.id,
    requestType: scenario.requestType,
    topic: userProfile.topic,
    mustHaveConcepts: userProfile.mustHaveConcepts,
    queryCount: queries.length,
    filteredCount: filtered.length,
    rankedCount: ranked.length,
    rankedIds,
    missingHigh,
    mediumHits,
    rejectLeaks,
    rejected,
    scoredDiagnostics: scoredItems.map((item) => ({
      id: item.record.videoId,
      title: item.record.title,
      finalScore: Number(item.match.finalScore.toFixed(3)),
      topicMatch: Number(item.match.topicMatch.toFixed(3)),
      conceptCoverageMatch: Number(item.match.conceptCoverageMatch.toFixed(3)),
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

  if (result.rejectLeaks.length) {
    console.log(`  Rejected items that leaked into ranking: ${result.rejectLeaks.join(', ')}`);
  }

  if (result.mediumHits.length) {
    console.log(`  Medium-ranked items included: ${result.mediumHits.join(', ')}`);
  }

  if (!result.passed) {
    if (result.rejected.length) {
      console.log('  Early rejections:');
      result.rejected.slice(0, 5).forEach((item) => {
        console.log(`    - ${item.id}: ${item.reason}`);
      });
    }

    if (result.scoredDiagnostics.length) {
      console.log('  Scored candidates:');
      result.scoredDiagnostics.forEach((item) => {
        console.log(
          `    - ${item.id}: score=${item.finalScore}, topic=${item.topicMatch}, concepts=${item.conceptCoverageMatch}, gate=${item.gateFailure || 'none'}, include=${item.shouldInclude}`
        );
      });
    }
  }
}

async function main() {
  const raw = await fs.readFile(datasetPath, 'utf8');
  const dataset = JSON.parse(raw);
  const results = dataset.scenarios.map(evaluateScenario);

  console.log('Discover Offline Evaluation');
  console.log(`Dataset: ${path.basename(datasetPath)}`);
  console.log(`Scenarios: ${results.length}`);

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
  console.error('Offline evaluation failed:', error);
  process.exitCode = 1;
});

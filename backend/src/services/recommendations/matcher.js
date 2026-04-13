import { clamp, tokenOverlapScore, normalize } from './common.js';
import { calculateSubtypeFit } from './matchingPolicy.js';

const DEPTH_VALUES = {
  intro: 0.25,
  intro_to_medium: 0.45,
  medium: 0.65,
  deep: 0.9
};

function tokenizeConcept(value) {
  return new Set(
    String(value || '')
      .toLowerCase()
      .split(/[^a-z0-9+#.]+/)
      .map((token) => (token.length > 4 ? token.replace(/s$/, '') : token))
      .filter((token) => token && token.length > 2)
  );
}

function conceptSimilarity(requiredItem, availableItem) {
  const left = tokenizeConcept(requiredItem);
  const right = tokenizeConcept(availableItem);
  if (!left.size || !right.size) return 0;

  let overlap = 0;
  left.forEach((token) => {
    if (right.has(token)) overlap += 1;
  });

  if (!overlap) return 0;
  if (overlap === left.size && overlap === right.size) return 1;
  return Math.max(overlap / left.size, overlap / right.size) * 0.75;
}

function overlapScore(required = [], available = []) {
  if (!required.length) return 1;
  const left = new Set(required.map((item) => normalize(item)).filter(Boolean));
  const right = new Set(available.map((item) => normalize(item)).filter(Boolean));
  if (!left.size) return 1;

  let score = 0;
  left.forEach((item) => {
    if (right.has(item)) {
      score += 1;
      return;
    }

    let bestPartial = 0;
    right.forEach((availableItem) => {
      bestPartial = Math.max(bestPartial, conceptSimilarity(item, availableItem));
    });
    score += bestPartial;
  });

  return clamp(score / left.size);
}

function penaltyScore(avoidItems = [], actualItems = []) {
  if (!avoidItems.length) return 0;
  const left = new Set(avoidItems.map((item) => normalize(item)).filter(Boolean));
  const right = new Set(actualItems.map((item) => normalize(item)).filter(Boolean));
  if (!left.size) return 0;

  let overlap = 0;
  left.forEach((item) => {
    if (right.has(item)) overlap += 1;
  });

  return overlap / left.size;
}

function semanticSimilarity(userProfile, videoProfile) {
  return tokenOverlapScore(userProfile.semanticText, videoProfile.videoEmbeddingText || videoProfile.globalSummary);
}

function topicMatch(userProfile, videoProfile) {
  return tokenOverlapScore(userProfile.topic, `${videoProfile.globalSummary} ${videoProfile.conceptsCovered.join(' ')}`);
}

function difficultyMatch(userProfile, videoProfile) {
  const order = { BEGINNER: 0, INTERMEDIATE: 1, ADVANCED: 2 };
  const mappedVideoLevel = {
    beginner: 'BEGINNER',
    intermediate: 'INTERMEDIATE',
    advanced: 'ADVANCED'
  }[videoProfile.dominantDifficulty] || 'BEGINNER';

  if (userProfile.level === mappedVideoLevel) return 1;
  const distance = Math.abs((order[userProfile.level] ?? 0) - (order[mappedVideoLevel] ?? 0));
  if (distance === 1) return 0.5;
  return 0;
}

function prerequisiteCompatibility(userProfile, videoProfile) {
  const known = userProfile.knownPrerequisites || [];
  const required = videoProfile.prerequisites || [];
  if (!required.length) return 1;
  if (!known.length) return 0.45;

  const knownSet = new Set(known.map((item) => normalize(item)));
  let covered = 0;

  required.forEach((item) => {
    const requirement = normalize(item);
    const matched = [...knownSet].some(
      (knownItem) => requirement.includes(knownItem) || knownItem.includes(requirement)
    );
    if (matched) covered += 1;
  });

  return covered / required.length;
}

function teachingStyleMatch(userProfile, videoProfile) {
  const expected = userProfile.preferredStyle || {};
  const actual = videoProfile.teachingStyle || {};
  const keys = ['project_based', 'conceptual', 'theory_heavy', 'hands_on'];
  let total = 0;
  let weight = 0;

  keys.forEach((key) => {
    const left = Number(expected[key] ?? (key === 'hands_on' ? expected.practical : 0));
    const right = Number(actual[key] || 0);
    const axisWeight = Math.max(left, 0.1);
    total += (1 - Math.abs(left - right)) * axisWeight;
    weight += axisWeight;
  });

  return weight ? total / weight : 0.5;
}

function goalFit(userProfile, videoProfile) {
  const bestForGoals = (videoProfile.bestForGoals || []).map((item) => normalize(item));
  const intent = normalize(userProfile.intent);
  if (bestForGoals.includes(intent)) return 1;

  if (intent === 'broad_exploration' && bestForGoals.includes('learn_basics')) return 0.85;
  if (intent === 'learn_basics' && bestForGoals.includes('broad_exploration')) return 0.8;

  if (intent === 'concept_clarity') {
    return clamp(
      0.35 +
        0.45 * Number(videoProfile.teachingStyle?.conceptual || 0) +
        0.2 * Number(videoProfile.clarityScore || 0.5)
    );
  }

  if (intent === 'build_project') {
    return clamp(
      0.35 +
        0.45 * Number(videoProfile.teachingStyle?.project_based || 0) +
        0.2 * Number(videoProfile.teachingStyle?.hands_on || 0)
    );
  }

  return 0.5;
}

function depthMatch(userProfile, videoProfile) {
  const desired = DEPTH_VALUES[userProfile.depthRequired] || 0.45;
  const conceptDepths = Object.values(videoProfile.conceptDepthMap || {});
  const averageDepth = conceptDepths.length
    ? conceptDepths.reduce((sum, value) => sum + (DEPTH_VALUES[value] || 0.45), 0) / conceptDepths.length
    : 0.45;

  return clamp(1 - Math.abs(desired - averageDepth));
}

function durationFit(userProfile, videoProfile) {
  const durationSeconds = Number(videoProfile.durationSeconds || 0);
  const maxMinutes = Number(userProfile.maxDurationMinutes || 0);
  const minMinutes = Number(userProfile.minDurationMinutes || 0);

  if (!maxMinutes && !minMinutes) return null;
  if (!durationSeconds) return 0.75;

  const durationMinutes = durationSeconds / 60;
  if (maxMinutes && durationMinutes > maxMinutes) {
    return clamp(1 - (durationMinutes - maxMinutes) / maxMinutes);
  }

  if (minMinutes && durationMinutes < minMinutes) {
    return clamp(1 - (minMinutes - durationMinutes) / (maxMinutes || 30));
  }

  return 1;
}

function clarityFit(videoProfile) {
  return clamp(Number(videoProfile.clarityScore || 0.5));
}

function confidenceBonus(videoProfile) {
  return clamp(Number(videoProfile.confidence || 0.5));
}

function teachingQualityScore(videoProfile) {
  return clamp(Number(videoProfile.teachingQuality?.overallQuality || 0.35));
}

function teachingEffectiveness(videoProfile) {
  const quality = videoProfile.teachingQuality?.dimensions || {};
  const clarity = Number(quality.clarity?.score || videoProfile.clarityScore || 0.5);
  const examples = Number(quality.examples?.score || 0.3);
  const structure = Number(quality.structure?.score || 0.4);
  return clamp((clarity + examples + structure) / 3);
}

function outdatedPenalty(userProfile, videoProfile) {
  const wantsFresh = Boolean(userProfile.contentConstraints?.excludeOutdated || userProfile.contentConstraints?.exclude_outdated);
  const penalty = clamp(Number(videoProfile.outdatedRiskScore || 0));
  return wantsFresh ? penalty : penalty * 0.5;
}

function buildReasons(userProfile, scores) {
  const reasons = [];
  const warnings = [];

  if (scores.conceptCoverageMatch > 0.7) reasons.push('Covers most required concepts');
  if (scores.subtypeFit > 0.75) reasons.push('Matches the exact kind of content requested');
  if (scores.goalFit > 0.8) reasons.push('Well aligned with the learning goal');
  if (scores.difficultyMatch > 0.9) reasons.push('Good level match');
  if (scores.teachingStyleMatch > 0.7) reasons.push('Matches preferred teaching style');
  if (scores.durationFit !== null && scores.durationFit > 0.8) reasons.push('Fits requested duration');
  if (scores.clarityFit > 0.75) reasons.push('Clear explanation profile');
  if (scores.teachingQuality > 0.75) reasons.push('High-quality teaching');
  if (scores.teachingEffectiveness > 0.75) reasons.push('Strong teaching effectiveness');
  if (scores.prerequisiteCompatibility < 0.5) warnings.push('May assume knowledge the learner does not have');
  if (scores.outdatedPenalty > 0.4) warnings.push('Possible outdated content');
  if (scores.confidenceBonus < 0.5) warnings.push('Profile confidence is limited');
  if (scores.avoidConceptPenalty > 0.25) warnings.push('Touches concepts the learner wanted to avoid');
  if (scores.avoidStylePenalty > 0.25) warnings.push('Likely uses an unwanted teaching style');
  if (scores.metadataPenalty > 0.2) warnings.push('Used weaker metadata-only analysis');

  if (!reasons.length) reasons.push('Solid overall fit across topic, content, and teaching style');

  return { reasons, warnings };
}

function getRequestWeights(intent) {
  const byIntent = {
    learn_basics: {
      conceptCoverageMatch: 0.22,
      subtypeFit: 0.06,
      goalFit: 0.1,
      teachingQuality: 0.2,
      teachingEffectiveness: 0.18,
      difficultyMatch: 0.1,
      prerequisiteCompatibility: 0.08,
      teachingStyleMatch: 0.08,
      topicMatch: 0.05,
      semanticSimilarity: 0.04,
      clarityFit: 0.03,
      confidenceBonus: 0.02
    },
    concept_clarity: {
      conceptCoverageMatch: 0.24,
      subtypeFit: 0.1,
      goalFit: 0.12,
      teachingQuality: 0.2,
      teachingEffectiveness: 0.18,
      difficultyMatch: 0.08,
      prerequisiteCompatibility: 0.08,
      teachingStyleMatch: 0.12,
      topicMatch: 0.03,
      semanticSimilarity: 0.05,
      clarityFit: 0.02,
      confidenceBonus: 0.02
    },
    build_project: {
      conceptCoverageMatch: 0.2,
      subtypeFit: 0.18,
      goalFit: 0.12,
      teachingQuality: 0.16,
      teachingEffectiveness: 0.22,
      difficultyMatch: 0.08,
      prerequisiteCompatibility: 0.08,
      teachingStyleMatch: 0.1,
      topicMatch: 0.05,
      semanticSimilarity: 0.05,
      clarityFit: 0.02,
      confidenceBonus: 0.02
    },
    broad_exploration: {
      conceptCoverageMatch: 0.16,
      subtypeFit: 0.02,
      goalFit: 0.12,
      teachingQuality: 0.22,
      teachingEffectiveness: 0.16,
      difficultyMatch: 0.12,
      prerequisiteCompatibility: 0.08,
      teachingStyleMatch: 0.08,
      topicMatch: 0.09,
      semanticSimilarity: 0.05,
      clarityFit: 0.02,
      confidenceBonus: 0.02
    }
  };

  return byIntent[intent] || {
    conceptCoverageMatch: 0.2,
    subtypeFit: 0.06,
    teachingQuality: 0.18,
    teachingEffectiveness: 0.18,
    difficultyMatch: 0.1,
    prerequisiteCompatibility: 0.1,
    teachingStyleMatch: 0.1,
    topicMatch: 0.06,
    semanticSimilarity: 0.04,
    clarityFit: 0.02,
    confidenceBonus: 0.02
  };
}

function getThresholds(intent) {
  const defaults = {
    minConceptCoverageMatch: 0.5,
    minTeachingQuality: 0.4,
    minTeachingEffectiveness: 0.35,
    minTopicMatch: 0.4
  };

  if (intent === 'concept_clarity') {
    return {
      ...defaults,
      minConceptCoverageMatch: 0.55,
      minTeachingQuality: 0.5,
      minTeachingEffectiveness: 0.45,
      minTopicMatch: 0.45
    };
  }

  if (intent === 'build_project') {
    return {
      ...defaults,
      minConceptCoverageMatch: 0.45,
      minTeachingQuality: 0.38,
      minTeachingEffectiveness: 0.45,
      minTopicMatch: 0.4
    };
  }

  if (intent === 'broad_exploration') {
    return {
      ...defaults,
      minConceptCoverageMatch: 0.3,
      minTeachingQuality: 0.38,
      minTeachingEffectiveness: 0.32,
      minTopicMatch: 0.35
    };
  }

  return defaults;
}

function checkHardGates(userProfile, scores) {
  const thresholds = getThresholds(userProfile.intent);

  if (scores.topicMatch < thresholds.minTopicMatch) {
    return { passed: false, gateFailure: 'TOPIC_MATCH', reason: `Topic match too low (${Math.round(scores.topicMatch * 100)}%)` };
  }

  if (scores.conceptCoverageMatch < thresholds.minConceptCoverageMatch) {
    return {
      passed: false,
      gateFailure: 'CONCEPT_MATCH',
      reason: `Concept match too low (${Math.round(scores.conceptCoverageMatch * 100)}%)`
    };
  }

  if (scores.teachingQuality < thresholds.minTeachingQuality) {
    return {
      passed: false,
      gateFailure: 'TEACHING_QUALITY',
      reason: `Teaching quality too low (${Math.round(scores.teachingQuality * 100)}%)`
    };
  }

  if (scores.teachingEffectiveness < thresholds.minTeachingEffectiveness) {
    return {
      passed: false,
      gateFailure: 'TEACHING_EFFECTIVENESS',
      reason: `Teaching effectiveness too low (${Math.round(scores.teachingEffectiveness * 100)}%)`
    };
  }

  if (userProfile.intent === 'build_project' && userProfile.mustHaveConcepts.length > 0 && scores.subtypeFit < 0.45) {
    return {
      passed: false,
      gateFailure: 'SUBTYPE_MATCH',
      reason: `Project subtype match too low (${Math.round(scores.subtypeFit * 100)}%)`
    };
  }

  return { passed: true, gateFailure: null, reason: null };
}

export function scoreVideoMatch(userProfile, videoProfile) {
  const conceptCoverageMatch = overlapScore(userProfile.mustHaveConcepts || [], videoProfile.conceptsCovered || []);
  const avoidConceptPenalty = penaltyScore(userProfile.avoidConcepts || [], videoProfile.conceptsCovered || []);
  const avoidStylePenalty = penaltyScore(userProfile.avoidStyles || [], videoProfile.notIdealFor || []);
  const specificRequest = userProfile.mustHaveConcepts.length > 0 || userProfile.topic.split(/\s+/).length > 1;
  const metadataPenalty =
    videoProfile.analysisMode === 'metadata'
      ? specificRequest
        ? 0.35
        : 0.18
      : 0;

  const scores = {
    topicMatch: topicMatch(userProfile, videoProfile),
    conceptCoverageMatch,
    subtypeFit: calculateSubtypeFit(userProfile, videoProfile),
    goalFit: goalFit(userProfile, videoProfile),
    difficultyMatch: difficultyMatch(userProfile, videoProfile),
    prerequisiteCompatibility: prerequisiteCompatibility(userProfile, videoProfile),
    teachingStyleMatch: teachingStyleMatch(userProfile, videoProfile),
    depthMatch: depthMatch(userProfile, videoProfile),
    durationFit: durationFit(userProfile, videoProfile),
    clarityFit: clarityFit(videoProfile),
    outdatedPenalty: outdatedPenalty(userProfile, videoProfile),
    semanticSimilarity: semanticSimilarity(userProfile, videoProfile),
    confidenceBonus: confidenceBonus(videoProfile),
    teachingQuality: teachingQualityScore(videoProfile),
    teachingEffectiveness: teachingEffectiveness(videoProfile),
    avoidConceptPenalty,
    avoidStylePenalty,
    metadataPenalty
  };
  const gate = checkHardGates(userProfile, scores);
  if (!gate.passed) {
    return {
      ...scores,
      finalScore: 0,
      confidence: 0,
      shouldInclude: false,
      gateFailure: gate.gateFailure,
      whyItMatches: [],
      warnings: [gate.reason]
    };
  }

  const weights = getRequestWeights(userProfile.intent);
  const weightedParts = Object.entries(weights);

  if (scores.durationFit !== null) {
    weightedParts.push(['durationFit', 0.05]);
  }

  const positiveWeightTotal = weightedParts.reduce((sum, [, weight]) => sum + weight, 0);
  const positiveScore = weightedParts.reduce((sum, [key, weight]) => sum + weight * Number(scores[key] || 0), 0);
  const penalty =
    0.04 * scores.outdatedPenalty +
    0.05 * scores.avoidConceptPenalty +
    0.04 * scores.avoidStylePenalty +
    0.12 * scores.metadataPenalty;

  const finalScore = clamp(positiveScore / positiveWeightTotal - penalty);
  const confidence = clamp(
    0.5 * (
      Object.values({
        conceptCoverageMatch: scores.conceptCoverageMatch,
        teachingQuality: scores.teachingQuality,
        teachingEffectiveness: scores.teachingEffectiveness,
        topicMatch: scores.topicMatch
      }).filter((value) => value > 0.7).length / 4
    ) +
      0.3 * scores.confidenceBonus +
      0.2 * scores.teachingQuality
  );

  const { reasons, warnings } = buildReasons(userProfile, scores);

  return {
    ...scores,
    finalScore,
    confidence,
    shouldInclude: finalScore > 0.4,
    gateFailure: null,
    whyItMatches: reasons,
    warnings
  };
}

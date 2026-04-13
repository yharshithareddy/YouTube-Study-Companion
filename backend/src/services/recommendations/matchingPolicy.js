import { keywordOverlap, normalize, tokenOverlapScore } from './common.js';

const SCRAPER_GROUPS = [
  ['web scraping', 'web scraper', 'scraping', 'scraper'],
  ['beautiful soup', 'bs4', 'html parsing', 'parse html'],
  ['requests', 'http request', 'http requests', 'fetch page']
];

function getCandidateText(candidate) {
  return [
    candidate.title,
    candidate.description || '',
    (candidate.tags || []).join(' '),
    (candidate.chapters || []).join(' '),
    candidate.globalSummary || '',
    (candidate.conceptsCovered || []).join(' '),
    candidate.videoEmbeddingText || ''
  ]
    .join(' ')
    .toLowerCase();
}

function buildSubtypePolicy(userProfile) {
  const rawText = normalize(
    `${userProfile.rawRequirement} ${userProfile.topic} ${(userProfile.mustHaveConcepts || []).join(' ')}`
  );

  const policy = {
    requiredGroups: [],
    minRequiredGroups: 0
  };

  if (
    userProfile.intent === 'build_project' &&
    /\bweb scrapp?ing\b|\bweb scrapp?er\b|\bbeautiful soup\b|\bbs4\b|\brequests?\b/.test(rawText)
  ) {
    policy.requiredGroups = SCRAPER_GROUPS;
    policy.minRequiredGroups = 2;
  }

  return policy;
}

function countMatchedGroups(groups, text) {
  if (!groups.length) return 0;
  return groups.filter((group) => group.some((signal) => text.includes(signal))).length;
}

export function calculateSubtypeFit(userProfile, videoProfile) {
  const policy = buildSubtypePolicy(userProfile);
  if (!policy.requiredGroups.length) return 1;

  const text = getCandidateText(videoProfile);
  const matchedGroups = countMatchedGroups(policy.requiredGroups, text);
  return matchedGroups / policy.requiredGroups.length;
}

export function getNonTeachingReason(candidate, userProfile) {
  const text = getCandidateText(candidate);
  const userText = normalize(`${userProfile.topic} ${userProfile.goal} ${userProfile.rawRequirement}`);

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
    ['resource_advice', /\bhow i'd learn\b|\bhow i would learn\b|\bdo this instead\b|\binstead of watching\b|\bmy recommended\b|\brecommended resources?\b|\bbest resources?\b/],
    ['roadmap', /\broadmap\b|\bnext step\b|\bafter learning\b|\bwhat next\b/],
    ['opinion', /\bmy favorite\b|\bmy thoughts\b|\bshould you learn\b/],
    ['ai_generated', /\bai generated\b/],
    ['preview', /\bpreview\b/]
  ];

  for (const [reason, pattern] of rules) {
    if (pattern.test(text)) return reason;
  }

  const isModernReactRequest = /\breact\b/.test(userProfile.topic) && !/\bclass components?\b/.test(userText);
  if (isModernReactRequest && /\bclass components?\b|\blifecycle methods?\b/.test(text) && !/\bhooks?\b/.test(text)) {
    return 'legacy_framework_content';
  }

  return null;
}

export function hasTutorialSignal(candidate, userProfile) {
  if (['compare_resources', 'next_step'].includes(userProfile.intent)) {
    return true;
  }

  const broadTopicRequest = userProfile.mustHaveConcepts.length === 0 && userProfile.topic.split(/\s+/).length <= 1;
  if (broadTopicRequest) {
    return true;
  }

  const text = getCandidateText(candidate);

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
    /\bfrom scratch\b/,
    /\bwalkthrough\b/
  ].some((pattern) => pattern.test(text));
}

export function hasIntentMatch(candidate, userProfile) {
  const text = getCandidateText(candidate);
  const broadTopicRequest = userProfile.mustHaveConcepts.length === 0 && userProfile.topic.split(/\s+/).length <= 1;
  const topicOverlap = keywordOverlap(userProfile.topic, text);
  const conceptOverlap = userProfile.mustHaveConcepts.length
    ? keywordOverlap(userProfile.mustHaveConcepts.join(' '), text)
    : 0;

  if (broadTopicRequest || userProfile.intent === 'broad_exploration') {
    return true;
  }

  if (userProfile.intent === 'build_project') {
    return /\bproject\b|\bbuild\b|\bapp\b|\bclone\b|\bhands on\b|\bwalkthrough\b|\bfrom scratch\b/.test(text);
  }

  if (userProfile.intent === 'concept_clarity') {
    return (
      /\bexplain\b|\bexplained\b|\bconcept\b|\bunderstand\b|\bwhy\b|\bguide\b/.test(text) ||
      conceptOverlap >= 0.34 ||
      (topicOverlap >= 0.5 && /\btutorial\b|\blesson\b|\bbasics\b/.test(text))
    );
  }

  if (userProfile.intent === 'learn_basics') {
    return /\bintro\b|\bbasics\b|\bbeginner\b|\bfor beginners\b|\bcrash course\b|\blesson\b/.test(text);
  }

  return true;
}

export function evaluateCandidateByPolicy(userProfile, candidate) {
  const nonTeachingReason = getNonTeachingReason(candidate, userProfile);
  if (nonTeachingReason) {
    return { pass: false, reason: nonTeachingReason, pattern: nonTeachingReason };
  }

  if (!hasTutorialSignal(candidate, userProfile)) {
    return { pass: false, reason: 'No tutorial signal', pattern: 'missing_tutorial_signal' };
  }

  if (!hasIntentMatch(candidate, userProfile)) {
    return { pass: false, reason: 'Intent mismatch', pattern: 'intent_mismatch' };
  }

  const text = getCandidateText(candidate);
  const topicOverlap = keywordOverlap(userProfile.topic, text);
  const conceptOverlap = userProfile.mustHaveConcepts.length
    ? keywordOverlap(userProfile.mustHaveConcepts.join(' '), text)
    : 0;
  const semanticOverlap = tokenOverlapScore(`${userProfile.topic} ${userProfile.goal}`, text);

  const strongSpecificRequest = userProfile.mustHaveConcepts.length > 0 || userProfile.topic.split(/\s+/).length > 1;
  const minimumTopicOverlap = strongSpecificRequest ? 0.35 : 0.18;

  if (topicOverlap < minimumTopicOverlap && semanticOverlap < 0.24 && conceptOverlap < 0.15) {
    return { pass: false, reason: 'Low topical overlap', pattern: 'low_topic_overlap' };
  }

  if (strongSpecificRequest && topicOverlap < 0.34 && conceptOverlap === 0) {
    return { pass: false, reason: 'Specific request but no concept overlap', pattern: 'specific_no_concept_overlap' };
  }

  const subtypePolicy = buildSubtypePolicy(userProfile);
  if (subtypePolicy.requiredGroups.length) {
    const matchedGroups = countMatchedGroups(subtypePolicy.requiredGroups, text);
    if (matchedGroups < subtypePolicy.minRequiredGroups) {
      return {
        pass: false,
        reason: 'Missing project-specific signal',
        pattern: 'missing_project_specific_signal'
      };
    }
  }

  return { pass: true };
}

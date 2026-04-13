import {
  listFromInput,
  normalize,
  parseDurationPreference,
  toUniqueList
} from './common.js';

const LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];
const STYLE_KEYS = ['project_based', 'conceptual', 'practical'];
const TOPIC_NOISE_PATTERNS = [
  /\bfor beginners?\b/gi,
  /\bbeginners?\b/gi,
  /\bcrash\s*course\b/gi,
  /\bfull\s*course\b/gi,
  /\bcourse\b/gi,
  /\btutorial\b/gi,
  /\bguide\b/gi,
  /\bexplained\b/gi,
  /\blesson\b/gi,
  /\bintroduction\b/gi,
  /\bintro\b/gi,
  /\bbasics?\b/gi,
  /\bfundamentals?\b/gi,
  /\bcomplete\b/gi,
  /\bfrom scratch\b/gi,
  /\bclear(?:ly)?\b/gi,
  /\bpractical\b/gi,
  /\bconcept(?:s|ual)?\b/gi
];
const TECH_TOPIC_HINTS = {
  python: 'python programming',
  java: 'java programming',
  javascript: 'javascript programming',
  typescript: 'typescript programming',
  react: 'react js',
  sql: 'sql database',
  node: 'node js'
};

function inferTechnicalBaseTopic(rawText) {
  const text = normalize(rawText);
  if (!text) return '';

  const orderedKeys = ['typescript', 'javascript', 'python', 'react', 'sql', 'java', 'node'];
  const matchedKey = orderedKeys.find((key) => new RegExp(`\\b${key}\\b`).test(text));
  return matchedKey ? TECH_TOPIC_HINTS[matchedKey] : '';
}

function inferLevel(rawText, explicitLevel) {
  const normalizedExplicit = String(explicitLevel || '').trim().toUpperCase();
  if (LEVELS.includes(normalizedExplicit)) return normalizedExplicit;

  const text = normalize(rawText);
  if (/(advanced|expert|production-grade|internals|deep dive)/.test(text)) return 'ADVANCED';
  if (/(intermediate|already know|comfortable with|have built before)/.test(text)) return 'INTERMEDIATE';
  return 'BEGINNER';
}

function inferTopic(rawText, explicitTopic) {
  if (String(explicitTopic || '').trim()) {
    return sanitizeTopic(String(explicitTopic).trim());
  }

  const technicalBaseTopic = inferTechnicalBaseTopic(rawText);
  if (technicalBaseTopic) {
    return technicalBaseTopic;
  }

  const cleaned = String(rawText || '')
    .replace(/i want to learn|help me learn|teach me|show me|i need|for beginners|for beginner/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  return sanitizeTopic(cleaned.split(/[.!?]/)[0]?.trim() || '');
}

function sanitizeTopic(topic) {
  let cleaned = String(topic || '').trim();
  if (!cleaned) return '';

  TOPIC_NOISE_PATTERNS.forEach((pattern) => {
    cleaned = cleaned.replace(pattern, ' ');
  });

  cleaned = cleaned
    .replace(/\b(i want|want|learn|understand|get|need|something|video|videos)\b/gi, ' ')
    .replace(/[,:;()/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const ofMatch = cleaned.match(/^(.+?)\s+of\s+(.+)$/i);
  if (ofMatch) {
    cleaned = `${ofMatch[1]} ${ofMatch[2]}`.trim();
  }

  const words = cleaned.split(/\s+/).filter(Boolean);
  const normalizedCleaned = normalize(cleaned);
  const genericTopicSuffixes = new Set([
    'course',
    'tutorial',
    'guide',
    'lesson',
    'intro',
    'introduction',
    'basics',
    'fundamentals',
    'concepts',
    'concept'
  ]);
  const firstWord = normalize(words[0] || '');
  const remainingWords = words.slice(1).map((word) => normalize(word));

  if (
    TECH_TOPIC_HINTS[firstWord] &&
    (!remainingWords.length || remainingWords.every((word) => genericTopicSuffixes.has(word)))
  ) {
    return TECH_TOPIC_HINTS[firstWord];
  }

  if (words.length <= 4) {
    return TECH_TOPIC_HINTS[normalizedCleaned] || words.join(' ');
  }

  const stopWords = new Set(['not', 'just', 'code', 'with', 'and', 'or', 'the', 'a', 'an']);
  const compact = words.filter((word) => !stopWords.has(normalize(word)));
  const finalTopic = compact.slice(0, 4).join(' ');
  const normalizedFinalTopic = normalize(finalTopic);
  return TECH_TOPIC_HINTS[normalizedFinalTopic] || finalTopic;
}

function inferGoal(rawText, explicitGoal, topic) {
  if (String(explicitGoal || '').trim()) return String(explicitGoal).trim();

  const text = String(rawText || '').trim();
  if (!text) return `Learn ${topic}`.trim();

  const goalSentence = text.split(/[.!?]/).find((sentence) => /\b(build|learn|understand|revise|prepare)\b/i.test(sentence));
  return goalSentence?.trim() || `Learn ${topic}`.trim();
}

function inferPreferredStyle(rawText, explicitStyle, projectBased, learningMode) {
  const style = {
    project_based: 0.15,
    conceptual: 0.2,
    practical: 0.2
  };

  const styleText = normalize(`${explicitStyle || ''} ${rawText || ''} ${learningMode || ''}`);

  if (projectBased || /project|build|hands on|portfolio|mini app/.test(styleText)) {
    style.project_based = 0.85;
    style.practical = Math.max(style.practical, 0.8);
  }

  if (/practical|hands on|exercise|coding/.test(styleText)) {
    style.practical = Math.max(style.practical, 0.85);
  }

  if (/concept|explain|fundamental|theory|clear explanation/.test(styleText)) {
    style.conceptual = Math.max(style.conceptual, 0.8);
  }

  if (normalize(learningMode) === 'theory') {
    style.conceptual = Math.max(style.conceptual, 0.9);
  }

  if (normalize(learningMode) === 'practical') {
    style.practical = Math.max(style.practical, 0.9);
  }

  if (normalize(explicitStyle) === 'project-based') {
    style.project_based = Math.max(style.project_based, 0.95);
  }

  if (normalize(explicitStyle) === 'concept-first') {
    style.conceptual = Math.max(style.conceptual, 0.95);
  }

  if (normalize(explicitStyle) === 'balanced') {
    STYLE_KEYS.forEach((key) => {
      style[key] = Math.max(style[key], 0.55);
    });
  }

  return style;
}

function inferAvoidList(rawText, explicitAvoid) {
  const avoid = listFromInput(explicitAvoid);
  const text = String(rawText || '');

  const patterns = [
    /not\s+([^.,;]+)/gi,
    /avoid\s+([^.,;]+)/gi,
    /without\s+([^.,;]+)/gi
  ];

  patterns.forEach((pattern) => {
    for (const match of text.matchAll(pattern)) {
      avoid.push(match[1]);
    }
  });

  return toUniqueList(avoid);
}

function splitAvoidSignals(avoidItems) {
  const avoidConcepts = [];
  const avoidStyles = [];

  avoidItems.forEach((item) => {
    const normalized = normalize(item);
    if (/(theory|lecture|blind coding|too fast|too slow|style|pace|shorts|chaotic)/.test(normalized)) {
      avoidStyles.push(item);
      return;
    }

    avoidConcepts.push(item);
  });

  return {
    avoidConcepts: toUniqueList(avoidConcepts),
    avoidStyles: toUniqueList(avoidStyles)
  };
}

function inferMustHave(rawText, explicitMustHave) {
  const mustHave = listFromInput(explicitMustHave);
  const text = String(rawText || '');

  const conceptClause = text.match(/(?:must have|cover|including|include)\s+([^.;]+)/i);
  if (conceptClause) {
    mustHave.push(...conceptClause[1].split(/\band\b|,/i));
  }

  const normalizedText = normalize(text);
  if (/\bweb scrapp?er\b|\bweb scrapp?ing\b/.test(normalizedText)) {
    mustHave.push('web scraping', 'scraper');
  }
  if (/\bbeautiful soup\b|\bbs4\b/.test(normalizedText) || /\bweb scrapp?er\b|\bweb scrapp?ing\b/.test(normalizedText)) {
    mustHave.push('beautiful soup');
  }
  if (/\brequests?\b/.test(normalizedText) || /\bweb scrapp?er\b|\bweb scrapp?ing\b/.test(normalizedText)) {
    mustHave.push('requests');
  }
  if (/\bhtml\b/.test(normalizedText) && /\bweb scrapp?er\b|\bweb scrapp?ing\b/.test(normalizedText)) {
    mustHave.push('html parsing');
  }
  if (/\breact hooks?\b/.test(normalizedText)) {
    mustHave.push('hooks');
  }
  if (/\bsql joins?\b/.test(normalizedText)) {
    mustHave.push('joins');
  }
  if (/\bjavascript promises?\b/.test(normalizedText)) {
    mustHave.push('promises');
  }

  return toUniqueList(mustHave);
}

function inferKnownPrerequisites(rawText, explicitKnownPrerequisites) {
  const known = listFromInput(explicitKnownPrerequisites);
  const text = String(rawText || '');

  const matches = [
    text.match(/i know\s+([^.;]+)/i),
    text.match(/i already know\s+([^.;]+)/i),
    text.match(/comfortable with\s+([^.;]+)/i)
  ].filter(Boolean);

  matches.forEach((match) => {
    known.push(...String(match[1] || '').split(/\band\b|,/i));
  });

  return toUniqueList(known);
}

function inferDepthRequired(level, goal) {
  const text = normalize(goal);
  if (/(deep dive|master|production|internals)/.test(text)) return 'deep';
  if (level === 'ADVANCED') return 'deep';
  if (level === 'INTERMEDIATE') return 'intro_to_medium';
  return 'intro';
}

function inferIntent(rawRequirement, goal) {
  const requirement = normalize(rawRequirement);
  const text = normalize(`${rawRequirement} ${goal}`);
  const requirementWordCount = requirement.split(/\s+/).filter(Boolean).length;

  if (/\bcompare|comparison|vs|which should i choose|best course|best book|review\b/.test(text)) {
    return 'compare_resources';
  }

  if (/\bwhat next|next step|after basics|roadmap\b/.test(text)) {
    return 'next_step';
  }

  if (/\bbuild|project|app|portfolio|clone\b/.test(text)) {
    return 'build_project';
  }

  if (/\bexplain|understand|clarity|concept|why\b/.test(text)) {
    return 'concept_clarity';
  }

  if (requirementWordCount <= 2 && !/\b(beginner|basics|fundamentals|tutorial|course|lesson|guide)\b/.test(requirement)) {
    return 'broad_exploration';
  }

  return 'learn_basics';
}

function inferLegacyPreferences(profile) {
  const projectBased = profile.preferredStyle.project_based >= 0.65;
  const learningMode = profile.preferredStyle.practical > profile.preferredStyle.conceptual + 0.2
    ? 'PRACTICAL'
    : profile.preferredStyle.conceptual > profile.preferredStyle.practical + 0.2
      ? 'THEORY'
      : 'BOTH';
  const teachingStyle = /fun|engaging|light/.test(normalize(profile.rawRequirement)) ? 'FUN' : 'SERIOUS';
  const pace = profile.maxDurationMinutes && profile.maxDurationMinutes <= 20 ? 'FAST' : 'MEDIUM';

  return {
    projectBased,
    learningMode,
    teachingStyle,
    pace
  };
}

export function buildUserProfile(input) {
  const rawRequirement = String(input?.rawRequirement || input?.query || '').trim();
  const topic = inferTopic(rawRequirement, input?.topic);
  const level = inferLevel(rawRequirement, input?.level);
  const goal = inferGoal(rawRequirement, input?.goal, topic);
  const language = String(input?.language || 'English').trim() || 'English';
  const maxDurationMinutes = Number(input?.maxDurationMinutes) || parseDurationPreference(rawRequirement) || null;
  const mustHaveConcepts = inferMustHave(rawRequirement, input?.mustHave);
  const avoid = inferAvoidList(rawRequirement, input?.avoid);
  const { avoidConcepts, avoidStyles } = splitAvoidSignals(avoid);
  const knownPrerequisites = inferKnownPrerequisites(rawRequirement, input?.knownPrerequisites);
  const preferredStyle = inferPreferredStyle(
    rawRequirement,
    input?.preferredStyle,
    Boolean(input?.projectBased),
    input?.learningMode
  );
  const depthRequired = inferDepthRequired(level, goal);
  const intent = inferIntent(rawRequirement, goal);
  const legacy = inferLegacyPreferences({
    rawRequirement,
    preferredStyle,
    maxDurationMinutes
  });

  return {
    rawRequirement,
    topic,
    level,
    subtopics: mustHaveConcepts,
    goal,
    targetOutcomes: [goal].filter(Boolean),
    language,
    maxDurationMinutes,
    minDurationMinutes: null,
    mustHaveConcepts,
    avoid,
    avoidConcepts,
    avoidStyles,
    knownPrerequisites,
    preferredStyle,
    depthRequired,
    intent,
    contentConstraints: {
      excludeShorts: true,
      excludeOutdated: true,
      preferRecentIfTopicChangesFast: true
    },
    semanticText: [
      topic,
      goal,
      mustHaveConcepts.join(' '),
      knownPrerequisites.join(' '),
      avoid.join(' ')
    ].join(' '),
    legacy
  };
}

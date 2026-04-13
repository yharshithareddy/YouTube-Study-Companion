import { toUniqueList } from './common.js';

function canonicalTopic(baseTopic = '') {
  const normalized = String(baseTopic || '').trim().replace(/\s+/g, ' ');
  const words = normalized.split(' ').filter(Boolean);
  if (words.length <= 2) return normalized;

  return words.slice(0, 2).join(' ');
}

function domainQueries(baseTopic = '') {
  const normalized = String(baseTopic || '').trim().toLowerCase();
  const queries = [];

  if (/\bpython\b/.test(normalized)) queries.push('python programming', 'python coding tutorial');
  if (/\breact\b/.test(normalized)) queries.push('react js tutorial', 'react programming tutorial');
  if (/\bsql\b/.test(normalized)) queries.push('sql database tutorial', 'sql query tutorial');
  if (/\bjavascript\b/.test(normalized)) queries.push('javascript programming tutorial');
  if (/\bjava\b/.test(normalized)) queries.push('java programming tutorial');

  return queries;
}

function durationPhrases(maxDurationMinutes) {
  if (!maxDurationMinutes) return [];
  if (maxDurationMinutes <= 20) return ['under 20 minutes', 'quick tutorial', 'short tutorial'];
  if (maxDurationMinutes <= 45) return ['under 45 minutes', 'concise tutorial'];
  if (maxDurationMinutes <= 60) return ['under 1 hour', 'one hour tutorial'];
  return ['full tutorial', 'complete guide'];
}

function levelPhrases(level) {
  return {
    BEGINNER: ['for beginners', 'beginner tutorial', 'basics', 'fundamentals'],
    INTERMEDIATE: ['intermediate tutorial', 'practical tutorial', 'hands on'],
    ADVANCED: ['advanced tutorial', 'deep dive', 'internals']
  }[level] || [];
}

function stylePhrases(preferredStyle) {
  const variants = [];

  if ((preferredStyle?.project_based || 0) >= 0.6) {
    variants.push('project based tutorial', 'build project', 'mini project');
  }

  if ((preferredStyle?.practical || 0) >= 0.6) {
    variants.push('hands on tutorial', 'coding tutorial', 'practical tutorial');
  }

  if ((preferredStyle?.conceptual || 0) >= 0.6) {
    variants.push('explained clearly', 'concept tutorial', 'fundamentals explained');
  }

  return variants;
}

function projectFocusedQueries(profile, baseTopic, broadTopic) {
  if (profile.intent !== 'build_project') return [];

  const concepts = profile.mustHaveConcepts.map((concept) => String(concept).trim()).filter(Boolean);
  const normalizedConcepts = concepts.map((concept) => concept.toLowerCase());
  const queries = [];

  concepts.forEach((concept) => {
    queries.push(`${baseTopic} ${concept} project`);
    queries.push(`${baseTopic} ${concept} walkthrough`);
    queries.push(`${baseTopic} ${concept} build from scratch`);
    queries.push(`${broadTopic} ${concept} project`);
  });

  if (normalizedConcepts.some((concept) => /\b(web scraping|scraper|scraping)\b/.test(concept))) {
    queries.push('python web scraping tutorial');
    queries.push('python web scraper project');
    queries.push('python web scraping build from scratch');
  }

  if (normalizedConcepts.some((concept) => /\bbeautiful soup\b|\bbs4\b/.test(concept))) {
    queries.push('python beautiful soup tutorial');
    queries.push('beautiful soup web scraping python');
  }

  if (normalizedConcepts.some((concept) => /\brequests\b/.test(concept))) {
    queries.push('python requests tutorial');
    queries.push('python requests web scraping');
  }

  if (
    normalizedConcepts.some((concept) => /\b(web scraping|scraper|scraping)\b/.test(concept)) &&
    normalizedConcepts.some((concept) => /\bbeautiful soup\b|\bbs4\b/.test(concept))
  ) {
    queries.push('python requests beautiful soup tutorial');
  }

  return queries;
}

export function buildRecommendationQueries(profile) {
  const baseTopic = profile.topic;
  const broadTopic = canonicalTopic(baseTopic);
  const concepts = profile.mustHaveConcepts.slice(0, 6);
  const goalTerms = profile.goal ? [profile.goal] : [];
  const durationTerms = durationPhrases(profile.maxDurationMinutes);
  const variants = [
    baseTopic,
    broadTopic,
    ...domainQueries(baseTopic),
    `${baseTopic} tutorial`,
    `${broadTopic} tutorial`,
    `${baseTopic} ${profile.language} tutorial`,
    `${broadTopic} ${profile.language} tutorial`,
    ...levelPhrases(profile.level).map((suffix) => `${baseTopic} ${suffix}`),
    ...levelPhrases(profile.level).map((suffix) => `${broadTopic} ${suffix}`),
    ...stylePhrases(profile.preferredStyle).map((suffix) => `${baseTopic} ${suffix}`),
    ...stylePhrases(profile.preferredStyle).map((suffix) => `${broadTopic} ${suffix}`),
    ...durationTerms.map((suffix) => `${baseTopic} ${suffix}`),
    ...durationTerms.map((suffix) => `${broadTopic} ${suffix}`),
    ...goalTerms.map((goal) => `${baseTopic} ${goal}`),
    ...goalTerms.map((goal) => `${broadTopic} ${goal}`),
    ...(concepts.length ? [`${baseTopic} ${concepts.join(' ')}`] : []),
    ...(concepts.length ? [`${broadTopic} ${concepts.join(' ')}`] : []),
    ...concepts.map((concept) => `${baseTopic} ${concept}`),
    ...concepts.map((concept) => `${broadTopic} ${concept}`),
    ...concepts.map((concept) => `${baseTopic} ${concept} tutorial`),
    ...concepts.map((concept) => `${broadTopic} ${concept} tutorial`),
    ...projectFocusedQueries(profile, baseTopic, broadTopic),
    ...(profile.legacy.projectBased
      ? [
          `${baseTopic} build from scratch`,
          `${baseTopic} project tutorial`,
          `${broadTopic} build from scratch`,
          `${broadTopic} project tutorial`
        ]
      : [])
  ];

  const filteredAvoid = profile.avoid
    .filter((item) => item.length < 30)
    .slice(0, 4)
    .map((item) => `${baseTopic} without ${item}`);

  return toUniqueList([...variants, ...filteredAvoid]).slice(0, 40);
}

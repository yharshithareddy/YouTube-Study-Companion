const LANGUAGE_ALIASES = {
  english: 'English',
  hindi: 'Hindi',
  telugu: 'Telugu',
  tamil: 'Tamil',
  kannada: 'Kannada'
};

export function normalizeLanguage(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return LANGUAGE_ALIASES[normalized] || value || 'English';
}

export function buildRecommendationQueries(preference) {
  const topic = String(preference.topic || '').trim();
  const language = normalizeLanguage(preference.language);
  const levelMap = {
    BEGINNER: ['for beginners', 'beginner tutorial', 'beginner course'],
    INTERMEDIATE: ['intermediate tutorial', 'hands on tutorial', 'deep dive'],
    ADVANCED: ['advanced tutorial', 'internals', 'deep dive']
  };
  const learningMap = {
    THEORY: ['explained', 'concepts', 'theory'],
    PRACTICAL: ['practical tutorial', 'hands on', 'coding tutorial'],
    BOTH: ['full tutorial', 'complete guide', 'full course']
  };
  const styleMap = {
    FUN: ['easy explanation', 'simple tutorial', 'fun tutorial'],
    SERIOUS: ['serious tutorial', 'professional tutorial'],
    BALANCED: ['clear tutorial', 'beginner friendly']
  };
  const paceMap = {
    SLOW: ['step by step', 'slow paced'],
    MEDIUM: ['complete guide', 'practical tutorial'],
    FAST: ['quick tutorial', 'crash course']
  };

  const rawQueries = [
    topic,
    `${topic} ${language}`,
    ...((levelMap[preference.level] || []).map((suffix) => `${topic} ${suffix}`)),
    ...((learningMap[preference.learningMode] || []).map((suffix) => `${topic} ${suffix}`)),
    ...((styleMap[preference.teachingStyle] || []).map((suffix) => `${topic} ${suffix}`)),
    ...((paceMap[preference.pace] || []).map((suffix) => `${topic} ${suffix}`)),
    ...(preference.projectBased ? [`${topic} project tutorial`, `${topic} build from scratch`] : []),
    `${topic} ${language} tutorial`,
    `${topic} ${language} ${String(preference.level || '').toLowerCase()}`
  ];

  return [...new Set(rawQueries.map((query) => query.trim()).filter(Boolean))];
}

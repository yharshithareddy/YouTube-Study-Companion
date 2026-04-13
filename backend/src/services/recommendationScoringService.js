function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function tokenize(value) {
  return normalize(value)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

export function computeTopicScore(topic, analysis) {
  const wanted = new Set(tokenize(topic));
  if (wanted.size === 0) return 0;

  const haystack = new Set([
    ...tokenize(analysis.title),
    ...tokenize(analysis.summary),
    ...((analysis.topicTags || []).flatMap((tag) => tokenize(tag)))
  ]);

  let overlap = 0;
  wanted.forEach((token) => {
    if (haystack.has(token)) overlap += 1;
  });

  return overlap / wanted.size;
}

function computeLevelScore(preferenceLevel, analysisLevel, beginnerFriendliness) {
  const preferred = normalize(preferenceLevel);
  const actual = normalize(analysisLevel);

  if (!actual) {
    return 0;
  }

  if (preferred === actual) {
    return 1;
  }

  if (preferred === 'beginner') {
    return Math.min(0.75, Number(beginnerFriendliness || 0));
  }

  if (
    (preferred === 'intermediate' && ['beginner', 'advanced'].includes(actual)) ||
    (preferred === 'advanced' && actual === 'intermediate')
  ) {
    return 0.45;
  }

  return 0.15;
}

function computeLearningModeScore(preferenceMode, analysisMode) {
  const preferred = normalize(preferenceMode);
  const actual = normalize(analysisMode);

  if (!actual) return 0;
  if (preferred === actual) return 1;
  if (preferred === 'both' && ['theory', 'practical', 'both'].includes(actual)) return 0.8;
  if (actual === 'both' && ['theory', 'practical'].includes(preferred)) return 0.75;
  return 0.1;
}

function computeProjectScore(projectBasedPreference, analysisProjectBased) {
  if (projectBasedPreference === analysisProjectBased) {
    return 1;
  }
  return projectBasedPreference ? 0 : 0.4;
}

function computeStyleScore(preferenceStyle, analysisStyle) {
  const preferred = normalize(preferenceStyle);
  const actual = normalize(analysisStyle);

  if (!actual) return 0;
  if (preferred === actual) return 1;
  if (preferred === 'serious' && actual === 'balanced') return 0.7;
  if (preferred === 'fun' && actual === 'balanced') return 0.7;
  if (preferred === 'balanced' && ['serious', 'fun'].includes(actual)) return 0.75;
  return 0.15;
}

function computePaceScore(preferencePace, analysisPace) {
  const preferred = normalize(preferencePace);
  const actual = normalize(analysisPace);

  if (!actual) return 0;
  if (preferred === actual) return 1;
  if (
    (preferred === 'slow' && actual === 'medium') ||
    (preferred === 'medium' && ['slow', 'fast'].includes(actual)) ||
    (preferred === 'fast' && actual === 'medium')
  ) {
    return 0.55;
  }
  return 0.1;
}

function computeLanguageScore(preferenceLanguage, analysisLanguage) {
  if (!analysisLanguage) return 0;
  return normalize(preferenceLanguage) === normalize(analysisLanguage) ? 1 : 0;
}

function computeTranscriptReliability(analysisSource) {
  const source = normalize(analysisSource);
  if (source.includes('transcript-openai')) return 1;
  if (source.includes('transcript-heuristic')) return 0.75;
  if (source.includes('metadata-openai')) return 0.45;
  return 0.2;
}

export function scoreRecommendation(preference, analysis) {
  const whyMatched = [];

  const topicScore = computeTopicScore(preference.topic, analysis);
  const levelScore = computeLevelScore(preference.level, analysis.difficultyLevel, analysis.beginnerFriendliness);
  const learningModeScore = computeLearningModeScore(preference.learningMode, analysis.learningMode);
  const languageScore = computeLanguageScore(preference.language, analysis.language);
  const projectScore = computeProjectScore(Boolean(preference.projectBased), Boolean(analysis.projectBased));
  const styleScore = computeStyleScore(preference.teachingStyle, analysis.teachingStyle);
  const paceScore = computePaceScore(preference.pace, analysis.pace);
  const transcriptReliability = computeTranscriptReliability(analysis.analysisSource);
  const beginnerFriendlinessBoost = Number(analysis.beginnerFriendliness || 0) * 0.05;
  const confidenceBoost = Math.min(0.05, Number(analysis.confidenceScore || 0) * 0.05);
  const transcriptBoost = transcriptReliability * 0.07;

  const score =
    topicScore * 0.28 +
    levelScore * 0.2 +
    learningModeScore * 0.15 +
    languageScore * 0.1 +
    projectScore * 0.1 +
    styleScore * 0.07 +
    paceScore * 0.08 +
    beginnerFriendlinessBoost +
    confidenceBoost +
    transcriptBoost;

  if (topicScore >= 0.55) {
    whyMatched.push('Strong topic overlap');
  }
  if (levelScore >= 0.8) {
    whyMatched.push(`${preference.level.toLowerCase()} level fit`);
  }
  if (learningModeScore >= 0.75) {
    whyMatched.push('Learning mode match');
  }
  if (languageScore === 1) {
    whyMatched.push('Language match');
  }
  if (projectScore === 1 && preference.projectBased) {
    whyMatched.push('Project-based format');
  }
  if (styleScore >= 0.75) {
    whyMatched.push('Teaching style match');
  }
  if (paceScore >= 0.75) {
    whyMatched.push('Pace match');
  }
  if (Number(analysis.beginnerFriendliness || 0) >= 0.8) {
    whyMatched.push('Beginner-friendly explanation style');
  }
  if (Number(analysis.confidenceScore || 0) >= 0.8) {
    whyMatched.push('High-confidence profile match');
  }
  if (transcriptReliability >= 0.75) {
    whyMatched.push('Transcript-backed content analysis');
  }

  if (whyMatched.length === 0) {
    whyMatched.push('General fit across topic and learning preferences');
  }

  return {
    matchScore: Number(score.toFixed(4)),
    whyMatched
  };
}

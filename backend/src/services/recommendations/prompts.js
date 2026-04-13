export const TRANSCRIPT_CHUNK_ANALYSIS_PROMPT = `You are analyzing one chunk from an educational YouTube video transcript.

Your job is to identify what this chunk teaches and how it teaches it.

Rules:
- Judge only from the provided text.
- Be specific and conservative.
- Output valid JSON only.
- Do not include markdown.
- Use this exact schema:

{
  "chunkIndex": 0,
  "summary": "string",
  "conceptsTaught": ["string"],
  "difficulty": "beginner | intermediate | advanced",
  "teachingStyle": {
    "project_based": 0.0,
    "conceptual": 0.0,
    "theory_heavy": 0.0,
    "hands_on": 0.0
  },
  "depth": "intro | medium | deep",
  "prerequisitesImplied": ["string"],
  "clarityScore": 0.0,
  "pace": "slow | medium | fast",
  "outdatedSignals": ["string"],
  "usefulnessForBeginner": 0.0,
  "usefulnessForIntermediate": 0.0,
  "usefulnessForAdvanced": 0.0,
  "embeddingText": "string"
}

Chunk index:
{{CHUNK_INDEX}}

Video title:
{{VIDEO_TITLE}}

Transcript chunk:
{{TRANSCRIPT_CHUNK}}`;

export const TRANSCRIPT_AGGREGATION_PROMPT = `You are aggregating chunk analyses for an educational YouTube video into one final structured profile.

Rules:
- Merge repeated concepts.
- Estimate dominant difficulty from the chunk distribution.
- Infer teaching style, prerequisites, clarity, pace, and outdated risk.
- Output valid JSON only.
- Do not include markdown.
- Use this exact schema:

{
  "videoId": "string",
  "globalSummary": "string",
  "conceptsCovered": ["string"],
  "conceptDepthMap": {
    "conceptName": "intro | medium | deep"
  },
  "dominantDifficulty": "beginner | intermediate | advanced",
  "difficultyDistribution": {
    "beginner": 0.0,
    "intermediate": 0.0,
    "advanced": 0.0
  },
  "teachingStyle": {
    "project_based": 0.0,
    "conceptual": 0.0,
    "theory_heavy": 0.0,
    "hands_on": 0.0
  },
  "prerequisites": ["string"],
  "clarityScore": 0.0,
  "pace": "slow | medium | fast",
  "outdatedRiskScore": 0.0,
  "outdatedSignals": ["string"],
  "bestForGoals": ["learn_basics", "build_project", "interview_prep", "revision", "concept_clarity"],
  "notIdealFor": ["string"],
  "coverageGaps": ["string"],
  "confidence": 0.0,
  "videoEmbeddingText": "string"
}

Video ID:
{{VIDEO_ID}}

Video title:
{{VIDEO_TITLE}}

Chunk analyses:
{{CHUNK_ANALYSES_JSON}}`;

export const NO_TRANSCRIPT_VIDEO_ANALYSIS_PROMPT = `You are analyzing an educational YouTube video without a transcript.

You must estimate what the video likely teaches from metadata only.

Rules:
- Use only the provided title, description, chapters, and tags.
- Be conservative when uncertain.
- Output valid JSON only.
- Do not include markdown.
- Use this exact schema:

{
  "videoId": "string",
  "globalSummary": "string",
  "conceptsCovered": ["string"],
  "conceptDepthMap": {
    "conceptName": "intro | medium | deep"
  },
  "dominantDifficulty": "beginner | intermediate | advanced",
  "difficultyDistribution": {
    "beginner": 0.0,
    "intermediate": 0.0,
    "advanced": 0.0
  },
  "teachingStyle": {
    "project_based": 0.0,
    "conceptual": 0.0,
    "theory_heavy": 0.0,
    "hands_on": 0.0
  },
  "prerequisites": ["string"],
  "clarityScore": 0.0,
  "pace": "slow | medium | fast",
  "outdatedRiskScore": 0.0,
  "outdatedSignals": ["string"],
  "bestForGoals": ["learn_basics", "build_project", "interview_prep", "revision", "concept_clarity"],
  "notIdealFor": ["string"],
  "coverageGaps": ["string"],
  "confidence": 0.0,
  "videoEmbeddingText": "string"
}

Video ID:
{{VIDEO_ID}}

Title:
{{TITLE}}

Description:
{{DESCRIPTION}}

Chapters:
{{CHAPTERS}}

Tags:
{{TAGS}}`;

import { PrismaClient } from '@prisma/client';
import { fetchTranscriptText } from './youtubeService.js';

const prisma = new PrismaClient();
const OPENAI_API_URL = 'https://api.openai.com/v1/responses';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const ANALYSIS_VERSION = 'v2';

function normalizeEnumValue(value, allowedValues, fallback) {
  const normalized = String(value || '').trim().toUpperCase();
  return allowedValues.includes(normalized) ? normalized : fallback;
}

function heuristicAnalyze(candidate) {
  const text = `${candidate.title} ${candidate.description} ${candidate.transcriptText || ''}`.toLowerCase();
  const hasProjectSignal = /(project|build|clone|from scratch|portfolio)/.test(text);
  const difficultyLevel = /(advanced|internals|deep dive)/.test(text)
    ? 'ADVANCED'
    : /(intermediate|hands on|practical)/.test(text)
      ? 'INTERMEDIATE'
      : 'BEGINNER';
  const learningMode = hasProjectSignal || /(practical|hands on|coding)/.test(text)
    ? 'PRACTICAL'
    : /(concept|theory|explained|architecture)/.test(text)
      ? 'THEORY'
      : 'BOTH';
  const teachingStyle = /(fun|easy|simple)/.test(text) ? 'FUN' : 'SERIOUS';
  const pace = /(fast|quick|crash course)/.test(text)
    ? 'FAST'
    : /(slow|step by step)/.test(text)
      ? 'SLOW'
      : 'MEDIUM';

  return {
    topic: candidate.title,
    topicTags: [...new Set(candidate.title.split(/\s+/).slice(0, 8))],
    difficultyLevel,
    language: 'English',
    learningMode,
    projectBased: hasProjectSignal,
    teachingStyle,
    pace,
    beginnerFriendliness: difficultyLevel === 'BEGINNER' ? 0.85 : difficultyLevel === 'INTERMEDIATE' ? 0.6 : 0.3,
    confidenceScore: 0.45,
    summary: candidate.description?.slice(0, 220) || candidate.title,
    analysisSource: candidate.transcriptText ? 'transcript-heuristic' : 'metadata-heuristic'
  };
}

function buildTranscriptDigest(transcriptText) {
  if (!transcriptText) {
    return null;
  }

  const normalized = transcriptText.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return null;
  }

  return normalized.slice(0, 14000);
}

async function llmAnalyze(candidate) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return heuristicAnalyze(candidate);
  }

  const transcriptDigest = buildTranscriptDigest(candidate.transcriptText);

  const payload = {
    model: OPENAI_MODEL,
    input: [
      {
        role: 'system',
        content: [
          {
            type: 'input_text',
            text:
              'Classify an educational video into a recommendation schema. Use the transcript as the primary source of truth whenever it is present. Use title and description only as supporting context. Return JSON only.'
          }
        ]
      },
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: `Video title: ${candidate.title}
Video description: ${candidate.description || ''}
Channel: ${candidate.channelTitle || ''}
Duration ISO8601: ${candidate.durationIso || ''}
Transcript: ${transcriptDigest || 'Transcript unavailable'}

Return JSON with:
- topic
- topicTags (array of strings)
- difficultyLevel (BEGINNER | INTERMEDIATE | ADVANCED)
- language
- learningMode (THEORY | PRACTICAL | BOTH)
- projectBased (boolean)
- teachingStyle (FUN | SERIOUS | BALANCED)
- pace (SLOW | MEDIUM | FAST)
- beginnerFriendliness (0 to 1)
- confidenceScore (0 to 1)
- summary`
          }
        ]
      }
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'video_recommendation_profile',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          required: [
            'topic',
            'topicTags',
            'difficultyLevel',
            'language',
            'learningMode',
            'projectBased',
            'teachingStyle',
            'pace',
            'beginnerFriendliness',
            'confidenceScore',
            'summary'
          ],
          properties: {
            topic: { type: 'string' },
            topicTags: { type: 'array', items: { type: 'string' } },
            difficultyLevel: { type: 'string', enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] },
            language: { type: 'string' },
            learningMode: { type: 'string', enum: ['THEORY', 'PRACTICAL', 'BOTH'] },
            projectBased: { type: 'boolean' },
            teachingStyle: { type: 'string', enum: ['FUN', 'SERIOUS', 'BALANCED'] },
            pace: { type: 'string', enum: ['SLOW', 'MEDIUM', 'FAST'] },
            beginnerFriendliness: { type: 'number' },
            confidenceScore: { type: 'number' },
            summary: { type: 'string' }
          }
        }
      }
    }
  };

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    return heuristicAnalyze(candidate);
  }

  const data = await response.json();
  const outputText = data.output_text || '{}';
  const parsed = JSON.parse(outputText);

  return {
    topic: parsed.topic || candidate.title,
    topicTags: Array.isArray(parsed.topicTags) ? parsed.topicTags.slice(0, 10) : [],
    difficultyLevel: normalizeEnumValue(parsed.difficultyLevel, ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'], 'BEGINNER'),
    language: parsed.language || 'English',
    learningMode: normalizeEnumValue(parsed.learningMode, ['THEORY', 'PRACTICAL', 'BOTH'], 'BOTH'),
    projectBased: Boolean(parsed.projectBased),
    teachingStyle: normalizeEnumValue(parsed.teachingStyle, ['FUN', 'SERIOUS', 'BALANCED'], 'BALANCED'),
    pace: normalizeEnumValue(parsed.pace, ['SLOW', 'MEDIUM', 'FAST'], 'MEDIUM'),
    beginnerFriendliness: Number(parsed.beginnerFriendliness) || 0,
    confidenceScore: Number(parsed.confidenceScore) || (transcriptDigest ? 0.8 : 0.55),
    summary: parsed.summary || candidate.description?.slice(0, 220) || candidate.title,
    analysisSource: transcriptDigest ? 'transcript-openai' : 'metadata-openai'
  };
}

export async function getOrCreateVideoAnalysis(candidate) {
  const existing = await prisma.cachedVideoAnalysis.findUnique({
    where: { videoId: candidate.videoId }
  });

  if (existing && existing.analysisSource === ANALYSIS_VERSION) {
    return existing;
  }

  const transcriptText = await fetchTranscriptText(candidate.videoId);
  const enrichedCandidate = {
    ...candidate,
    transcriptText
  };
  const analysis = await llmAnalyze(enrichedCandidate);

  if (existing) {
    return prisma.cachedVideoAnalysis.update({
      where: { id: existing.id },
      data: {
        title: candidate.title,
        description: candidate.description || null,
        channelTitle: candidate.channelTitle || null,
        thumbnailUrl: candidate.thumbnailUrl || null,
        publishedAt: candidate.publishedAt ? new Date(candidate.publishedAt) : null,
        durationIso: candidate.durationIso || null,
        transcriptText: transcriptText || null,
        topic: analysis.topic,
        topicTags: analysis.topicTags,
        difficultyLevel: analysis.difficultyLevel,
        language: analysis.language,
        learningMode: analysis.learningMode,
        projectBased: analysis.projectBased,
        teachingStyle: analysis.teachingStyle,
        pace: analysis.pace,
        beginnerFriendliness: analysis.beginnerFriendliness,
        confidenceScore: analysis.confidenceScore,
        summary: analysis.summary,
        analysisSource: ANALYSIS_VERSION
      }
    });
  }

  return prisma.cachedVideoAnalysis.create({
    data: {
      videoId: candidate.videoId,
      title: candidate.title,
      description: candidate.description || null,
      channelTitle: candidate.channelTitle || null,
      thumbnailUrl: candidate.thumbnailUrl || null,
      publishedAt: candidate.publishedAt ? new Date(candidate.publishedAt) : null,
      durationIso: candidate.durationIso || null,
      transcriptText: transcriptText || null,
      topic: analysis.topic,
      topicTags: analysis.topicTags,
      difficultyLevel: analysis.difficultyLevel,
      language: analysis.language,
      learningMode: analysis.learningMode,
      projectBased: analysis.projectBased,
      teachingStyle: analysis.teachingStyle,
      pace: analysis.pace,
      beginnerFriendliness: analysis.beginnerFriendliness,
      confidenceScore: analysis.confidenceScore,
      summary: analysis.summary,
      analysisSource: ANALYSIS_VERSION
    }
  });
}

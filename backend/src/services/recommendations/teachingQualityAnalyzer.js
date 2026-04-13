import { clamp, normalize } from './common.js';

function countMatches(text, patterns) {
  return patterns.reduce((total, pattern) => total + ((text.match(pattern) || []).length), 0);
}

export default class TeachingQualityAnalyzer {
  constructor() {
    this.patterns = {
      clarity: {
        definitions: [
          /\b(is|are|means|refers to|stands for|definition of|what is)\b/gi,
          /\b(in other words|that means|to put it simply|simply put)\b/gi
        ],
        analogies: [
          /\b(like|similar to|think of it as|imagine|analogy)\b/gi,
          /\b(for example|for instance|such as|e\.g\.)\b/gi
        ],
        jargonExplain: [
          /\b(jargon|technical term|this word|this phrase)\b/gi,
          /\b(don't worry about|don't be scared of|sounds complicated but)\b/gi
        ],
        simplicity: [
          /\b(basically|simply|easy|straightforward|simple version)\b/gi,
          /\b(i'll explain|let me break down|here's the simple version)\b/gi
        ],
        recaps: [
          /\b(so to summarize|in summary|recap|remember|key point)\b/gi,
          /\b(to sum up|the main idea|the key takeaway|important thing)\b/gi
        ]
      },
      structure: {
        progression: [
          /\b(first|second|third|next|then|after that|finally)\b/gi,
          /\b(step by step|one by one|in order|sequentially)\b/gi,
          /\b(before we|prerequisites|foundation|building block)\b/gi
        ],
        sections: [
          /\b(chapter|section|part|module|phase|stage|lesson)\b/gi,
          /\b(introduction|conclusion|wrap up)\b/gi
        ],
        transitions: [
          /\b(now that|having covered|moving on|let's move to|next topic)\b/gi,
          /\b(this connects to|related to|similarly|on the other hand)\b/gi
        ],
        complexity: [
          /\b(simple|basic|easy|more advanced|harder|complex)\b/gi,
          /\b(take it further|level up)\b/gi
        ]
      },
      examples: {
        explicit: [
          /\b(example|for example|for instance|let me show|watch this|look at)\b/gi,
          /\b(sample|demo|demonstration|real-world|practical)\b/gi
        ],
        code: [
          /\b(code|const|let|var|function|import|export|return)\b/gi,
          /\b(console\.log|print|output|result)\b/gi
        ],
        multiple: [
          /\b(another example|one more|different example|in this case)\b/gi,
          /\b(again|also|additionally|moreover)\b/gi
        ],
        visual: [
          /\b(you can see|as you can see|notice|look at|see here|watch)\b/gi,
          /\b(appears|shows|displays|renders|outputs|screen|browser)\b/gi
        ]
      },
      pace: {
        slowPace: [
          /\b(slowly|carefully|take your time|no rush|don't worry)\b/gi,
          /\b(let me explain|let me break this down)\b/gi,
          /\b(step by step|one at a time|gradually|progressively)\b/gi
        ],
        fastPace: [
          /\b(quickly|fast|rapidly|hurry|let's move on|skip|briefly)\b/gi,
          /\b(we won't cover|i won't go into detail|moving on)\b/gi,
          /\b(assuming you know|you should already)\b/gi
        ],
        pauses: [
          /\b(pause here|take a moment|think about|consider|reflect)\b/gi,
          /\b(let that sink in|give that some thought)\b/gi
        ]
      },
      engagement: {
        questions: [
          /\?/g,
          /\b(what do you think|can you guess|what would happen)\b/gi,
          /\b(why do you think|how would you|what if)\b/gi
        ],
        interactive: [
          /\b(try this|test it|experiment|play around|try changing)\b/gi,
          /\b(pause and try|before we continue|your turn)\b/gi
        ],
        conversational: [
          /\b(let's talk about|let's discuss|cool|exactly|right)\b/gi
        ],
        addressingConfusion: [
          /\b(you might be wondering|this is confusing|i know this sounds)\b/gi,
          /\b(don't worry|it's okay|common mistake|many people think)\b/gi,
          /\b(that's a good question|valid point)\b/gi
        ]
      },
      completeness: {
        edgeCases: [
          /\b(edge case|corner case|special case|what if|be careful)\b/gi,
          /\b(also note|watch out|don't forget|important|critical)\b/gi,
          /\b(in some cases|sometimes|occasionally|exception)\b/gi
        ],
        gotchas: [
          /\b(gotcha|trap|pitfall|mistake|bug|error|wrong)\b/gi,
          /\b(this won't work|this is wrong|this will fail|don't do this)\b/gi
        ],
        related: [
          /\b(related|similar|also useful|also important|alternative)\b/gi,
          /\b(you might also|don't forget about|also consider)\b/gi
        ],
        resources: [
          /\b(documentation|official|further reading|more details)\b/gi,
          /\b(if you want to learn more|for more info|check out)\b/gi
        ]
      },
      vocabulary: {
        technical: [
          /\b(algorithm|data structure|paradigm|architecture|design pattern)\b/gi,
          /\b(abstraction|encapsulation|polymorphism|inheritance)\b/gi,
          /\b(synchronous|asynchronous|promise|callback|closure)\b/gi
        ],
        simple: [
          /\b(thing|stuff|basically|pretty much|sort of)\b/gi
        ]
      }
    };
  }

  analyzeQuality(transcript, concepts = []) {
    const clarity = this.scoreDensityDimension(transcript, this.patterns.clarity, 5, {
      high: 'VERY_CLEAR',
      mediumHigh: 'CLEAR',
      medium: 'MODERATELY_CLEAR',
      low: 'UNCLEAR'
    });
    const structure = this.scoreDensityDimension(transcript, this.patterns.structure, 4, {
      high: 'WELL_STRUCTURED',
      mediumHigh: 'STRUCTURED',
      medium: 'SOMEWHAT_STRUCTURED',
      low: 'POORLY_STRUCTURED'
    });
    const examples = this.scoreExamples(transcript, concepts);
    const pace = this.scorePace(transcript);
    const engagement = this.scoreDensityDimension(transcript, this.patterns.engagement, 3, {
      high: 'HIGHLY_ENGAGING',
      mediumHigh: 'ENGAGING',
      medium: 'SOMEWHAT_ENGAGING',
      low: 'LOW_ENGAGEMENT'
    });
    const completeness = this.scoreDensityDimension(transcript, this.patterns.completeness, 2, {
      high: 'COMPREHENSIVE',
      mediumHigh: 'MOSTLY_COMPLETE',
      medium: 'SOMEWHAT_COMPLETE',
      low: 'INCOMPLETE'
    });
    const vocabulary = this.scoreVocabularyLevel(transcript);

    const overallQuality = this.calculateOverallScore({
      clarity,
      structure,
      examples,
      pace,
      engagement,
      completeness,
      vocabulary
    });

    return {
      overallQuality,
      qualityTier:
        overallQuality > 0.85 ? 'EXCELLENT' :
        overallQuality > 0.75 ? 'VERY_GOOD' :
        overallQuality > 0.65 ? 'GOOD' :
        overallQuality > 0.5 ? 'ACCEPTABLE' :
        overallQuality > 0.35 ? 'POOR' : 'VERY_POOR',
      dimensions: {
        clarity,
        examples,
        structure,
        engagement,
        completeness,
        pace,
        vocabulary
      },
      strengths: this.identifyStrengths({ clarity, examples, structure, engagement, completeness, pace }),
      weaknesses: this.identifyWeaknesses({ clarity, examples, structure, engagement, completeness, pace }),
      recommendations: this.generateRecommendations({ clarity, examples, structure, engagement, completeness, pace })
    };
  }

  scoreDensityDimension(transcript, categoryPatterns, divisor, verdicts) {
    let totalSignals = 0;
    const breakdown = {};
    for (const [category, patterns] of Object.entries(categoryPatterns)) {
      const score = countMatches(transcript, patterns);
      breakdown[category] = score;
      totalSignals += score;
    }
    const wordCount = String(transcript || '').split(/\s+/).filter(Boolean).length || 1;
    const density = totalSignals / Math.max(1, wordCount / 100);
    const score = Math.min(1, density / divisor);
    return {
      score: Number(score.toFixed(2)),
      signals: totalSignals,
      breakdown,
      verdict:
        score > 0.8 ? verdicts.high :
        score > 0.6 ? verdicts.mediumHigh :
        score > 0.4 ? verdicts.medium : verdicts.low
    };
  }

  scoreExamples(transcript, concepts) {
    const explicit = countMatches(transcript, this.patterns.examples.explicit);
    const codeExamples = countMatches(transcript, this.patterns.examples.code);
    const multiple = countMatches(transcript, this.patterns.examples.multiple);
    const visual = countMatches(transcript, this.patterns.examples.visual);
    const examplesPerConcept = explicit / Math.max(1, concepts.length || 1);
    const score = Math.min(1, (examplesPerConcept / 1.5) * 0.6 + (Math.min(1, codeExamples / 10)) * 0.4);
    return {
      score: Number(score.toFixed(2)),
      explicitExamples: explicit,
      codeExamples,
      examplesPerConcept: Number(examplesPerConcept.toFixed(2)),
      breakdown: { explicit, code: codeExamples, multiple, visual },
      verdict:
        score > 0.8 ? 'ABUNDANT_EXAMPLES' :
        score > 0.6 ? 'MANY_EXAMPLES' :
        score > 0.4 ? 'SOME_EXAMPLES' : 'FEW_EXAMPLES'
    };
  }

  scorePace(transcript) {
    const slowSignals = countMatches(transcript, this.patterns.pace.slowPace);
    const fastSignals = countMatches(transcript, this.patterns.pace.fastPace);
    const pauseSignals = countMatches(transcript, this.patterns.pace.pauses);
    const slowWeight = slowSignals * 2 + pauseSignals;
    const fastWeight = fastSignals;
    const score =
      slowWeight > fastWeight * 2 ? 0.9 :
      slowWeight > fastWeight ? 0.7 :
      slowWeight === fastWeight ? 0.5 : 0.3;
    const verdict =
      slowSignals > fastSignals * 3 ? 'SLOW' :
      slowSignals > fastSignals ? 'MODERATE' :
      fastSignals > slowSignals * 2 ? 'FAST' : 'MEDIUM';
    return {
      score: Number(score.toFixed(2)),
      slowIndicators: slowSignals,
      fastIndicators: fastSignals,
      pauseIndicators: pauseSignals,
      verdict
    };
  }

  scoreVocabularyLevel(transcript) {
    const technicalTerms = countMatches(transcript, this.patterns.vocabulary.technical);
    const simpleTerms = countMatches(transcript, this.patterns.vocabulary.simple);
    const ratio = technicalTerms / Math.max(1, technicalTerms + simpleTerms);
    return {
      score: clamp(1 - Math.abs(0.5 - ratio)),
      technicalTerms,
      simpleTerms,
      technicalityRatio: Number(ratio.toFixed(2)),
      level:
        ratio > 0.7 ? 'VERY_TECHNICAL' :
        ratio > 0.5 ? 'TECHNICAL' :
        ratio > 0.3 ? 'MODERATE' : 'SIMPLE'
    };
  }

  calculateOverallScore(dimensions) {
    const weights = {
      clarity: 0.25,
      examples: 0.2,
      structure: 0.18,
      engagement: 0.12,
      completeness: 0.13,
      pace: 0.1,
      vocabulary: 0.02
    };
    const total =
      dimensions.clarity.score * weights.clarity +
      dimensions.examples.score * weights.examples +
      dimensions.structure.score * weights.structure +
      dimensions.engagement.score * weights.engagement +
      dimensions.completeness.score * weights.completeness +
      dimensions.pace.score * weights.pace +
      dimensions.vocabulary.score * weights.vocabulary;
    return Number(total.toFixed(2));
  }

  identifyStrengths(dimensions) {
    const strengths = [];
    if (dimensions.clarity.score > 0.75) strengths.push('Clear explanations');
    if (dimensions.examples.score > 0.75) strengths.push('Plenty of examples');
    if (dimensions.structure.score > 0.75) strengths.push('Well-structured');
    if (dimensions.engagement.score > 0.7) strengths.push('Engaging');
    if (dimensions.completeness.score > 0.7) strengths.push('Comprehensive coverage');
    if (dimensions.pace.score > 0.7) strengths.push('Good pacing');
    return strengths.length ? strengths : ['Adequate teaching'];
  }

  identifyWeaknesses(dimensions) {
    const weaknesses = [];
    if (dimensions.clarity.score < 0.5) weaknesses.push('Could be clearer');
    if (dimensions.examples.score < 0.5) weaknesses.push('Lacks examples');
    if (dimensions.structure.score < 0.5) weaknesses.push('Poorly structured');
    if (dimensions.engagement.score < 0.4) weaknesses.push('Low engagement');
    if (dimensions.completeness.score < 0.5) weaknesses.push('Incomplete coverage');
    if (dimensions.pace.score < 0.4) weaknesses.push('Poor pacing');
    return weaknesses;
  }

  generateRecommendations(dimensions) {
    const recommendations = [];
    if (dimensions.clarity.score < 0.6) recommendations.push('Better explanations of key concepts would help');
    if (dimensions.examples.score < 0.6) recommendations.push('Adding more concrete examples would improve learning');
    if (dimensions.structure.score < 0.6) recommendations.push('More logical organization of topics');
    if (dimensions.pace.score < 0.4 || dimensions.pace.score > 0.8) recommendations.push('Adjust pacing');
    return recommendations;
  }
}

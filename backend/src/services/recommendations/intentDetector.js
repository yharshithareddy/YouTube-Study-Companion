class IntentDetector {
  constructor() {
    this.patterns = {
      TEACHING: {
        imperative: [
          /^(let's|let me|i'll|we'll|we are going to|here's|here we go)/gim,
          /\b(learn|teach|understand|master|build|create|implement|code|write|develop)\b/gi,
          /\b(step by step|follow along|next|then|after that|finally|first|second|third)\b/gi,
          /\b(this will show you|in this video|in this tutorial|we're going to learn)\b/gi,
          /\b(syntax|function|method|class|variable|parameter|argument)\b/gi
        ],
        demoResults: [
          /\b(as you can see|notice|look at|see here|watch this|here's what happens)\b/gi,
          /\b(output|result|return|console\.log|print)\b/gi,
          /\b(now it works|there we go|perfect|that's it)\b/gi
        ],
        structure: [
          /\b(first|second|third|finally|at the end|in conclusion)\b/gi,
          /\b(chapter|section|part|module|lesson|day)\b/gi,
          /\b(before we|prerequisites|you should know|required|assumes)\b/gi
        ],
        technical: [
          /\b(const|let|var|function|class|import|export|return|if|else|for|while)\b/gi,
          /\b(console|document|window|this|prototype|async|await)\b/gi,
          /[`{}\[\]()]/g
        ]
      },
      REVIEW: {
        comparison: [
          /\b(vs|versus|comparison|compared to|difference between|better than|worse than)\b/gi,
          /\b(which is better|should i use|pros and cons|advantages and disadvantages)\b/gi,
          /\b(for this use case|in my opinion|i prefer|i recommend)\b/gi
        ],
        opinion: [
          /\b(i think|i believe|in my view|personally|my opinion|my take|my thoughts)\b/gi,
          /\b(it's great|it's terrible|it's decent|it's worth|i like|i dislike)\b/gi,
          /\b(star rating|out of|score|rating|review|verdict)\b/gi
        ],
        evaluation: [
          /\b(worth it|not worth it|recommend|don't recommend|best for|worst for)\b/gi,
          /\b(pros|cons|strengths|weaknesses|drawbacks|benefits)\b/gi,
          /\b(suitable for|ideal for|perfect for|not suitable)\b/gi
        ]
      },
      LISTICLE: {
        listing: [
          /\b(number \d+|#\d+|top \d+|best \d+|worst \d+|list of)\b/gi,
          /\b(first on my list|next up|also included|don't forget about)\b/gi,
          /\b(and that's it|those are|those were|in summary)\b/gi
        ],
        transitions: [
          /\b(moving on|next item|next up|let's move to|let's talk about)\b/gi,
          /\b(finally|last on the list|and finally|wrapping up)\b/gi
        ]
      },
      DISCUSSION: {
        questions: [
          /\b(what is|what does|why is|why do|how does|how do|when should)\b/gi,
          /\?/g
        ],
        exploration: [
          /\b(let's explore|let's discuss|let's talk about|let's consider)\b/gi,
          /\b(what if|suppose|imagine|consider|think about)\b/gi
        ],
        engagement: [
          /\b(let me know|in the comments|what do you think|subscribe|like)\b/gi,
          /\b(thanks for watching|see you next|until next time)\b/gi
        ],
        conceptual: [
          /\b(philosophy of|thinking about|understanding|perspective on)\b/gi,
          /\b(good question|interesting point|valid concern)\b/gi
        ]
      },
      AUDIOBOOK_PREVIEW: {
        reading: [
          /\b(author|novel|book|written|page|chapter|narrator)\b/gi,
          /\b(as the author says|in the book|the writer|the text)\b/gi
        ],
        narrative: [
          /\b(continue|continued|next part|previous part|earlier in)\b/gi,
          /\b(meanwhile|suddenly|and so)\b/gi
        ]
      }
    };
  }

  detectIntent(transcript) {
    const sampled = this.sampleTranscript(transcript);
    const scores = this.scoreAllIntents(sampled);
    const intent = this.determineIntent(scores);
    const confidence = this.calculateConfidence(scores, intent);
    const reasoning = this.generateReasoning(scores, intent);
    return { intent, confidence, scores, reasoning };
  }

  sampleTranscript(transcript) {
    const words = String(transcript || '').split(/\s+/).filter(Boolean);
    if (words.length <= 1800) return words.join(' ');
    const third = Math.floor(words.length / 3);
    const segments = [
      words.slice(0, 600),
      words.slice(Math.max(0, third - 300), third + 300),
      words.slice(Math.max(0, words.length - 600))
    ];
    return segments.flat().join(' ');
  }

  scoreAllIntents(transcript) {
    const scores = {};
    for (const [intent, categories] of Object.entries(this.patterns)) {
      scores[intent] = this.scoreIntent(transcript, categories);
    }
    return scores;
  }

  scoreIntent(transcript, categories) {
    let total = 0;
    const categoryScores = {};
    for (const [category, patterns] of Object.entries(categories)) {
      let matches = 0;
      for (const pattern of patterns) {
        const found = transcript.match(pattern) || [];
        matches += found.length;
      }
      categoryScores[category] = matches;
      total += matches;
    }
    const words = transcript.split(/\s+/).filter(Boolean).length || 1;
    return {
      total,
      categoryScores,
      normalized: (total / words) * 1000
    };
  }

  determineIntent(scores) {
    let topIntent = 'TEACHING';
    let topScore = -1;
    for (const [intent, score] of Object.entries(scores)) {
      if (score.total > topScore) {
        topScore = score.total;
        topIntent = intent;
      }
    }
    return topIntent;
  }

  calculateConfidence(scores, detectedIntent) {
    const detectedScore = scores[detectedIntent]?.total || 0;
    if (!detectedScore) return 0;
    const runnerUp = Object.entries(scores)
      .filter(([intent]) => intent !== detectedIntent)
      .map(([, score]) => score.total)
      .sort((a, b) => b - a)[0] || 0;
    const gap = (detectedScore - runnerUp) / detectedScore;
    return Math.max(0, Math.min(1, Number((0.3 + gap * 0.7).toFixed(2))));
  }

  generateReasoning(scores, intent) {
    const topIndicators = Object.entries(scores[intent]?.categoryScores || {})
      .sort(([, left], [, right]) => right - left)
      .slice(0, 2)
      .map(([category, matches]) => ({ category, matches }));
    return {
      intent,
      topIndicators,
      summary: `${intent} detected from ${topIndicators.map((item) => item.category).join(', ')}`
    };
  }
}

export default IntentDetector;

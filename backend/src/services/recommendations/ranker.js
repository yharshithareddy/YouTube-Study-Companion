export function rankRecommendations(items, limit = 12) {
  return [...items]
    .filter((item) => item.match.finalScore >= 0.28)
    .filter((item) => item.match.topicMatch >= 0.25)
    .sort((left, right) => {
      const leftTranscriptBoost = left.profile.analysisMode === 'transcript' ? 0.03 : 0;
      const rightTranscriptBoost = right.profile.analysisMode === 'transcript' ? 0.03 : 0;
      const leftScore = left.match.finalScore + leftTranscriptBoost;
      const rightScore = right.match.finalScore + rightTranscriptBoost;

      if (rightScore !== leftScore) {
        return rightScore - leftScore;
      }

      return (right.match.semanticSimilarity || 0) - (left.match.semanticSimilarity || 0);
    })
    .slice(0, limit)
    .map((item, index) => ({
      rank: index + 1,
      ...item
    }));
}

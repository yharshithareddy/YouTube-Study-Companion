class PipelineLogger {
  constructor(requestId) {
    this.requestId = requestId;
    this.stages = {
      search: [],
      earlyFilter: [],
      transcriptFetch: [],
      analysis: [],
      matching: [],
      ranking: []
    };
    this.startTime = Date.now();
  }

  logSearchStart(query) {
    this.stages.search.push({
      action: 'SEARCH_START',
      query,
      timestamp: Date.now()
    });
  }

  logSearchResult(query, count) {
    this.stages.search.push({
      action: 'SEARCH_RESULT',
      query,
      candidateCount: count,
      timestamp: Date.now()
    });
  }

  logEarlyFilterAccept(videoId, title) {
    this.stages.earlyFilter.push({
      videoId,
      title,
      action: 'ACCEPT',
      timestamp: Date.now()
    });
  }

  logEarlyFilterReject(videoId, title, reason, pattern) {
    this.stages.earlyFilter.push({
      videoId,
      title,
      action: 'REJECT',
      reason,
      pattern,
      timestamp: Date.now()
    });
  }

  logTranscriptSuccess(videoId, title, length) {
    this.stages.transcriptFetch.push({
      videoId,
      title,
      action: 'SUCCESS',
      transcriptLength: length,
      timestamp: Date.now()
    });
  }

  logTranscriptFailed(videoId, title, reason) {
    this.stages.transcriptFetch.push({
      videoId,
      title,
      action: 'FAILED',
      reason,
      timestamp: Date.now()
    });
  }

  logAnalysis(videoId, title, type, confidence) {
    this.stages.analysis.push({
      videoId,
      title,
      action: 'ANALYZED',
      type,
      confidence,
      timestamp: Date.now()
    });
  }

  logIntentDetection(videoId, title, intentAnalysis) {
    this.stages.analysis.push({
      videoId,
      title,
      action: 'INTENT_DETECTED',
      intent: intentAnalysis.intent,
      confidence: intentAnalysis.confidence,
      topIndicators: intentAnalysis.reasoning?.topIndicators || [],
      timestamp: Date.now()
    });
  }

  logTeachingQuality(videoId, title, qualityReport) {
    this.stages.analysis.push({
      videoId,
      title,
      action: 'QUALITY_ANALYZED',
      overallQuality: qualityReport.overallQuality,
      qualityTier: qualityReport.qualityTier,
      dimensions: {
        clarity: qualityReport.dimensions?.clarity?.score ?? 0,
        examples: qualityReport.dimensions?.examples?.score ?? 0,
        structure: qualityReport.dimensions?.structure?.score ?? 0,
        engagement: qualityReport.dimensions?.engagement?.score ?? 0,
        completeness: qualityReport.dimensions?.completeness?.score ?? 0,
        pace: qualityReport.dimensions?.pace?.score ?? 0
      },
      strengths: qualityReport.strengths || [],
      weaknesses: qualityReport.weaknesses || [],
      timestamp: Date.now()
    });
  }

  logRejectedMetadataOnly(videoId, title, reason) {
    this.stages.matching.push({
      videoId,
      title,
      action: 'REJECTED',
      reason,
      timestamp: Date.now()
    });
  }

  logMatched(videoId, title, score) {
    this.stages.matching.push({
      videoId,
      title,
      action: 'MATCHED',
      matchScore: score,
      timestamp: Date.now()
    });
  }

  logNotMatched(videoId, title, reason) {
    this.stages.matching.push({
      videoId,
      title,
      action: 'NOT_MATCHED',
      reason,
      timestamp: Date.now()
    });
  }

  logRanked(videoId, title, rank, finalScore) {
    this.stages.ranking.push({
      videoId,
      title,
      action: 'RANKED',
      rank,
      finalScore,
      timestamp: Date.now()
    });
  }

  analyzeRejectionReasons() {
    const reasons = {};
    this.stages.earlyFilter.forEach((entry) => {
      if (entry.action === 'REJECT') {
        const key = entry.pattern || entry.reason || 'unknown';
        reasons[key] = (reasons[key] || 0) + 1;
      }
    });
    return reasons;
  }

  getSummary() {
    const totalCandidates = this.stages.earlyFilter.length;
    const earlyFiltered = this.stages.earlyFilter.filter((entry) => entry.action === 'REJECT').length;
    const earlyAccepted = totalCandidates - earlyFiltered;
    const transcriptSuccess = this.stages.transcriptFetch.filter((entry) => entry.action === 'SUCCESS').length;
    const transcriptFailed = this.stages.transcriptFetch.filter((entry) => entry.action === 'FAILED').length;
    const transcriptBased = this.stages.analysis.filter((entry) => entry.type === 'TRANSCRIPT_BASED').length;
    const metadataOnly = this.stages.analysis.filter((entry) => entry.type === 'METADATA_ONLY').length;
    const metadataOnlyRejected = this.stages.matching.filter((entry) => entry.reason?.includes('Metadata-only')).length;
    const matched = this.stages.matching.filter((entry) => entry.action === 'MATCHED').length;

    return {
      requestId: this.requestId,
      totalTime: Date.now() - this.startTime,
      candidates: {
        started: totalCandidates,
        earlyFiltered,
        earlyAccepted
      },
      transcriptFetch: {
        attempted: transcriptSuccess + transcriptFailed,
        success: transcriptSuccess,
        failed: transcriptFailed,
        successRate: transcriptSuccess / (transcriptSuccess + transcriptFailed || 1)
      },
      analysis: {
        transcriptBased,
        metadataOnly,
        total: transcriptBased + metadataOnly
      },
      matching: {
        metadataOnlyRejected,
        matched
      },
      ranking: {
        finalResults: this.stages.ranking.length
      },
      rejectionReasons: this.analyzeRejectionReasons()
    };
  }

  getDetailedLog() {
    return {
      summary: this.getSummary(),
      fullLog: this.stages
    };
  }
}

export default PipelineLogger;

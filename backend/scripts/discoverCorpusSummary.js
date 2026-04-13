import { buildDiscoverCorpusIndex, loadDiscoverCorpus, summarizeDiscoverCorpus } from '../src/services/recommendations/discoverCorpus.js';

async function main() {
  const corpus = await loadDiscoverCorpus();
  const indexed = buildDiscoverCorpusIndex(corpus);
  const summary = summarizeDiscoverCorpus(indexed);

  console.log('Discover Corpus Summary');
  console.log(`Videos: ${summary.videoCount}`);
  console.log(`Requests: ${summary.requestCount}`);
  console.log(`Transcript-backed videos: ${summary.transcriptCount}`);
  console.log(`Metadata-only videos: ${summary.metadataOnlyCount}`);
  console.log(`Broad-exploration requests: ${summary.broadRequests}`);
  console.log(`Learn-basics requests: ${summary.beginnerRequests}`);
  console.log(`Concept-clarity requests: ${summary.conceptRequests}`);
  console.log(`Build-project requests: ${summary.projectRequests}`);

  console.log('\nRequests');
  indexed.requestIndex.forEach((request) => {
    const labelSummary = request.resolvedLabels
      .map((label) => `${label.label}:${label.videoId}${label.video ? '' : ' (missing)'}`)
      .join(', ');
    console.log(`- ${request.id} -> ${request.expectedTopic} :: ${labelSummary}`);
  });
}

main().catch((error) => {
  console.error('Discover corpus summary failed:', error);
  process.exitCode = 1;
});

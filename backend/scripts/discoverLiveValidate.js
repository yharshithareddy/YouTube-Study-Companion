import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const manifestPath = path.join(repoRoot, 'data', 'discover', 'live-validation-requests.json');

function parseArgs(argv) {
  const flags = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith('--')) continue;
    const key = value.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      flags.set(key, true);
      continue;
    }
    flags.set(key, next);
    index += 1;
  }
  return flags;
}

function buildTextBlob(result) {
  return [
    result.title,
    result.summary,
    result.channelTitle,
    ...(result.conceptsCovered || []),
    ...(result.whyMatched || []),
    ...(result.warnings || [])
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function evaluateResponse(item, payload) {
  const errors = [];
  const expectedTopic = item.expected?.topic;
  const results = Array.isArray(payload.results) ? payload.results : [];
  const first = results[0] || null;
  const blob = results.map(buildTextBlob).join(' ');

  if (expectedTopic && payload.userProfile?.topic !== expectedTopic) {
    errors.push(`topic mismatch: expected "${expectedTopic}", got "${payload.userProfile?.topic || 'none'}"`);
  }

  if (!results.length) {
    errors.push('no recommendation results returned');
    return { passed: false, errors, resultCount: 0 };
  }

  for (const forbidden of item.expected?.mustNotContain || []) {
    if (blob.includes(String(forbidden).toLowerCase())) {
      errors.push(`forbidden phrase appeared in results: "${forbidden}"`);
    }
  }

  const shouldContain = item.expected?.shouldContainAtLeastOne || [];
  if (shouldContain.length) {
    const matched = shouldContain.some((phrase) => blob.includes(String(phrase).toLowerCase()));
    if (!matched) {
      errors.push(`none of the expected relevance phrases appeared: ${shouldContain.join(', ')}`);
    }
  }

  return {
    passed: errors.length === 0,
    errors,
    resultCount: results.length,
    topTitle: first?.title || null,
    topScore: first?.finalScore ?? null
  };
}

async function readManifest() {
  const raw = await fs.readFile(manifestPath, 'utf8');
  return JSON.parse(raw);
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const text = await response.text();
  let payload = null;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = { raw: text };
  }

  return {
    ok: response.ok,
    status: response.status,
    payload
  };
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  const manifest = await readManifest();
  const baseUrl = String(flags.get('url') || process.env.DISCOVER_LIVE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
  const limit = Number(flags.get('limit') || process.env.DISCOVER_LIVE_LIMIT || manifest.defaultLimit || 2);
  const endpoint = `${baseUrl}/recommendations`;
  const selected = (manifest.requests || []).slice(0, Math.max(0, limit));

  console.log('Discover Live Validation');
  console.log(`Endpoint: ${endpoint}`);
  console.log(`Manifest: ${path.relative(repoRoot, manifestPath)}`);
  console.log(`Requests selected: ${selected.length}`);

  if (!selected.length) {
    console.log('\nNo requests selected.');
    return;
  }

  let passedCount = 0;
  for (const item of selected) {
    console.log(`\n[RUN] ${item.id}`);
    const response = await postJson(endpoint, item.body);

    if (!response.ok) {
      console.log(`  FAIL: HTTP ${response.status}`);
      console.log(`  Error: ${response.payload?.error || response.payload?.message || 'Unknown error'}`);
      continue;
    }

    const evaluation = evaluateResponse(item, response.payload);
    const status = evaluation.passed ? 'PASS' : 'FAIL';
    console.log(`  ${status}: ${evaluation.resultCount} results`);
    if (evaluation.topTitle) {
      console.log(`  Top result: ${evaluation.topTitle}`);
    }
    if (evaluation.topScore != null) {
      console.log(`  Top score: ${Number(evaluation.topScore).toFixed(3)}`);
    }

    if (!evaluation.passed) {
      evaluation.errors.forEach((error) => {
        console.log(`  Issue: ${error}`);
      });
      continue;
    }

    passedCount += 1;
  }

  const failedCount = selected.length - passedCount;
  console.log('\nSummary');
  console.log(`  Passed: ${passedCount}`);
  console.log(`  Failed: ${failedCount}`);

  if (failedCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('Discover live validation failed:', error);
  process.exitCode = 1;
});

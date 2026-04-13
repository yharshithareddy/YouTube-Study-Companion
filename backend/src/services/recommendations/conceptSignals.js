import { toUniqueList } from './common.js';

const CONCEPT_PATTERNS = [
  ['web scraping', [/\bweb scrapp?ing\b/, /\bweb scrapp?er\b/]],
  ['beautiful soup', [/\bbeautiful soup\b/, /\bbs4\b/]],
  ['requests', [/\brequests?\b/, /\bhttp requests?\b/]],
  ['html parsing', [/\bhtml parsing\b/, /\bparse html\b/]],
  ['hooks', [/\bhooks?\b/, /\breact hooks?\b/]],
  ['useState', [/\busestate\b/i]],
  ['useEffect', [/\buseeffect\b/i]],
  ['inner join', [/\binner join\b/]],
  ['left join', [/\bleft join\b/]],
  ['right join', [/\bright join\b/]],
  ['full join', [/\bfull join\b/, /\bfull outer join\b/]],
  ['joins', [/\bjoins?\b/]],
  ['promises', [/\bpromises?\b/]],
  ['async', [/\basync\b/]],
  ['await', [/\bawait\b/]],
  ['resolve', [/\bresolve\b/, /\bresolved\b/]],
  ['reject', [/\breject\b/, /\brejected\b/]]
];

export function extractConceptSignals(text) {
  const value = String(text || '');
  const matches = [];

  CONCEPT_PATTERNS.forEach(([concept, patterns]) => {
    if (patterns.some((pattern) => pattern.test(value))) {
      matches.push(concept);
    }
  });

  return toUniqueList(matches);
}

export function fillPrompt(template, values = {}) {
  return Object.entries(values).reduce((result, [key, value]) => {
    return result.replaceAll(`{{${key}}}`, String(value ?? ''));
  }, template);
}

export function safeJsonParse(text) {
  const raw = String(text || '').trim();
  if (!raw) {
    throw new Error('Empty LLM response');
  }

  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  return JSON.parse(cleaned);
}

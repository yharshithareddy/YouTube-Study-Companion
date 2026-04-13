import { safeJsonParse } from './promptUtils.js';

const OPENAI_API_URL = 'https://api.openai.com/v1/responses';

export class LLMClient {
  constructor(options = {}) {
    this.apiKey = options.apiKey || process.env.OPENAI_API_KEY || '';
    this.model = options.model || process.env.OPENAI_MODEL || 'gpt-4o-mini';
    this.enabled = Boolean(this.apiKey);
  }

  async complete(prompt) {
    if (!this.enabled) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.model,
        input: prompt
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OpenAI request failed (${response.status}): ${text}`);
    }

    const data = await response.json();
    return data.output_text || '';
  }

  async completeJson(prompt) {
    return safeJsonParse(await this.complete(prompt));
  }
}

export const defaultLLMClient = new LLMClient();

import dotenv from 'dotenv';
import { HostRunner } from '@mcpjam/sdk';

// Load provider keys from .env for local runs.
dotenv.config();

// Silence the ai-sdk LanguageModelV2/V3 compatibility warnings that otherwise
// flood the console on every generation.
(globalThis as Record<string, unknown>).AI_SDK_LOG_WARNINGS = false;

export const apiKeyFor = (model: string): string | undefined => {
  const provider = model.split('/')[0];
  switch (provider) {
    case 'openai':
      return process.env.OPENAI_API_KEY;
    case 'anthropic':
      return process.env.ANTHROPIC_API_KEY;
    case 'google':
      return process.env.GEMINI_API_KEY;
    default:
      return undefined;
  }
};

// One cheap call up front so an unusable provider (bad key, no credits, bad
// model) fails once with the real reason instead of as many opaque failures.
export const preflight = async (agent: HostRunner, model: string): Promise<void> => {
  const result = await agent.run('Reply with the single word: ready.');
  if (result.hasError()) {
    throw new Error(
      `Provider "${model}" is not usable: ${result.getError()}. Check API key, account credits, and model id.`,
    );
  }
};

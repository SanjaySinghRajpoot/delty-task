import { LLMProvider } from './types';
import { AnthropicProvider } from './providers/anthropic.provider';
import { GeminiProvider } from './providers/gemini.provider';

export type ProviderType = 'anthropic' | 'gemini' | 'openai';

export function createLLMProvider(
  providerType: ProviderType,
  config: { anthropicApiKey?: string; geminiApiKey?: string; openaiApiKey?: string }
): LLMProvider {
  switch (providerType) {
    case 'anthropic':
      if (!config.anthropicApiKey) {
        throw new Error('Anthropic API key is required');
      }
      return new AnthropicProvider(config.anthropicApiKey);

    case 'gemini':
      if (!config.geminiApiKey) {
        throw new Error('Gemini API key is required');
      }
      return new GeminiProvider(config.geminiApiKey);

    case 'openai':
      // TODO: Implement OpenAI provider
      throw new Error('OpenAI provider not yet implemented');

    default:
      throw new Error(`Unknown provider type: ${providerType}`);
  }
}

export function getDefaultProvider(): ProviderType {
  return (process.env.DEFAULT_LLM_PROVIDER as ProviderType) || 'gemini';
}


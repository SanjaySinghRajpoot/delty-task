import Anthropic from '@anthropic-ai/sdk';
import { LLMProvider, LLMMessage, LLMConfig, StreamEvent, ToolDefinition } from '../types';

export class AnthropicProvider implements LLMProvider {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async streamChat(
    messages: LLMMessage[],
    config: LLMConfig,
    tools?: ToolDefinition[],
    onEvent?: (event: StreamEvent) => void
  ): Promise<void> {
    try {
      // Convert messages to Anthropic format
      const systemMessage = messages.find(m => m.role === 'system');
      const conversationMessages = messages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content,
        }));

      // Convert tools to Anthropic format
      const anthropicTools = tools?.map(tool => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.parameters,
      }));

      // Build request parameters
      const requestParams: any = {
        model: config.model || 'claude-sonnet-4-20250514',
        max_tokens: config.maxTokens || 16000,
        system: systemMessage?.content,
        messages: conversationMessages as any,
        tools: anthropicTools,
      };

      // Enable extended thinking if configured
      // Note: Extended thinking requires temperature to be 1 and specific models
      if (config.thinkingEnabled) {
        requestParams.thinking = {
          type: 'enabled',
          budget_tokens: 10000, // Allow up to 10k tokens for thinking
        };
        // Temperature must be 1 when thinking is enabled
        requestParams.temperature = 1;
        console.log('[AnthropicProvider] Extended thinking enabled with 10k budget tokens');
      } else {
        requestParams.temperature = config.temperature ?? 1;
      }

      const stream = await this.client.messages.stream(requestParams);

      let currentToolCall: { id: string; name: string; arguments: string } | null = null;
      let isInThinkingBlock = false;

      for await (const event of stream) {
        if (event.type === 'message_start') {
          // Message started
        } else if (event.type === 'content_block_start') {
          const block = event.content_block as any;
          if (block.type === 'thinking') {
            // Thinking block started
            isInThinkingBlock = true;
            onEvent?.({
              type: 'thinking_start',
              data: { id: block.id || 'thinking' },
            });
            console.log('[AnthropicProvider] Thinking block started');
          } else if (block.type === 'tool_use') {
            currentToolCall = {
              id: block.id,
              name: block.name,
              arguments: '',
            };
            onEvent?.({
              type: 'tool_call_start',
              data: { id: block.id, name: block.name },
            });
          }
        } else if (event.type === 'content_block_delta') {
          const delta = event.delta as any;
          if (delta.type === 'thinking_delta') {
            // Stream thinking content
            onEvent?.({
              type: 'thinking_delta',
              data: { delta: delta.thinking },
            });
          } else if (delta.type === 'text_delta') {
            onEvent?.({
              type: 'text_delta',
              data: { delta: delta.text },
            });
          } else if (delta.type === 'input_json_delta' && currentToolCall) {
            currentToolCall.arguments += delta.partial_json;
            onEvent?.({
              type: 'tool_call_delta',
              data: {
                id: currentToolCall.id,
                name: currentToolCall.name,
                delta: delta.partial_json,
              },
            });
          }
        } else if (event.type === 'content_block_stop') {
          if (isInThinkingBlock) {
            // Thinking block ended
            isInThinkingBlock = false;
            onEvent?.({
              type: 'thinking_end',
              data: {},
            });
            console.log('[AnthropicProvider] Thinking block ended');
          } else if (currentToolCall) {
            try {
              const args = JSON.parse(currentToolCall.arguments);
              onEvent?.({
                type: 'tool_call_end',
                data: {
                  id: currentToolCall.id,
                  name: currentToolCall.name,
                  arguments: args,
                },
              });
              currentToolCall = null;
            } catch (e) {
              // Invalid JSON, continue
            }
          }
        } else if (event.type === 'message_delta') {
          // Handle message delta
          if ((event.delta as any).stop_reason) {
            // Message complete
          }
        } else if (event.type === 'message_stop') {
          onEvent?.({ type: 'done' });
        }
      }
    } catch (error: any) {
      console.error('[AnthropicProvider] Error:', error);
      onEvent?.({
        type: 'error',
        error: error.message || 'Anthropic API error',
      });
      throw error;
    }
  }
}

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

      const stream = await this.client.messages.stream({
        model: config.model || 'claude-3-5-sonnet-20241022',
        max_tokens: config.maxTokens || 4096,
        temperature: config.temperature ?? 1,
        system: systemMessage?.content,
        messages: conversationMessages as any,
        tools: anthropicTools,
      });

      let currentToolCall: { id: string; name: string; arguments: string } | null = null;

      for await (const event of stream) {
        if (event.type === 'message_start') {
          // Message started
        } else if (event.type === 'content_block_start') {
          const block = event.content_block;
          if (block.type === 'tool_use') {
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
          const delta = event.delta;
          if (delta.type === 'text_delta') {
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
          if (currentToolCall) {
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
          // Handle thinking/reasoning if available
          if (event.delta.stop_reason) {
            // Message complete
          }
        } else if (event.type === 'message_stop') {
          onEvent?.({ type: 'done' });
        }
      }
    } catch (error: any) {
      onEvent?.({
        type: 'error',
        error: error.message || 'Anthropic API error',
      });
      throw error;
    }
  }
}


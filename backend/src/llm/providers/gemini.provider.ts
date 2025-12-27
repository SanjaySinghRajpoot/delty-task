import { GoogleGenerativeAI } from '@google/generative-ai';
import { LLMProvider, LLMMessage, LLMConfig, StreamEvent, ToolDefinition } from '../types';

export class GeminiProvider implements LLMProvider {
  private genAI: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async streamChat(
    messages: LLMMessage[],
    config: LLMConfig,
    tools?: ToolDefinition[],
    onEvent?: (event: StreamEvent) => void
  ): Promise<void> {
    try {
      // Convert messages to Gemini format
      const systemMessage = messages.find(m => m.role === 'system');
      const conversationHistory = messages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        }));

      // Convert tools to Gemini format
      const geminiTools = tools?.map(tool => ({
        functionDeclarations: [
          {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
          },
        ],
      }));

      const modelName = config.model || 'gemini-2.0-flash';
      console.log(`[GeminiProvider] Using model: ${modelName}`);
      
      const model = this.genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          temperature: config.temperature ?? 1,
          maxOutputTokens: config.maxTokens || 4096,
        },
      });

      // Build chat config
      // Note: Gemini API may have issues with systemInstruction format
      // If systemInstruction causes errors, we can include system message in history instead
      const chatConfig: any = {
        history: conversationHistory.slice(0, -1) as any,
      };

      // Try to add system instruction - if this fails, we'll need to include it in history
      // The SDK should accept a string, but if it doesn't work, we'll handle it differently
      if (systemMessage?.content) {
        // Try as Content object format
        chatConfig.systemInstruction = {
          parts: [{ text: systemMessage.content }],
        };
      }

      // Add tools if provided
      if (geminiTools && geminiTools.length > 0) {
        chatConfig.tools = [{ functionDeclarations: geminiTools.flatMap(t => t.functionDeclarations) }] as any;
      }

      const chat = model.startChat(chatConfig);

      const lastMessage = messages[messages.length - 1];
      const result = await chat.sendMessageStream(lastMessage.content);

      let currentToolCall: { id: string; name: string; arguments: string } | null = null;

      for await (const chunk of result.stream) {
        try {
          const chunkText = chunk.text();
          if (chunkText) {
            // Send each text chunk immediately for token-by-token streaming
            onEvent?.({
              type: 'text_delta',
              data: { delta: chunkText },
            });
          }
        } catch (error) {
          console.error('[GeminiProvider] Error processing chunk:', error);
        }

        // Handle function calls
        const functionCalls = chunk.functionCalls();
        if (functionCalls && functionCalls.length > 0) {
          for (const fnCall of functionCalls) {
            if (!currentToolCall) {
              currentToolCall = {
                id: fnCall.name,
                name: fnCall.name,
                arguments: '',
              };
              onEvent?.({
                type: 'tool_call_start',
                data: { id: fnCall.name, name: fnCall.name },
              });
            }

            const args = JSON.stringify(fnCall.args || {});
            currentToolCall.arguments = args;
            onEvent?.({
              type: 'tool_call_delta',
              data: {
                id: fnCall.name,
                name: fnCall.name,
                delta: args,
              },
            });
          }
        }

        // Check if chunk is complete
        if (chunk.candidates?.[0]?.finishReason) {
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
              // Invalid JSON
            }
          }
        }
      }

      onEvent?.({ type: 'done' });
    } catch (error: any) {
      onEvent?.({
        type: 'error',
        error: error.message || 'Gemini API error',
      });
      throw error;
    }
  }
}


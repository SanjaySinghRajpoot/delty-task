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
      // Gemini expects tools as an array where each tool has functionDeclarations array
      const geminiTools = tools && tools.length > 0 ? [{
        functionDeclarations: tools.map(tool => ({
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        })),
      }] : undefined;

      const modelName = config.model || 'gemini-2.0-flash';
      console.log(`[GeminiProvider] Using model: ${modelName}`);
      console.log(`[GeminiProvider] Tools provided: ${tools?.length || 0}`);
      if (tools && tools.length > 0) {
        console.log(`[GeminiProvider] Tool names: ${tools.map(t => t.name).join(', ')}`);
      }
      
      const modelConfig: any = {
        model: modelName,
        generationConfig: {
          temperature: config.temperature ?? 1,
          maxOutputTokens: config.maxTokens || 4096,
        },
      };

      // Add tools to model config if available (some Gemini models support this)
      if (geminiTools && geminiTools.length > 0) {
        modelConfig.tools = geminiTools;
      }

      const model = this.genAI.getGenerativeModel(modelConfig);

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

      // Add tools if provided - Gemini expects tools array with functionDeclarations
      if (geminiTools && geminiTools.length > 0) {
        chatConfig.tools = geminiTools;
        // Configure tool behavior based on forceFunctionCall config
        // ANY mode forces the model to call at least one function
        // AUTO mode lets the model decide
        const functionCallingMode = config.forceFunctionCall ? "ANY" : "AUTO";
        chatConfig.toolConfig = {
          functionCallingConfig: {
            mode: functionCallingMode as any,
          },
        };
        console.log(`[GeminiProvider] Added ${geminiTools[0].functionDeclarations.length} tools to chat config with ${functionCallingMode} mode`);
      }

      const chat = model.startChat(chatConfig);

      const lastMessage = messages[messages.length - 1];
      console.log(`[GeminiProvider] Sending message: ${lastMessage.content.substring(0, 100)}...`);
      const result = await chat.sendMessageStream(lastMessage.content);

      const toolCallMap = new Map<string, { id: string; name: string; arguments: string }>();
      let hasReceivedFunctionCalls = false;

      for await (const chunk of result.stream) {
        try {
          // Check for function calls - this is the key part
          const functionCalls = chunk.functionCalls();
          if (functionCalls && functionCalls.length > 0) {
            hasReceivedFunctionCalls = true;
            console.log(`[GeminiProvider] Received ${functionCalls.length} function call(s)`);
            for (const fnCall of functionCalls) {
              const toolId = fnCall.name || `tool-${Date.now()}`;
              
              if (!toolCallMap.has(toolId)) {
                // New tool call starting
                const toolCall = {
                  id: toolId,
                  name: fnCall.name || 'unknown',
                  arguments: '',
                };
                toolCallMap.set(toolId, toolCall);
                console.log(`[GeminiProvider] Tool call started: ${fnCall.name}`);
                console.log(`[GeminiProvider] Function call args:`, fnCall.args);
                onEvent?.({
                  type: 'tool_call_start',
                  data: { id: toolId, name: fnCall.name },
                });
              }

              // Accumulate arguments
              const toolCall = toolCallMap.get(toolId)!;
              const args = fnCall.args ? JSON.stringify(fnCall.args) : '{}';
              toolCall.arguments = args;
              
              onEvent?.({
                type: 'tool_call_delta',
                data: {
                  id: toolId,
                  name: fnCall.name,
                  delta: args,
                },
              });
            }
          }

          // Handle text content (only if no function calls or after function calls)
          const chunkText = chunk.text();
          if (chunkText) {
            // Send each text chunk immediately for token-by-token streaming
            onEvent?.({
              type: 'text_delta',
              data: { delta: chunkText },
            });
          }

          // Check candidates for function calls (alternative method)
          const candidates = chunk.candidates;
          if (candidates && candidates.length > 0) {
            for (const candidate of candidates) {
              const content = candidate.content;
              if (content && content.parts) {
                for (const part of content.parts) {
                  if (part.functionCall) {
                    hasReceivedFunctionCalls = true;
                    const fnCall = part.functionCall;
                    const toolId = fnCall.name || `tool-${Date.now()}`;
                    
                    if (!toolCallMap.has(toolId)) {
                      const toolCall = {
                        id: toolId,
                        name: fnCall.name || 'unknown',
                        arguments: JSON.stringify(fnCall.args || {}),
                      };
                      toolCallMap.set(toolId, toolCall);
                      console.log(`[GeminiProvider] Function call from candidate: ${fnCall.name}`);
                      onEvent?.({
                        type: 'tool_call_start',
                        data: { id: toolId, name: fnCall.name },
                      });
                      onEvent?.({
                        type: 'tool_call_delta',
                        data: {
                          id: toolId,
                          name: fnCall.name,
                          delta: JSON.stringify(fnCall.args || {}),
                        },
                      });
                    }
                  }
                }
              }
            }
          }
        } catch (error) {
          console.error('[GeminiProvider] Error processing chunk:', error);
        }

        // Check if chunk is complete and finalize tool calls
        const finishReason = chunk.candidates?.[0]?.finishReason;
        if (finishReason) {
          console.log(`[GeminiProvider] Finish reason: ${finishReason}`);
          // Finalize all pending tool calls
          for (const [, toolCall] of toolCallMap.entries()) {
            try {
              const args = toolCall.arguments ? JSON.parse(toolCall.arguments) : {};
              console.log(`[GeminiProvider] Tool call completed: ${toolCall.name} with args:`, JSON.stringify(args, null, 2));
              onEvent?.({
                type: 'tool_call_end',
                data: {
                  id: toolCall.id,
                  name: toolCall.name,
                  arguments: args,
                },
              });
            } catch (e) {
              console.error(`[GeminiProvider] Error parsing tool call arguments for ${toolCall.name}:`, e);
              // Send tool call end even if parsing fails
              onEvent?.({
                type: 'tool_call_end',
                data: {
                  id: toolCall.id,
                  name: toolCall.name,
                  arguments: {},
                },
              });
            }
          }
          toolCallMap.clear();
        }
      }

      // Log if we received any function calls
      if (!hasReceivedFunctionCalls) {
        console.warn(`[GeminiProvider] No function calls received in response. Tools were: ${tools?.map(t => t.name).join(', ') || 'none'}`);
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


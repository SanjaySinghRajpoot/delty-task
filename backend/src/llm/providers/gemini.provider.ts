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

      // Use thinking model if thinking is enabled
      // gemini-2.0-flash-thinking-exp outputs thoughts separately
      let modelName = config.model || 'gemini-2.0-flash';
      if (config.thinkingEnabled) {
        modelName = 'gemini-2.0-flash-thinking-exp-01-21';
        console.log('[GeminiProvider] Using thinking model: gemini-2.0-flash-thinking-exp-01-21');
      }
      console.log(`[GeminiProvider] Using model: ${modelName}`);
      console.log(`[GeminiProvider] Tools provided: ${tools?.length || 0}`);
      if (tools && tools.length > 0) {
        console.log(`[GeminiProvider] Tool names: ${tools.map(t => t.name).join(', ')}`);
      }
      
      const modelConfig: any = {
        model: modelName,
        generationConfig: {
          temperature: config.temperature ?? 1,
          maxOutputTokens: config.maxTokens || 8192,
        },
      };

      // Add tools to model config if available (some Gemini models support this)
      // Note: Thinking model may have limited tool support
      if (geminiTools && geminiTools.length > 0 && !config.thinkingEnabled) {
        modelConfig.tools = geminiTools;
      }

      const model = this.genAI.getGenerativeModel(modelConfig);

      // Build chat config
      const chatConfig: any = {
        history: conversationHistory.slice(0, -1) as any,
      };

      // Add system instruction
      if (systemMessage?.content) {
        chatConfig.systemInstruction = {
          parts: [{ text: systemMessage.content }],
        };
      }

      // Add tools if provided and not using thinking model
      if (geminiTools && geminiTools.length > 0 && !config.thinkingEnabled) {
        chatConfig.tools = geminiTools;
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
      let isInThinkingBlock = false;
      let thinkingStarted = false;

      for await (const chunk of result.stream) {
        try {
          // Check for thinking content in candidates
          // Gemini thinking model returns thoughts in a separate part
          const candidates = chunk.candidates;
          if (candidates && candidates.length > 0) {
            for (const candidate of candidates) {
              const content = candidate.content;
              if (content && content.parts) {
                for (const part of content.parts as any[]) {
                  // Check for thought property (thinking model specific)
                  if (part.thought === true && part.text) {
                    // This is thinking content
                    if (!thinkingStarted) {
                      thinkingStarted = true;
                      isInThinkingBlock = true;
                      onEvent?.({
                        type: 'thinking_start',
                        data: { id: 'gemini-thinking' },
                      });
                      console.log('[GeminiProvider] Thinking block started');
                    }
                    onEvent?.({
                      type: 'thinking_delta',
                      data: { delta: part.text },
                    });
                  } else if (part.text && !part.thought) {
                    // Regular text content
                    if (isInThinkingBlock) {
                      // Thinking ended, regular text starting
                      isInThinkingBlock = false;
                      onEvent?.({
                        type: 'thinking_end',
                        data: {},
                      });
                      console.log('[GeminiProvider] Thinking block ended');
                    }
                    onEvent?.({
                      type: 'text_delta',
                      data: { delta: part.text },
                    });
                  }
                  
                  // Handle function calls
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

          // Check for function calls (alternative method)
          const functionCalls = chunk.functionCalls();
          if (functionCalls && functionCalls.length > 0) {
            hasReceivedFunctionCalls = true;
            console.log(`[GeminiProvider] Received ${functionCalls.length} function call(s)`);
            for (const fnCall of functionCalls) {
              const toolId = fnCall.name || `tool-${Date.now()}`;
              
              if (!toolCallMap.has(toolId)) {
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

          // Fallback: Handle text content without thought property
          try {
            const chunkText = chunk.text();
            if (chunkText && !thinkingStarted) {
              onEvent?.({
                type: 'text_delta',
                data: { delta: chunkText },
              });
            }
          } catch (e) {
            // chunk.text() might throw if content is function call only
          }

          // Check if chunk is complete and finalize tool calls
          const finishReason = chunk.candidates?.[0]?.finishReason;
          if (finishReason) {
            console.log(`[GeminiProvider] Finish reason: ${finishReason}`);
            
            // End thinking if still active
            if (isInThinkingBlock) {
              isInThinkingBlock = false;
              onEvent?.({
                type: 'thinking_end',
                data: {},
              });
              console.log('[GeminiProvider] Thinking block ended (finish)');
            }
            
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
        } catch (error) {
          console.error('[GeminiProvider] Error processing chunk:', error);
        }
      }

      // Log if we received any function calls
      if (!hasReceivedFunctionCalls && tools && tools.length > 0) {
        console.warn(`[GeminiProvider] No function calls received in response. Tools were: ${tools?.map(t => t.name).join(', ') || 'none'}`);
      }

      onEvent?.({ type: 'done' });
    } catch (error: any) {
      console.error('[GeminiProvider] Error:', error);
      onEvent?.({
        type: 'error',
        error: error.message || 'Gemini API error',
      });
      throw error;
    }
  }
}

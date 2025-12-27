import { Request, Response } from 'express';
import { createLLMProvider, getDefaultProvider } from '../llm/factory';
import { LLMMessage, LLMConfig, StreamEvent } from '../llm/types';
import { documentToolDefinitions, executeDocumentTool } from '../llm/tools/document.tool';
import { MessageModel } from '../models/message.model';
import { DocumentModel } from '../models/document.model';

export class ChatController {
  static async streamChat(req: Request, res: Response): Promise<void> {
    const { message, conversation_id, provider, model, temperature, maxTokens, thinkingEnabled } = req.body;

    if (!message || !conversation_id) {
      res.status(400).json({ error: 'message and conversation_id are required' });
      return;
    }

    // Set up SSE - must be done before any writes
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');
    
    // Send initial connection message
    res.write(': connected\n\n');

    const sendEvent = (event: StreamEvent) => {
      try {
        const data = `data: ${JSON.stringify(event)}\n\n`;
        const written = res.write(data);
        // If write buffer is full, wait for drain
        if (!written) {
          res.once('drain', () => {
            // Continue after drain
          });
        }
        // Force flush for immediate delivery
        if (typeof (res as any).flush === 'function') {
          (res as any).flush();
        }
        // Debug logging for text deltas
        if (event.type === 'text_delta') {
          console.log('[ChatController] Sent text_delta:', event.data?.delta?.substring(0, 50));
        }
      } catch (error) {
        console.error('[ChatController] Error sending event:', error);
      }
    };

    try {
      // Save user message
      await MessageModel.create({
        conversation_id,
        role: 'user',
        content: message,
      });

      // Get conversation history
      const history = await MessageModel.findByConversationId(conversation_id);
      const messages: LLMMessage[] = history
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role as 'system' | 'user' | 'assistant',
          content: m.content,
        }));

      // Add system message
      messages.unshift({
        role: 'system',
        content: `You are a helpful and friendly AI assistant that helps users create and manage documents through natural conversation.

Your personality:
- Be conversational, warm, and engaging
- Show enthusiasm when helping users
- Provide helpful context and explanations when appropriate
- Acknowledge user requests naturally before acting

When users ask you to create documents:
- Use the createDocument tool immediately with appropriate content
- Generate document_id and title automatically based on the user's request
- After creating, confirm what you've done in a friendly way (e.g., "I've created a document with 5 jokes for you!")

When users ask you to update documents:
- Use the updateDocument tool with the document_id and new content
- Confirm the update naturally

TOOLS:
- createDocument: Creates a document. Requires document_id, content, and optionally title.
- updateDocument: Updates existing documents. Requires document_id and content.

Be helpful, friendly, and proactive in assisting users with their document needs.`,
      });

      // Create LLM provider
      const providerType = provider || getDefaultProvider();
      
      // Validate API keys
      if (providerType === 'anthropic' && !process.env.ANTHROPIC_API_KEY) {
        sendEvent({
          type: 'error',
          error: 'ANTHROPIC_API_KEY is not set in environment variables',
        });
        res.end();
        return;
      }
      
      if (providerType === 'gemini' && !process.env.GEMINI_API_KEY) {
        sendEvent({
          type: 'error',
          error: 'GEMINI_API_KEY is not set in environment variables',
        });
        res.end();
        return;
      }

      const llmProvider = createLLMProvider(providerType, {
        anthropicApiKey: process.env.ANTHROPIC_API_KEY,
        geminiApiKey: process.env.GEMINI_API_KEY,
        openaiApiKey: process.env.OPENAI_API_KEY,
      });

      const defaultModel = providerType === 'anthropic' ? 'claude-3-5-sonnet-20241022' : 'gemini-2.0-flash';
      const selectedModel = model || defaultModel;
      console.log(`[ChatController] Provider: ${providerType}, Model: ${selectedModel}`);
      
      const config: LLMConfig = {
        model: selectedModel,
        temperature: temperature ?? 1,
        maxTokens: maxTokens || 4096,
        thinkingEnabled: thinkingEnabled ?? true,
      };

      let assistantContent = '';
      let pendingToolCalls: Map<string, { name: string; arguments: any }> = new Map();

      // Stream chat with tool support
      await llmProvider.streamChat(
        messages,
        config,
        documentToolDefinitions,
        async (event: StreamEvent) => {
          try {
            if (event.type === 'text_delta') {
              assistantContent += event.data?.delta || '';
              // Send immediately for token-by-token streaming
              sendEvent(event);
            } else if (event.type === 'thinking_delta') {
              sendEvent(event);
            } else if (event.type === 'tool_call_start') {
              const { id, name } = event.data;
              pendingToolCalls.set(id, { name, arguments: {} });
              sendEvent(event);
            } else if (event.type === 'tool_call_delta') {
              const { id, delta } = event.data;
              const toolCall = pendingToolCalls.get(id);
              if (toolCall && delta) {
                // Try to accumulate and parse delta for document tools
                try {
                  const deltaStr = typeof delta === 'string' ? delta : JSON.stringify(delta);
                  const parsed = JSON.parse(deltaStr);
                  if (toolCall.name === 'createDocument' && parsed.document_id && parsed.content) {
                    // Send document update event immediately
                    sendEvent({
                      type: 'tool_call_delta',
                      data: {
                        id,
                        name: toolCall.name,
                        document_id: parsed.document_id,
                        content: parsed.content,
                        title: parsed.title,
                      },
                    });
                  }
                } catch (e) {
                  // Delta might be partial, just forward the event
                }
              }
              // Always forward the original delta event
              sendEvent(event);
            } else if (event.type === 'tool_call_end') {
              const { id, name, arguments: args } = event.data;
              pendingToolCalls.delete(id);

              // Update existing tool event to executing status instead of creating a new one
              sendEvent({
                type: 'tool_call_delta',
                data: { id, name, status: 'executing' },
              });

              try {
                const result = await executeDocumentTool(name, args);

                // Stream document updates if it's a document tool
                if (result.success && result.content) {
                  const doc = await DocumentModel.findByDocumentId(result.document_id);
                  if (doc) {
                    // Stream document content updates
                    sendEvent({
                      type: 'tool_call_delta',
                      data: {
                        id,
                        name,
                        document_id: result.document_id,
                        content: doc.content,
                        title: doc.title,
                      },
                    });
                  }
                }

                sendEvent({
                  type: 'tool_call_end',
                  data: {
                    id,
                    name,
                    result,
                  },
                });
              } catch (error: any) {
                sendEvent({
                  type: 'tool_call_end',
                  data: {
                    id,
                    name,
                    result: {
                      success: false,
                      error: error.message,
                    },
                  },
                });
              }
            } else if (event.type === 'done') {
              // Save assistant message
              if (assistantContent) {
                await MessageModel.create({
                  conversation_id,
                  role: 'assistant',
                  content: assistantContent,
                });
              }
              sendEvent(event);
              res.end();
            } else if (event.type === 'error') {
              sendEvent(event);
              res.end();
            } else {
              sendEvent(event);
            }
          } catch (err) {
            console.error('[ChatController] Error handling event:', err, event);
          }
        }
      );
    } catch (error: any) {
      console.error('[ChatController] Stream error:', error);
      try {
        sendEvent({
          type: 'error',
          error: error.message || 'Chat error',
        });
      } catch (e) {
        // Response might be closed
      }
      res.end();
    }
  }

  static async getMessages(req: Request, res: Response): Promise<void> {
    try {
      const { conversation_id } = req.params;
      const messages = await MessageModel.findByConversationId(conversation_id);
      res.json({ messages });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getDocument(req: Request, res: Response): Promise<void> {
    try {
      const { document_id } = req.params;
      const doc = await DocumentModel.findByDocumentId(document_id);
      if (!doc) {
        res.status(404).json({ error: 'Document not found' });
        return;
      }
      res.json({ document: doc });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async updateDocument(req: Request, res: Response): Promise<void> {
    try {
      const { document_id } = req.params;
      const { content, title } = req.body;

      if (!content) {
        res.status(400).json({ error: 'content is required' });
        return;
      }

      const doc = await DocumentModel.update(document_id, { content, title });
      if (!doc) {
        res.status(404).json({ error: 'Document not found' });
        return;
      }

      res.json({ document: doc });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}


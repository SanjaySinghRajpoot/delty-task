'use client';

import { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '@/components/chat/ChatMessage';
import { ChatInput } from '@/components/chat/ChatInput';
import { ThinkingPanel } from '@/components/chat/ThinkingPanel';
import { ToolEventsPanel } from '@/components/chat/ToolEventsPanel';
import { DocumentViewer } from '@/components/chat/DocumentViewer';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface StreamEvent {
  type: 'text_delta' | 'thinking_delta' | 'tool_call_start' | 'tool_call_delta' | 'tool_call_end' | 'done' | 'error';
  data?: any;
  error?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

type ProviderType = 'anthropic' | 'gemini';

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentAssistantMessage, setCurrentAssistantMessage] = useState('');
  const [thinking, setThinking] = useState('');
  const [toolEvents, setToolEvents] = useState<any[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentDocument, setCurrentDocument] = useState<{ document_id: string; content: string; title?: string } | null>(null);
  const [conversationId] = useState(() => `conv-${Date.now()}`);
  const [provider, setProvider] = useState<ProviderType>('gemini');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, currentAssistantMessage]);

  const handleSendMessage = async (message: string) => {
    if (!message.trim() || isStreaming) return;

    // Add user message
    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: message,
    };
    setMessages((prev) => [...prev, userMessage]);
    setCurrentAssistantMessage('');
    setThinking('');
    setToolEvents([]);
    setIsStreaming(true);

    try {
      const response = await fetch('http://localhost:3001/api/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          conversation_id: conversationId,
          provider: provider,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to stream chat');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event: StreamEvent = JSON.parse(line.slice(6));
              // Handle events immediately for real-time streaming
              handleStreamEvent(event);
            } catch (e) {
              console.error('Failed to parse event:', e, line);
            }
          }
        }
      }
    } catch (error: any) {
      console.error('Chat error:', error);
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: `Error: ${error.message}`,
        },
      ]);
    } finally {
      setIsStreaming(false);
    }
  };

  const handleStreamEvent = (event: StreamEvent) => {
    switch (event.type) {
      case 'text_delta':
        setCurrentAssistantMessage((prev) => prev + (event.data?.delta || ''));
        break;

      case 'thinking_delta':
        setThinking((prev) => prev + (event.data?.delta || ''));
        break;

      case 'tool_call_start':
        setToolEvents((prev) => [
          ...prev,
          {
            id: `${event.data?.id || 'tool'}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: event.data?.name,
            status: 'started',
            timestamp: new Date(),
            toolCallId: event.data?.id, // Store original ID for matching updates
          },
        ]);
        break;

      case 'tool_call_delta':
        // Handle document data from backend (direct format)
        if (event.data?.document_id && event.data?.content) {
          // Update document content in real-time
          setCurrentDocument((prev) => {
            // If it's the same document, update it; otherwise create new
            if (prev && prev.document_id === event.data.document_id) {
              return {
                document_id: prev.document_id,
                content: event.data.content,
                title: event.data.title || prev.title,
              };
            }
            return {
              document_id: event.data.document_id,
              content: event.data.content,
              title: event.data.title,
            };
          });
        }
        // Handle document data from LLM provider (delta JSON string format)
        else if (event.data?.delta && event.data?.name === 'createDocument') {
          try {
            const deltaData = JSON.parse(event.data.delta);
            if (deltaData.document_id && deltaData.content) {
              setCurrentDocument((prev) => {
                // If it's the same document, update it; otherwise create new
                if (prev && prev.document_id === deltaData.document_id) {
                  return {
                    document_id: prev.document_id,
                    content: deltaData.content,
                    title: deltaData.title || prev.title,
                  };
                }
                return {
                  document_id: deltaData.document_id,
                  content: deltaData.content,
                  title: deltaData.title,
                };
              });
            }
          } catch (e) {
            console.error('Failed to parse tool_call_delta:', e);
          }
        }
        setToolEvents((prev) => {
          const updated = [...prev];
          const index = updated.findIndex((e) => (e as any).toolCallId === event.data?.id || e.id === event.data?.id);
          if (index >= 0) {
            updated[index] = { ...updated[index], ...event.data };
          }
          return updated;
        });
        break;

      case 'tool_call_end':
        setToolEvents((prev) => {
          const updated = [...prev];
          const index = updated.findIndex((e) => (e as any).toolCallId === event.data?.id || e.id === event.data?.id);
          if (index >= 0) {
            updated[index] = { ...updated[index], status: 'completed', result: event.data?.result };
          }
          return updated;
        });
        // Update document if the tool result contains document data
        if (event.data?.result?.success && event.data?.result?.document_id) {
          // Fetch the full document or use the result data
          if (event.data?.result?.content) {
            setCurrentDocument({
              document_id: event.data.result.document_id,
              content: event.data.result.content,
              title: event.data.result.title,
            });
          }
        }
        break;

      case 'done':
        if (currentAssistantMessage) {
          setMessages((prev) => [
            ...prev,
            {
              id: `msg-${Date.now()}`,
              role: 'assistant',
              content: currentAssistantMessage,
            },
          ]);
          setCurrentAssistantMessage('');
        }
        break;

      case 'error':
        console.error('Stream error:', event.error);
        break;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Chat</h1>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 dark:text-gray-400">Model:</label>
              <Select value={provider} onValueChange={(value) => setProvider(value as ProviderType)} disabled={isStreaming}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gemini">Gemini</SelectItem>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
          {currentAssistantMessage && (
            <ChatMessage
              message={{
                id: 'current',
                role: 'assistant',
                content: currentAssistantMessage,
              }}
              isStreaming
            />
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800">
          <ChatInput onSend={handleSendMessage} disabled={isStreaming} />
        </div>
      </div>

      {/* Side Panels */}
      <div className="w-80 border-l border-gray-200 dark:border-gray-700 flex flex-col bg-white dark:bg-gray-800">
        <ThinkingPanel thinking={thinking} />
        <ToolEventsPanel events={toolEvents} />
        <DocumentViewer document={currentDocument} />
      </div>
    </div>
  );
}


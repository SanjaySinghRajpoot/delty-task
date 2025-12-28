'use client';

import { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '@/components/chat/ChatMessage';
import { ChatInput } from '@/components/chat/ChatInput';
import { ThinkingPanel } from '@/components/chat/ThinkingPanel';
import { ToolEventsPanel } from '@/components/chat/ToolEventsPanel';
import { DocumentViewer } from '@/components/chat/DocumentViewer';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useChatStore } from '@/store/chatStore';

export interface StreamEvent {
  type: 'text_delta' | 'thinking_start' | 'thinking_delta' | 'thinking_end' | 'tool_call_start' | 'tool_call_delta' | 'tool_call_end' | 'done' | 'error';
  data?: any;
  error?: string;
}

type ProviderType = 'anthropic' | 'gemini';

export default function ChatPage() {
  const {
    conversationId,
    messages,
    currentDocument,
    provider,
    setMessages,
    addMessage,
    setCurrentDocument,
    setProvider: setStoreProvider,
  } = useChatStore();

  const [currentAssistantMessage, setCurrentAssistantMessage] = useState('');
  const [thinking, setThinking] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [toolEvents, setToolEvents] = useState<any[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Ref to track latest assistant message content (avoids closure issues in event handlers)
  const assistantContentRef = useRef<string>('');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, currentAssistantMessage]);

  // Load conversation history on mount
  useEffect(() => {
    const loadConversationHistory = async () => {
      try {
        const response = await fetch(`http://localhost:3001/api/chat/messages/${conversationId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.messages && Array.isArray(data.messages) && data.messages.length > 0) {
            // Filter out system messages and convert to Message format
            // Use database ID to ensure uniqueness and prevent conflicts with new messages
            const chatMessages = data.messages
              .filter((m: any) => m.role !== 'system')
              .map((m: any, index: number) => ({
                id: `msg-db-${m.id}-${index}`, // Use database ID with index for uniqueness
                role: m.role as 'user' | 'assistant',
                content: m.content,
              }));
            if (chatMessages.length > 0) {
              setMessages(chatMessages);
            }
          }
        } else if (response.status === 404) {
          // Conversation doesn't exist yet, that's fine
          console.log('No conversation history found, starting fresh');
        }
      } catch (error) {
        console.error('Failed to load conversation history:', error);
        // Don't show error to user, just start fresh
      }
    };

    loadConversationHistory();
  }, [conversationId, setMessages]);

  const handleSendMessage = async (message: string) => {
    if (!message.trim() || isStreaming) return;

    // Add user message with unique ID
    const userMessage = {
      id: `msg-user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role: 'user' as const,
      content: message,
    };
    addMessage(userMessage);
    
    // Reset streaming state (don't create assistant message prematurely)
    setCurrentAssistantMessage('');
    assistantContentRef.current = '';
    setThinking('');
    setIsThinking(false);
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

        // Decode chunk and add to buffer
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        
        // Process complete lines (ending with \n\n for SSE)
        const lines = buffer.split('\n');
        // Keep incomplete line in buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          // Skip empty lines and comments
          if (!line.trim() || line.startsWith(':')) continue;
          
          if (line.startsWith('data: ')) {
            try {
              const eventData = line.slice(6).trim();
              if (eventData) {
                const event: StreamEvent = JSON.parse(eventData);
                // Handle events immediately for real-time streaming
                handleStreamEvent(event);
              }
            } catch (e) {
              console.error('Failed to parse event:', e, line);
            }
          }
        }
      }
      
      // Process any remaining data in buffer
      if (buffer.trim()) {
        const lines = buffer.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const eventData = line.slice(6).trim();
              if (eventData) {
                const event: StreamEvent = JSON.parse(eventData);
                handleStreamEvent(event);
              }
            } catch (e) {
              console.error('Failed to parse remaining event:', e, line);
            }
          }
        }
      }
    } catch (error: any) {
      console.error('Chat error:', error);
      addMessage({
        id: `msg-error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        role: 'assistant',
        content: `Error: ${error.message}`,
      });
    } finally {
      setIsStreaming(false);
    }
  };

  const handleDocumentUpdate = async (document_id: string, content: string, title?: string) => {
    try {
      const response = await fetch(`http://localhost:3001/api/chat/documents/${document_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content, title }),
      });

      if (!response.ok) {
        throw new Error('Failed to update document');
      }

      const data = await response.json();
      if (data.document) {
        setCurrentDocument({
          document_id: data.document.document_id,
          content: data.document.content,
          title: data.document.title,
        });
      }
    } catch (error) {
      console.error('Failed to update document:', error);
      throw error;
    }
  };

  const handleStreamEvent = (event: StreamEvent) => {
    switch (event.type) {
      case 'text_delta':
        const delta = event.data?.delta || '';
        if (delta) {
          // Update ref synchronously for access in 'done' handler (avoids closure issues)
          assistantContentRef.current += delta;
          // Update local state for immediate UI update (chunk by chunk)
          // Only update local state during streaming - store is updated on 'done'
          setCurrentAssistantMessage(assistantContentRef.current);
        }
        break;

      case 'thinking_start':
        setIsThinking(true);
        console.log('[ChatPage] Thinking started');
        break;

      case 'thinking_delta':
        const thinkingDelta = event.data?.delta || '';
        if (thinkingDelta) {
          setThinking((prev) => prev + thinkingDelta);
        }
        break;

      case 'thinking_end':
        setIsThinking(false);
        console.log('[ChatPage] Thinking ended');
        break;

      case 'tool_call_start':
        // Only add if it doesn't already exist (avoid duplicates)
        setToolEvents((prev) => {
          const existingIndex = prev.findIndex((e) => (e as any).toolCallId === event.data?.id);
          if (existingIndex >= 0) {
            // Update existing event
            const updated = [...prev];
            updated[existingIndex] = {
              ...updated[existingIndex],
              status: event.data?.status || 'started',
            };
            return updated;
          }
          // Add new event
          return [
            ...prev,
            {
              id: `${event.data?.id || 'tool'}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              name: event.data?.name,
              status: event.data?.status || 'started',
              timestamp: new Date(),
              toolCallId: event.data?.id, // Store original ID for matching updates
            },
          ];
        });
        break;

      case 'tool_call_delta':
        // Handle document data from backend (direct format)
        if (event.data?.document_id && event.data?.content) {
          // Always update to show the latest document (replace current one)
          setCurrentDocument({
            document_id: event.data.document_id,
            content: event.data.content,
            title: event.data.title,
          });
        }
        // Handle document data from LLM provider (delta JSON string format)
        else if (event.data?.delta && event.data?.name === 'createDocument') {
          try {
            const deltaData = JSON.parse(event.data.delta);
            if (deltaData.document_id && deltaData.content) {
              // Always update to show the latest document
              setCurrentDocument({
                document_id: deltaData.document_id,
                content: deltaData.content,
                title: deltaData.title,
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
        // Always show the latest document created/updated
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
        // Use ref to get the actual latest content (avoids closure issues)
        const finalContent = assistantContentRef.current;
        if (finalContent) {
          // Add the final assistant message to the store
          addMessage({
            id: `msg-assistant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            role: 'assistant',
            content: finalContent,
          });
        }
        // Clear streaming state
        assistantContentRef.current = '';
        setCurrentAssistantMessage('');
        setIsThinking(false);
        break;

      case 'error':
        console.error('Stream error:', event.error);
        break;
    }
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm shadow-sm">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
                <span className="text-white font-bold text-sm">D</span>
              </div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
                Delty Chat
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Model:</label>
              <Select value={provider} onValueChange={(value) => setStoreProvider(value as ProviderType)} disabled={isStreaming}>
                <SelectTrigger className="w-36 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
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
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 space-y-6 scroll-smooth min-h-0">
          {messages.length === 0 && !currentAssistantMessage && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-3">
                <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 flex items-center justify-center mx-auto">
                  <span className="text-2xl">💬</span>
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">Welcome to Delty Chat</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Start a conversation to get started</p>
                </div>
              </div>
            </div>
          )}
          {messages.map((msg, index) => (
            <ChatMessage
              key={`${msg.id}-${index}`}
              message={msg}
              isStreaming={false}
            />
          ))}
          {/* Show streaming message while receiving chunks */}
          {isStreaming && currentAssistantMessage && (
            <ChatMessage
              message={{
                id: 'current-streaming',
                role: 'assistant',
                content: currentAssistantMessage,
              }}
              isStreaming={true}
            />
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm p-4">
          <ChatInput onSend={handleSendMessage} disabled={isStreaming} />
        </div>
      </div>

      {/* Side Panels */}
      <div className="w-96 border-l border-slate-200/80 dark:border-slate-800/80 flex flex-col bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm overflow-hidden">
        <ThinkingPanel thinking={thinking} isThinking={isThinking} />
        <ToolEventsPanel events={toolEvents} />
        <DocumentViewer document={currentDocument} onDocumentUpdate={handleDocumentUpdate} />
      </div>
    </div>
  );
}


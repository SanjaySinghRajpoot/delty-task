import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface ChatState {
  conversationId: string;
  messages: Message[];
  currentDocument: { document_id: string; content: string; title?: string } | null;
  provider: 'anthropic' | 'gemini';
  setConversationId: (id: string) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateLastMessage: (content: string) => void;
  setCurrentDocument: (
    document:
      | { document_id: string; content: string; title?: string }
      | null
      | ((prev: { document_id: string; content: string; title?: string } | null) => {
          document_id: string;
          content: string;
          title?: string;
        } | null)
  ) => void;
  setProvider: (provider: 'anthropic' | 'gemini') => void;
  clearChat: () => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      conversationId: `conv-${Date.now()}`,
      messages: [],
      currentDocument: null,
      provider: 'gemini',
      setConversationId: (id) => set({ conversationId: id }),
      setMessages: (messages) => set({ messages }),
      addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
      updateLastMessage: (content) =>
        set((state) => {
          const messages = [...state.messages];
          const lastMessage = messages[messages.length - 1];
          if (lastMessage && lastMessage.role === 'assistant') {
            // Update existing assistant message
            messages[messages.length - 1] = { ...lastMessage, content };
          } else {
            // Create new assistant message if none exists
            // Use a more unique ID to avoid conflicts
            const uniqueId = `msg-assistant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            messages.push({
              id: uniqueId,
              role: 'assistant',
              content,
            });
          }
          return { messages };
        }),
      setCurrentDocument: (document) =>
        set((state) => ({
          currentDocument:
            typeof document === 'function' ? document(state.currentDocument) : document,
        })),
      setProvider: (provider) => set({ provider }),
      clearChat: () =>
        set({
          messages: [],
          currentDocument: null,
          conversationId: `conv-${Date.now()}`,
        }),
    }),
    {
      name: 'chat-storage',
    }
  )
);


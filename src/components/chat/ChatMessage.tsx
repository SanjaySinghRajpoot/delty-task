import { Message } from '@/app/chat/page';

interface ChatMessageProps {
  message: Message;
  isStreaming?: boolean;
}

export function ChatMessage({ message, isStreaming }: ChatMessageProps) {
  return (
    <div
      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[80%] rounded-lg px-4 py-2 ${
          message.role === 'user'
            ? 'bg-blue-500 text-white'
            : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
        }`}
      >
        <div className="text-sm font-medium mb-1 opacity-70">
          {message.role === 'user' ? 'You' : 'Assistant'}
        </div>
        <div className="whitespace-pre-wrap">{message.content}</div>
        {isStreaming && (
          <span className="inline-block w-2 h-4 ml-1 bg-gray-500 animate-pulse" />
        )}
      </div>
    </div>
  );
}


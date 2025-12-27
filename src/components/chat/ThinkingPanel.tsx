'use client';

import { useState, useEffect, useRef } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, Brain, Sparkles } from 'lucide-react';

interface ThinkingPanelProps {
  thinking: string;
  isThinking?: boolean;
}

export function ThinkingPanel({ thinking, isThinking = false }: ThinkingPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Auto-open when thinking starts
  useEffect(() => {
    if (isThinking && thinking) {
      setIsOpen(true);
    }
  }, [isThinking, thinking]);

  // Auto-scroll to bottom when thinking updates
  useEffect(() => {
    if (contentRef.current && isOpen) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [thinking, isOpen]);

  if (!thinking && !isThinking) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border-b border-slate-200/80 dark:border-slate-800/80">
      <CollapsibleTrigger className="w-full flex items-center justify-between p-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
        <div className="flex items-center gap-2">
          {isThinking ? (
            <div className="relative">
              <Brain className="h-4 w-4 text-purple-500 animate-pulse" />
              <Sparkles className="absolute -top-1 -right-1 h-2.5 w-2.5 text-amber-400 animate-bounce" />
            </div>
          ) : (
            <Brain className="h-4 w-4 text-purple-500" />
          )}
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {isThinking ? 'Thinking...' : 'Thought Process'}
          </span>
          {isThinking && (
            <span className="flex gap-0.5">
              <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
          )}
        </div>
        {isOpen ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div 
          ref={contentRef}
          className="p-4 max-h-64 overflow-y-auto overflow-x-hidden scroll-smooth bg-gradient-to-b from-purple-50/50 to-transparent dark:from-purple-950/20"
        >
          <div className="relative">
            {/* Decorative thinking indicator */}
            {isThinking && (
              <div className="absolute -left-1 top-0 bottom-0 w-0.5 bg-gradient-to-b from-purple-500 via-purple-400 to-transparent animate-pulse" />
            )}
            <div className="text-xs font-mono text-slate-600 dark:text-slate-400 whitespace-pre-wrap break-words pl-3 leading-relaxed">
              {thinking || (
                <span className="text-slate-400 dark:text-slate-500 italic">
                  Gathering thoughts...
                </span>
              )}
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

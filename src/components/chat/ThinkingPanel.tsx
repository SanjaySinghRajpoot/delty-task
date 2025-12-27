'use client';

import { useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface ThinkingPanelProps {
  thinking: string;
}

export function ThinkingPanel({ thinking }: ThinkingPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!thinking) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border-b border-slate-200/80 dark:border-slate-800/80">
      <CollapsibleTrigger className="w-full flex items-center justify-between p-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Thinking</span>
        {isOpen ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
      </CollapsibleTrigger>
      <CollapsibleContent className="p-3 max-h-64 overflow-y-auto overflow-x-hidden scroll-smooth">
        <div className="text-xs font-mono text-slate-600 dark:text-slate-400 whitespace-pre-wrap break-words">
          {thinking}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}


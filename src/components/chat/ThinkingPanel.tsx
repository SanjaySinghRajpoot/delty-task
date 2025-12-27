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
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border-b border-gray-200 dark:border-gray-700">
      <CollapsibleTrigger className="w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Thinking</span>
        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </CollapsibleTrigger>
      <CollapsibleContent className="p-3 max-h-64 overflow-y-auto">
        <div className="text-xs font-mono text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
          {thinking}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}


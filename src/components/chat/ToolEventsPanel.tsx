'use client';

import { useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface ToolEvent {
  id: string | number;
  name: string;
  status?: string;
  timestamp?: Date;
  result?: any;
  toolCallId?: string;
}

interface ToolEventsPanelProps {
  events: ToolEvent[];
}

export function ToolEventsPanel({ events }: ToolEventsPanelProps) {
  const [isOpen, setIsOpen] = useState(true);

  if (events.length === 0) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border-b border-slate-200/80 dark:border-slate-800/80">
      <CollapsibleTrigger className="w-full flex items-center justify-between p-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Tool Events ({events.length})
        </span>
        {isOpen ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
      </CollapsibleTrigger>
      <CollapsibleContent className="p-3 max-h-64 overflow-y-auto overflow-x-hidden space-y-2 scroll-smooth">
        {events.map((event, index) => (
          <div
            key={`${event.id}-${index}`}
            className="text-xs p-3 rounded-lg bg-slate-100/50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50"
          >
            <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500"></span>
              {event.name}
            </div>
            <div className="text-slate-600 dark:text-slate-400 mt-1.5">
              Status: <span className="font-medium">{event.status || 'pending'}</span>
            </div>
            {event.result && (
              <div className={`mt-1.5 font-medium ${event.result.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {event.result.success ? '✓ Success' : `✗ ${event.result.error}`}
              </div>
            )}
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}


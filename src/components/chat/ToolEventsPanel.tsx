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
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border-b border-gray-200 dark:border-gray-700">
      <CollapsibleTrigger className="w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Tool Events ({events.length})
        </span>
        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </CollapsibleTrigger>
      <CollapsibleContent className="p-3 max-h-64 overflow-y-auto space-y-2">
        {events.map((event, index) => (
          <div
            key={`${event.id}-${index}`}
            className="text-xs p-2 rounded bg-gray-100 dark:bg-gray-700"
          >
            <div className="font-semibold text-gray-900 dark:text-white">
              {event.name}
            </div>
            <div className="text-gray-600 dark:text-gray-400 mt-1">
              Status: {event.status || 'pending'}
            </div>
            {event.result && (
              <div className="text-gray-600 dark:text-gray-400 mt-1">
                {event.result.success ? '✓ Success' : `✗ ${event.result.error}`}
              </div>
            )}
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}


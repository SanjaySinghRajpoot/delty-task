'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect } from 'react';

interface Document {
  document_id: string;
  content: string;
  title?: string;
}

interface DocumentViewerProps {
  document: Document | null;
}

export function DocumentViewer({ document }: DocumentViewerProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'No document yet. Ask the assistant to create one!',
      }),
    ],
    content: '',
    editable: false, // Read-only for now
    immediatelyRender: false, // Fix SSR hydration mismatch
  });

  useEffect(() => {
    if (document && editor) {
      // Convert markdown/plain text to HTML for Tiptap
      // Simple conversion - in production, use a proper markdown parser
      const htmlContent = document.content
        .split('\n')
        .map((line) => {
          if (line.startsWith('# ')) {
            return `<h1>${line.slice(2)}</h1>`;
          } else if (line.startsWith('## ')) {
            return `<h2>${line.slice(3)}</h2>`;
          } else if (line.startsWith('### ')) {
            return `<h3>${line.slice(4)}</h3>`;
          } else if (line.trim() === '') {
            return '<p><br></p>';
          } else {
            return `<p>${line}</p>`;
          }
        })
        .join('');

      editor.commands.setContent(htmlContent);
    } else if (!document && editor) {
      editor.commands.setContent('');
    }
  }, [document, editor]);

  if (!document) {
    return (
      <div className="flex-1 p-4 text-sm text-gray-500 dark:text-gray-400">
        <div className="text-center mt-8">No document active</div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col border-t border-gray-200 dark:border-gray-700">
      <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="text-sm font-semibold text-gray-900 dark:text-white">
          {document.title || 'Document'}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {document.document_id}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="prose dark:prose-invert max-w-none">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}


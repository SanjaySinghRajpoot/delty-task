'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Save, Loader2 } from 'lucide-react';

interface Document {
  document_id: string;
  content: string;
  title?: string;
}

interface DocumentViewerProps {
  document: Document | null;
  onDocumentUpdate?: (document_id: string, content: string, title?: string) => void;
}

export function DocumentViewer({ document, onDocumentUpdate }: DocumentViewerProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [lastSavedContent, setLastSavedContent] = useState('');

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'No document yet. Ask the assistant to create one!',
      }),
    ],
    content: '',
    editable: true,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      const currentContent = editor.getText();
      if (currentContent !== lastSavedContent) {
        setHasChanges(true);
      }
    },
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
      setLastSavedContent(document.content);
      setHasChanges(false);
    } else if (!document && editor) {
      editor.commands.setContent('');
      setLastSavedContent('');
      setHasChanges(false);
    }
  }, [document, editor]);

  const handleSave = async () => {
    if (!document || !editor || !onDocumentUpdate) return;

    setIsSaving(true);
    try {
      // Get the HTML content from the editor
      const htmlContent = editor.getHTML();
      // For now, save as plain text (we can enhance this later to save HTML)
      const textContent = editor.getText();
      
      await onDocumentUpdate(document.document_id, textContent, document.title);
      setLastSavedContent(textContent);
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to save document:', error);
      alert('Failed to save document. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!document) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 overflow-hidden">
        <div className="text-center space-y-3">
          <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 flex items-center justify-center mx-auto">
            <span className="text-xl">📄</span>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">No document active</p>
            <p className="text-xs text-slate-500 dark:text-slate-500">Ask the assistant to create one!</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col border-t border-slate-200/80 dark:border-slate-800/80 overflow-hidden">
      <div className="flex-shrink-0 p-4 border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
              {document.title || 'Document'}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              {document.document_id}
            </div>
          </div>
          {hasChanges && (
            <Button
              onClick={handleSave}
              disabled={isSaving}
              size="sm"
              className="flex-shrink-0 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-sm"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-3 w-3 mr-1.5" />
                  Save
                </>
              )}
            </Button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 scroll-smooth min-h-0">
        <div className="prose prose-slate dark:prose-invert max-w-none h-full">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}


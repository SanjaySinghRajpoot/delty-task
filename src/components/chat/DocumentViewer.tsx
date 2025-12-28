'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Save, Loader2 } from 'lucide-react';
import { marked } from 'marked';

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
  // Track the last document content to avoid unnecessary updates
  const lastDocumentContentRef = useRef<string>('');

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

  // Convert content to HTML for TipTap
  const convertToHtml = (content: string): string => {
    try {
      // Check if content looks like markdown (has markdown syntax)
      const hasMarkdownSyntax = /^#{1,6}\s|^\*\s|^-\s|^\d+\.\s|^\*\*|^__|^`|^>/m.test(content);
      
      if (hasMarkdownSyntax) {
        // Use marked to parse markdown (synchronous mode)
        const result = marked.parse(content, {
          breaks: true,
          gfm: true,
          async: false, // Force synchronous mode
        });
        return typeof result === 'string' ? result : content;
      } else {
        // Plain text - convert line breaks to paragraphs
        return content
          .split('\n')
          .map((line) => {
            if (line.trim() === '') {
              return '<p><br></p>';
            }
            // Escape HTML entities to prevent XSS
            const escaped = line
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;');
            return `<p>${escaped}</p>`;
          })
          .join('');
      }
    } catch (error) {
      console.error('Error parsing markdown:', error);
      // Fallback to simple text conversion
      return content
        .split('\n')
        .map((line) => {
          if (line.trim() === '') {
            return '<p><br></p>';
          }
          return `<p>${line}</p>`;
        })
        .join('');
    }
  };

  // Update editor when document content changes
  useEffect(() => {
    if (!editor) return;

    if (document) {
      // Only update if content actually changed (compare with ref to avoid unnecessary updates)
      if (document.content !== lastDocumentContentRef.current) {
        const htmlContent = convertToHtml(document.content);
        editor.commands.setContent(htmlContent);
        lastDocumentContentRef.current = document.content;
        setLastSavedContent(document.content);
        setHasChanges(false);
      }
    } else {
      // Clear document
      if (lastDocumentContentRef.current !== '') {
        editor.commands.setContent('');
        lastDocumentContentRef.current = '';
        setLastSavedContent('');
        setHasChanges(false);
      }
    }
  }, [document?.content, document?.document_id, editor]);

  const handleSave = async () => {
    if (!document || !editor || !onDocumentUpdate) return;

    setIsSaving(true);
    try {
      // Get the HTML content from the editor
      const htmlContent = editor.getHTML();
      // Convert HTML back to markdown for storage (preserves formatting better)
      // For now, save as plain text but preserve line breaks
      const textContent = editor.getText();
      
      // Save the content - backend will store it as-is
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


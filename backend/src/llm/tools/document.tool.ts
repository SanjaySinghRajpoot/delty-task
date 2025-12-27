import { ToolDefinition } from '../types';
import { DocumentModel } from '../../models/document.model';

export const documentToolDefinitions: ToolDefinition[] = [
  {
    name: 'createDocument',
    description: 'Create a new document with the given title and content. Use this when the user asks to create a document.',
    parameters: {
      type: 'object',
      properties: {
        document_id: {
          type: 'string',
          description: 'A unique identifier for the document (e.g., "doc-1", "jokes-document")',
        },
        title: {
          type: 'string',
          description: 'The title of the document',
        },
        content: {
          type: 'string',
          description: 'The full content of the document',
        },
      },
      required: ['document_id', 'content'],
    },
  },
  {
    name: 'updateDocument',
    description: 'Update an existing document by appending or modifying its content. Use this when the user asks to update or add to a document.',
    parameters: {
      type: 'object',
      properties: {
        document_id: {
          type: 'string',
          description: 'The unique identifier of the document to update',
        },
        content: {
          type: 'string',
          description: 'The new or additional content for the document',
        },
        title: {
          type: 'string',
          description: 'Optional: Update the document title',
        },
      },
      required: ['document_id', 'content'],
    },
  },
];

export interface DocumentToolResult {
  success: boolean;
  document_id: string;
  content?: string;
  error?: string;
}

export async function executeDocumentTool(
  toolName: string,
  args: Record<string, any>
): Promise<DocumentToolResult> {
  try {
    if (toolName === 'createDocument') {
      const { document_id, title, content } = args;
      if (!document_id || !content) {
        return {
          success: false,
          document_id: document_id || 'unknown',
          error: 'document_id and content are required',
        };
      }

      const doc = await DocumentModel.create({
        document_id,
        title,
        content,
      });

      return {
        success: true,
        document_id: doc.document_id,
        content: doc.content,
      };
    } else if (toolName === 'updateDocument') {
      const { document_id, content, title } = args;
      if (!document_id || !content) {
        return {
          success: false,
          document_id: document_id || 'unknown',
          error: 'document_id and content are required',
        };
      }

      const existing = await DocumentModel.findByDocumentId(document_id);
      if (existing) {
        // Append to existing content
        const updatedContent = existing.content + '\n\n' + content;
        const doc = await DocumentModel.update(document_id, {
          content: updatedContent,
          title,
        });

        return {
          success: true,
          document_id: doc!.document_id,
          content: doc!.content,
        };
      } else {
        // Create if doesn't exist
        const doc = await DocumentModel.create({
          document_id,
          title,
          content,
        });

        return {
          success: true,
          document_id: doc.document_id,
          content: doc.content,
        };
      }
    } else {
      return {
        success: false,
        document_id: 'unknown',
        error: `Unknown tool: ${toolName}`,
      };
    }
  } catch (error: any) {
    return {
      success: false,
      document_id: args.document_id || 'unknown',
      error: error.message || 'Tool execution failed',
    };
  }
}


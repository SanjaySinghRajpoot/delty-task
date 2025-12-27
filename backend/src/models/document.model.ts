import { pool } from '../utils/db';

export interface Document {
  id: number;
  document_id: string;
  title: string | null;
  content: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateDocumentDto {
  document_id: string;
  title?: string;
  content: string;
}

export interface UpdateDocumentDto {
  content: string;
  title?: string;
}

export class DocumentModel {
  static async findByDocumentId(documentId: string): Promise<Document | null> {
    const result = await pool.query(
      'SELECT * FROM documents WHERE document_id = $1',
      [documentId]
    );
    return result.rows[0] || null;
  }

  static async create(data: CreateDocumentDto): Promise<Document> {
    const result = await pool.query(
      'INSERT INTO documents (document_id, title, content) VALUES ($1, $2, $3) RETURNING *',
      [data.document_id, data.title || null, data.content]
    );
    return result.rows[0];
  }

  static async update(documentId: string, data: UpdateDocumentDto): Promise<Document | null> {
    const result = await pool.query(
      'UPDATE documents SET content = $1, title = COALESCE($2, title), updated_at = CURRENT_TIMESTAMP WHERE document_id = $3 RETURNING *',
      [data.content, data.title || null, documentId]
    );
    return result.rows[0] || null;
  }

  static async upsert(data: CreateDocumentDto): Promise<Document> {
    const existing = await this.findByDocumentId(data.document_id);
    if (existing) {
      return (await this.update(data.document_id, { content: data.content, title: data.title }))!;
    }
    return await this.create(data);
  }
}


import { pool } from '../utils/db';

export interface Message {
  id: number;
  conversation_id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  created_at: Date;
}

export interface CreateMessageDto {
  conversation_id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class MessageModel {
  static async findByConversationId(conversationId: string): Promise<Message[]> {
    const result = await pool.query(
      'SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC',
      [conversationId]
    );
    return result.rows;
  }

  static async create(data: CreateMessageDto): Promise<Message> {
    const result = await pool.query(
      'INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3) RETURNING *',
      [data.conversation_id, data.role, data.content]
    );
    return result.rows[0];
  }
}


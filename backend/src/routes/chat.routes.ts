import { Router } from 'express';
import { ChatController } from '../controllers/chat.controller';

const router = Router();

// POST /api/chat/stream - Stream chat response
router.post('/stream', ChatController.streamChat);

// GET /api/chat/messages/:conversation_id - Get conversation history
router.get('/messages/:conversation_id', ChatController.getMessages);

// GET /api/chat/documents/:document_id - Get document
router.get('/documents/:document_id', ChatController.getDocument);

// PUT /api/chat/documents/:document_id - Update document
router.put('/documents/:document_id', ChatController.updateDocument);

export default router;


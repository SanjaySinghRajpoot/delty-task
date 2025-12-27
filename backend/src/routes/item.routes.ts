import { Router } from 'express';
import { ItemController } from '../controllers/item.controller';

const router = Router();

// GET /api/items - Get all items
router.get('/', ItemController.getAllItems);

// GET /api/items/:id - Get item by ID
router.get('/:id', ItemController.getItemById);

// POST /api/items - Create a new item
router.post('/', ItemController.createItem);

// PUT /api/items/:id - Update an item
router.put('/:id', ItemController.updateItem);

// DELETE /api/items/:id - Delete an item
router.delete('/:id', ItemController.deleteItem);

export default router;


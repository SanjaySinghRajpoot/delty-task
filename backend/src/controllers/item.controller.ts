import { Request, Response } from 'express';
import { ItemModel } from '../models/item.model';
import { CreateItemDto, UpdateItemDto } from '../types/item.types';

export class ItemController {
  static getAllItems(_req: Request, res: Response): void {
    try {
      const items = ItemModel.findAll();
      res.status(200).json({
        success: true,
        data: items,
        count: items.length,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch items',
      });
    }
  }

  static getItemById(req: Request, res: Response): void {
    try {
      const { id } = req.params;
      const item = ItemModel.findById(id);

      if (!item) {
        res.status(404).json({
          success: false,
          error: 'Item not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: item,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch item',
      });
    }
  }

  static createItem(req: Request, res: Response): void {
    try {
      const data: CreateItemDto = req.body;

      // Basic validation
      if (!data.name || data.name.trim() === '') {
        res.status(400).json({
          success: false,
          error: 'Name is required',
        });
        return;
      }

      const newItem = ItemModel.create(data);
      res.status(201).json({
        success: true,
        data: newItem,
        message: 'Item created successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to create item',
      });
    }
  }

  static updateItem(req: Request, res: Response): void {
    try {
      const { id } = req.params;
      const data: UpdateItemDto = req.body;

      const updatedItem = ItemModel.update(id, data);

      if (!updatedItem) {
        res.status(404).json({
          success: false,
          error: 'Item not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: updatedItem,
        message: 'Item updated successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to update item',
      });
    }
  }

  static deleteItem(req: Request, res: Response): void {
    try {
      const { id } = req.params;
      const deleted = ItemModel.delete(id);

      if (!deleted) {
        res.status(404).json({
          success: false,
          error: 'Item not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Item deleted successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to delete item',
      });
    }
  }
}


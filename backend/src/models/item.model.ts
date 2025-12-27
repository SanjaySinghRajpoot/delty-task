import { Item, CreateItemDto, UpdateItemDto } from '../types/item.types';

// In-memory storage (replace with actual database in production)
let items: Item[] = [];
let nextId = 1;

export class ItemModel {
  static findAll(): Item[] {
    return items;
  }

  static findById(id: string): Item | undefined {
    return items.find(item => item.id === id);
  }

  static create(data: CreateItemDto): Item {
    const newItem: Item = {
      id: String(nextId++),
      name: data.name,
      description: data.description,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    items.push(newItem);
    return newItem;
  }

  static update(id: string, data: UpdateItemDto): Item | null {
    const itemIndex = items.findIndex(item => item.id === id);
    if (itemIndex === -1) {
      return null;
    }

    const updatedItem: Item = {
      ...items[itemIndex],
      ...data,
      updatedAt: new Date(),
    };
    items[itemIndex] = updatedItem;
    return updatedItem;
  }

  static delete(id: string): boolean {
    const itemIndex = items.findIndex(item => item.id === id);
    if (itemIndex === -1) {
      return false;
    }
    items.splice(itemIndex, 1);
    return true;
  }
}


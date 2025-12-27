export interface Item {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateItemDto {
  name: string;
  description?: string;
}

export interface UpdateItemDto {
  name?: string;
  description?: string;
}


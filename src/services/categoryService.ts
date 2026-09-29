import { api } from './api';
import type { CategoryItem } from '../types/admin';
import type { PropertyType } from '../types/property';

export interface CategoryInput {
  id?: string;
  nameAr: string;
  nameEn: string;
  type: PropertyType;
  tags: string[];
}

export const categoryService = {
  async list(signal?: AbortSignal): Promise<CategoryItem[]> {
    return api.get<CategoryItem[]>('/api/categories', { signal });
  },

  async create(category: CategoryInput): Promise<CategoryItem> {
    return api.post<CategoryItem>('/api/categories', category);
  },

  async update(id: string, category: CategoryInput | Omit<CategoryInput, 'id'>): Promise<CategoryItem> {
    return api.put<CategoryItem>(`/api/categories/${encodeURIComponent(id)}`, category);
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/api/categories/${encodeURIComponent(id)}`);
  },
};

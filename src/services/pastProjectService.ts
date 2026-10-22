import { api, resolveMediaUrl } from './api';

export interface PastProject {
  id: number;
  title: string;
  titleEn: string | null;
  category: string | null;
  categoryEn: string | null;
  image: string;
  gallery: string[];
  pdfUrl: string | null;
  description: string | null;
  descriptionEn: string | null;
  sortOrder: number;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PastProjectInput {
  title: string;
  titleEn?: string | null;
  category?: string | null;
  categoryEn?: string | null;
  image: string;
  gallery?: string[];
  pdfUrl?: string | null;
  description?: string | null;
  descriptionEn?: string | null;
  sortOrder?: number;
  published?: boolean;
}

export const pastProjectService = {
  async list(signal?: AbortSignal): Promise<PastProject[]> {
    const data = await api.get<PastProject[]>('/api/past-projects', { signal });
    return (data ?? []).map((p) => ({ ...p, image: resolveMediaUrl(p.image), gallery: (p.gallery ?? []).map(resolveMediaUrl), pdfUrl: p.pdfUrl ? resolveMediaUrl(p.pdfUrl) : null }));
  },
  async listAdmin(signal?: AbortSignal): Promise<PastProject[]> {
    const data = await api.get<PastProject[]>('/api/past-projects/admin', { signal });
    return (data ?? []).map((p) => ({ ...p, image: resolveMediaUrl(p.image), gallery: (p.gallery ?? []).map(resolveMediaUrl), pdfUrl: p.pdfUrl ? resolveMediaUrl(p.pdfUrl) : null }));
  },
  async create(input: PastProjectInput): Promise<PastProject> {
    const data = await api.post<PastProject>('/api/past-projects', input);
    return { ...data, image: resolveMediaUrl(data.image), gallery: (data.gallery ?? []).map(resolveMediaUrl), pdfUrl: data.pdfUrl ? resolveMediaUrl(data.pdfUrl) : null };
  },
  async update(id: number, input: Partial<PastProjectInput>): Promise<PastProject> {
    const data = await api.put<PastProject>(`/api/past-projects/${id}`, input);
    return { ...data, image: resolveMediaUrl(data.image), gallery: (data.gallery ?? []).map(resolveMediaUrl), pdfUrl: data.pdfUrl ? resolveMediaUrl(data.pdfUrl) : null };
  },
  async remove(id: number): Promise<void> {
    await api.delete(`/api/past-projects/${id}`);
  },
  async setPublished(id: number, published: boolean): Promise<PastProject> {
    const data = await api.patch<PastProject>(`/api/past-projects/${id}/published`, { published });
    return { ...data, image: resolveMediaUrl(data.image), gallery: (data.gallery ?? []).map(resolveMediaUrl), pdfUrl: data.pdfUrl ? resolveMediaUrl(data.pdfUrl) : null };
  },
};
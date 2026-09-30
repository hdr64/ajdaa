import { api } from './api';
import { downloadFile, todayStamp } from './download';
import type { CustomerInquiry, InterestType } from '../types/property';

export type InquiryStatus = 'new' | 'contacted' | 'closed';

const INQUIRY_STATUSES: readonly InquiryStatus[] = ['new', 'contacted', 'closed'];
const INTEREST_TYPES: readonly InterestType[] = ['rent', 'buy', 'invest', 'general'];

interface InquiryDto {
  id: string;
  createdAt: string;
  updatedAt?: string;
  name: string;
  phone: string | null;
  email: string | null;
  projectId: number | null;
  projectTitle: string | null;
  unitId: string | null;
  unitNumber: string | null;
  interestType: string;
  interestTypeAr: string;
  message: string | null;
  notes: string | null;
  status: string;
  statusAr: string;
}

export interface InquiryInput {
  name: string;
  phone?: string | null;
  email?: string | null;
  projectId?: number | null;
  projectTitle?: string | null;
  unitId?: string | null;
  unitNumber?: string | null;
  interestType: InterestType;
  message?: string | null;
  /** Honeypot field; must stay empty for real visitors. */
  website?: string;
  /** How long the form was open, in milliseconds. */
  elapsedMs?: number;
}

export type InquiryFilters = {
  status?: InquiryStatus;
  projectId?: number;
};

export interface InquiryCreatedEvent extends CustomerInquiry {}

function toInquiry(dto: InquiryDto): CustomerInquiry {
  return {
    id: dto.id,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    name: dto.name,
    phone: dto.phone ?? undefined,
    email: dto.email ?? undefined,
    projectId: dto.projectId ?? undefined,
    projectTitle: dto.projectTitle ?? undefined,
    unitId: dto.unitId ?? undefined,
    unitNumber: dto.unitNumber ?? undefined,
    interestType: (INTEREST_TYPES as readonly string[]).includes(dto.interestType)
      ? (dto.interestType as InterestType)
      : 'general',
    interestTypeAr: dto.interestTypeAr,
    message: dto.message ?? undefined,
    notes: dto.notes ?? null,
    status: (INQUIRY_STATUSES as readonly string[]).includes(dto.status)
      ? (dto.status as InquiryStatus)
      : 'new',
    statusAr: dto.statusAr,
  };
}

/** The server derives `interestTypeAr` from the enum, so only the code is sent. */
function toPayload(input: InquiryInput) {
  return {
    name: input.name.trim(),
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    projectId: input.projectId ?? null,
    projectTitle: input.projectTitle ?? null,
    unitId: input.unitId ?? null,
    unitNumber: input.unitNumber ?? null,
    interestType: input.interestType,
    message: input.message?.trim() || null,
    website: input.website || null,
    elapsedMs: input.elapsedMs ?? null,
  };
}

export const inquiryService = {
  /** Public lead submission. */
  async submit(input: InquiryInput): Promise<CustomerInquiry> {
    const created = await api.post<InquiryDto>('/api/inquiries', toPayload(input));
    return toInquiry(created);
  },

  async list(filters: InquiryFilters = {}, signal?: AbortSignal): Promise<CustomerInquiry[]> {
    const inquiries = await api.get<InquiryDto[]>('/api/inquiries', { query: filters, signal });
    return inquiries.map(toInquiry);
  },

  async updateStatus(id: string, status: InquiryStatus): Promise<CustomerInquiry> {
    const updated = await api.patch<InquiryDto>(`/api/inquiries/${encodeURIComponent(id)}/status`, { status });
    return toInquiry(updated);
  },

  async updateInquiry(
    id: string,
    data: { notes?: string | null; status?: InquiryStatus }
  ): Promise<CustomerInquiry> {
    const updated = await api.patch<InquiryDto>(`/api/inquiries/${encodeURIComponent(id)}`, data);
    return toInquiry(updated);
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/api/inquiries/${encodeURIComponent(id)}`);
  },

  async exportCsv(filters: InquiryFilters = {}): Promise<void> {
    await downloadFile('/api/inquiries/export', `inquiries-${todayStamp()}.csv`, {
      status: filters.status,
      projectId: filters.projectId,
    });
  },
};

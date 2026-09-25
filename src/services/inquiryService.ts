import { api } from './api';
import type { CustomerInquiry, InterestType } from '../types/property';

export type InquiryStatus = 'new' | 'contacted' | 'closed';

const INQUIRY_STATUSES: readonly InquiryStatus[] = ['new', 'contacted', 'closed'];
const INTEREST_TYPES: readonly InterestType[] = ['rent', 'buy', 'invest', 'general'];

interface InquiryDto {
  id: string;
  createdAt: string;
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
};

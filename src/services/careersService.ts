import { api, getAuthToken, resolveMediaUrl } from './api';

export interface CareersFormConfig {
  required: {
    name: boolean;
    email: boolean;
    phone: boolean;
    jobTitle: boolean;
    message: boolean;
    cv: boolean;
  };
}

export interface JobApplicationListItem {
  id: string;
  name: string;
  email: string;
  phone: string;
  jobTitle: string;
  status: string;
  statusAr?: string;
  createdAt: string;
  updatedAt: string;
  hasCv: boolean;
}

export interface JobApplicationDetail extends JobApplicationListItem {
  message: string | null;
  cvOriginalName: string | null;
  adminNote: string | null;
}

export interface ApplicationsPage {
  items: JobApplicationListItem[];
  total: number;
  page: number;
  limit: number;
}

export const careersService = {
  getFormConfig: () => api.get<CareersFormConfig>('/careers/form'),

  submitApplication: (formData: FormData) =>
    api.upload<{ ok: boolean }>('/careers/applications', formData),

  listApplications: (params: { status?: string; q?: string; page?: number; limit?: number }) =>
    api.get<ApplicationsPage>('/careers/applications', { query: params }),

  getApplication: (id: string) => api.get<JobApplicationDetail>(`/careers/applications/${id}`),

  downloadCv: async (id: string, filename?: string) => {
    const token = getAuthToken();
    // resolveMediaUrl prefixes VITE_API_BASE_URL like every other API call.
    const response = await fetch(resolveMediaUrl(`/api/careers/applications/${id}/cv`), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) throw new Error('Download failed');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'cv.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  updateApplication: (id: string, body: { status?: string; adminNote?: string | null }) =>
    api.patch<JobApplicationDetail>(`/careers/applications/${id}`, body),

  deleteApplication: (id: string) => api.delete(`/careers/applications/${id}`),

  getSettings: () => api.get<{ required: CareersFormConfig['required']; notificationEmails: string[] }>('/careers/settings'),

  updateSettings: (body: { required?: Partial<CareersFormConfig['required']>; notificationEmails?: string[] }) =>
    api.put('/careers/settings', body),
};

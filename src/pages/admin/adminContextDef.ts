import { createContext, useContext } from 'react';
import type { Property, CustomerInquiry } from '../../types/property';
import type { AdminPermissions, AdminUser } from '../../types/admin';
import type { AsyncResource } from '../../hooks/useAsyncData';
import type { AdminLocation } from './adminRoutes';

export type AdminPermission = keyof AdminPermissions;

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  /** Destructive actions get a red confirm button. */
  danger?: boolean;
}

export interface AdminContextValue {
  currentUser: AdminUser | null;
  /** super_admin implicitly holds every permission, mirroring the server. */
  can: (permission: AdminPermission) => boolean;
  isSuperAdmin: boolean;

  projects: AsyncResource<Property[]>;
  inquiries: AsyncResource<CustomerInquiry[]>;
  realtimeConnected: boolean;

  location: AdminLocation;
  navigate: (location: AdminLocation, options?: { replace?: boolean }) => void;

  showToast: (message: string) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  refreshAll: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setCurrentUser: (user: AdminUser | null) => void;
}

export const AdminContext = createContext<AdminContextValue | null>(null);

export function useAdmin(): AdminContextValue {
  const value = useContext(AdminContext);
  if (!value) throw new Error('useAdmin must be used inside the admin dashboard');
  return value;
}

/** DOM node inside the page header where sections portal their primary actions. */
export const HeaderActionsSlotContext = createContext<HTMLElement | null>(null);

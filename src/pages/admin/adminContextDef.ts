import { createContext, useContext } from 'react';
import type { ConfirmAction } from '../../services/authService';
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
  /**
   * Offers "don't ask again" for this reversible action type. Once chosen, later
   * confirms with the same key resolve true without a dialog. Never pass it for
   * permanent deletes (the server only accepts the reversible toggles anyway).
   */
  rememberKey?: ConfirmAction;
}

export interface DeleteConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
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
  /**
   * The one way to confirm a delete or removal: always asks (never remembered),
   * red button, and warns it cannot be undone unless `message` says otherwise.
   */
  confirmDelete: (options: DeleteConfirmOptions) => Promise<boolean>;
  /** Actions this admin chose "don't ask again" for; the profile page can reset them. */
  skipConfirm: ConfirmAction[];
  setSkipConfirm: (actions: ConfirmAction[]) => Promise<void>;
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

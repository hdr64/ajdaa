import { authService, type AuthSession } from './authService';
import { inquiryService, type InquiryFilters, type InquiryInput, type InquiryStatus } from './inquiryService';
import {
  propertyService,
  toUnitInput,
  type UnitInput,
} from './propertyService';
import { categoryService, type CategoryInput } from './categoryService';
import { ApiError } from './api';
import type {
  CustomerInquiry,
  Property,
  PropertyFloor,
  PropertyUnit,
  UnitStatus,
} from '../types/property';
import type { AdminUser, AdminUserInput, CategoryItem, AdminStatus } from '../types/admin';

export type { AdminUser, AdminUserInput, CategoryItem, AdminStatus } from '../types/admin';

const CATEGORIES_KEY = 'ajdaa_categories';

/**
 * Categories have no API resource yet (see `server/src/routes`), so they remain
 * browser-local. Everything else in this facade is backed by the live API and
 * every method is asynchronous — the previous localStorage implementation was
 * synchronous, which is why all call sites now load inside effects.
 */

const DEFAULT_CATEGORIES: CategoryItem[] = [
  {
    id: 'cat-commercial',
    nameAr: 'مجمعات ومراكز تجارية',
    nameEn: 'Commercial Complexes & Centers',
    type: 'commercial',
    tags: ['طريق الملك فهد', 'واجهات زجاجية', 'صالات عرض', 'معارض تجارية', 'مطاعم وكافيهات'],
  },
  {
    id: 'cat-office',
    nameAr: 'مباني وأبراج إدارية',
    nameEn: 'Corporate Buildings & Towers',
    type: 'office',
    tags: ['مقرات شركات', 'مكاتب تنفيذية', 'قاعات مؤتمرات', 'تراسات خارجية', 'ألياف بصرية'],
  },
  {
    id: 'cat-logistics',
    nameAr: 'مستودعات ومخازن لوجستية',
    nameEn: 'Logistics Hubs & Warehouses',
    type: 'logistics',
    tags: ['سلاسل إمداد', 'مستودعات مبردة', 'أرصفة هيدروليكية', 'شحن وتفريغ', 'أمن 24/7'],
  },
  {
    id: 'cat-residential',
    nameAr: 'مجمعات سكنية فاخرة',
    nameEn: 'Luxury Residential Compounds',
    type: 'residential',
    tags: ['شقق فاخرة', 'أدوار متكررة', 'بنتهاوس', 'مسابح وحدائق', 'مواقف خاصة'],
  },
  {
    id: 'cat-hotel',
    nameAr: 'فنادق وأجنحة فندقية',
    nameEn: 'Hotels & Hotel Suites',
    type: 'hotel',
    tags: ['أجنحة فندقية', 'غرف ضيافة', 'مرافق رياضية', 'مطاعم', 'واي فاي مجاني'],
  },
];

function readLocalCategories(): CategoryItem[] {
  try {
    const stored = window.localStorage.getItem(CATEGORIES_KEY);
    if (!stored) {
      window.localStorage.setItem(CATEGORIES_KEY, JSON.stringify(DEFAULT_CATEGORIES));
      return DEFAULT_CATEGORIES;
    }
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? (parsed as CategoryItem[]) : DEFAULT_CATEGORIES;
  } catch {
    return DEFAULT_CATEGORIES;
  }
}

export const AdminStorage = {
  /* ------------------------------- Auth ---------------------------------- */

  /**
   * Synchronous presence check for the router only. The token is verified against
   * `/api/auth/me` before the dashboard renders anything.
   */
  isAuthenticated(): boolean {
    return authService.hasToken();
  },

  async login(email: string, password: string): Promise<AuthSession> {
    return authService.login(email, password);
  },

  async getCurrentUser(): Promise<AdminUser> {
    return authService.me();
  },

  logout(): void {
    authService.logout();
  },

  /* ----------------------------- Projects -------------------------------- */

  getAllProjects(filters?: Parameters<typeof propertyService.list>[0], signal?: AbortSignal): Promise<Property[]> {
    return propertyService.list(filters ?? {}, signal);
  },

  /** Resolves to `undefined` instead of throwing so callers can render a 404 state. */
  async getProjectById(id: number, signal?: AbortSignal): Promise<Property | undefined> {
    try {
      return await propertyService.getById(id, signal);
    } catch (error) {
      if (error instanceof ApiError && error.isNotFound) return undefined;
      throw error;
    }
  },

  /** Creates the project together with the supplied floors and units. */
  createProject(project: Property, floors: PropertyFloor[] = []): Promise<Property> {
    return propertyService.createWithStructure(project, floors);
  },

  updateProject(id: number, project: Property): Promise<Property> {
    return propertyService.update(id, project);
  },

  async deleteProject(projectId: number): Promise<void> {
    await propertyService.remove(projectId);
  },

  /* ------------------------------ Floors --------------------------------- */

  async addFloorToProject(projectId: number, floorName: string): Promise<Property> {
    const project = await propertyService.getById(projectId);
    const nextNumber = (project.floors ?? []).reduce((max, floor) => Math.max(max, floor.floorNumber), -1) + 1;

    await propertyService.createFloor(projectId, {
      floorNumber: nextNumber,
      floorNameAr: floorName,
      floorNameEn: `Floor ${nextNumber}`,
    });

    return propertyService.getById(projectId);
  },

  async deleteFloorFromProject(projectId: number, floorNumber: number): Promise<Property> {
    await propertyService.removeFloor(projectId, floorNumber);
    return propertyService.getById(projectId);
  },

  /* ------------------------------- Units --------------------------------- */

  async addUnitToProject(projectId: number, floor: PropertyFloor, unit: PropertyUnit): Promise<Property> {
    if (typeof floor.id !== 'number') {
      throw new Error('Cannot add a unit to a floor that has not been saved yet.');
    }
    await propertyService.createUnit(toUnitInput(unit, floor.id));
    return propertyService.getById(projectId);
  },

  async updateUnitInProject(projectId: number, floor: PropertyFloor, unit: PropertyUnit): Promise<Property> {
    if (typeof floor.id !== 'number') {
      throw new Error('Cannot update a unit on a floor that has not been saved yet.');
    }
    const payload: Partial<UnitInput> = toUnitInput(unit, floor.id);
    delete payload.id;
    delete payload.floorId;
    await propertyService.updateUnit(unit.id, payload);
    return propertyService.getById(projectId);
  },

  async deleteUnitFromProject(projectId: number, unitId: string): Promise<Property> {
    await propertyService.removeUnit(unitId);
    return propertyService.getById(projectId);
  },

  /** Persists the status server-side; the server then broadcasts it to every tab. */
  async updateUnitStatus(unitId: string, newStatus: UnitStatus): Promise<void> {
    await propertyService.updateUnitStatus(unitId, newStatus);
  },

  /* ----------------------------- Inquiries ------------------------------- */

  getInquiries(filters?: InquiryFilters, signal?: AbortSignal): Promise<CustomerInquiry[]> {
    return inquiryService.list(filters ?? {}, signal);
  },

  addInquiry(input: InquiryInput) {
    return inquiryService.submit(input);
  },

  async updateInquiryStatus(id: string, status: InquiryStatus): Promise<void> {
    await inquiryService.updateStatus(id, status);
  },

  updateInquiry(id: string, data: { notes?: string | null; status?: InquiryStatus }): Promise<CustomerInquiry> {
    return inquiryService.updateInquiry(id, data);
  },

  deleteInquiry(id: string): Promise<void> {
    return inquiryService.remove(id);
  },

  exportInquiriesCsv(filters?: InquiryFilters): Promise<void> {
    return inquiryService.exportCsv(filters);
  },

  /* ---------------------- Categories (local only) ------------------------ */

  getCategories(): CategoryItem[] {
    return readLocalCategories();
  },

  saveCategories(categories: CategoryItem[]): void {
    try {
      window.localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
    } catch {
      // Storage unavailable: keep the in-memory value the caller already has.
    }
  },

  listCategories(signal?: AbortSignal): Promise<CategoryItem[]> {
    return categoryService.list(signal);
  },

  createCategory(category: CategoryInput): Promise<CategoryItem> {
    return categoryService.create(category);
  },

  updateCategory(id: string, category: CategoryInput): Promise<CategoryItem> {
    return categoryService.update(id, category);
  },

  deleteCategory(id: string): Promise<void> {
    return categoryService.remove(id);
  },

  /* ------------------------------- Users --------------------------------- */

  getUsers(signal?: AbortSignal): Promise<AdminUser[]> {
    return authService.listUsers(signal);
  },

  createUser(input: AdminUserInput): Promise<AdminUser> {
    return authService.createUser(input);
  },

  updateUser(id: string, input: Partial<AdminUserInput>): Promise<AdminUser> {
    return authService.updateUser(id, input);
  },

  async deleteUser(userId: string): Promise<void> {
    await authService.deleteUser(userId);
  },

  setUserStatus(userId: string, status: AdminStatus): Promise<AdminUser> {
    return authService.setUserStatus(userId, status);
  },
};

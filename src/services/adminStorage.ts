import type { Property, PropertyUnit, UnitStatus, CustomerInquiry, PropertyType } from '../types/property';
import { properties as initialProperties } from '../data/properties';

const AUTH_KEY = 'ajdaa_admin_authenticated';
const PROJECTS_KEY = 'ajdaa_custom_projects';
const INQUIRIES_KEY = 'ajdaa_customer_inquiries';
const STATUS_OVERRIDES_KEY = 'ajdaa_unit_status_overrides';
const CATEGORIES_KEY = 'ajdaa_categories';
const USERS_KEY = 'ajdaa_admin_users';

export interface CategoryItem {
  id: string;
  nameAr: string;
  nameEn: string;
  type: PropertyType;
  tags: string[];
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'super_admin' | 'project_manager' | 'sales_agent' | 'viewer';
  roleAr: string;
  department: string;
  permissions: {
    manageProjects: boolean;
    manageUnits: boolean;
    viewInquiries: boolean;
    exportData: boolean;
    manageUsers: boolean;
  };
  lastLogin?: string;
  status: 'active' | 'suspended';
}

const DEFAULT_USERS: AdminUser[] = [
  {
    id: 'usr-1',
    name: 'سلطان المقرن',
    email: 'admin@ajdaa.sa',
    role: 'super_admin',
    roleAr: 'مدير عام النظام (Super Admin)',
    department: 'الإدارة التنفيذية',
    permissions: {
      manageProjects: true,
      manageUnits: true,
      viewInquiries: true,
      exportData: true,
      manageUsers: true,
    },
    lastLogin: 'الآن',
    status: 'active',
  },
  {
    id: 'usr-2',
    name: 'م. فهد السديري',
    email: 'f.sudairy@ajdaa.sa',
    role: 'project_manager',
    roleAr: 'مدير التطوير والمشاريع',
    department: 'التطوير الهندسي',
    permissions: {
      manageProjects: true,
      manageUnits: true,
      viewInquiries: true,
      exportData: true,
      manageUsers: false,
    },
    lastLogin: 'منذ ساعتين',
    status: 'active',
  },
  {
    id: 'usr-3',
    name: 'ريم القحطاني',
    email: 'reem.q@ajdaa.sa',
    role: 'sales_agent',
    roleAr: 'مسؤول تأجير ومبيعات',
    department: 'إدارة الاستثمار والمبيعات',
    permissions: {
      manageProjects: false,
      manageUnits: true,
      viewInquiries: true,
      exportData: false,
      manageUsers: false,
    },
    lastLogin: 'أمس، 4:30 م',
    status: 'active',
  },
  {
    id: 'usr-4',
    name: 'تركي الدوسري',
    email: 'turki.d@ajdaa.sa',
    role: 'viewer',
    roleAr: 'محلل استثماري ومتابع',
    department: 'التخطيط والتحليل',
    permissions: {
      manageProjects: false,
      manageUnits: false,
      viewInquiries: true,
      exportData: true,
      manageUsers: false,
    },
    lastLogin: 'منذ 3 أيام',
    status: 'active',
  },
];

const DEFAULT_CATEGORIES: CategoryItem[] = [
  {
    id: 'cat-commercial',
    nameAr: 'مجمعات ومراكز تجارية',
    nameEn: 'Commercial Complexes & Centers',
    type: 'commercial',
    tags: ['طريق الملك فهد', 'واجهات زجاجية', 'صالات عرض', 'معارض تجارية', 'مطاعم وكافيهات']
  },
  {
    id: 'cat-office',
    nameAr: 'مباني وأبراج إدارية',
    nameEn: 'Corporate Buildings & Towers',
    type: 'office',
    tags: ['مقرات شركات', 'مكاتب تنفيذية', 'قاعات مؤتمرات', 'تراسات خارجية', 'ألياف بصرية']
  },
  {
    id: 'cat-logistics',
    nameAr: 'مستودعات ومخازن لوجستية',
    nameEn: 'Logistics Hubs & Warehouses',
    type: 'logistics',
    tags: ['سلاسل إمداد', 'مستودعات مبردة', 'أرصفة هيدروليكية', 'شحن وتفريغ', 'أمن 24/7']
  },
  {
    id: 'cat-residential',
    nameAr: 'مجمعات سكنية فاخرة',
    nameEn: 'Luxury Residential Compounds',
    type: 'residential',
    tags: ['شقق فاخرة', 'أدوار متكررة', 'بنتهاوس', 'مسابح وحدائق', 'مواقف خاصة']
  }
];

const DEFAULT_INQUIRIES: CustomerInquiry[] = [
  {
    id: 'inq-101',
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    name: 'سعد بن عبدالعزيز المقرن',
    phone: '+966 50 123 4567',
    email: 'saad.almuqrin@enterprise.sa',
    projectId: 206,
    projectTitle: 'مركز أجدا برايم للأعمال',
    unitId: 'p206-g-s1',
    unitNumber: 'معرض 01 (جنوبي)',
    interestType: 'rent',
    interestTypeAr: 'استئجار',
    message: 'نود استئجار المعرض الرئيسي لافتتاح فرع جديد لعلامتنا التجارية، نرجو تزويدنا بشروط العقد والأسعار.',
    status: 'new',
    statusAr: 'جديد'
  },
  {
    id: 'inq-102',
    createdAt: new Date(Date.now() - 3600000 * 18).toISOString(),
    name: 'عبدالله السبيعي',
    phone: '+966 55 987 6543',
    email: 'a.subaie@logistics-sa.com',
    projectId: 201,
    projectTitle: 'مستودعات المنصورية اللوجستية',
    unitId: 'p201-w3',
    unitNumber: 'مستودع B-01 (تبريد/تجميد)',
    interestType: 'invest',
    interestTypeAr: 'استثمار طويل الأجل',
    message: 'استفسار عن إمكانية التعاقد لـ 5 سنوات على المستودعات المبردة لسلاسل إمداد الأغذية.',
    status: 'contacted',
    statusAr: 'تم التواصل'
  }
];

export const AdminStorage = {
  // Auth
  isAuthenticated(): boolean {
    return localStorage.getItem(AUTH_KEY) === 'true';
  },

  login(email: string, pass: string): boolean {
    if (email.trim().toLowerCase() === 'admin@ajdaa.sa' && pass === 'password') {
      localStorage.setItem(AUTH_KEY, 'true');
      return true;
    }
    return false;
  },

  logout(): void {
    localStorage.removeItem(AUTH_KEY);
  },

  // Projects CRUD
  getAllProjects(): Property[] {
    let customProjects: Property[] = [];
    try {
      const stored = localStorage.getItem(PROJECTS_KEY);
      if (stored) customProjects = JSON.parse(stored);
    } catch {
      customProjects = [];
    }

    const all = [...initialProperties, ...customProjects];
    const overrides = this.getUnitStatusOverrides();

    // Apply unit status overrides
    return all.map((p) => {
      if (!p.floors) return p;
      const updatedFloors = p.floors.map((fl) => ({
        ...fl,
        units: fl.units.map((u) => {
          if (overrides[u.id]) {
            const newStatus = overrides[u.id];
            return {
              ...u,
              status: newStatus,
              statusAr:
                newStatus === 'available'
                  ? 'متاح'
                  : newStatus === 'reserved'
                  ? 'محجوز'
                  : newStatus === 'rented'
                  ? 'مؤجر'
                  : 'مباع',
            };
          }
          return u;
        }),
      }));
      return { ...p, floors: updatedFloors };
    });
  },

  getProjectById(id: number): Property | undefined {
    return this.getAllProjects().find((p) => p.id === id);
  },

  saveNewProject(project: Property): void {
    let custom: Property[] = [];
    try {
      const stored = localStorage.getItem(PROJECTS_KEY);
      if (stored) custom = JSON.parse(stored);
    } catch {
      custom = [];
    }
    custom.push(project);
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(custom));
  },

  deleteProject(projectId: number): void {
    let custom: Property[] = [];
    try {
      const stored = localStorage.getItem(PROJECTS_KEY);
      if (stored) custom = JSON.parse(stored);
    } catch {
      custom = [];
    }
    const filtered = custom.filter((p) => p.id !== projectId);
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(filtered));
  },

  // Units CRUD for any project
  addUnitToProject(projectId: number, floorNumber: number, unit: PropertyUnit): void {
    const all = this.getAllProjects();
    const targetProj = all.find((p) => p.id === projectId);
    if (!targetProj) return;

    if (!targetProj.floors) targetProj.floors = [];
    let floor = targetProj.floors.find((f) => f.floorNumber === floorNumber);
    if (!floor) {
      floor = {
        floorNumber,
        floorNameAr: `الدور ${floorNumber}`,
        floorNameEn: `Floor ${floorNumber}`,
        units: [],
      };
      targetProj.floors.push(floor);
    }
    floor.units.push(unit);
    this.updateProjectInMemory(targetProj);
  },

  updateUnitInProject(projectId: number, updatedUnit: PropertyUnit): void {
    const all = this.getAllProjects();
    const targetProj = all.find((p) => p.id === projectId);
    if (!targetProj || !targetProj.floors) return;

    targetProj.floors.forEach((fl) => {
      fl.units = fl.units.map((u) => (u.id === updatedUnit.id ? updatedUnit : u));
    });
    this.updateProjectInMemory(targetProj);
  },

  deleteUnitFromProject(projectId: number, unitId: string): void {
    const all = this.getAllProjects();
    const targetProj = all.find((p) => p.id === projectId);
    if (!targetProj || !targetProj.floors) return;

    targetProj.floors.forEach((fl) => {
      fl.units = fl.units.filter((u) => u.id !== unitId);
    });
    this.updateProjectInMemory(targetProj);
  },

  addFloorToProject(projectId: number, floorName: string): void {
    const all = this.getAllProjects();
    const targetProj = all.find((p) => p.id === projectId);
    if (!targetProj) return;

    if (!targetProj.floors) targetProj.floors = [];
    const nextNumber = targetProj.floors.length;
    targetProj.floors.push({
      floorNumber: nextNumber,
      floorNameAr: floorName,
      floorNameEn: `Floor ${nextNumber}`,
      units: [],
    });
    this.updateProjectInMemory(targetProj);
  },

  deleteFloorFromProject(projectId: number, floorNumber: number): void {
    const all = this.getAllProjects();
    const targetProj = all.find((p) => p.id === projectId);
    if (!targetProj || !targetProj.floors) return;

    targetProj.floors = targetProj.floors.filter((f) => f.floorNumber !== floorNumber);
    this.updateProjectInMemory(targetProj);
  },

  updateProjectInMemory(project: Property): void {
    // Check if it's a custom project
    let custom: Property[] = [];
    try {
      const stored = localStorage.getItem(PROJECTS_KEY);
      if (stored) custom = JSON.parse(stored);
    } catch {
      custom = [];
    }

    const existingIdx = custom.findIndex((p) => p.id === project.id);
    if (existingIdx >= 0) {
      custom[existingIdx] = project;
    } else {
      // Overriding a base project by pushing to custom
      custom.push(project);
    }
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(custom));
  },

  // Unit Status Overrides
  getUnitStatusOverrides(): Record<string, UnitStatus> {
    try {
      const stored = localStorage.getItem(STATUS_OVERRIDES_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  },

  updateUnitStatus(unitId: string, newStatus: UnitStatus): void {
    const current = this.getUnitStatusOverrides();
    current[unitId] = newStatus;
    localStorage.setItem(STATUS_OVERRIDES_KEY, JSON.stringify(current));
  },

  // Customer Inquiries
  getInquiries(): CustomerInquiry[] {
    try {
      const stored = localStorage.getItem(INQUIRIES_KEY);
      if (stored) return JSON.parse(stored);
      localStorage.setItem(INQUIRIES_KEY, JSON.stringify(DEFAULT_INQUIRIES));
      return DEFAULT_INQUIRIES;
    } catch {
      return DEFAULT_INQUIRIES;
    }
  },

  addInquiry(data: Omit<CustomerInquiry, 'id' | 'createdAt' | 'status' | 'statusAr'>): CustomerInquiry {
    const list = this.getInquiries();
    const newInquiry: CustomerInquiry = {
      ...data,
      id: `inq-${Date.now().toString().slice(-5)}`,
      createdAt: new Date().toISOString(),
      status: 'new',
      statusAr: 'جديد',
    };
    list.unshift(newInquiry);
    localStorage.setItem(INQUIRIES_KEY, JSON.stringify(list));
    return newInquiry;
  },

  updateInquiryStatus(id: string, status: 'new' | 'contacted' | 'closed'): void {
    const list = this.getInquiries();
    const statusArMap = { new: 'جديد', contacted: 'تم التواصل', closed: 'مغلق' };
    const updated = list.map((inq) =>
      inq.id === id ? { ...inq, status, statusAr: statusArMap[status] } : inq
    );
    localStorage.setItem(INQUIRIES_KEY, JSON.stringify(updated));
  },

  deleteInquiry(id: string): void {
    const list = this.getInquiries();
    const filtered = list.filter((inq) => inq.id !== id);
    localStorage.setItem(INQUIRIES_KEY, JSON.stringify(filtered));
  },

  // Categories & Tags
  getCategories(): CategoryItem[] {
    try {
      const stored = localStorage.getItem(CATEGORIES_KEY);
      if (stored) return JSON.parse(stored);
      localStorage.setItem(CATEGORIES_KEY, JSON.stringify(DEFAULT_CATEGORIES));
      return DEFAULT_CATEGORIES;
    } catch {
      return DEFAULT_CATEGORIES;
    }
  },

  saveCategories(cats: CategoryItem[]): void {
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(cats));
  },

  // Users & Permissions
  getUsers(): AdminUser[] {
    try {
      const stored = localStorage.getItem(USERS_KEY);
      if (stored) return JSON.parse(stored);
      localStorage.setItem(USERS_KEY, JSON.stringify(DEFAULT_USERS));
      return DEFAULT_USERS;
    } catch {
      return DEFAULT_USERS;
    }
  },

  saveUser(user: AdminUser): void {
    const list = this.getUsers();
    const existingIdx = list.findIndex((u) => u.id === user.id);
    if (existingIdx >= 0) {
      list[existingIdx] = user;
    } else {
      list.push(user);
    }
    localStorage.setItem(USERS_KEY, JSON.stringify(list));
  },

  deleteUser(userId: string): void {
    const list = this.getUsers();
    const filtered = list.filter((u) => u.id !== userId);
    localStorage.setItem(USERS_KEY, JSON.stringify(filtered));
  },

  toggleUserStatus(userId: string): void {
    const list = this.getUsers();
    const updated = list.map((u) =>
      u.id === userId ? { ...u, status: (u.status === 'active' ? 'suspended' : 'active') as 'active' | 'suspended' } : u
    );
    localStorage.setItem(USERS_KEY, JSON.stringify(updated));
  },
};

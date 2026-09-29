import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/services/prisma.js';
import { hasPermission } from '../src/middleware/auth.js';
import {
  authInject,
  closeApp,
  createThrowawayUser,
  getApp,
  inject,
  login,
  removeUser,
  SEED_ADMINS,
  SEED_PASSWORD,
  seedSession,
  type TestSession,
} from './helpers.js';
import type { PermissionDef } from '../src/config/permissions.js';

let superAdmin: TestSession;
let viewer: TestSession;
let cleanups: (() => Promise<void>)[] = [];

beforeAll(async () => {
  await getApp();
  superAdmin = await seedSession(SEED_ADMINS.superAdmin);
  viewer = await seedSession(SEED_ADMINS.viewer);
});

afterAll(async () => {
  for (const cleanup of cleanups.reverse()) {
    try {
      await cleanup();
    } catch {
      // ignore cleanup errors
    }
  }
  await closeApp();
});

describe('1. Permissions catalogue', () => {
  it('returns 401 without authentication', async () => {
    const res = await inject({ method: 'GET', url: '/api/permissions' });
    expect(res.statusCode).toBe(401);
  });

  it('allows any authenticated admin (including viewer) to read the catalogue', async () => {
    const res = await authInject(viewer.token, { method: 'GET', url: '/api/permissions' });
    expect(res.statusCode).toBe(200);

    const catalogue = res.json() as PermissionDef[];
    expect(Array.isArray(catalogue)).toBe(true);
    expect(catalogue.length).toBe(6);

    const keys = catalogue.map((c) => c.key);
    expect(keys).toEqual(
      expect.arrayContaining(['manageProjects', 'manageUnits', 'viewInquiries', 'exportData', 'manageUsers', 'manageNotifications'])
    );

    for (const item of catalogue) {
      expect(item.key).toBeDefined();
      expect(item.group).toBeDefined();
      expect(item.labelAr).toBeDefined();
      expect(item.labelEn).toBeDefined();
      expect(item.description).toBeDefined();
    }
  });
});

describe('2. Roles CRUD and validation', () => {
  it('GET /api/roles lists roles with userCount', async () => {
    const res = await authInject(superAdmin.token, { method: 'GET', url: '/api/roles' });
    expect(res.statusCode).toBe(200);

    const roles = res.json() as Array<{
      id: string;
      key: string;
      nameAr: string;
      nameEn: string;
      userCount: number;
      isSystem: boolean;
      permissions: string[];
    }>;

    expect(roles.length).toBeGreaterThanOrEqual(4);
    const superAdminRole = roles.find((r) => r.key === 'super_admin');
    expect(superAdminRole).toBeDefined();
    expect(superAdminRole?.isSystem).toBe(true);
    expect(superAdminRole?.userCount).toBeGreaterThanOrEqual(1);
    expect(superAdminRole?.permissions).toHaveLength(5);
  });

  it('rejects invalid role keys with 400', async () => {
    const invalidKeys = ['123_starts_with_num', 'CamelCase', 'ab', 'a'.repeat(42), 'spaces in key'];

    for (const key of invalidKeys) {
      const res = await authInject(superAdmin.token, {
        method: 'POST',
        url: '/api/roles',
        payload: {
          key,
          nameAr: 'اسم تجريبي',
          nameEn: 'Test Role',
          permissions: ['viewInquiries'],
        },
      });
      expect(res.statusCode).toBe(400);
    }
  });

  it('creates a custom role, rejects duplicates with 409, and dedupes permissions', async () => {
    const roleKey = `test_role_${Date.now()}`;
    const res = await authInject(superAdmin.token, {
      method: 'POST',
      url: '/api/roles',
      payload: {
        key: roleKey,
        nameAr: 'دور مخصص تجريبي',
        nameEn: 'Test Custom Role',
        description: 'وصف تجريبي',
        permissions: ['viewInquiries', 'viewInquiries', 'exportData'],
        sortOrder: 10,
      },
    });

    expect(res.statusCode).toBe(201);
    const created = res.json() as {
      id: string;
      key: string;
      permissions: string[];
      userCount: number;
    };
    expect(created.key).toBe(roleKey);
    expect(created.userCount).toBe(0);
    expect(created.permissions).toEqual(['viewInquiries', 'exportData']);

    cleanups.push(async () => {
      await prisma.role.deleteMany({ where: { id: created.id } });
    });

    // Duplicate key -> 409
    const dupRes = await authInject(superAdmin.token, {
      method: 'POST',
      url: '/api/roles',
      payload: {
        key: roleKey,
        nameAr: 'تكرار',
        nameEn: 'Duplicate',
        permissions: ['viewInquiries'],
      },
    });
    expect(dupRes.statusCode).toBe(409);

    // Update role
    const updateRes = await authInject(superAdmin.token, {
      method: 'PUT',
      url: `/api/roles/${created.id}`,
      payload: {
        nameAr: 'دور مخصص محدث',
        nameEn: 'Updated Custom Role',
        description: 'وصف محدث',
        sortOrder: 15,
      },
    });
    expect(updateRes.statusCode).toBe(200);
    const updated = updateRes.json() as { nameAr: string; nameEn: string; sortOrder: number };
    expect(updated.nameAr).toBe('دور مخصص محدث');
    expect(updated.nameEn).toBe('Updated Custom Role');
    expect(updated.sortOrder).toBe(15);

    // Delete role
    const delRes = await authInject(superAdmin.token, {
      method: 'DELETE',
      url: `/api/roles/${created.id}`,
    });
    expect(delRes.statusCode).toBe(200);
  });
});

describe('3. Delete guards (system roles and in-use roles)', () => {
  it('returns 400 when attempting to delete a system role', async () => {
    const res = await authInject(superAdmin.token, {
      method: 'DELETE',
      url: '/api/roles/role_super_admin',
    });
    expect(res.statusCode).toBe(400);
    expect((res.json() as { error: string }).error).toMatch(/system role/i);
  });

  it('returns 409 with userCount when attempting to delete a role currently in use', async () => {
    // role_sales_agent isSystem=false, but assigned to seeded user Reem
    const res = await authInject(superAdmin.token, {
      method: 'DELETE',
      url: '/api/roles/role_sales_agent',
    });
    expect(res.statusCode).toBe(409);
    const body = res.json() as { error: string; userCount: number };
    expect(body.userCount).toBeGreaterThanOrEqual(1);
  });
});

describe('4. PUT /api/roles/:id with applyToUsers', () => {
  it('updates users permissions when applyToUsers is true, and does not when false', async () => {
    // 1. Create a custom role
    const roleKey = `apply_role_${Date.now()}`;
    const createRoleRes = await authInject(superAdmin.token, {
      method: 'POST',
      url: '/api/roles',
      payload: {
        key: roleKey,
        nameAr: 'دور فحص المزامنة',
        nameEn: 'Sync Test Role',
        permissions: ['manageProjects'],
      },
    });
    expect(createRoleRes.statusCode).toBe(201);
    const testRole = createRoleRes.json() as { id: string };

    cleanups.push(async () => {
      await prisma.adminUser.deleteMany({ where: { roleId: testRole.id } });
      await prisma.role.deleteMany({ where: { id: testRole.id } });
    });

    // 2. Create user with roleId
    const testUser = await createThrowawayUser({
      name: 'User In Sync Test',
      role: roleKey,
      roleAr: 'دور فحص المزامنة',
    });
    cleanups.push(async () => {
      await removeUser(testUser.id);
    });

    // Link user to roleId
    await prisma.adminUser.update({
      where: { id: testUser.id },
      data: {
        roleId: testRole.id,
        permissions: JSON.stringify({
          manageProjects: true,
          manageUnits: false,
          viewInquiries: false,
          exportData: false,
          manageUsers: false,
        }),
      },
    });

    // 3. Update role with applyToUsers: true (adding viewInquiries)
    const updateWithSyncRes = await authInject(superAdmin.token, {
      method: 'PUT',
      url: `/api/roles/${testRole.id}`,
      payload: {
        permissions: ['manageProjects', 'viewInquiries'],
        applyToUsers: true,
      },
    });
    expect(updateWithSyncRes.statusCode).toBe(200);

    const userAfterSync = await prisma.adminUser.findUnique({ where: { id: testUser.id } });
    const permsAfterSync = JSON.parse(userAfterSync!.permissions);
    expect(permsAfterSync.manageProjects).toBe(true);
    expect(permsAfterSync.viewInquiries).toBe(true);
    expect(permsAfterSync.manageUnits).toBe(false);

    // 4. Update role with applyToUsers: false (adding exportData)
    const updateWithoutSyncRes = await authInject(superAdmin.token, {
      method: 'PUT',
      url: `/api/roles/${testRole.id}`,
      payload: {
        permissions: ['manageProjects', 'viewInquiries', 'exportData'],
        applyToUsers: false,
      },
    });
    expect(updateWithoutSyncRes.statusCode).toBe(200);

    const userAfterNoSync = await prisma.adminUser.findUnique({ where: { id: testUser.id } });
    const permsAfterNoSync = JSON.parse(userAfterNoSync!.permissions);
    expect(permsAfterNoSync.manageProjects).toBe(true);
    expect(permsAfterNoSync.viewInquiries).toBe(true);
    // exportData must NOT have updated because applyToUsers was false
    expect(permsAfterNoSync.exportData).toBe(false);
  });
});

describe('5. Non-super manageUsers admin cannot manage roles with manageUsers', () => {
  it('forbids a non-super admin with manageUsers from creating, editing, or deleting manageUsers roles', async () => {
    // Create a non-super manager
    const manager = await createThrowawayUser({
      name: 'Manager Admin',
      role: 'project_manager',
      permissions: { manageUsers: true, viewInquiries: true },
    });
    cleanups.push(async () => {
      await removeUser(manager.id);
    });

    const managerSession = await login(manager.email, SEED_PASSWORD);

    // 1. Attempt to create role with manageUsers -> 403
    const createRes = await authInject(managerSession.token, {
      method: 'POST',
      url: '/api/roles',
      payload: {
        key: `escalate_role_${Date.now()}`,
        nameAr: 'دور اختراق',
        nameEn: 'Escalation Role',
        permissions: ['manageUsers'],
      },
    });
    expect(createRes.statusCode).toBe(403);

    // 2. Can create a role without manageUsers
    const safeRoleKey = `safe_role_${Date.now()}`;
    const safeCreateRes = await authInject(managerSession.token, {
      method: 'POST',
      url: '/api/roles',
      payload: {
        key: safeRoleKey,
        nameAr: 'دور آمن',
        nameEn: 'Safe Role',
        permissions: ['viewInquiries'],
      },
    });
    expect(safeCreateRes.statusCode).toBe(201);
    const safeRole = safeCreateRes.json() as { id: string };
    cleanups.push(async () => {
      await prisma.role.deleteMany({ where: { id: safeRole.id } });
    });

    // 3. Attempt to PUT manageUsers onto the safe role -> 403
    const editRes = await authInject(managerSession.token, {
      method: 'PUT',
      url: `/api/roles/${safeRole.id}`,
      payload: {
        permissions: ['viewInquiries', 'manageUsers'],
      },
    });
    expect(editRes.statusCode).toBe(403);

    // 4. Attempt to edit role_super_admin (contains manageUsers) -> 403
    const editSuperAdminRoleRes = await authInject(managerSession.token, {
      method: 'PUT',
      url: '/api/roles/role_super_admin',
      payload: {
        nameAr: 'محاولة تعديل',
      },
    });
    expect(editSuperAdminRoleRes.statusCode).toBe(403);

    // 5. Manager CAN delete their safe role
    const delSafeRes = await authInject(managerSession.token, {
      method: 'DELETE',
      url: `/api/roles/${safeRole.id}`,
    });
    expect(delSafeRes.statusCode).toBe(200);
  });
});

describe('6. Departments CRUD and guards', () => {
  it('lists departments with userCount, validates unique nameAr, and guards in-use delete', async () => {
    // List
    const listRes = await authInject(superAdmin.token, { method: 'GET', url: '/api/departments' });
    expect(listRes.statusCode).toBe(200);
    const departments = listRes.json() as Array<{ id: string; nameAr: string; userCount: number }>;
    expect(departments.length).toBeGreaterThanOrEqual(4);

    // Create
    const deptNameAr = `قسم تجريبي ${Date.now()}`;
    const createRes = await authInject(superAdmin.token, {
      method: 'POST',
      url: '/api/departments',
      payload: {
        nameAr: deptNameAr,
        nameEn: 'Test Department',
      },
    });
    expect(createRes.statusCode).toBe(201);
    const createdDept = createRes.json() as { id: string; nameAr: string; userCount: number };
    expect(createdDept.nameAr).toBe(deptNameAr);
    expect(createdDept.userCount).toBe(0);

    cleanups.push(async () => {
      await prisma.department.deleteMany({ where: { id: createdDept.id } });
    });

    // Duplicate nameAr -> 409
    const dupRes = await authInject(superAdmin.token, {
      method: 'POST',
      url: '/api/departments',
      payload: {
        nameAr: deptNameAr,
        nameEn: 'Duplicate',
      },
    });
    expect(dupRes.statusCode).toBe(409);

    // Update
    const updateRes = await authInject(superAdmin.token, {
      method: 'PUT',
      url: `/api/departments/${createdDept.id}`,
      payload: {
        nameAr: `${deptNameAr} محدث`,
        nameEn: 'Updated Dept',
      },
    });
    expect(updateRes.statusCode).toBe(200);

    // Assign to a user -> in-use guard
    const throwaway = await createThrowawayUser({
      name: 'Department User',
      role: 'viewer',
    });
    cleanups.push(async () => {
      await removeUser(throwaway.id);
    });

    await prisma.adminUser.update({
      where: { id: throwaway.id },
      data: { departmentId: createdDept.id },
    });

    // Attempt delete -> 409
    const inUseDeleteRes = await authInject(superAdmin.token, {
      method: 'DELETE',
      url: `/api/departments/${createdDept.id}`,
    });
    expect(inUseDeleteRes.statusCode).toBe(409);
    expect((inUseDeleteRes.json() as { userCount: number }).userCount).toBe(1);

    // Unassign and delete -> 200
    await prisma.adminUser.update({
      where: { id: throwaway.id },
      data: { departmentId: null },
    });

    const successDeleteRes = await authInject(superAdmin.token, {
      method: 'DELETE',
      url: `/api/departments/${createdDept.id}`,
    });
    expect(successDeleteRes.statusCode).toBe(200);
  });
});

describe('7. User create and update with roleId and departmentId', () => {
  it('user create with roleId copies role permissions, unless explicit permissions are provided', async () => {
    // 1. Without explicit permissions: copies role template
    const userRes = await authInject(superAdmin.token, {
      method: 'POST',
      url: '/api/auth/users',
      payload: {
        name: 'User From Role',
        email: `role_user_${Date.now()}@ajdaa.test`,
        password: 'password123',
        roleId: 'role_project_manager',
      },
    });

    expect(userRes.statusCode).toBe(201);
    const created = userRes.json() as {
      id: string;
      role: string;
      roleAr: string;
      roleId: string;
      permissions: Record<string, boolean>;
    };
    cleanups.push(async () => {
      await removeUser(created.id);
    });

    expect(created.role).toBe('project_manager');
    expect(created.roleId).toBe('role_project_manager');
    expect(created.roleAr).toBe('مدير التطوير والمشاريع');
    expect(created.permissions.manageProjects).toBe(true);
    expect(created.permissions.manageUnits).toBe(true);
    expect(created.permissions.viewInquiries).toBe(true);
    expect(created.permissions.exportData).toBe(true);
    expect(created.permissions.manageUsers).toBe(false);

    // 2. With explicit permissions: per-user customisation takes precedence
    const customUserRes = await authInject(superAdmin.token, {
      method: 'POST',
      url: '/api/auth/users',
      payload: {
        name: 'User Custom Perms',
        email: `custom_role_user_${Date.now()}@ajdaa.test`,
        password: 'password123',
        roleId: 'role_project_manager',
        permissions: { manageProjects: false, manageUsers: true },
      },
    });

    expect(customUserRes.statusCode).toBe(201);
    const customCreated = customUserRes.json() as {
      id: string;
      permissions: Record<string, boolean>;
    };
    cleanups.push(async () => {
      await removeUser(customCreated.id);
    });

    expect(customCreated.permissions.manageProjects).toBe(false);
    expect(customCreated.permissions.manageUsers).toBe(true);
  });

  it('blocks non-super admin from assigning roleId=role_super_admin (403)', async () => {
    const manager = await createThrowawayUser({
      name: 'Manager Admin 2',
      role: 'project_manager',
      permissions: { manageUsers: true },
    });
    cleanups.push(async () => {
      await removeUser(manager.id);
    });

    const managerSession = await login(manager.email, SEED_PASSWORD);

    // 1. Attempt create with roleId = role_super_admin
    const createRes = await authInject(managerSession.token, {
      method: 'POST',
      url: '/api/auth/users',
      payload: {
        name: 'Super Admin Attempt',
        email: `hack_${Date.now()}@ajdaa.test`,
        password: 'password123',
        roleId: 'role_super_admin',
      },
    });
    expect(createRes.statusCode).toBe(403);

    // 2. Attempt update to roleId = role_super_admin
    const targetUser = await createThrowawayUser({ role: 'viewer' });
    cleanups.push(async () => {
      await removeUser(targetUser.id);
    });

    const updateRes = await authInject(managerSession.token, {
      method: 'PUT',
      url: `/api/auth/users/${targetUser.id}`,
      payload: {
        roleId: 'role_super_admin',
      },
    });
    expect(updateRes.statusCode).toBe(403);
  });

  it('resolves departmentId and populates department, departmentId, and departmentName', async () => {
    const dept = await prisma.department.findFirst();
    expect(dept).toBeDefined();

    const userRes = await authInject(superAdmin.token, {
      method: 'POST',
      url: '/api/auth/users',
      payload: {
        name: 'Department Linked User',
        email: `dept_user_${Date.now()}@ajdaa.test`,
        password: 'password123',
        roleId: 'role_viewer',
        departmentId: dept!.id,
      },
    });

    expect(userRes.statusCode).toBe(201);
    const created = userRes.json() as {
      id: string;
      department: string;
      departmentId: string;
      departmentName: string;
    };
    cleanups.push(async () => {
      await removeUser(created.id);
    });

    expect(created.departmentId).toBe(dept!.id);
    expect(created.department).toBe(dept!.nameAr);
    expect(created.departmentName).toBe(dept!.nameAr);
  });
});

describe('8. Migration equivalence check', () => {
  it('verifies that every seeded user has roleId matching its role and effective permissions unchanged', async () => {
    const seededAdmins = [
      {
        email: 'admin@ajdaa.sa',
        expectedRole: 'super_admin',
        expectedRoleId: 'role_super_admin',
        expectedDepartment: 'الإدارة التنفيذية',
        expectedPerms: {
          manageProjects: true,
          manageUnits: true,
          viewInquiries: true,
          exportData: true,
          manageUsers: true,
        },
      },
      {
        email: 'f.sudairy@ajdaa.sa',
        expectedRole: 'project_manager',
        expectedRoleId: 'role_project_manager',
        expectedDepartment: 'التطوير الهندسي',
        expectedPerms: {
          manageProjects: true,
          manageUnits: true,
          viewInquiries: true,
          exportData: true,
          manageUsers: false,
        },
      },
      {
        email: 'reem.q@ajdaa.sa',
        expectedRole: 'sales_agent',
        expectedRoleId: 'role_sales_agent',
        expectedDepartment: 'إدارة الاستثمار والمبيعات',
        expectedPerms: {
          manageProjects: false,
          manageUnits: true,
          viewInquiries: true,
          exportData: false,
          manageUsers: false,
        },
      },
      {
        email: 'turki.d@ajdaa.sa',
        expectedRole: 'viewer',
        expectedRoleId: 'role_viewer',
        expectedDepartment: 'التخطيط والتحليل',
        expectedPerms: {
          manageProjects: false,
          manageUnits: false,
          viewInquiries: true,
          exportData: true,
          manageUsers: false,
        },
      },
    ];

    for (const admin of seededAdmins) {
      const user = await prisma.adminUser.findUnique({
        where: { email: admin.email },
        include: { departmentRef: true, roleRef: true },
      });

      expect(user).toBeDefined();
      expect(user!.role).toBe(admin.expectedRole);
      expect(user!.roleId).toBe(admin.expectedRoleId);
      expect(user!.department).toBe(admin.expectedDepartment);
      expect(user!.departmentId).toBeDefined();
      expect(user!.departmentRef?.nameAr).toBe(admin.expectedDepartment);

      const perms = JSON.parse(user!.permissions) as Record<string, boolean>;
      expect(perms).toEqual(admin.expectedPerms);

      // Verify effective authorization enforcement via hasPermission helper
      const authenticatedAdmin = {
        id: user!.id,
        email: user!.email,
        role: user!.role,
        permissions: perms,
      };

      if (admin.expectedRole === 'super_admin') {
        expect(hasPermission(authenticatedAdmin, 'manageProjects')).toBe(true);
        expect(hasPermission(authenticatedAdmin, 'manageUnits')).toBe(true);
        expect(hasPermission(authenticatedAdmin, 'viewInquiries')).toBe(true);
        expect(hasPermission(authenticatedAdmin, 'exportData')).toBe(true);
        expect(hasPermission(authenticatedAdmin, 'manageUsers')).toBe(true);
      } else {
        expect(hasPermission(authenticatedAdmin, 'manageProjects')).toBe(admin.expectedPerms.manageProjects);
        expect(hasPermission(authenticatedAdmin, 'manageUnits')).toBe(admin.expectedPerms.manageUnits);
        expect(hasPermission(authenticatedAdmin, 'viewInquiries')).toBe(admin.expectedPerms.viewInquiries);
        expect(hasPermission(authenticatedAdmin, 'exportData')).toBe(admin.expectedPerms.exportData);
        expect(hasPermission(authenticatedAdmin, 'manageUsers')).toBe(admin.expectedPerms.manageUsers);
      }
    }
  });
});

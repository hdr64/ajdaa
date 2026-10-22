import { describe, expect, it } from 'vitest';
import {
  PERMISSION_CATALOGUE,
  PERMISSION_KEYS,
  parsePermissions,
  parseRolePermissions,
  permissionKeySchema,
  rolePermissionsToUserPermissions,
} from '../src/config/permissions.js';

describe('Permission catalogue', () => {
  it('describes every permission key exactly once', () => {
    const catalogueKeys = PERMISSION_CATALOGUE.map((definition) => definition.key);

    expect(new Set(catalogueKeys).size).toBe(catalogueKeys.length);
    expect([...catalogueKeys].sort()).toEqual([...PERMISSION_KEYS].sort());
  });

  it('gives every permission a group, an Arabic and an English label, and a description', () => {
    for (const definition of PERMISSION_CATALOGUE) {
      expect(definition.group.trim()).not.toBe('');
      expect(definition.labelAr.trim()).not.toBe('');
      expect(definition.labelEn.trim()).not.toBe('');
      expect(definition.description.trim()).not.toBe('');
    }
  });

  it('carries the permissions of the new features', () => {
    const keys = PERMISSION_CATALOGUE.map((definition) => definition.key);

    expect(keys).toContain('managePastProjects');
    expect(keys).toContain('viewApplications');
    expect(keys).toContain('manageApplications');

    for (const key of ['managePastProjects', 'viewApplications', 'manageApplications'] as const) {
      expect(permissionKeySchema.safeParse(key).success).toBe(true);
    }
  });

  it('rejects an unknown permission key', () => {
    expect(permissionKeySchema.safeParse('manageEverything').success).toBe(false);
  });
});

describe('Permission parsing', () => {
  it('keeps only the known keys of a role list', () => {
    expect(parseRolePermissions('["viewInquiries","manageApplications","nonsense"]')).toEqual([
      'viewInquiries',
      'manageApplications',
    ]);
  });

  it('grants nothing for a missing or malformed role list', () => {
    expect(parseRolePermissions(null)).toEqual([]);
    expect(parseRolePermissions('')).toEqual([]);
    expect(parseRolePermissions('not json')).toEqual([]);
    expect(parseRolePermissions('{"viewInquiries":true}')).toEqual([]);
  });

  it('maps a role list onto a boolean per permission key', () => {
    const map = rolePermissionsToUserPermissions(['viewApplications']);

    expect(Object.keys(map).sort()).toEqual([...PERMISSION_KEYS].sort());
    expect(map.viewApplications).toBe(true);
    expect(map.manageApplications).toBe(false);
  });

  it('grants nothing for a malformed per-user permission map', () => {
    expect(parsePermissions(null)).toEqual({});
    expect(parsePermissions('not json')).toEqual({});
    expect(parsePermissions('["viewInquiries"]')).toEqual({});
  });
});

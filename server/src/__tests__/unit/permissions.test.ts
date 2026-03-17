import { describe, it, expect } from 'vitest';
import { getPermissionsForRole, ROLE_PERMISSIONS } from '../../config/permissions';

describe('權限設定檔', () => {
  it('general_manager 有 15 個權限', () => {
    expect(getPermissionsForRole('general_manager')).toHaveLength(15);
  });

  it('senior_manager 有 21 個權限', () => {
    expect(getPermissionsForRole('senior_manager')).toHaveLength(21);
  });

  it('senior_manager 包含 general_manager 所有權限', () => {
    const generalPerms = getPermissionsForRole('general_manager');
    const seniorPerms = getPermissionsForRole('senior_manager');
    for (const perm of generalPerms) {
      expect(seniorPerms).toContain(perm);
    }
  });

  it('senior_manager 額外擁有 admin:* 和 broadcast:* 權限', () => {
    const seniorPerms = getPermissionsForRole('senior_manager');
    expect(seniorPerms).toContain('admin:read');
    expect(seniorPerms).toContain('admin:create');
    expect(seniorPerms).toContain('admin:toggle');
    expect(seniorPerms).toContain('admin:reset_password');
    expect(seniorPerms).toContain('broadcast:read');
    expect(seniorPerms).toContain('broadcast:create');
  });

  it('general_manager 不擁有 admin:* 和 broadcast:* 權限', () => {
    const generalPerms = getPermissionsForRole('general_manager');
    expect(generalPerms).not.toContain('admin:read');
    expect(generalPerms).not.toContain('broadcast:create');
  });

  it('未知 role 回傳空陣列', () => {
    expect(getPermissionsForRole('unknown')).toEqual([]);
    expect(getPermissionsForRole('')).toEqual([]);
  });

  it('所有權限格式符合 resource:action 慣例', () => {
    const allPerms = [...ROLE_PERMISSIONS.general_manager, ...ROLE_PERMISSIONS.senior_manager];
    for (const perm of allPerms) {
      expect(perm).toMatch(/^[a-z_]+:[a-z_]+$/);
    }
  });
});

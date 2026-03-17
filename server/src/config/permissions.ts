export const ROLE_PERMISSIONS: Record<string, string[]> = {
  general_manager: [
    'auth:change_own_password',
    'chat:read',
    'chat:delete',
    'blacklist:read',
    'blacklist:create',
    'blacklist:delete',
    'ip_block:read',
    'ip_block:create',
    'ip_block:delete',
    'chatroom:read',
    'operation_log:read',
    'report:read',
    'report:review',
    'nickname:read',
    'nickname:review',
  ],
  senior_manager: [],
};

// senior_manager 繼承 general_manager 所有權限 + 額外權限
ROLE_PERMISSIONS.senior_manager = [
  ...ROLE_PERMISSIONS.general_manager,
  'admin:read',
  'admin:create',
  'admin:toggle',
  'admin:reset_password',
  'broadcast:read',
  'broadcast:create',
];

export function getPermissionsForRole(role: string): string[] {
  return ROLE_PERMISSIONS[role] || [];
}

// Roles & permissions. In production these live in the roles / permissions /
// role_permissions tables; here they're a static map for the demo.

export const PERMISSIONS = [
  'validation.run',
  'detection.run',
  'detection.manage', // configure providers
  'wallet.recharge',
  'wallet.view',
  'users.manage',
  'reports.view',
  'system.admin',
] as const;

export type Permission = (typeof PERMISSIONS)[number];
export type RoleName = 'admin' | 'customer_owner' | 'customer_member';

export const ROLE_PERMISSIONS: Record<RoleName, Permission[]> = {
  admin: [...PERMISSIONS], // platform admin — everything
  customer_owner: [
    'validation.run',
    'detection.run',
    'detection.manage',
    'wallet.recharge',
    'wallet.view',
    'users.manage',
    'reports.view',
  ],
  customer_member: ['validation.run', 'detection.run', 'wallet.view', 'reports.view'],
};

export function permsForRole(role: RoleName): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

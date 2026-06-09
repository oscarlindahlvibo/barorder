import type { AppUser, UserRole } from './supabase';

export async function hashPassword(password: string) {
  const encoded = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function passwordMatches(user: AppUser, password: string) {
  if (user.password_hash) {
    return user.password_hash === await hashPassword(password);
  }

  return password === user.pin;
}

export function getUserRoles(user: AppUser): UserRole[] {
  const roles = Array.isArray(user.roles) && user.roles.length > 0 ? user.roles : [user.role];
  const uniqueRoles = Array.from(new Set(roles));
  return uniqueRoles.includes('admin')
    ? ['admin', 'barpersonal', 'lager', 'personal', 'serveringsansvarig', 'kitchen', 'kitchen_display', 'schedule_display', 'exhibition_display', 'event_planning', 'staff_ledger']
    : uniqueRoles;
}

export function withSelectedRole(user: AppUser, role: UserRole): AppUser {
  return {
    ...user,
    role,
    roles: getUserRoles(user),
  };
}

export function viewForRole(role: UserRole) {
  if (role === 'kitchen') return 'kitchen-dashboard';
  if (role === 'kitchen_display') return 'kitchen-display';
  if (role === 'schedule_display') return 'schedule-display';
  if (role === 'exhibition_display') return 'exhibition-display';
  if (role === 'event_planning') return 'event-planning';
  if (role === 'staff_ledger') return 'staff-ledger';
  if (role === 'serveringsansvarig') return 'serving-dashboard';
  if (role === 'personal') return 'staff-dashboard';
  if (role === 'lager' || role === 'admin') return 'dashboard';
  return 'location-select';
}

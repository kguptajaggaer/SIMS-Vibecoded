import type { User } from './types'
import { supabase } from './supabase'

// Cache permissions per session
let permissionsCache: string[] | null = null

export async function getUserPermissions(user: User): Promise<string[]> {
  if (!user.role_id) return []
  if (permissionsCache) return permissionsCache

  const { data } = await supabase
    .from('role_permissions')
    .select('permissions(permission_key)')
    .eq('role_id', user.role_id)

  const keys = (data || []).flatMap(
    (r: { permissions: { permission_key: string } | null }) =>
      r.permissions ? [r.permissions.permission_key] : []
  )
  permissionsCache = keys
  return keys
}

export function clearPermissionsCache(): void {
  permissionsCache = null
}

export async function hasPermission(user: User, key: string): Promise<boolean> {
  if (user.user_type === 'internal') {
    const perms = await getUserPermissions(user)
    return perms.includes(key)
  }
  return false
}

// Role-based shorthand checks (synchronous, based on role name stored on User)
export function isAdmin(user: User | null): boolean {
  return !!(user && user.user_type === 'internal' && (user.role as { name?: string })?.name === 'admin')
}

export function isSupplierUser(user: User | null): boolean {
  return !!(user && user.user_type === 'supplier')
}

export function isInternalUser(user: User | null): boolean {
  return !!(user && user.user_type === 'internal')
}

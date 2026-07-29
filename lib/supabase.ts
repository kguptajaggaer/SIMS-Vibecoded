import { createClient } from '@supabase/supabase-js'
import type { User } from './types'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const SESSION_KEY = 'sims_user'

export function getUser(): User | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveUser(user: User): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user))
}

export function removeUser(): void {
  localStorage.removeItem(SESSION_KEY)
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

export function formatDateShort(dateStr: string): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatPct(value: number | null | undefined): string {
  if (value == null) return '—'
  return `${value.toFixed(2)}%`
}

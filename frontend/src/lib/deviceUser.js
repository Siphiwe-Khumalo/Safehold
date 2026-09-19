import { api } from './api'

// Device-based identity for the MVP (no login required before an emergency).
// We persist the server-issued user id locally. Real accounts can be layered
// on later without changing this contract.
const KEY = 'safehold.userId'

export function getStoredUserId() {
  return localStorage.getItem(KEY)
}

/**
 * Returns a stable user id, registering a new anonymous device user with the
 * backend on first use. Falls back to null if the backend is unreachable so
 * the emergency UI still functions locally.
 */
export async function ensureUserId() {
  const existing = getStoredUserId()
  if (existing) return existing
  try {
    const user = await api.registerDevice()
    localStorage.setItem(KEY, user.id)
    return user.id
  } catch {
    return null
  }
}

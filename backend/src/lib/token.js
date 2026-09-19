import { randomBytes } from 'node:crypto'

// Unpredictable, URL-safe share token for tracking links.
// 32 bytes = 256 bits of entropy, base64url encoded.
export function generateShareToken() {
  return randomBytes(32).toString('base64url')
}

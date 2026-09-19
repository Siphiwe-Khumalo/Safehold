import { query } from '../db/pool.js'
import { HttpError } from '../lib/http.js'

// Creates an anonymous device user (MVP identity model).
export async function createUser() {
  const { rows } = await query(
    'INSERT INTO users DEFAULT VALUES RETURNING id, created_at',
  )
  return { id: rows[0].id, createdAt: rows[0].created_at }
}

// Ensures a user id exists; used to authorise ownership of contacts/incidents.
export async function assertUserExists(userId) {
  if (!userId) throw new HttpError(400, 'userId is required')
  const { rows } = await query('SELECT id FROM users WHERE id = $1', [userId])
  if (rows.length === 0) throw new HttpError(404, 'Unknown user')
}

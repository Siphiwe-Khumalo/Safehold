import { query } from '../db/pool.js'
import { HttpError } from '../lib/http.js'
import { mapContact } from './mappers.js'

export async function listContacts(userId) {
  const { rows } = await query(
    'SELECT * FROM trusted_contacts WHERE user_id = $1 ORDER BY created_at',
    [userId],
  )
  return rows.map(mapContact)
}

// Enabled contacts only — used when firing notifications.
export async function listEnabledContacts(userId) {
  const { rows } = await query(
    'SELECT * FROM trusted_contacts WHERE user_id = $1 AND enabled = TRUE',
    [userId],
  )
  return rows.map(mapContact)
}

export async function createContact(userId, { name, phone, email, relationship }) {
  const { rows } = await query(
    `INSERT INTO trusted_contacts (user_id, name, phone, email, relationship)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [userId, name, phone, email, relationship],
  )
  return mapContact(rows[0])
}

export async function updateContact(userId, id, fields) {
  // Build a partial update from provided fields only.
  const allowed = ['name', 'phone', 'email', 'relationship', 'enabled']
  const sets = []
  const values = []
  let i = 1
  for (const key of allowed) {
    if (key in fields) {
      sets.push(`${key} = $${i++}`)
      values.push(fields[key])
    }
  }
  if (sets.length === 0) throw new HttpError(400, 'No fields to update')
  values.push(id, userId)
  const { rows } = await query(
    `UPDATE trusted_contacts SET ${sets.join(', ')}
     WHERE id = $${i++} AND user_id = $${i} RETURNING *`,
    values,
  )
  if (rows.length === 0) throw new HttpError(404, 'Contact not found')
  return mapContact(rows[0])
}

export async function deleteContact(userId, id) {
  const { rowCount } = await query(
    'DELETE FROM trusted_contacts WHERE id = $1 AND user_id = $2',
    [id, userId],
  )
  if (rowCount === 0) throw new HttpError(404, 'Contact not found')
}

import { query, withTransaction } from '../db/pool.js'
import { HttpError } from '../lib/http.js'
import { generateShareToken } from '../lib/token.js'
import { mapIncident, mapIncidentPublic } from './mappers.js'
import { listEnabledContacts } from './contactService.js'
import { notifier } from '../notifications/index.js'

const END_STATUSES = ['RESOLVED', 'CANCELLED']

/**
 * Create a new ACTIVE incident for a user, optionally with an initial location.
 * Fires the "emergency started" notification to enabled trusted contacts.
 */
export async function createIncident(userId, location) {
  const shareToken = generateShareToken()

  const incident = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO incidents (user_id, status, share_token, last_lat, last_lng, last_accuracy, last_location_at)
       VALUES ($1, 'ACTIVE', $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        userId,
        shareToken,
        location?.lat ?? null,
        location?.lng ?? null,
        location?.accuracy ?? null,
        location?.recordedAt ?? (location ? new Date().toISOString() : null),
      ],
    )
    const created = rows[0]

    // Record the first location in history too, so the trail is complete.
    if (location?.lat != null && location?.lng != null) {
      await client.query(
        `INSERT INTO location_updates (incident_id, lat, lng, accuracy, recorded_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          created.id,
          location.lat,
          location.lng,
          location.accuracy ?? null,
          location.recordedAt ?? new Date().toISOString(),
        ],
      )
    }
    return created
  })

  const mapped = mapIncident(incident)

  // Notify contacts (best-effort — never blocks the emergency from being active).
  fireAndForget(async () => {
    const contacts = await listEnabledContacts(userId)
    if (contacts.length) await notifier.notifyEmergencyStarted(mapped, contacts)
  })

  return mapped
}

// Public tracking lookup by secure token.
export async function getIncidentByToken(token) {
  const { rows } = await query('SELECT * FROM incidents WHERE share_token = $1', [
    token,
  ])
  if (rows.length === 0) throw new HttpError(404, 'Incident not found')
  return mapIncidentPublic(rows[0])
}

/**
 * Update an incident's status. Only the owning user may do so.
 * Ending the incident (RESOLVED/CANCELLED) fires the "ended" notification once.
 */
export async function updateIncidentStatus(userId, incidentId, status) {
  if (!['ACTIVE', ...END_STATUSES].includes(status)) {
    throw new HttpError(400, 'Invalid status')
  }

  const { rows } = await query(
    `UPDATE incidents SET status = $1, updated_at = now()
     WHERE id = $2 AND user_id = $3
     RETURNING *`,
    [status, incidentId, userId],
  )
  if (rows.length === 0) throw new HttpError(404, 'Incident not found')
  const mapped = mapIncident(rows[0])

  if (END_STATUSES.includes(status)) {
    fireAndForget(async () => {
      const contacts = await listEnabledContacts(userId)
      if (contacts.length) await notifier.notifyEmergencyEnded(mapped, contacts)
    })
  }

  return mapped
}

/**
 * Append a location update to an ACTIVE incident and refresh its latest
 * denormalised location. Ignored (409) if the incident is no longer active.
 */
export async function addLocation(userId, incidentId, { lat, lng, accuracy, recordedAt }) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      'SELECT status FROM incidents WHERE id = $1 AND user_id = $2 FOR UPDATE',
      [incidentId, userId],
    )
    if (rows.length === 0) throw new HttpError(404, 'Incident not found')
    if (rows[0].status !== 'ACTIVE') {
      throw new HttpError(409, 'Incident is not active')
    }

    const ts = recordedAt || new Date().toISOString()
    await client.query(
      `INSERT INTO location_updates (incident_id, lat, lng, accuracy, recorded_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [incidentId, lat, lng, accuracy ?? null, ts],
    )
    const { rows: updated } = await client.query(
      `UPDATE incidents
       SET last_lat = $1, last_lng = $2, last_accuracy = $3, last_location_at = $4, updated_at = now()
       WHERE id = $5 RETURNING *`,
      [lat, lng, accuracy ?? null, ts, incidentId],
    )
    return mapIncident(updated[0])
  })
}

// Runs async side-effects without blocking the request; logs failures.
function fireAndForget(fn) {
  Promise.resolve()
    .then(fn)
    .catch((err) => console.error('[incident] notification error:', err.message))
}

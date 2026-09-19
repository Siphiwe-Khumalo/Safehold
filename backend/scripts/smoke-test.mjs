// End-to-end smoke test: boots the Express app in-process and exercises the
// full emergency flow against a real Postgres. Run after migrations.
import { createApp } from '../src/app.js'
import { pool } from '../src/db/pool.js'

const app = createApp()
const server = app.listen(0)
const base = `http://127.0.0.1:${server.address().port}`

let failures = 0
function check(name, cond) {
  console.log(`${cond ? '✓' : '✗'} ${name}`)
  if (!cond) failures++
}

async function req(method, path, body) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = text
  }
  return { status: res.status, json }
}

try {
  // Health
  const health = await req('GET', '/api/health')
  check('health returns ok', health.status === 200 && health.json.status === 'ok')

  // Register device user
  const user = await req('POST', '/api/users')
  check('create user 201 + id', user.status === 201 && !!user.json.id)
  const userId = user.json.id

  // Add a trusted contact (with email so the email path is exercised)
  const contact = await req('POST', '/api/contacts', {
    userId,
    name: 'Thandi',
    phone: '+27123456789',
    email: 'thandi@example.com',
    relationship: 'Sister',
  })
  check('create contact 201', contact.status === 201 && contact.json.enabled === true)

  const list = await req('GET', `/api/contacts?userId=${userId}`)
  check('list contacts has 1', list.status === 200 && list.json.length === 1)

  // Create incident with initial location
  const incident = await req('POST', '/api/incidents', {
    userId,
    location: { lat: -33.9249, lng: 18.4241, accuracy: 12 },
  })
  check(
    'create incident ACTIVE + share_token',
    incident.status === 201 &&
      incident.json.status === 'ACTIVE' &&
      typeof incident.json.shareToken === 'string' &&
      incident.json.shareToken.length > 20,
  )
  const { id: incidentId, shareToken } = incident.json

  // Public tracking view by token — must NOT leak userId/shareToken
  const track = await req('GET', `/api/incidents/track/${shareToken}`)
  check(
    'track by token returns status+location',
    track.status === 200 &&
      track.json.status === 'ACTIVE' &&
      Math.abs(track.json.lastLat - -33.9249) < 1e-6,
  )
  check(
    'track view hides userId and shareToken',
    !('userId' in track.json) && !('shareToken' in track.json),
  )

  // Invalid token -> 404
  const bad = await req('GET', '/api/incidents/track/not-a-real-token')
  check('unknown token 404', bad.status === 404)

  // Append a location update
  const loc = await req('POST', `/api/incidents/${incidentId}/locations`, {
    userId,
    lat: -33.925,
    lng: 18.425,
    accuracy: 8,
  })
  check('add location 200 + latest updated', loc.status === 200 && loc.json.lastAccuracy === 8)

  // History row count
  const hist = await pool.query(
    'SELECT count(*)::int AS n FROM location_updates WHERE incident_id = $1',
    [incidentId],
  )
  check('location history has 2 rows', hist.rows[0].n === 2)

  // Resolve incident
  const resolved = await req('PATCH', `/api/incidents/${incidentId}/status`, {
    userId,
    status: 'RESOLVED',
  })
  check('resolve incident', resolved.status === 200 && resolved.json.status === 'RESOLVED')

  // Location updates now rejected (409) because not ACTIVE
  const afterResolve = await req('POST', `/api/incidents/${incidentId}/locations`, {
    userId,
    lat: -33.926,
    lng: 18.426,
  })
  check('location rejected after resolve (409)', afterResolve.status === 409)

  // Ownership enforcement: another user cannot resolve someone else's incident
  const otherUser = (await req('POST', '/api/users')).json
  const steal = await req('PATCH', `/api/incidents/${incidentId}/status`, {
    userId: otherUser.id,
    status: 'CANCELLED',
  })
  check('cannot modify another user incident (404)', steal.status === 404)

  // Validation: missing name
  const badContact = await req('POST', '/api/contacts', { userId, phone: '123' })
  check('missing name rejected (400)', badContact.status === 400)
} catch (err) {
  console.error('Smoke test crashed:', err)
  failures++
} finally {
  server.close()
  await pool.end()
}

console.log(failures === 0 ? '\nALL SMOKE TESTS PASSED' : `\n${failures} CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)

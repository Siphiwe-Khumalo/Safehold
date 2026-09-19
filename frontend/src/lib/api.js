// Thin API client. All calls go through the Vite dev proxy (/api -> backend).
// In production set VITE_API_BASE to the backend origin.
const BASE = import.meta.env.VITE_API_BASE ?? ''

async function request(path, { method = 'GET', body, headers } = {}) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    let detail
    try {
      detail = await res.json()
    } catch {
      detail = { error: res.statusText }
    }
    const err = new Error(detail.error || `Request failed (${res.status})`)
    err.status = res.status
    err.detail = detail
    throw err
  }
  if (res.status === 204) return null
  return res.json()
}

export const api = {
  // Device identity
  registerDevice: () => request('/users', { method: 'POST' }),

  // Incidents
  createIncident: (userId, location) =>
    request('/incidents', { method: 'POST', body: { userId, location } }),
  getIncidentByToken: (token) => request(`/incidents/track/${token}`),
  updateIncidentStatus: (id, userId, status) =>
    request(`/incidents/${id}/status`, {
      method: 'PATCH',
      body: { userId, status },
    }),
  addLocation: (id, userId, location) =>
    request(`/incidents/${id}/locations`, {
      method: 'POST',
      body: { userId, ...location },
    }),

  // Trusted contacts
  listContacts: (userId) => request(`/contacts?userId=${encodeURIComponent(userId)}`),
  createContact: (userId, contact) =>
    request('/contacts', { method: 'POST', body: { userId, ...contact } }),
  updateContact: (id, userId, contact) =>
    request(`/contacts/${id}`, { method: 'PATCH', body: { userId, ...contact } }),
  deleteContact: (id, userId) =>
    request(`/contacts/${id}?userId=${encodeURIComponent(userId)}`, {
      method: 'DELETE',
    }),
}

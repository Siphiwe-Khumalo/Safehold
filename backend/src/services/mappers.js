// Convert DB rows (snake_case) to API shapes (camelCase).

export function mapContact(row) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    relationship: row.relationship,
    enabled: row.enabled,
    createdAt: row.created_at,
  }
}

export function mapIncident(row) {
  return {
    id: row.id,
    userId: row.user_id,
    status: row.status,
    shareToken: row.share_token,
    lastLat: row.last_lat,
    lastLng: row.last_lng,
    lastAccuracy: row.last_accuracy,
    lastLocationAt: row.last_location_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// Public tracking view — deliberately omits user_id and share_token internals
// beyond what the contact needs. No personal data.
export function mapIncidentPublic(row) {
  return {
    status: row.status,
    lastLat: row.last_lat,
    lastLng: row.last_lng,
    lastAccuracy: row.last_accuracy,
    lastLocationAt: row.last_location_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

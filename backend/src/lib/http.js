// Small helpers for consistent HTTP behaviour.

// An error carrying an HTTP status code, thrown by services/routes.
export class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

// Wrap an async route handler so thrown errors reach the error middleware.
export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)
}

// Basic validators used by routes.
export function requireString(value, field, { max = 500 } = {}) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new HttpError(400, `${field} is required`)
  }
  if (value.length > max) {
    throw new HttpError(400, `${field} is too long`)
  }
  return value.trim()
}

export function optionalString(value, field, { max = 500 } = {}) {
  if (value == null || value === '') return null
  return requireString(value, field, { max })
}

export function requireNumber(value, field) {
  const n = typeof value === 'string' ? Number(value) : value
  if (typeof n !== 'number' || Number.isNaN(n)) {
    throw new HttpError(400, `${field} must be a number`)
  }
  return n
}

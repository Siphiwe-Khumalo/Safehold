import { Router } from 'express'
import { asyncHandler, requireString, requireNumber } from '../lib/http.js'
import { assertUserExists } from '../services/userService.js'
import {
  createIncident,
  getIncidentByToken,
  updateIncidentStatus,
  addLocation,
} from '../services/incidentService.js'

export const incidentsRouter = Router()

function parseLocation(input) {
  if (!input || input.lat == null || input.lng == null) return null
  return {
    lat: requireNumber(input.lat, 'lat'),
    lng: requireNumber(input.lng, 'lng'),
    accuracy: input.accuracy == null ? null : requireNumber(input.accuracy, 'accuracy'),
    recordedAt: typeof input.recordedAt === 'string' ? input.recordedAt : null,
  }
}

// POST /api/incidents — create + activate an emergency.
incidentsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { userId } = req.body
    await assertUserExists(userId)
    const incident = await createIncident(userId, parseLocation(req.body.location))
    res.status(201).json(incident)
  }),
)

// GET /api/incidents/track/:token — public tracking view for contacts.
incidentsRouter.get(
  '/track/:token',
  asyncHandler(async (req, res) => {
    const incident = await getIncidentByToken(req.params.token)
    // Tracking data is sensitive — never let it be cached by proxies/CDNs.
    res.set('Cache-Control', 'no-store')
    res.json(incident)
  }),
)

// PATCH /api/incidents/:id/status — resolve/cancel (owner only).
incidentsRouter.patch(
  '/:id/status',
  asyncHandler(async (req, res) => {
    const { userId } = req.body
    await assertUserExists(userId)
    const status = requireString(req.body.status, 'status')
    const incident = await updateIncidentStatus(userId, req.params.id, status)
    res.json(incident)
  }),
)

// POST /api/incidents/:id/locations — append a live location update (owner only).
incidentsRouter.post(
  '/:id/locations',
  asyncHandler(async (req, res) => {
    const { userId } = req.body
    await assertUserExists(userId)
    const loc = parseLocation(req.body)
    if (!loc) {
      res.status(400).json({ error: 'lat and lng are required' })
      return
    }
    const incident = await addLocation(userId, req.params.id, loc)
    res.json(incident)
  }),
)

import { Router } from 'express'
import { asyncHandler, requireString, optionalString } from '../lib/http.js'
import { assertUserExists } from '../services/userService.js'
import {
  listContacts,
  createContact,
  updateContact,
  deleteContact,
} from '../services/contactService.js'

export const contactsRouter = Router()

// GET /api/contacts?userId=...
contactsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const userId = req.query.userId
    await assertUserExists(userId)
    res.json(await listContacts(userId))
  }),
)

// POST /api/contacts
contactsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { userId } = req.body
    await assertUserExists(userId)
    const contact = await createContact(userId, {
      name: requireString(req.body.name, 'name', { max: 120 }),
      phone: requireString(req.body.phone, 'phone', { max: 40 }),
      email: optionalString(req.body.email, 'email', { max: 200 }),
      relationship: optionalString(req.body.relationship, 'relationship', { max: 80 }),
    })
    res.status(201).json(contact)
  }),
)

// PATCH /api/contacts/:id
contactsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const { userId } = req.body
    await assertUserExists(userId)

    const fields = {}
    if ('name' in req.body) fields.name = requireString(req.body.name, 'name', { max: 120 })
    if ('phone' in req.body) fields.phone = requireString(req.body.phone, 'phone', { max: 40 })
    if ('email' in req.body) fields.email = optionalString(req.body.email, 'email', { max: 200 })
    if ('relationship' in req.body)
      fields.relationship = optionalString(req.body.relationship, 'relationship', { max: 80 })
    if ('enabled' in req.body) fields.enabled = Boolean(req.body.enabled)

    const contact = await updateContact(userId, req.params.id, fields)
    res.json(contact)
  }),
)

// DELETE /api/contacts/:id?userId=...
contactsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const userId = req.query.userId
    await assertUserExists(userId)
    await deleteContact(userId, req.params.id)
    res.status(204).end()
  }),
)

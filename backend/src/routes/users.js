import { Router } from 'express'
import { asyncHandler } from '../lib/http.js'
import { createUser } from '../services/userService.js'

export const usersRouter = Router()

// POST /api/users — register an anonymous device user.
usersRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const user = await createUser()
    res.status(201).json(user)
  }),
)

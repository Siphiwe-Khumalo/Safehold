import express from 'express'
import cors from 'cors'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { existsSync } from 'node:fs'
import { config } from './config.js'
import { usersRouter } from './routes/users.js'
import { contactsRouter } from './routes/contacts.js'
import { incidentsRouter } from './routes/incidents.js'
import { notFound, errorHandler } from './middleware/errors.js'

const __dir = dirname(fileURLToPath(import.meta.url))
// backend/src -> ../../frontend/dist
const FRONTEND_DIST = join(__dir, '..', '..', 'frontend', 'dist')

export function createApp() {
  const app = express()
  app.disable('x-powered-by')

  app.use(
    cors({
      origin: config.corsOrigins.length ? config.corsOrigins : true,
    }),
  )
  app.use(express.json({ limit: '64kb' }))

  app.get('/api/health', (req, res) => res.json({ status: 'ok' }))

  app.use('/api/users', usersRouter)
  app.use('/api/contacts', contactsRouter)
  app.use('/api/incidents', incidentsRouter)

  // Unknown API routes -> JSON 404.
  app.use('/api', notFound)

  // In production, serve the built PWA and hand client-side routes back to the
  // SPA (index.html). Anything under /api is excluded above.
  if (config.serveStatic && existsSync(FRONTEND_DIST)) {
    app.use(express.static(FRONTEND_DIST))
    app.get('*', (req, res) => {
      res.sendFile(join(FRONTEND_DIST, 'index.html'))
    })
  } else {
    // No static bundle (pure API mode): non-API routes -> JSON 404.
    app.use(notFound)
  }

  app.use(errorHandler)

  return app
}

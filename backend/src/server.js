import { createApp } from './app.js'
import { config } from './config.js'
import { pool } from './db/pool.js'

const app = createApp()

const server = app.listen(config.port, () => {
  console.log(`SafeHold backend listening on http://localhost:${config.port}`)
  console.log(`Notification provider: ${config.notify.provider}`)
})

// Graceful shutdown.
async function shutdown(signal) {
  console.log(`\n${signal} received, shutting down…`)
  server.close(async () => {
    await pool.end()
    process.exit(0)
  })
}
process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

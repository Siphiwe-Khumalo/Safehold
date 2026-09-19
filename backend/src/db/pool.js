import pg from 'pg'
import { config } from '../config.js'

// Single shared connection pool for the process.
// Most managed Postgres providers (Neon, Supabase, Heroku, external Render)
// require SSL. Set DATABASE_SSL=true for those; local Docker Postgres does not.
export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined,
})

export function query(text, params) {
  return pool.query(text, params)
}

// Run a set of statements inside a transaction.
export async function withTransaction(fn) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

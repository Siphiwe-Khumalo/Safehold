// Minimal, transparent SQL migration runner.
// Applies every *.sql file in ./migrations in filename order, exactly once,
// tracking applied files in the schema_migrations table.
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pool } from './pool.js'

const __dir = dirname(fileURLToPath(import.meta.url))
const migrationsDir = join(__dir, 'migrations')

async function run() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)

  const applied = new Set(
    (await pool.query('SELECT filename FROM schema_migrations')).rows.map(
      (r) => r.filename,
    ),
  )

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  let count = 0
  for (const file of files) {
    if (applied.has(file)) continue
    const sql = readFileSync(join(migrationsDir, file), 'utf8')
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(sql)
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [
        file,
      ])
      await client.query('COMMIT')
      console.log(`✓ applied ${file}`)
      count++
    } catch (err) {
      await client.query('ROLLBACK')
      console.error(`✗ failed ${file}:`, err.message)
      throw err
    } finally {
      client.release()
    }
  }

  console.log(count === 0 ? 'No new migrations.' : `Applied ${count} migration(s).`)
  await pool.end()
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})

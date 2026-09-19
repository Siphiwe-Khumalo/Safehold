import 'dotenv/config'

// In production (single-service deploy) the backend serves the built PWA and
// the tracking link is same-origin. Prefer an explicit PUBLIC_APP_URL, then
// Render's auto-injected external URL, then the local dev default.
const publicAppUrl =
  process.env.PUBLIC_APP_URL ||
  process.env.RENDER_EXTERNAL_URL ||
  'http://localhost:5173'

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  databaseUrl:
    process.env.DATABASE_URL ||
    'postgres://safehold:safehold@localhost:5432/safehold',
  databaseSsl: process.env.DATABASE_SSL === 'true',
  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  publicAppUrl,
  // When true, Express serves the frontend build (frontend/dist) and falls back
  // to index.html for client-side routes. Enabled automatically in production.
  serveStatic:
    process.env.SERVE_STATIC === 'true' || process.env.NODE_ENV === 'production',
  notify: {
    provider: process.env.NOTIFY_PROVIDER || 'console',
    smtp: {
      host: process.env.SMTP_HOST || '',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
      from: process.env.SMTP_FROM || 'SafeHold <alerts@example.com>',
    },
  },
}

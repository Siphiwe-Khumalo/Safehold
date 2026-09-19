# SafeHold — Personal Safety PWA (MVP)

A personal safety Progressive Web App designed primarily for women in South Africa.
If a user feels unsafe, she can trigger an emergency alert within seconds and notify
trusted contacts with her live location.

> **MVP scope.** This is an intentionally small, honest MVP. Where a browser cannot
> reliably do something native (background location, SMS, calling, smartwatch), we say
> so and design the architecture so it can be added later.

## Repository layout

```
safety-pwa/
├── frontend/          # React + Vite + Tailwind + PWA (installable)
├── backend/           # Node + Express + PostgreSQL
├── docker-compose.yml # PostgreSQL for local development
└── README.md
```

## Architecture at a glance

- **Frontend** — React 18 + Vite + Tailwind, mobile-first and high-contrast. Installable
  PWA (`vite-plugin-pwa`). The emergency screen loads instantly; the map (Leaflet +
  OpenStreetMap) only loads on the contact tracking page.
- **Backend** — Express REST API (JSON only), PostgreSQL via the `pg` driver with plain
  SQL migrations. Layered `routes → services → db`. No web-only assumptions, so native
  apps can reuse the same API later.
- **Identity (MVP)** — anonymous, device-based. The app registers a `user` on first
  launch and stores the id in `localStorage`. No login is required before an emergency.
  Real accounts can be layered on later without changing this contract.
- **Security** — tracking links use unpredictable 256-bit tokens (not sequential ids);
  the public tracking view exposes only status + latest location (no name, phone, or
  contact list); tracking responses are `Cache-Control: no-store`; minimal PII stored.

### Data model

| Table | Purpose |
|---|---|
| `users` | Anonymous device users. |
| `trusted_contacts` | Name, phone, email, relationship, enabled flag. |
| `incidents` | Status (`ACTIVE`/`RESOLVED`/`CANCELLED`), timestamps, **latest** location, unique `share_token`. |
| `location_updates` | Full location history — written from day one, so history features need no rewrite. |

## Prerequisites

- Node.js 18+ (tested on 22)
- Docker + Docker Compose (for local PostgreSQL), **or** your own PostgreSQL and a
  `DATABASE_URL`.

---

## Running locally

### 1. Start PostgreSQL

```bash
docker compose up -d      # starts Postgres on localhost:5432
```

(Or point `DATABASE_URL` at any existing PostgreSQL instance.)

### 2. Backend

```bash
cd backend
cp .env.example .env      # defaults match docker-compose.yml
npm install
npm run migrate           # creates the schema
npm run dev               # http://localhost:4000
```

Quick checks:

```bash
curl http://localhost:4000/api/health        # {"status":"ok"}
npm run smoke                                 # full end-to-end API test (needs DB + migrations)
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev               # prints a local + network URL (Vite)
```

Open the printed URL. The **HOLD FOR HELP** screen loads first. The dev server proxies
`/api` to the backend on port 4000, so no CORS setup is needed.

> **HTTPS note.** Geolocation and PWA install require a secure context. `localhost` is
> treated as secure by browsers. To test on a phone over your LAN, use an HTTPS tunnel
> (e.g. a dev tunnel/ngrok) or Vite's HTTPS option, otherwise location will be blocked.

---

## Using the app

1. **Home** — "Are you safe?" with the large **HOLD FOR HELP** button. Hold ~3 seconds
   (accidental-press protection) to trigger.
2. On activation the app gets your location, creates an **ACTIVE** incident, starts
   streaming location updates, and notifies enabled trusted contacts.
3. A **tracking link** is shown; contacts open it to see live status + location on a map.
4. **Resolve** ("I'm safe now") or **Cancel** (false alarm) ends the incident and updates
   contacts.
5. **Trusted contacts** — add/enable/disable/remove the people who get alerted.

---

## Notifications

All alerts go through one `NotificationProvider` interface (`backend/src/notifications/`).

| Channel | Status | Notes |
|---|---|---|
| Console | ✅ default | Logs the exact alert (great for local dev). |
| Email (SMTP) | ✅ real | Set `NOTIFY_PROVIDER=smtp` + `SMTP_*` env vars. Sends via `nodemailer`. |
| SMS | ⚠️ not implemented | Requires a paid provider (Twilio/Clickatell). Interface is ready. |
| Web Push | ⚠️ not implemented | Requires VAPID keys + stored subscriptions. Interface is ready. |

We deliberately **do not fake** SMS/push delivery — unconfigured channels log a clear
warning instead of pretending to succeed. See `backend/src/notifications/README.md`.

---

## Honest browser/PWA limitations (designed around, not hidden)

| Capability | Reality in a PWA | Plan |
|---|---|---|
| Background location | Unreliable — browsers suspend JS when backgrounded. | V1 tracks only while the app is foregrounded and the emergency is active. Native app needed for true background tracking. |
| SMS sending | Impossible from the browser. | `NotificationProvider` + external provider (native/server). |
| Emergency calling | Can only offer a tap-to-call `tel:` link. | Surface tap-to-call, not auto-dial. |
| Web Push | Possible but needs VAPID + provider. | Interface stubbed; wire later. |
| Smartwatch | Not from a PWA. | Separate native effort; API stays compatible. |

---

## API reference (MVP)

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/users` | Register an anonymous device user. |
| `GET` | `/api/contacts?userId=` | List trusted contacts. |
| `POST` | `/api/contacts` | Create a contact. |
| `PATCH` | `/api/contacts/:id` | Update a contact (incl. enable/disable). |
| `DELETE` | `/api/contacts/:id?userId=` | Delete a contact. |
| `POST` | `/api/incidents` | Create + activate an emergency. |
| `GET` | `/api/incidents/track/:token` | Public tracking view (status + latest location). |
| `POST` | `/api/incidents/:id/locations` | Append a live location update. |
| `PATCH` | `/api/incidents/:id/status` | Resolve/cancel an incident. |

Ownership is enforced via `userId`; incidents/contacts of other users return `404`.


---

## Deploy (make it public)

The app is packaged as a **single service**: in production the backend serves the
built PWA *and* the API from one HTTPS origin (no CORS setup, one URL to share).

### Option A — Render (recommended, one blueprint)

1. Push this repo to GitHub (already done if you used the assistant).
2. Go to <https://render.com> → **New → Blueprint** → connect this repo.
3. Render reads [`render.yaml`](./render.yaml) and provisions:
   - a **managed PostgreSQL** database, and
   - a **web service** that builds the PWA, runs migrations, and starts the server.
   `DATABASE_URL` is wired automatically; `RENDER_EXTERNAL_URL` is used for tracking
   links, so there is nothing else to configure to go live.
4. Open the service URL — that's your public app. To send real emails later, set
   `NOTIFY_PROVIDER=smtp` and the `SMTP_*` vars in the Render dashboard.

> Render's free Postgres/web tiers are fine for a demo; upgrade the plans in
> `render.yaml` for real traffic.

### Option B — Any container host (Docker)

A multi-stage [`Dockerfile`](./Dockerfile) builds one image (PWA + API):

```bash
docker build -t safehold .
docker run -p 4000:4000 \
  -e DATABASE_URL='postgres://user:pass@host:5432/db' \
  -e DATABASE_SSL=true \
  safehold
```

Point it at any managed Postgres (Neon, Supabase, RDS, Railway…). Deploy the image
to Fly.io, Railway, Cloud Run, etc. The container runs migrations on start.

### Production notes

- **HTTPS is required** for geolocation + PWA install — every option above provides it.
- Set `PUBLIC_APP_URL` if your public URL isn't auto-detected (Render sets it for you).
- `NODE_ENV=production` enables static PWA serving automatically.

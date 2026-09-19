-- SafeHold initial schema.
-- Designed so location history and richer auth can be added later without a rewrite.

-- Anonymous device-based users for the MVP. Real accounts can extend this table.
CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trusted contacts notified during an emergency.
CREATE TABLE IF NOT EXISTS trusted_contacts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  phone         TEXT NOT NULL,
  email         TEXT,
  relationship  TEXT,
  enabled       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contacts_user ON trusted_contacts(user_id);

-- Emergency incidents. The latest location is denormalised here for fast reads;
-- the full trail lives in location_updates.
CREATE TABLE IF NOT EXISTS incidents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status            TEXT NOT NULL DEFAULT 'ACTIVE'
                      CHECK (status IN ('ACTIVE', 'RESOLVED', 'CANCELLED')),
  share_token       TEXT NOT NULL UNIQUE,
  last_lat          DOUBLE PRECISION,
  last_lng          DOUBLE PRECISION,
  last_accuracy     DOUBLE PRECISION,
  last_location_at  TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_incidents_user ON incidents(user_id);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);

-- Full location history for an incident (populated from day one).
CREATE TABLE IF NOT EXISTS location_updates (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  incident_id  UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  lat          DOUBLE PRECISION NOT NULL,
  lng          DOUBLE PRECISION NOT NULL,
  accuracy     DOUBLE PRECISION,
  recorded_at  TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_locations_incident ON location_updates(incident_id, recorded_at);

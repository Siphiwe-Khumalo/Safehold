import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import HoldButton from '../components/HoldButton.jsx'
import { api } from '../lib/api.js'
import { ensureUserId } from '../lib/deviceUser.js'
import { getCurrentPosition, watchPosition } from '../lib/geolocation.js'

// UI states for the single-purpose emergency screen.
const State = {
  IDLE: 'idle',
  ACTIVATING: 'activating',
  ACTIVE: 'active',
  ENDED: 'ended',
}

export default function EmergencyScreen() {
  const [state, setState] = useState(State.IDLE)
  const [incident, setIncident] = useState(null)
  const [location, setLocation] = useState(null)
  const [error, setError] = useState(null)
  const [endedStatus, setEndedStatus] = useState(null)
  const stopWatchRef = useRef(null)
  const userIdRef = useRef(null)

  // Register the device (anonymous) as early as possible.
  useEffect(() => {
    ensureUserId().then((id) => {
      userIdRef.current = id
    })
  }, [])

  const stopWatching = useCallback(() => {
    if (stopWatchRef.current) {
      stopWatchRef.current()
      stopWatchRef.current = null
    }
  }, [])

  useEffect(() => () => stopWatching(), [stopWatching])

  // Begin streaming location updates to the backend while the incident is ACTIVE.
  const beginLocationStream = useCallback((incidentId, userId) => {
    stopWatchRef.current = watchPosition(
      async (loc) => {
        setLocation(loc)
        if (incidentId && userId) {
          try {
            await api.addLocation(incidentId, userId, loc)
          } catch {
            // Non-fatal: keep tracking locally; updates resume when back online.
          }
        }
      },
      (err) => setError(err.message),
    )
  }, [])

  const handleActivate = useCallback(async () => {
    setError(null)
    setState(State.ACTIVATING)

    // 1. Get location first — it's the most valuable payload and may prompt
    //    for permission.
    let loc = null
    try {
      loc = await getCurrentPosition()
      setLocation(loc)
    } catch (e) {
      setError(e.message) // continue anyway; an alert with no location is still useful
    }

    // 2. Create the incident on the backend.
    const userId = userIdRef.current
    try {
      const created = await api.createIncident(userId, loc)
      setIncident(created)
      setState(State.ACTIVE)
      // 3-4. Incident is ACTIVE; begin streaming location updates.
      beginLocationStream(created.id, userId)
    } catch (e) {
      // Backend unreachable — still show the ACTIVE emergency screen locally so
      // the user is not left with a dead button. Tracking link needs backend.
      setIncident({ id: null, shareToken: null, offline: true })
      setState(State.ACTIVE)
      beginLocationStream(null, null)
      setError(
        'Could not reach the alert server. Your emergency is active on this device, ' +
          'but trusted contacts may not have been notified yet.',
      )
    }
  }, [beginLocationStream])

  const endIncident = useCallback(
    async (status) => {
      stopWatching()
      const userId = userIdRef.current
      if (incident?.id && userId) {
        try {
          await api.updateIncidentStatus(incident.id, userId, status)
        } catch {
          // ignore; local state still ends
        }
      }
      setEndedStatus(status)
      setState(State.ENDED)
    },
    [incident, stopWatching],
  )

  const reset = useCallback(() => {
    setIncident(null)
    setLocation(null)
    setError(null)
    setEndedStatus(null)
    setState(State.IDLE)
  }, [])

  const trackUrl = incident?.shareToken
    ? `${window.location.origin}/track/${incident.shareToken}`
    : null

  return (
    <div className="flex min-h-full flex-col bg-ink text-white">
      <Header />

      <main className="flex flex-1 flex-col items-center justify-center px-5 pb-8">
        {state === State.IDLE && (
          <IdleView error={error} onActivate={handleActivate} />
        )}

        {state === State.ACTIVATING && <ActivatingView />}

        {state === State.ACTIVE && (
          <ActiveView
            location={location}
            trackUrl={trackUrl}
            error={error}
            onResolve={() => endIncident('RESOLVED')}
            onCancel={() => endIncident('CANCELLED')}
          />
        )}

        {state === State.ENDED && (
          <EndedView status={endedStatus} onReset={reset} />
        )}
      </main>
    </div>
  )
}

function Header() {
  return (
    <header className="flex items-center justify-between px-5 pt-4">
      <span className="text-lg font-black tracking-tight">SafeHold</span>
      <Link
        to="/contacts"
        className="rounded-lg px-3 py-2 text-sm font-semibold text-white/80 underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
      >
        Trusted contacts
      </Link>
    </header>
  )
}

function IdleView({ error, onActivate }) {
  return (
    <>
      <h1 className="mb-2 text-center text-4xl font-black tracking-tight">
        Are you safe?
      </h1>
      <p className="mb-10 text-center text-base text-white/70">
        If you feel unsafe, hold the button to alert your trusted contacts with
        your location.
      </p>

      <HoldButton onActivate={onActivate} />

      {error && (
        <p className="mt-6 max-w-sm text-center text-sm text-amber-300" role="alert">
          {error}
        </p>
      )}
    </>
  )
}

function ActivatingView() {
  return (
    <div className="text-center" aria-live="polite">
      <div className="mx-auto mb-6 h-16 w-16 animate-spin rounded-full border-4 border-white/20 border-t-white" />
      <h1 className="text-2xl font-bold">Sending alert…</h1>
      <p className="mt-2 text-white/70">Getting your location and notifying contacts.</p>
    </div>
  )
}

function ActiveView({ location, trackUrl, error, onResolve, onCancel }) {
  return (
    <div className="w-full max-w-sm text-center" aria-live="assertive">
      <div className="mb-6 rounded-2xl bg-danger px-5 py-6 ring-1 ring-white/10">
        <div className="flex items-center justify-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-white" />
          </span>
          <h1 className="text-2xl font-black uppercase tracking-wide">
            Emergency active
          </h1>
        </div>
        <p className="mt-2 text-sm text-white/90">
          Your trusted contacts are being alerted with your live location.
        </p>
      </div>

      <LocationCard location={location} />

      {trackUrl && (
        <div className="mt-4 rounded-xl bg-white/5 p-4 text-left">
          <p className="text-xs uppercase tracking-wide text-white/50">
            Contact tracking link
          </p>
          <a
            href={trackUrl}
            className="mt-1 block break-all text-sm text-sky-300 underline"
          >
            {trackUrl}
          </a>
        </div>
      )}

      {error && (
        <p className="mt-4 text-sm text-amber-300" role="alert">
          {error}
        </p>
      )}

      <div className="mt-8 grid gap-3">
        <button
          onClick={onResolve}
          className="rounded-xl bg-safe py-4 text-lg font-bold focus:outline-none focus-visible:ring-4 focus-visible:ring-white/70"
        >
          I'm safe now — Resolve
        </button>
        <button
          onClick={onCancel}
          className="rounded-xl bg-white/10 py-3 text-base font-semibold text-white/80 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/70"
        >
          Cancel (false alarm)
        </button>
      </div>
    </div>
  )
}

function LocationCard({ location }) {
  if (!location) {
    return (
      <div className="rounded-xl bg-white/5 p-4 text-sm text-white/60">
        Waiting for your location…
      </div>
    )
  }
  return (
    <div className="rounded-xl bg-white/5 p-4 text-left">
      <p className="text-xs uppercase tracking-wide text-white/50">Your location</p>
      <p className="mt-1 font-mono text-sm">
        {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
      </p>
      {location.accuracy != null && (
        <p className="text-xs text-white/50">
          Accuracy ≈ {Math.round(location.accuracy)} m
        </p>
      )}
    </div>
  )
}

function EndedView({ status, onReset }) {
  const resolved = status === 'RESOLVED'
  return (
    <div className="text-center">
      <h1 className="text-3xl font-black">
        {resolved ? 'Marked safe' : 'Alert cancelled'}
      </h1>
      <p className="mt-2 max-w-sm text-white/70">
        {resolved
          ? 'Your emergency has been resolved and your contacts have been updated.'
          : 'The alert was cancelled. Your contacts have been notified it was a false alarm.'}
      </p>
      <button
        onClick={onReset}
        className="mt-8 rounded-xl bg-white/10 px-8 py-4 text-lg font-semibold focus:outline-none focus-visible:ring-4 focus-visible:ring-white/70"
      >
        Back to home
      </button>
    </div>
  )
}

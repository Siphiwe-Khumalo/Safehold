import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import HoldButton from '../components/HoldButton.jsx'
import { api } from '../lib/api.js'
import { ensureUserId } from '../lib/deviceUser.js'
import { getCurrentPosition, watchPosition } from '../lib/geolocation.js'
import { buildEmergencyMessage, buildWaLink } from '../lib/whatsapp.js'
import WhatsAppIcon from '../components/WhatsAppIcon.jsx'

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
  const [contacts, setContacts] = useState([])
  const stopWatchRef = useRef(null)
  const userIdRef = useRef(null)
  const incidentIdRef = useRef(null)

  // Register the device (anonymous) and load enabled trusted contacts early so
  // the WhatsApp alert buttons are ready the instant an emergency starts.
  useEffect(() => {
    ensureUserId().then(async (id) => {
      userIdRef.current = id
      if (!id) return
      try {
        const list = await api.listContacts(id)
        setContacts(list.filter((c) => c.enabled && c.phone))
      } catch {
        /* contacts are optional; ignore load failure */
      }
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

  // One-shot location fix — non-blocking. Allows a recent cached position so
  // the first point appears fast, then the watch refines it.
  const captureOnce = useCallback((incidentId, userId) => {
    getCurrentPosition({ maximumAge: 60000, timeout: 12000 })
      .then((loc) => {
        setLocation(loc)
        setError(null)
        if (incidentId && userId) api.addLocation(incidentId, userId, loc).catch(() => {})
      })
      .catch((e) => setError(e.message))
  }, [])

  const handleActivate = useCallback(async () => {
    setError(null)
    setState(State.ACTIVATING)
    const userId = userIdRef.current

    // 1. Create + activate the incident IMMEDIATELY — never wait for GPS.
    //    Firing the alert fast matters more than having coordinates in the
    //    first second; the location streams in right after.
    let created = null
    try {
      created = await api.createIncident(userId, null)
      setIncident(created)
    } catch {
      // Backend unreachable — still show the ACTIVE screen locally.
      setIncident({ id: null, shareToken: null, offline: true })
      setError(
        'Could not reach the alert server. Your emergency is active on this device, ' +
          'but trusted contacts may not have been notified yet.',
      )
    }
    incidentIdRef.current = created?.id ?? null
    setState(State.ACTIVE)

    // 2. Stream location as it arrives (updates the map + backend + tracking link).
    beginLocationStream(created?.id ?? null, userId)
    // 3. Kick off a fast first fix in parallel (does not block anything).
    captureOnce(created?.id ?? null, userId)
  }, [beginLocationStream, captureOnce])

  // Let the user re-request location if it was blocked/slow, without ending
  // the emergency.
  const retryLocation = useCallback(() => {
    setError(null)
    stopWatching()
    const userId = userIdRef.current
    const id = incidentIdRef.current
    beginLocationStream(id, userId)
    captureOnce(id, userId)
  }, [beginLocationStream, captureOnce, stopWatching])

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
            contacts={contacts}
            onRetryLocation={retryLocation}
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
      <nav className="flex items-center gap-1">
        <Link
          to="/map"
          className="rounded-lg px-3 py-2 text-sm font-semibold text-white/80 underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          My map
        </Link>
        <Link
          to="/contacts"
          className="rounded-lg px-3 py-2 text-sm font-semibold text-white/80 underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          Contacts
        </Link>
      </nav>
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

function ActiveView({ location, trackUrl, error, contacts, onRetryLocation, onResolve, onCancel }) {
  const [sent, setSent] = useState(() => new Set())
  const [toast, setToast] = useState(null)

  const sendWhatsApp = (contact) => {
    const message = buildEmergencyMessage({ trackUrl, location })
    const link = buildWaLink(contact.phone, message)
    // Open WhatsApp with the message pre-filled (user taps send).
    window.open(link, '_blank', 'noopener')
    setSent((prev) => new Set(prev).add(contact.id))
    setToast(`WhatsApp opened for ${contact.name} — tap send to alert them.`)
    window.clearTimeout(sendWhatsApp._t)
    sendWhatsApp._t = window.setTimeout(() => setToast(null), 4000)
  }

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
          Alert your trusted contacts on WhatsApp with your live location.
        </p>
      </div>

      <LocationCard location={location} onRetryLocation={onRetryLocation} />

      {/* WhatsApp alert buttons — one per enabled trusted contact. */}
      <div className="mt-4 text-left">
        <p className="mb-2 text-xs uppercase tracking-wide text-white/50">
          Send WhatsApp alert
        </p>
        {contacts.length === 0 ? (
          <div className="rounded-xl bg-white/5 p-4 text-sm text-white/60">
            No trusted contacts yet.{' '}
            <Link to="/contacts" className="text-sky-300 underline">
              Add one
            </Link>{' '}
            so you can alert them here.
          </div>
        ) : (
          <div className="grid gap-2">
            {/* One-tap queue: alerts the next un-sent contact each tap. */}
            {(() => {
              const next = contacts.find((c) => !sent.has(c.id))
              const allDone = !next
              return (
                <button
                  onClick={() => next && sendWhatsApp(next)}
                  disabled={allDone}
                  className={[
                    'rounded-xl px-4 py-3 text-base font-black focus:outline-none focus-visible:ring-4 focus-visible:ring-white/70',
                    allDone
                      ? 'bg-white/10 text-white/60'
                      : 'bg-white text-ink',
                  ].join(' ')}
                >
                  {allDone
                    ? `✓ All ${contacts.length} contact${contacts.length > 1 ? 's' : ''} alerted`
                    : sent.size === 0
                      ? `Alert all on WhatsApp (${contacts.length})`
                      : `Next: alert ${next.name}`}
                </button>
              )
            })()}
            {contacts.length > 1 && (
              <p className="-mt-0.5 mb-1 text-center text-[11px] text-white/40">
                One tap per contact — WhatsApp opens each chat in turn.
              </p>
            )}
            {contacts.map((c) => (
              <button
                key={c.id}
                onClick={() => sendWhatsApp(c)}
                className="flex items-center justify-between rounded-xl bg-[#25D366] px-4 py-3 text-left font-bold text-black focus:outline-none focus-visible:ring-4 focus-visible:ring-white/70"
              >
                <span className="flex items-center gap-2">
                  <WhatsAppIcon />
                  {c.name}
                  {c.relationship ? (
                    <span className="font-normal opacity-70">· {c.relationship}</span>
                  ) : null}
                </span>
                <span className="text-sm">{sent.has(c.id) ? '✓ Sent' : 'Send'}</span>
              </button>
            ))}
          </div>
        )}
      </div>

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

      {/* In-app confirmation popup. */}
      {toast && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-6 z-50 mx-auto max-w-sm rounded-xl bg-safe px-4 py-3 text-center text-sm font-semibold text-white shadow-2xl"
        >
          {toast}
        </div>
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

function LocationCard({ location, onRetryLocation }) {
  if (!location) {
    return (
      <div className="rounded-xl bg-white/5 p-4 text-sm text-white/70">
        <p>Getting your location… If nothing appears, location may be blocked.</p>
        {onRetryLocation && (
          <button
            onClick={onRetryLocation}
            className="mt-2 rounded-lg bg-white/15 px-4 py-2 text-sm font-bold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            Retry location
          </button>
        )}
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

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../lib/api.js'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Public tracking page for trusted contacts. Accessed only via an
// unpredictable share token. Exposes ONLY incident status + latest location —
// no name, phone, or contact details.
const POLL_MS = 10000

export default function TrackScreen() {
  const { token } = useParams()
  const [incident, setIncident] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const mapRef = useRef(null)
  const mapObjRef = useRef(null)
  const markerRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    let timer

    const poll = async () => {
      try {
        const data = await api.getIncidentByToken(token)
        if (!cancelled) {
          setIncident(data)
          setError(null)
          setLoading(false)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.status === 404 ? 'This tracking link is invalid or has expired.' : e.message)
          setLoading(false)
        }
      }
      if (!cancelled) timer = setTimeout(poll, POLL_MS)
    }
    poll()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [token])

  // Initialise / update the Leaflet map when we have coordinates.
  useEffect(() => {
    const lat = incident?.lastLat
    const lng = incident?.lastLng
    if (lat == null || lng == null || !mapRef.current) return

    if (!mapObjRef.current) {
      mapObjRef.current = L.map(mapRef.current).setView([lat, lng], 16)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(mapObjRef.current)
      markerRef.current = L.marker([lat, lng]).addTo(mapObjRef.current)
    } else {
      markerRef.current.setLatLng([lat, lng])
      mapObjRef.current.panTo([lat, lng])
    }
  }, [incident])

  const isActive = incident?.status === 'ACTIVE'

  return (
    <div className="min-h-full bg-ink text-white">
      <header
        className={[
          'px-5 py-4 text-center font-black',
          isActive ? 'bg-danger' : 'bg-white/10',
        ].join(' ')}
      >
        {loading
          ? 'Loading…'
          : isActive
            ? '🚨 EMERGENCY IN PROGRESS'
            : incident?.status === 'RESOLVED'
              ? '✅ Marked safe'
              : incident?.status === 'CANCELLED'
                ? 'Alert cancelled'
                : 'Emergency status'}
      </header>

      <main className="mx-auto max-w-lg px-5 py-6">
        {error && (
          <p className="rounded-lg bg-amber-500/20 px-3 py-2 text-sm text-amber-200">
            {error}
          </p>
        )}

        {incident && (
          <>
            <p className="mb-4 text-sm text-white/70">
              {isActive
                ? 'Someone who trusts you has triggered an emergency alert and is sharing their live location. If you cannot reach them, contact local emergency services (10111 / 112).'
                : 'This emergency is no longer active.'}
            </p>

            <div
              ref={mapRef}
              className="h-72 w-full overflow-hidden rounded-xl bg-white/5"
              aria-label="Map showing the latest location"
            />

            <div className="mt-4 rounded-xl bg-white/5 p-4 text-sm">
              {incident.lastLat != null ? (
                <>
                  <p className="font-mono">
                    {incident.lastLat.toFixed(5)}, {incident.lastLng.toFixed(5)}
                  </p>
                  {incident.lastAccuracy != null && (
                    <p className="text-white/50">
                      Accuracy ≈ {Math.round(incident.lastAccuracy)} m
                    </p>
                  )}
                  {incident.lastLocationAt && (
                    <p className="text-white/50">
                      Updated {new Date(incident.lastLocationAt).toLocaleTimeString()}
                    </p>
                  )}
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${incident.lastLat}&mlon=${incident.lastLng}#map=17/${incident.lastLat}/${incident.lastLng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-sky-300 underline"
                  >
                    Open in maps
                  </a>
                </>
              ) : (
                <p className="text-white/50">No location available yet.</p>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}

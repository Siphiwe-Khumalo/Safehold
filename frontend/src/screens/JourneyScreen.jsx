import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { watchPosition } from '../lib/geolocation.js'
import { buildWaShareLink, buildLocationShareMessage } from '../lib/whatsapp.js'
import WhatsAppIcon from '../components/WhatsAppIcon.jsx'

// "My Journey" — an always-available live map that traces where you've been to
// where you are now. Works with no emergency active.
//
// Privacy by design: the trail is kept ONLY on this device (localStorage). It
// is never sent to the server unless an emergency is triggered.
//
// Honest limitation: a browser only records location while this screen is open
// and in the foreground — continuous background tracking needs a native app.

const STORAGE_KEY = 'safehold.trail'
const MIN_MOVE_M = 8 // ignore jitter smaller than this between points

function haversine(a, b) {
  const R = 6371000
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const la1 = (a.lat * Math.PI) / 180
  const la2 = (b.lat * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

function loadTrail() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []
  } catch {
    return []
  }
}

export default function JourneyScreen() {
  const [tracking, setTracking] = useState(true)
  const [trail, setTrail] = useState(loadTrail)
  const [error, setError] = useState(null)

  const mapEl = useRef(null)
  const map = useRef(null)
  const line = useRef(null)
  const dot = useRef(null)
  const startMarker = useRef(null)
  const stopWatch = useRef(null)
  const followRef = useRef(true)

  // Initialise the map once.
  useEffect(() => {
    if (map.current || !mapEl.current) return
    const start = trail[trail.length - 1] || { lat: -26.2041, lng: 28.0473 }
    map.current = L.map(mapEl.current, { zoomControl: true }).setView(
      [start.lat, start.lng],
      trail.length ? 16 : 12,
    )
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map.current)

    line.current = L.polyline([], {
      color: '#e11d2a',
      weight: 5,
      opacity: 0.9,
      lineJoin: 'round',
    }).addTo(map.current)

    // Stop auto-following if the user drags the map.
    map.current.on('dragstart', () => (followRef.current = false))

    redraw(trail)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const redraw = useCallback((points) => {
    if (!map.current || !line.current) return
    const latlngs = points.map((p) => [p.lat, p.lng])
    line.current.setLatLngs(latlngs)

    if (points.length) {
      const last = points[points.length - 1]
      const first = points[0]

      // Pulsing current-position dot (divIcon → no image assets needed).
      const icon = L.divIcon({
        className: '',
        html: '<div class="journey-dot"></div>',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      })
      if (!dot.current) dot.current = L.marker([last.lat, last.lng], { icon }).addTo(map.current)
      else dot.current.setLatLng([last.lat, last.lng])

      if (!startMarker.current) {
        startMarker.current = L.circleMarker([first.lat, first.lng], {
          radius: 6,
          color: '#16a34a',
          fillColor: '#16a34a',
          fillOpacity: 1,
        }).addTo(map.current)
      } else {
        startMarker.current.setLatLng([first.lat, first.lng])
      }

      if (followRef.current) map.current.panTo([last.lat, last.lng])
    }
  }, [])

  // Start/stop the geolocation watch based on the tracking toggle.
  useEffect(() => {
    if (!tracking) {
      if (stopWatch.current) {
        stopWatch.current()
        stopWatch.current = null
      }
      return
    }
    stopWatch.current = watchPosition(
      (loc) => {
        setError(null)
        setTrail((prev) => {
          const last = prev[prev.length - 1]
          if (last && haversine(last, loc) < MIN_MOVE_M) return prev
          const next = [...prev, loc]
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next.slice(-2000)))
          } catch {
            /* ignore quota */
          }
          redraw(next)
          return next
        })
      },
      (err) => setError(err.message),
    )
    return () => {
      if (stopWatch.current) {
        stopWatch.current()
        stopWatch.current = null
      }
    }
  }, [tracking, redraw])

  const clearTrail = () => {
    setTrail([])
    localStorage.removeItem(STORAGE_KEY)
    line.current?.setLatLngs([])
    if (dot.current) {
      dot.current.remove()
      dot.current = null
    }
    if (startMarker.current) {
      startMarker.current.remove()
      startMarker.current = null
    }
  }

  const recenter = () => {
    followRef.current = true
    const last = trail[trail.length - 1]
    if (last && map.current) map.current.setView([last.lat, last.lng], 16)
  }

  const shareLocation = () => {
    const last = trail[trail.length - 1]
    const message = buildLocationShareMessage(last)
    // No fixed recipient — WhatsApp lets the user pick who to share with.
    window.open(buildWaShareLink(message), '_blank', 'noopener')
  }

  // Stats
  let distance = 0
  for (let i = 1; i < trail.length; i++) distance += haversine(trail[i - 1], trail[i])
  const durationMin =
    trail.length > 1
      ? Math.max(
          0,
          Math.round(
            (new Date(trail[trail.length - 1].recordedAt) -
              new Date(trail[0].recordedAt)) /
              60000,
          ),
        )
      : 0
  const distanceLabel =
    distance >= 1000 ? `${(distance / 1000).toFixed(2)} km` : `${Math.round(distance)} m`

  return (
    <div className="flex min-h-full flex-col bg-ink text-white">
      <header className="flex items-center justify-between px-5 py-4">
        <Link to="/" className="rounded-lg px-2 py-2 text-sm font-semibold text-white/80 hover:underline">
          ← Back
        </Link>
        <span className="text-lg font-black">My Journey</span>
        <button
          onClick={() => setTracking((t) => !t)}
          className={[
            'rounded-lg px-3 py-1.5 text-xs font-bold',
            tracking ? 'bg-safe text-white' : 'bg-white/10 text-white/70',
          ].join(' ')}
        >
          {tracking ? '● Live' : 'Paused'}
        </button>
      </header>

      <div className="grid grid-cols-3 gap-2 px-5 pb-3">
        <Stat label="Distance" value={distanceLabel} />
        <Stat label="Duration" value={`${durationMin} min`} />
        <Stat label="Points" value={String(trail.length)} />
      </div>

      <div className="px-5 pb-3">
        <button
          onClick={shareLocation}
          disabled={trail.length === 0}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] py-3 font-black text-black disabled:opacity-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/70"
        >
          <WhatsAppIcon />
          Share my location on WhatsApp
        </button>
      </div>

      <div className="relative flex-1 px-5 pb-5">
        <div ref={mapEl} className="h-full min-h-[60vh] w-full overflow-hidden rounded-2xl bg-white/5" />
        <div className="pointer-events-none absolute inset-x-8 bottom-8 flex justify-center gap-2">
          <button
            onClick={recenter}
            className="pointer-events-auto rounded-full bg-white/90 px-4 py-2 text-sm font-bold text-ink shadow-lg"
          >
            Recenter
          </button>
          <button
            onClick={clearTrail}
            className="pointer-events-auto rounded-full bg-black/70 px-4 py-2 text-sm font-bold text-white shadow-lg ring-1 ring-white/20"
          >
            Clear trail
          </button>
        </div>
      </div>

      {error && (
        <p className="px-5 pb-3 text-center text-sm text-amber-300" role="alert">
          {error}
        </p>
      )}
      <p className="px-5 pb-5 text-center text-xs text-white/40">
        Your trail stays on this device only. Location records while this screen is open.
      </p>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl bg-white/5 p-3 text-center">
      <p className="text-lg font-black tabular-nums">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-white/50">{label}</p>
    </div>
  )
}

// Browser Geolocation helpers.
//
// HONEST LIMITATION: the browser can only read location while the page is
// active/foregrounded. Reliable background tracking requires a native app.
// These helpers are built around that reality.

export function getCurrentPosition(options = {}) {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Geolocation is not supported on this device.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(toLocation(pos)),
      (err) => reject(normalizeError(err)),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0, ...options },
    )
  })
}

/**
 * Continuously watch position. Returns a stop() function.
 * Calls onUpdate for each fix and onError on failures.
 */
export function watchPosition(onUpdate, onError, options = {}) {
  if (!('geolocation' in navigator)) {
    onError?.(new Error('Geolocation is not supported on this device.'))
    return () => {}
  }
  const id = navigator.geolocation.watchPosition(
    (pos) => onUpdate(toLocation(pos)),
    (err) => onError?.(normalizeError(err)),
    { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000, ...options },
  )
  return () => navigator.geolocation.clearWatch(id)
}

function toLocation(pos) {
  return {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    accuracy: pos.coords.accuracy ?? null,
    recordedAt: new Date(pos.timestamp).toISOString(),
  }
}

function normalizeError(err) {
  const map = {
    1: 'Location permission denied. Please allow location access to send your position.',
    2: 'Your location is currently unavailable.',
    3: 'Timed out while getting your location.',
  }
  return new Error(map[err.code] || err.message || 'Failed to get location.')
}

// Build a WhatsApp "click to chat" (wa.me) link with a pre-filled emergency
// message. This opens WhatsApp with the message ready to send — the user taps
// send. No WhatsApp Business API / account required.

// Normalise a phone number into wa.me's required format: country-code digits
// only, no '+', spaces, or leading zeros. Includes a light South-African rule
// (a local 0XXXXXXXXX becomes 27XXXXXXXXX).
export function normalizeForWa(phone, defaultCountry = '27') {
  if (!phone) return ''
  let digits = String(phone).replace(/[^\d+]/g, '')
  if (digits.startsWith('+')) digits = digits.slice(1)
  else if (digits.startsWith('00')) digits = digits.slice(2)
  else if (digits.startsWith('0')) digits = defaultCountry + digits.slice(1)
  return digits.replace(/\D/g, '')
}

// Compose the emergency message. Includes the secure tracking link and, when
// available, a Google Maps pin so any recipient can open it instantly.
export function buildEmergencyMessage({ trackUrl, location, name }) {
  const lines = ['🚨 EMERGENCY — I need help.']
  if (name) lines.push(`It's ${name}.`)
  if (location) {
    lines.push(
      `My location: https://maps.google.com/?q=${location.lat},${location.lng}`,
    )
  }
  if (trackUrl) lines.push(`Track me live: ${trackUrl}`)
  lines.push('Please call me or contact emergency services (10111 / 112).')
  return lines.join('\n')
}

export function buildWaLink(phone, message) {
  const number = normalizeForWa(phone)
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`
}

// A WhatsApp link with NO fixed recipient — opens WhatsApp's contact picker so
// the user can share with anyone. Used for "share my location" outside an
// emergency.
export function buildWaShareLink(message) {
  return `https://wa.me/?text=${encodeURIComponent(message)}`
}

// A friendly, non-emergency "here's where I am" message (current-location
// snapshot via a Google Maps pin).
export function buildLocationShareMessage(location) {
  const when = new Date().toLocaleTimeString()
  return [
    '📍 Sharing my location with you.',
    location
      ? `I'm here: https://maps.google.com/?q=${location.lat},${location.lng}`
      : '(location unavailable)',
    `As of ${when}. Sent from SafeHold.`,
  ].join('\n')
}

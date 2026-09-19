import { config } from '../config.js'

// Builds the human-readable alert content shared across channels.
// The tracking link is the only sensitive item and points at the secure token.

export function trackingUrl(incident) {
  return `${config.publicAppUrl.replace(/\/$/, '')}/track/${incident.shareToken}`
}

export function startedMessage(incident) {
  const url = trackingUrl(incident)
  const loc =
    incident.lastLat != null
      ? `Last known location: ${incident.lastLat.toFixed(5)}, ${incident.lastLng.toFixed(5)}`
      : 'Location is being determined.'
  return {
    subject: '🚨 EMERGENCY: someone needs help',
    text:
      `Someone who added you as a trusted contact has triggered an emergency alert.\n\n` +
      `${loc}\n\n` +
      `Follow their live location and status here:\n${url}\n\n` +
      `If you cannot reach them, contact local emergency services (10111 / 112).`,
  }
}

export function endedMessage(incident) {
  const resolved = incident.status === 'RESOLVED'
  return {
    subject: resolved ? '✅ Emergency resolved' : 'Emergency alert cancelled',
    text: resolved
      ? 'The emergency has been marked as resolved. The person is safe.'
      : 'The earlier emergency alert was cancelled (false alarm).',
  }
}

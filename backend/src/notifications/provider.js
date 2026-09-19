import { config } from '../config.js'
import { startedMessage, endedMessage, trackingUrl } from './messages.js'

// Resolves the configured provider once at startup.
export function createNotificationProvider() {
  switch (config.notify.provider) {
    case 'smtp':
      return new SmtpProvider()
    case 'console':
    default:
      return new ConsoleProvider()
  }
}

/**
 * ConsoleProvider — the safe default for local development.
 * Logs the exact alert that WOULD be sent. Does not fake delivery success
 * for channels that need external accounts; it simply shows the payload.
 */
class ConsoleProvider {
  async notifyEmergencyStarted(incident, contacts) {
    this.#log('EMERGENCY STARTED', incident, contacts, startedMessage(incident))
  }

  async notifyEmergencyEnded(incident, contacts) {
    this.#log('EMERGENCY ENDED', incident, contacts, endedMessage(incident))
  }

  #log(title, incident, contacts, msg) {
    console.log('\n==================== NOTIFICATION ====================')
    console.log(title, `(incident ${incident.id})`)
    console.log('Tracking link:', trackingUrl(incident))
    console.log('Subject:', msg.subject)
    console.log('Recipients:')
    for (const c of contacts) {
      console.log(
        `  - ${c.name} <${c.email || 'no-email'}> / ${c.phone}` +
          (c.email ? '' : '  (no email; SMS not implemented in MVP)'),
      )
    }
    console.log('Body:\n' + msg.text)
    console.log('======================================================\n')
  }
}

/**
 * SmtpProvider — sends REAL email via nodemailer to contacts that have an
 * email address. Contacts without email are skipped (SMS is not implemented
 * in the MVP — see notifications/README.md).
 */
class SmtpProvider {
  constructor() {
    this.transportPromise = this.#createTransport()
  }

  async #createTransport() {
    const { host, port, user, pass } = config.notify.smtp
    if (!host) {
      console.warn(
        '[notify] NOTIFY_PROVIDER=smtp but SMTP_HOST is not set. ' +
          'Falling back to logging alerts instead of sending.',
      )
      return null
    }
    const nodemailer = (await import('nodemailer')).default
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user ? { user, pass } : undefined,
    })
  }

  async notifyEmergencyStarted(incident, contacts) {
    await this.#send(incident, contacts, startedMessage(incident))
  }

  async notifyEmergencyEnded(incident, contacts) {
    await this.#send(incident, contacts, endedMessage(incident))
  }

  async #send(incident, contacts, msg) {
    const transport = await this.transportPromise
    const withEmail = contacts.filter((c) => c.email)
    const withoutEmail = contacts.filter((c) => !c.email)

    if (withoutEmail.length) {
      console.warn(
        `[notify] ${withoutEmail.length} contact(s) have no email and will not be ` +
          'reached — SMS is not implemented in the MVP.',
      )
    }

    if (!transport) {
      // No SMTP configured: log rather than fake success.
      console.log('[notify] (SMTP not configured) would email:', {
        to: withEmail.map((c) => c.email),
        subject: msg.subject,
        track: trackingUrl(incident),
      })
      return
    }

    await Promise.allSettled(
      withEmail.map((c) =>
        transport.sendMail({
          from: config.notify.smtp.from,
          to: c.email,
          subject: msg.subject,
          text: msg.text,
        }),
      ),
    )
  }
}

# Notifications

All outbound alerts go through a single `NotificationProvider` interface
(`provider.js`) so channels can be added or swapped without touching the
incident logic.

## Channels & honest MVP status

| Channel | Status in MVP | What's needed to make it real |
|---|---|---|
| **Console** | ✅ Implemented (default) | Nothing — logs the exact alert that *would* be sent. Useful for local dev. |
| **Email (SMTP)** | ✅ Implemented (real) | Set `NOTIFY_PROVIDER=smtp` and provide `SMTP_*` env vars (any SMTP account, e.g. Gmail app password, Mailgun, SES). Sends real email via `nodemailer`. |
| **SMS** | ⚠️ Not implemented | Requires a paid provider account (Twilio, Clickatell, etc.). A browser/Node backend cannot send SMS without one. The interface is ready — implement `sendSms()` in a new provider. |
| **Web Push** | ⚠️ Not implemented | Requires VAPID keys + storing push subscriptions. Interface ready. |

**We deliberately do not fake SMS or push sending.** When a channel needs an
external account you must configure, it is clearly marked and logs a warning
rather than pretending to succeed.

## Contract

```
NotificationProvider {
  async notifyEmergencyStarted(incident, contacts): void
  async notifyEmergencyEnded(incident, contacts): void
}
```

`contacts` is the list of *enabled* trusted contacts. Each notification includes
the secure tracking link (`PUBLIC_APP_URL/track/<share_token>`) and never leaks
other contacts' details.

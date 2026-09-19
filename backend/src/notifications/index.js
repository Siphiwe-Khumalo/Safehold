import { createNotificationProvider } from './provider.js'

// Single provider instance for the process, chosen from config at startup.
export const notifier = createNotificationProvider()

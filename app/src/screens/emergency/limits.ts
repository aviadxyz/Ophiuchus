// The limits the automatic vital-sign watch uses, shown on this screen next to each reading.
// The same numbers as AUTO_ALERT_LIMITS in data/autoAlert.ts, which is what actually triggers.
// ILLUSTRATIVE: chosen for a demonstration, not clinical limits.

export const LIMITS = {
  countdownSeconds: 10,
  sustainSeconds: 20,
  heartRateHigh: 170,
  heartRateLow: 35,
  spo2Low: 88,
} as const

export const heartRateOut = (bpm: number) =>
  bpm >= LIMITS.heartRateHigh || bpm <= LIMITS.heartRateLow

export const spo2Out = (percent: number) => percent <= LIMITS.spo2Low

/** An alert the app sent by itself, recognised by the fixed form of its message. */
export const isAutomaticMessage = (message: string) => message.includes(', no response')

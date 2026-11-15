// Words and times for the Admin screen.

import { useEffect, useState } from 'react'
import type { Level } from '@/design'
import { worstLevel, type GroundReport } from '@/data'

const MINUTE_MS = 60_000
export const LATE_MS = 60 * MINUTE_MS

export const SHARE_CONFIRM =
  'The ground team will see your name and role, today’s sleep, food, water, exercise and mood with their status, the last seven days of each, your latest heart rate, and your alerts, including questions the Med bot passed to the flight surgeon. They do not see your mood notes, your meals, your body mass or your chats. You can switch this off at any time and your record is deleted from the server at once.'

export const OPEN_CONFIRM =
  'You are about to open the health records of the crew. They are private. Open them only if you are part of the medical team for this mission.'

/** The time of day, with the date when it is not today. */
export function clockTime(at: string, now: number): string {
  const date = new Date(at)
  if (Number.isNaN(date.getTime())) return 'an unknown time'
  const sameDay = new Date(now).toDateString() === date.toDateString()
  return date.toLocaleString(
    'en-GB',
    sameDay
      ? { hour: '2-digit', minute: '2-digit' }
      : { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' },
  )
}

/** How long ago, in plain words. */
export function ago(at: string, now: number): string {
  const ms = now - new Date(at).getTime()
  if (!Number.isFinite(ms)) return 'time unknown'
  if (ms < MINUTE_MS) return 'just now'
  const minutes = Math.round(ms / MINUTE_MS)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return hours === 1 ? 'about an hour ago' : `about ${hours} hours ago`
  const days = Math.round(hours / 24)
  return days === 1 ? 'a day ago' : `${days} days ago`
}

/** A signal delay in words, for example "4 minutes". */
export function delayWords(seconds: number): string {
  if (seconds < 60) return `${seconds} seconds`
  const minutes = Math.round(seconds / 60)
  return minutes === 1 ? '1 minute' : `${minutes} minutes`
}

export function isLate(sentAt: string, now: number): boolean {
  return now - new Date(sentAt).getTime() > LATE_MS
}

/** The time now, refreshed every 30 seconds so "how long ago" stays right. */
export function useClock(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [])
  return now
}

/** The worst level of a report's five summary lines. */
export function reportLevel(report: GroundReport): Level {
  const { sleep, food, water, exercise, mood } = report.summary
  return worstLevel([sleep.level, food.level, water.level, exercise.level, mood.level])
}

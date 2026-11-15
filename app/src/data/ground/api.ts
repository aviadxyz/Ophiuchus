// The client for the two ground endpoints (CONTRACTS section 11). Used only when VITE_GROUND_URL
// is set. A report body holds `reportId`, `key` and `report` and nothing else. The ground code
// travels only in the Authorization header of the one GET, and is never logged.

import { config } from '@/config'
import type { GroundReport, OutgoingGroundReport } from './types'
import { sanitizeReport } from './sanitize'

const TIMEOUT_MS = 8000

export function groundEnabled(): boolean {
  return (config.groundUrl ?? '').length > 0
}

function endpoint(path: '/report' | '/reports'): string {
  const base = config.groundUrl
  const root = base.endsWith('/api/ground') ? base : `${base}/api/ground`
  return `${root}${path}`
}

/** The status of a request, or 0 when the server cannot be reached. */
async function request(
  path: '/report' | '/reports',
  init: RequestInit,
): Promise<{ status: number; body: unknown }> {
  if (!groundEnabled()) return { status: 0, body: null }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(endpoint(path), {
      ...init,
      signal: controller.signal,
      cache: 'no-store',
    })
    let body: unknown = null
    try {
      body = await response.json()
    } catch {
      body = null
    }
    return { status: response.status, body }
  } catch {
    return { status: 0, body: null }
  } finally {
    clearTimeout(timer)
  }
}

const post = (body: Record<string, unknown>) =>
  request('/report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

/** Sends the latest report. True when the server stored it. */
export async function apiSendReport(
  reportId: string,
  key: string,
  report: OutgoingGroundReport,
): Promise<boolean> {
  const { status } = await post({ reportId, key, report })
  return status === 200
}

/**
 * Asks the server to delete the report. `done` when it is gone or can never be removed by this
 * device (refused); `retry` when the server could not be reached or failed.
 */
export async function apiRemoveReport(reportId: string, key: string): Promise<'done' | 'retry'> {
  const { status } = await post({ reportId, key, remove: true })
  return status >= 200 && status < 500 ? 'done' : 'retry'
}

export type FetchReportsResult =
  { state: 'open'; reports: GroundReport[] } | { state: 'wrong-code' | 'not-set-up' | 'offline' }

/** Every report on the server, read with the ground code. */
export async function apiFetchReports(code: string): Promise<FetchReportsResult> {
  const { status, body } = await request('/reports', {
    method: 'GET',
    headers: { Authorization: `Bearer ${code}` },
  })
  if (status === 401) return { state: 'wrong-code' }
  if (status === 503) return { state: 'not-set-up' }
  if (status !== 200) return { state: 'offline' }
  const raw =
    typeof body === 'object' && body !== null ? (body as Record<string, unknown>).reports : null
  const reports = Array.isArray(raw)
    ? raw.map(sanitizeReport).filter((r): r is GroundReport => r !== null)
    : []
  return { state: 'open', reports }
}

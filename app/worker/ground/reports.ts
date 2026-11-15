// The ground reports (CONTRACTS section 11): `POST /api/ground/report` and
// `GET /api/ground/reports`. The rows live in the crew network's Durable Object, in the table
// below, so no new Durable Object class (and no migration) is needed.
//
// What it stores: one row per `reportId`, holding the SHA-256 hash of its key, the latest report
// as text (only the fields of `GroundReport`) and when it was received. A row is deleted at once
// on `remove`, and 7 days after its last update on every write. Reports can be read only with
// the server secret `GROUND_CODE`; while it is not set, nothing can be read.

import type { Env } from '../types.ts'
import { bearerCode, cleanGroundWrite, MAX_BODY_BYTES } from './rules.ts'

export const GROUND_RETENTION_MS = 7 * 24 * 60 * 60 * 1000

/** Created with the crew network's other tables, in `CrewNetworkDurableObject.initDb`. */
export const GROUND_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS ground_reports (
    report_id TEXT PRIMARY KEY,
    key_hash TEXT NOT NULL,
    report TEXT NOT NULL,
    received_at INTEGER NOT NULL
  );
`

type Row = Record<string, unknown>

/** The two SQL calls the ground reports need, given by the Durable Object that owns the table. */
export type GroundSql = {
  rows(query: string, ...bindings: unknown[]): Row[]
  run(query: string, ...bindings: unknown[]): void
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

async function sha256Bytes(text: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))
}

async function sha256Hex(text: string): Promise<string> {
  return Array.from(await sha256Bytes(text), (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Compares two secrets in constant time. Both are hashed first, so the time depends neither on
 * where they differ nor on their lengths.
 */
export async function sameSecret(given: string, expected: string): Promise<boolean> {
  const [a, b] = await Promise.all([sha256Bytes(given), sha256Bytes(expected)])
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0)
  return diff === 0 && given.length > 0
}

/** Deletes every report not updated for 7 days. Runs on every write. */
export function pruneGroundReports(sql: GroundSql, now: number): void {
  sql.run(`DELETE FROM ground_reports WHERE received_at < ?`, now - GROUND_RETENTION_MS)
}

async function readBody(request: Request): Promise<unknown> {
  const text = await request.text()
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return undefined
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

/** `POST /api/ground/report`: stores the latest report for a `reportId`, or removes it. */
export async function postGroundReport(
  request: Request,
  sql: GroundSql,
  now: number,
): Promise<Response> {
  const write = cleanGroundWrite(await readBody(request))
  if (!write) return json({ error: 'invalid' }, 400)

  pruneGroundReports(sql, now)
  const keyHash = await sha256Hex(write.key)
  const existing = sql.rows(
    `SELECT key_hash FROM ground_reports WHERE report_id = ?`,
    write.reportId,
  )[0]
  // The first report fixes the key. Another device cannot overwrite or remove it.
  if (existing && existing.key_hash !== keyHash) return json({ error: 'forbidden' }, 403)

  if (write.remove) {
    sql.run(`DELETE FROM ground_reports WHERE report_id = ?`, write.reportId)
    return json({ ok: true })
  }
  sql.run(
    `INSERT OR REPLACE INTO ground_reports (report_id, key_hash, report, received_at)
     VALUES (?, ?, ?, ?)`,
    write.reportId,
    keyHash,
    JSON.stringify(write.report),
    now,
  )
  return json({ ok: true })
}

/** `GET /api/ground/reports`: every stored report with its `receivedAt`, for the ground code only. */
export async function getGroundReports(
  request: Request,
  env: Env,
  sql: GroundSql,
  now: number,
): Promise<Response> {
  const secret = env.GROUND_CODE ?? ''
  if (!secret) return json({ error: 'not-set-up' }, 503)
  const given = bearerCode(request.headers.get('Authorization'))
  if (!(await sameSecret(given, secret))) return json({ error: 'unauthorized' }, 401)

  const rows = sql.rows(
    `SELECT report, received_at FROM ground_reports WHERE received_at >= ?
     ORDER BY received_at DESC`,
    now - GROUND_RETENTION_MS,
  )
  const reports = rows.flatMap((row) => {
    try {
      const report: unknown = JSON.parse(String(row.report))
      if (typeof report !== 'object' || report === null) return []
      return [{ ...report, receivedAt: new Date(Number(row.received_at)).toISOString() }]
    } catch {
      return []
    }
  })
  return json({ reports })
}

/** Routes `/api/ground/*` inside the crew network's Durable Object. */
export async function handleGround(
  request: Request,
  env: Env,
  sql: GroundSql,
  now: number,
): Promise<Response> {
  const path = new URL(request.url).pathname
  if (path === '/api/ground/report' && request.method === 'POST') {
    return postGroundReport(request, sql, now)
  }
  if (path === '/api/ground/reports' && request.method === 'GET') {
    return getGroundReports(request, env, sql, now)
  }
  return json({ error: 'Not found' }, 404)
}

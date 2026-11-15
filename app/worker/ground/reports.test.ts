// @vitest-environment node
// The ground report endpoints (CONTRACTS section 11), run through the crew network's Durable
// Object on a real SQLite engine so the queries themselves are tested. Every person and value
// here is invented, and the ground code is made fresh for each run.

import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CrewNetworkDurableObject } from '../social/crewDo.ts'
import type { DurableObjectContext, Env, SqlStorageCursor } from '../types.ts'
import { cleanGroundWrite, cleanReport, METRIC_IDS, WEEK_METRIC_IDS } from './rules.ts'

const DAY_MS = 24 * 60 * 60 * 1000
const START = new Date('2026-11-16T09:00:00Z')

function sqliteStorage(): { storage: DurableObjectContext['storage']; db: DatabaseSync } {
  const db = new DatabaseSync(':memory:')
  const cursor = (rows: Record<string, unknown>[]): SqlStorageCursor => ({
    toArray: () => rows,
    one: () => rows[0] ?? null,
  })
  return {
    db,
    storage: {
      sql: {
        exec(query: string, ...bindings: unknown[]) {
          const statements = query.split(';').filter((s) => s.trim().length > 0)
          if (bindings.length === 0 && statements.length > 1) {
            db.exec(query)
            return cursor([])
          }
          const statement = db.prepare(query)
          const params = bindings as (string | number | null)[]
          if (statement.columns().length === 0) {
            statement.run(...params)
            return cursor([])
          }
          return cursor(statement.all(...params) as Record<string, unknown>[])
        },
      },
      get: async () => undefined,
      put: async () => undefined,
    },
  }
}

function server(groundCode?: string): { crew: CrewNetworkDurableObject; db: DatabaseSync } {
  const { storage, db } = sqliteStorage()
  const ctx: DurableObjectContext = { storage, blockConcurrencyWhile: (callback) => callback() }
  const env = (groundCode ? { GROUND_CODE: groundCode } : {}) as Env
  return { crew: new CrewNetworkDurableObject(ctx, env), db }
}

const metric = (id: string, value: number | null) => ({
  value,
  targetId: id,
  level: value === null ? 'none' : 'ok',
  source: value === null ? null : 'entered',
})

/** An invented report that passes every check. */
function validReport(reportId: string): Record<string, unknown> {
  const today: Record<string, unknown> = { date: '2026-11-16' }
  for (const id of METRIC_IDS) today[id] = metric(id, id === 'sleepHours' ? 7.5 : null)
  const week: Record<string, unknown> = {}
  for (const id of WEEK_METRIC_IDS) {
    week[id] = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-11-${String(10 + i).padStart(2, '0')}`,
      value: i % 2 === 0 ? 5 : null,
      source: i % 2 === 0 ? 'entered' : null,
    }))
  }
  const area = { level: 'ok', text: 'On target', source: 'entered' }
  return {
    reportId,
    displayName: 'Test crew A',
    role: 'Test role',
    kind: 'member',
    missionDay: 16,
    sentAt: '2026-11-16T08:59:00.000Z',
    today,
    summary: {
      sleep: area,
      food: area,
      water: area,
      exercise: area,
      mood: area,
      openAlerts: 1,
      ophiLine: 'A question is waiting for the flight surgeon.',
      updatedAt: '2026-11-16T08:59:00.000Z',
    },
    week,
    vitals: { at: '2026-11-16T08:58:00.000Z', heartRate: 64, source: 'live' },
    alerts: [
      {
        at: '2026-11-16T08:00:00.000Z',
        kind: 'health',
        message: 'A test question.',
        status: 'open',
      },
    ],
  }
}

const ID_A = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'
const KEY_A = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb'
const KEY_OTHER = 'cccccccc-3333-4333-8333-cccccccccccc'

async function post(crew: CrewNetworkDurableObject, body: unknown): Promise<number> {
  const response = await crew.fetch(
    new Request('https://crew.test/api/ground/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  )
  return response.status
}

async function read(
  crew: CrewNetworkDurableObject,
  code: string | null,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await crew.fetch(
    new Request('https://crew.test/api/ground/reports', {
      headers: code === null ? {} : { Authorization: `Bearer ${code}` },
    }),
  )
  return { status: response.status, body: (await response.json()) as Record<string, unknown> }
}

const send = (crew: CrewNetworkDurableObject, report = validReport(ID_A), key = KEY_A) =>
  post(crew, { reportId: ID_A, key, report })

describe('ground report validation', () => {
  const body = (change: (report: Record<string, unknown>) => void, extra: object = {}) => {
    const report = validReport(ID_A)
    change(report)
    return { reportId: ID_A, key: KEY_A, report, ...extra }
  }

  it('accepts a valid report and a valid remove', () => {
    expect(cleanGroundWrite(body(() => {}))).not.toBeNull()
    expect(cleanGroundWrite({ reportId: ID_A, key: KEY_A, remove: true })).toMatchObject({
      remove: true,
    })
  })

  it('refuses a reportId or key outside 16 to 64 letters, digits and hyphens', () => {
    for (const bad of [
      'short',
      'x'.repeat(65),
      'has spaces in it here',
      'under_score_is_not_ok',
      7,
    ]) {
      expect(cleanGroundWrite({ ...body(() => {}), reportId: bad })).toBeNull()
      expect(cleanGroundWrite({ ...body(() => {}), key: bad })).toBeNull()
    }
    expect(cleanGroundWrite({ ...body(() => {}), key: 'k'.repeat(16) })).not.toBeNull()
    expect(cleanGroundWrite({ ...body(() => {}), key: 'k'.repeat(64) })).not.toBeNull()
  })

  it('refuses a demo report', () => {
    expect(cleanGroundWrite(body((r) => (r.kind = 'demo')))).toBeNull()
    expect(cleanGroundWrite(body((r) => delete r.kind))).toBeNull()
  })

  it('refuses a display name or role over 40 characters', () => {
    expect(cleanGroundWrite(body((r) => (r.displayName = 'n'.repeat(41))))).toBeNull()
    expect(cleanGroundWrite(body((r) => (r.role = 'r'.repeat(41))))).toBeNull()
    expect(cleanGroundWrite(body((r) => (r.displayName = '')))).toBeNull()
  })

  it('needs exactly the five weekly metrics with seven entries each', () => {
    expect(
      cleanGroundWrite(body((r) => delete (r.week as Record<string, unknown>).moodScore)),
    ).toBeNull()
    expect(
      cleanGroundWrite(body((r) => ((r.week as Record<string, unknown>).proteinG = []))),
    ).toBeNull()
    expect(
      cleanGroundWrite(
        body(
          (r) =>
            ((r.week as Record<string, unknown[]>).sleepHours = [
              { date: '2026-11-16', value: 1, source: 'entered' },
            ]),
        ),
      ),
    ).toBeNull()
  })

  it('refuses more than 20 alerts or a message over 300 characters', () => {
    const alert = { at: '2026-11-16T08:00:00.000Z', kind: 'health', message: 'q', status: 'open' }
    expect(cleanGroundWrite(body((r) => (r.alerts = Array(21).fill(alert))))).toBeNull()
    expect(cleanGroundWrite(body((r) => (r.alerts = Array(20).fill(alert))))).not.toBeNull()
    expect(
      cleanGroundWrite(body((r) => (r.alerts = [{ ...alert, message: 'm'.repeat(301) }]))),
    ).toBeNull()
  })

  it('refuses malformed values', () => {
    expect(cleanGroundWrite(body((r) => (r.today = null)))).toBeNull()
    expect(
      cleanGroundWrite(
        body((r) => ((r.today as Record<string, unknown>).waterMl = { value: 'lots' })),
      ),
    ).toBeNull()
    expect(
      cleanGroundWrite(
        body((r) => ((r.summary as Record<string, unknown>).sleep = { level: 'great' })),
      ),
    ).toBeNull()
    expect(cleanGroundWrite(body((r) => (r.sentAt = 'yesterday')))).toBeNull()
    expect(
      cleanGroundWrite(body((r) => (r.vitals = { at: r.sentAt, heartRate: 900, source: 'live' }))),
    ).toBeNull()
    expect(cleanGroundWrite({ reportId: ID_A, key: KEY_A, remove: 'yes' })).toBeNull()
    expect(cleanGroundWrite('not an object')).toBeNull()
  })

  it('drops every field that is not in GroundReport', () => {
    const report = cleanReport(
      {
        ...validReport(ID_A),
        receivedAt: '2020-01-01T00:00:00.000Z',
        note: 'a private note',
        meals: [{ foodId: 'x' }],
        birthYear: 1990,
        summary: { ...(validReport(ID_A).summary as object), extra: 'drop me' },
      },
      ID_A,
    )
    expect(report).not.toBeNull()
    const text = JSON.stringify(report)
    for (const field of ['receivedAt', 'note', 'meals', 'birthYear', 'extra']) {
      expect(text).not.toContain(field)
    }
  })

  it('never keeps a body mass, even when one is sent', () => {
    const sent = validReport(ID_A)
    ;(sent.today as Record<string, unknown>).bodyMassKg = {
      value: 70,
      targetId: 'bodyMassKg',
      level: 'ok',
      source: 'entered',
    }
    expect(cleanReport(sent, ID_A)?.today.bodyMassKg).toEqual({
      value: null,
      targetId: 'bodyMassKg',
      level: 'none',
      source: null,
    })
  })
})

describe('ground report endpoints', () => {
  let code: string

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(START)
    code = crypto.randomUUID()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('refuses a body over 20 KB and a body that is not JSON', async () => {
    const { crew } = server(code)
    const big = validReport(ID_A)
    big.ophiPadding = 'p'.repeat(21 * 1024)
    expect(await send(crew, big)).toBe(400)
    expect(await post(crew, '{not json')).toBe(400)
  })

  it('refuses a demo report over the wire', async () => {
    const { crew } = server(code)
    expect(await send(crew, { ...validReport(ID_A), kind: 'demo' })).toBe(400)
    expect((await read(crew, code)).body.reports).toEqual([])
  })

  it('gives 503 and nothing else when no ground code is set', async () => {
    const { crew } = server()
    expect(await send(crew)).toBe(200)
    const { status, body } = await read(crew, 'anything-at-all')
    expect(status).toBe(503)
    expect(body.reports).toBeUndefined()
    expect(JSON.stringify(body)).not.toContain('Test crew A')
  })

  it('gives 401 and no report for a wrong or missing code', async () => {
    const { crew } = server(code)
    await send(crew)
    for (const wrong of [null, '', `${code}x`, code.slice(1), crypto.randomUUID()]) {
      const { status, body } = await read(crew, wrong)
      expect(status).toBe(401)
      expect(body.reports).toBeUndefined()
      expect(JSON.stringify(body)).not.toContain('Test crew A')
    }
  })

  it('gives every report with its receivedAt for the right code', async () => {
    const { crew } = server(code)
    expect(await send(crew)).toBe(200)
    const ID_B = 'dddddddd-4444-4444-8444-dddddddddddd'
    vi.setSystemTime(new Date(START.getTime() + 60_000))
    expect(
      await post(crew, {
        reportId: ID_B,
        key: KEY_OTHER,
        report: {
          ...validReport(ID_B),
          displayName: 'Test crew B',
          receivedAt: '2000-01-01T00:00:00Z',
        },
      }),
    ).toBe(200)
    const { status, body } = await read(crew, code)
    expect(status).toBe(200)
    const reports = body.reports as Record<string, unknown>[]
    expect(reports.map((r) => r.displayName)).toEqual(['Test crew B', 'Test crew A'])
    // receivedAt is the server's clock, never the body's.
    expect(reports[0]?.receivedAt).toBe(new Date(START.getTime() + 60_000).toISOString())
    expect(reports[1]?.receivedAt).toBe(START.toISOString())
  })

  it('keeps only the latest report per reportId', async () => {
    const { crew } = server(code)
    await send(crew)
    await send(crew, { ...validReport(ID_A), missionDay: 17 })
    const reports = (await read(crew, code)).body.reports as Record<string, unknown>[]
    expect(reports).toHaveLength(1)
    expect(reports[0]?.missionDay).toBe(17)
  })

  it('does not let a second device overwrite or remove another device’s report', async () => {
    const { crew } = server(code)
    await send(crew)
    expect(await send(crew, { ...validReport(ID_A), displayName: 'Intruder' }, KEY_OTHER)).toBe(403)
    expect(await post(crew, { reportId: ID_A, key: KEY_OTHER, remove: true })).toBe(403)
    const reports = (await read(crew, code)).body.reports as Record<string, unknown>[]
    expect(reports.map((r) => r.displayName)).toEqual(['Test crew A'])
  })

  it('deletes the report at once on remove', async () => {
    const { crew } = server(code)
    await send(crew)
    expect(await post(crew, { reportId: ID_A, key: KEY_A, remove: true })).toBe(200)
    expect((await read(crew, code)).body.reports).toEqual([])
    // After a remove the id is free again.
    expect(await send(crew, validReport(ID_A), KEY_OTHER)).toBe(200)
  })

  it('deletes reports not updated for 7 days on the next write', async () => {
    const { crew, db } = server(code)
    await send(crew)
    vi.setSystemTime(new Date(START.getTime() + 7 * DAY_MS + 1000))
    const ID_C = 'eeeeeeee-5555-4555-8555-eeeeeeeeeeee'
    await post(crew, { reportId: ID_C, key: KEY_OTHER, report: validReport(ID_C) })
    const ids = db
      .prepare('SELECT report_id FROM ground_reports')
      .all()
      .map((r) => r.report_id)
    expect(ids).toEqual([ID_C])
  })

  it('stores only the hash of the key and no unknown field', async () => {
    const { crew, db } = server(code)
    await send(crew, { ...validReport(ID_A), note: 'a private note', massKg: 70 })
    const row = db.prepare('SELECT * FROM ground_reports').get() as Record<string, unknown>
    expect(Object.keys(row).sort()).toEqual(['key_hash', 'received_at', 'report', 'report_id'])
    expect(String(row.key_hash)).not.toContain(KEY_A)
    expect(String(row.key_hash)).toMatch(/^[0-9a-f]{64}$/)
    expect(String(row.report)).not.toContain('private note')
    expect(String(row.report)).not.toContain('massKg')
    expect(String(row.report)).not.toContain(KEY_A)
  })
})

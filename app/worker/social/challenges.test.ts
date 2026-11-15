// @vitest-environment node
// The crew challenge endpoints (CONTRACTS section 11), run against a real SQLite engine so the
// queries themselves are tested. Every person here is invented.

import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DurableObjectContext, Env, SqlStorageCursor } from '../types.ts'
import { CrewNetworkDurableObject } from './crewDo.ts'
import { cleanChallengeWrite } from './rules.ts'

const DAY_MS = 24 * 60 * 60 * 1000
const START = new Date('2026-11-16T09:00:00Z')

function sqliteStorage(): DurableObjectContext['storage'] {
  const db = new DatabaseSync(':memory:')
  const cursor = (rows: Record<string, unknown>[]): SqlStorageCursor => ({
    toArray: () => rows,
    one: () => rows[0] ?? null,
  })
  return {
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
  }
}

function network(): CrewNetworkDurableObject {
  const ctx: DurableObjectContext = {
    storage: sqliteStorage(),
    blockConcurrencyWhile: (callback) => callback(),
  }
  return new CrewNetworkDurableObject(ctx, {} as Env)
}

type Person = { socialId: string; token: string; handle: string }

async function call(
  crew: CrewNetworkDurableObject,
  method: 'GET' | 'POST',
  path: string,
  token: string | null,
  body?: unknown,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await crew.fetch(
    new Request(`https://crew.test/api/social${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  )
  return { status: response.status, body: (await response.json()) as Record<string, unknown> }
}

async function join(crew: CrewNetworkDurableObject, handle: string): Promise<Person> {
  const { body } = await call(crew, 'POST', '/join', null, { handle })
  return { socialId: String(body.socialId), token: String(body.token), handle }
}

async function befriend(crew: CrewNetworkDurableObject, a: Person, b: Person): Promise<void> {
  await call(crew, 'POST', '/relation', a.token, { socialId: b.socialId, action: 'request' })
  await call(crew, 'POST', '/relation', b.token, { socialId: a.socialId, action: 'accept' })
}

const send = (crew: CrewNetworkDurableObject, who: Person, body: unknown) =>
  call(crew, 'POST', '/challenge', who.token, body)

async function boards(crew: CrewNetworkDurableObject, who: Person) {
  const { status, body } = await call(crew, 'GET', '/challenges', who.token)
  expect(status).toBe(200)
  return body as Record<
    'exercise' | 'nutrition',
    { socialId: string; handle: string; score: number }[]
  >
}

describe('crew challenge endpoints', () => {
  let crew: CrewNetworkDurableObject
  let ana: Person
  let ben: Person
  let cy: Person

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(START)
    crew = network()
    ana = await join(crew, 'test_ana')
    ben = await join(crew, 'test_ben')
    cy = await join(crew, 'test_cy')
    await befriend(crew, ana, ben)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('refuses both endpoints without a valid token', async () => {
    expect(
      (await call(crew, 'POST', '/challenge', null, { id: 'exercise', score: 50 })).status,
    ).toBe(401)
    expect((await call(crew, 'GET', '/challenges', null)).status).toBe(401)
    const forged = 'f'.repeat(64)
    expect(
      (await call(crew, 'POST', '/challenge', forged, { id: 'exercise', score: 50 })).status,
    ).toBe(401)
    expect((await call(crew, 'GET', '/challenges', forged)).status).toBe(401)
  })

  it('accepts only a known id and a whole-number score in range', async () => {
    const refused = [
      { id: 'sleep', score: 3 },
      { score: 3 },
      { id: 'exercise', score: 101 },
      { id: 'exercise', score: -1 },
      { id: 'exercise', score: 50.5 },
      { id: 'exercise', score: '50' },
      { id: 'exercise' },
      { id: 'nutrition', score: 8 },
      { id: 'nutrition', score: 3.5 },
      { id: 'nutrition', leave: 'yes' },
      { id: 'nutrition', leave: false },
      { id: 'exercise', score: 50, minutes: 120 },
      { id: 'exercise', leave: true, score: 50 },
    ]
    for (const body of refused) {
      const reply = await send(crew, ana, body)
      expect(reply.status, JSON.stringify(body)).toBe(400)
    }
    expect((await send(crew, ana, { id: 'exercise', score: 0 })).status).toBe(200)
    expect((await send(crew, ana, { id: 'exercise', score: 100 })).status).toBe(200)
    expect((await send(crew, ana, { id: 'nutrition', score: 7 })).status).toBe(200)
    expect((await send(crew, ana, { id: 'nutrition', leave: true })).status).toBe(200)
    // Nothing refused was stored.
    expect((await boards(crew, ana)).exercise).toEqual([
      { socialId: ana.socialId, handle: 'test_ana', score: 100 },
    ])
  })

  it('gives an empty board for a challenge you have not joined', async () => {
    await send(crew, ben, { id: 'exercise', score: 70 })
    await send(crew, ben, { id: 'nutrition', score: 4 })
    expect(await boards(crew, ana)).toEqual({ exercise: [], nutrition: [] })
    await send(crew, ana, { id: 'nutrition', score: 5 })
    const seen = await boards(crew, ana)
    expect(seen.exercise).toEqual([])
    expect(seen.nutrition.map((e) => e.handle)).toEqual(['test_ana', 'test_ben'])
  })

  it('shows you and your friends who take part, highest first, and never anyone else', async () => {
    await send(crew, ana, { id: 'exercise', score: 40 })
    await send(crew, ben, { id: 'exercise', score: 80 })
    await send(crew, cy, { id: 'exercise', score: 95 })
    const seen = await boards(crew, ana)
    expect(seen.exercise).toEqual([
      { socialId: ben.socialId, handle: 'test_ben', score: 80 },
      { socialId: ana.socialId, handle: 'test_ana', score: 40 },
    ])
    // A request that was never accepted is not a friendship.
    await call(crew, 'POST', '/relation', cy.token, { socialId: ana.socialId, action: 'request' })
    expect((await boards(crew, ana)).exercise.some((e) => e.socialId === cy.socialId)).toBe(false)
    expect((await boards(crew, cy)).exercise).toEqual([
      { socialId: cy.socialId, handle: 'test_cy', score: 95 },
    ])
  })

  it('removes a score at once on leave', async () => {
    await send(crew, ana, { id: 'exercise', score: 40 })
    await send(crew, ben, { id: 'exercise', score: 80 })
    await send(crew, ben, { id: 'exercise', leave: true })
    expect((await boards(crew, ana)).exercise.map((e) => e.handle)).toEqual(['test_ana'])
    expect((await boards(crew, ben)).exercise).toEqual([])
  })

  it('hides both scores the moment a friendship ends or someone leaves the network', async () => {
    await send(crew, ana, { id: 'exercise', score: 40 })
    await send(crew, ben, { id: 'exercise', score: 80 })
    await call(crew, 'POST', '/relation', ben.token, { socialId: ana.socialId, action: 'remove' })
    expect((await boards(crew, ana)).exercise.map((e) => e.handle)).toEqual(['test_ana'])
    expect((await boards(crew, ben)).exercise.map((e) => e.handle)).toEqual(['test_ben'])

    await befriend(crew, ana, ben)
    expect((await boards(crew, ana)).exercise).toHaveLength(2)
    await call(crew, 'POST', '/leave', ben.token, {})
    expect((await boards(crew, ana)).exercise.map((e) => e.handle)).toEqual(['test_ana'])
  })

  it('deletes scores not updated for 8 days on the next write', async () => {
    await send(crew, ana, { id: 'exercise', score: 40 })
    await send(crew, ben, { id: 'exercise', score: 80 })
    vi.setSystemTime(START.getTime() + 7 * DAY_MS)
    await send(crew, ana, { id: 'exercise', score: 60 })
    // Ben keeps using the app (so his account stays) but sends no new score.
    expect((await boards(crew, ben)).exercise).toHaveLength(2)
    vi.setSystemTime(START.getTime() + 8 * DAY_MS + 60_000)
    // Ben's score is now more than 8 days old; Ana's is one day old.
    await send(crew, ana, { id: 'nutrition', score: 2 })
    const seen = await boards(crew, ana)
    expect(seen.exercise).toEqual([{ socialId: ana.socialId, handle: 'test_ana', score: 60 }])
    // Ben is no longer in the exercise challenge at all.
    expect((await boards(crew, ben)).exercise).toEqual([])
  })
})

describe('challenge write rule', () => {
  it('keeps only id and score, or id and leave', () => {
    expect(cleanChallengeWrite({ id: 'exercise', score: 68 })).toEqual({
      id: 'exercise',
      leave: false,
      score: 68,
    })
    expect(cleanChallengeWrite({ id: 'nutrition', leave: true })).toEqual({
      id: 'nutrition',
      leave: true,
    })
    expect(cleanChallengeWrite({ id: 'nutrition', score: 4, kcal: 2500 })).toBeNull()
  })
})

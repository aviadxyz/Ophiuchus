import { describe, expect, it } from 'vitest'
import { capWatchReply, getScriptedFallback, handleChat, isForward, isUrgent } from './chat.ts'
import worker, { RoomDurableObject } from './index.ts'
import { MEDBOT_SYSTEM_PROMPT } from './systemPrompt.ts'
import type { DurableObjectContext, Env, RelayEventMessage, SqlStorageCursor } from './types.ts'
import {
  normalizeRoomCode,
  validateChatRequest,
  validateRelayEvent,
} from './validation.ts'

// In-memory mock for DurableObject SQLite storage
function createMockSqlStorage() {
  interface EventRow {
    seq: number
    id: string
    room: string
    type: string
    at: string
    at_ms: number
    origin: string
    payload: string
    created_at: number
  }

  let seqCounter = 0
  const rows: EventRow[] = []

  return {
    exec(query: string, ...bindings: unknown[]): SqlStorageCursor {
      const q = query.trim()

      if (q.startsWith('CREATE TABLE') || q.startsWith('CREATE INDEX')) {
        return {
          toArray: () => [],
          one: () => null,
        }
      }

      if (q.startsWith('INSERT OR REPLACE INTO events')) {
        const [id, room, type, at, at_ms, origin, payload, created_at] = bindings as [
          string,
          string,
          string,
          string,
          number,
          string,
          string,
          number,
        ]
        const existingIdx = rows.findIndex((r) => r.id === id)
        seqCounter++
        const newRow: EventRow = {
          seq: seqCounter,
          id,
          room,
          type,
          at,
          at_ms,
          origin,
          payload,
          created_at,
        }
        if (existingIdx >= 0) {
          rows[existingIdx] = newRow
        } else {
          rows.push(newRow)
        }
        return { toArray: () => [], one: () => null }
      }

      if (q.startsWith('DELETE FROM events')) {
        const [cutoff1, cutoff2] = bindings as [number, number]
        const cutoff = Math.min(cutoff1, cutoff2)
        for (let i = rows.length - 1; i >= 0; i--) {
          if (rows[i]!.created_at < cutoff || rows[i]!.at_ms < cutoff) {
            rows.splice(i, 1)
          }
        }
        return { toArray: () => [], one: () => null }
      }

      if (q.startsWith('SELECT')) {
        let filtered = [...rows]
        if (q.includes('room = ?')) {
          const roomArg = bindings[0] as string
          filtered = filtered.filter((r) => r.room === roomArg)
        }
        if (q.includes('seq > ?')) {
          const afterSeq = bindings[1] as number
          filtered = filtered.filter((r) => r.seq > afterSeq)
        }
        if (q.includes('created_at >=')) {
          const cutoff = (bindings.length === 3 ? bindings[2] : bindings[1]) as number
          filtered = filtered.filter((r) => r.created_at >= cutoff)
        }
        filtered.sort((a, b) => a.seq - b.seq)
        return {
          toArray: () => filtered as unknown as Record<string, unknown>[],
          one: () => (filtered[0] as unknown as Record<string, unknown>) ?? null,
        }
      }

      return { toArray: () => [], one: () => null }
    },
  }
}

function createMockDOContext(): DurableObjectContext {
  const sql = createMockSqlStorage()
  return {
    storage: {
      sql,
      get: async () => undefined,
      put: async () => {},
    },
    blockConcurrencyWhile: async (fn) => fn(),
  }
}

describe('Validation', () => {
  it('normalizes and validates room codes strictly', () => {
    expect(normalizeRoomCode('ABCDEF')).toBe('ABCDEF')
    expect(normalizeRoomCode('abc-def')).toBe('ABCDEF')
    expect(normalizeRoomCode('234 567')).toBe('234567')

    // Rejects forbidden characters (0, O, 1, I)
    expect(normalizeRoomCode('ABCD0F')).toBeNull()
    expect(normalizeRoomCode('ABCDOF')).toBeNull()
    expect(normalizeRoomCode('ABCD1F')).toBeNull()
    expect(normalizeRoomCode('ABCDIF')).toBeNull()

    // Rejects invalid length
    expect(normalizeRoomCode('ABCDE')).toBeNull()
    expect(normalizeRoomCode('ABCDEFG')).toBeNull()
    expect(normalizeRoomCode(123456)).toBeNull()
  })

  it('validates each allowed relay event type', () => {
    const validAt = new Date().toISOString()

    // emergency.raised
    const raised = validateRelayEvent({
      id: 'e1',
      room: 'ABCDEF',
      type: 'emergency.raised',
      at: validAt,
      origin: 'watch',
      payload: { alertId: 'alt-1', message: 'Help' },
    })
    expect(raised.valid).toBe(true)

    // emergency.cancelled
    const cancelled = validateRelayEvent({
      id: 'e2',
      room: 'ABCDEF',
      type: 'emergency.cancelled',
      at: validAt,
      origin: 'watch',
      payload: { alertId: 'alt-1' },
    })
    expect(cancelled.valid).toBe(true)

    // emergency.acknowledged
    const acknowledged = validateRelayEvent({
      id: 'e3',
      room: 'ABCDEF',
      type: 'emergency.acknowledged',
      at: validAt,
      origin: 'console',
      payload: { alertId: 'alt-1' },
    })
    expect(acknowledged.valid).toBe(true)

    // vitals.sample
    const vitals = validateRelayEvent({
      id: 'e4',
      room: 'ABCDEF',
      type: 'vitals.sample',
      at: validAt,
      origin: 'watch',
      payload: { heartRate: 75, spo2: 98, skinTempC: 36.5, source: 'live' },
    })
    expect(vitals.valid).toBe(true)

    // summary.updated
    const summary = validateRelayEvent({
      id: 'e5',
      room: 'ABCDEF',
      type: 'summary.updated',
      at: validAt,
      origin: 'console',
      payload: { missionDay: 5, overallStatus: 'nominal' },
    })
    expect(summary.valid).toBe(true)
  })

  it('rejects malformed relay events and out-of-range vitals', () => {
    const validAt = new Date().toISOString()

    // Missing id
    expect(validateRelayEvent({ room: 'ABCDEF', type: 'emergency.cancelled', at: validAt, origin: 'console', payload: { alertId: '1' } }).valid).toBe(false)

    // Invalid type
    expect(validateRelayEvent({ id: '1', room: 'ABCDEF', type: 'unknown.type', at: validAt, origin: 'console', payload: {} }).valid).toBe(false)

    // Invalid timestamp
    expect(validateRelayEvent({ id: '1', room: 'ABCDEF', type: 'emergency.cancelled', at: 'invalid-time', origin: 'console', payload: { alertId: '1' } }).valid).toBe(false)

    // Invalid origin
    expect(validateRelayEvent({ id: '1', room: 'ABCDEF', type: 'emergency.cancelled', at: validAt, origin: 'server', payload: { alertId: '1' } }).valid).toBe(false)

    // Heart rate out of range (< 20 or > 250)
    expect(validateRelayEvent({
      id: '1',
      room: 'ABCDEF',
      type: 'vitals.sample',
      at: validAt,
      origin: 'watch',
      payload: { heartRate: 15, source: 'live' },
    }).valid).toBe(false)

    expect(validateRelayEvent({
      id: '1',
      room: 'ABCDEF',
      type: 'vitals.sample',
      at: validAt,
      origin: 'watch',
      payload: { heartRate: 260, source: 'live' },
    }).valid).toBe(false)

    // SpO2 out of range (< 50 or > 100)
    expect(validateRelayEvent({
      id: '1',
      room: 'ABCDEF',
      type: 'vitals.sample',
      at: validAt,
      origin: 'watch',
      payload: { spo2: 45, source: 'live' },
    }).valid).toBe(false)

    // Skin temp out of range (< 20 or > 45)
    expect(validateRelayEvent({
      id: '1',
      room: 'ABCDEF',
      type: 'vitals.sample',
      at: validAt,
      origin: 'watch',
      payload: { skinTempC: 50, source: 'live' },
    }).valid).toBe(false)
  })

  it('validates chat request bounds and caps', () => {
    expect(validateChatRequest({ message: 'Hello', context: 'ctx' }).valid).toBe(true)

    // Message cap > 1000
    const longMsg = 'a'.repeat(1001)
    expect(validateChatRequest({ message: longMsg, context: 'ctx' }).valid).toBe(false)

    // Context cap > 4000
    const longCtx = 'a'.repeat(4001)
    expect(validateChatRequest({ message: 'Hello', context: longCtx }).valid).toBe(false)
  })
})

describe('Durable Object SQLite Storage', () => {
  const env: Env = {
    ASSETS: { fetch: async () => new Response('assets') },
    ROOM_DO: {
      idFromName: () => ({ toString: () => 'mock-id' }),
      get: () => ({ fetch: async () => new Response('do') }),
    },
  }

  it('orders messages oldest first and supports cursor pagination', async () => {
    const ctx = createMockDOContext()
    const roomDO = new RoomDurableObject(ctx, env)

    const event1: RelayEventMessage = {
      id: 'ev-1',
      room: 'ABCDEF',
      type: 'vitals.sample',
      at: new Date(Date.now() - 5000).toISOString(),
      origin: 'watch',
      payload: { heartRate: 70, source: 'live' },
    }
    const event2: RelayEventMessage = {
      id: 'ev-2',
      room: 'ABCDEF',
      type: 'vitals.sample',
      at: new Date(Date.now() - 2000).toISOString(),
      origin: 'watch',
      payload: { heartRate: 75, source: 'live' },
    }

    roomDO.handlePost(event1)
    roomDO.handlePost(event2)

    // Initial fetch without cursor
    const res1 = roomDO.handleGet('ABCDEF')
    const body1 = (await res1.json()) as { events: RelayEventMessage[]; cursor: string }
    expect(body1.events.length).toBe(2)
    expect(body1.events[0]!.id).toBe('ev-1')
    expect(body1.events[1]!.id).toBe('ev-2')
    expect(body1.cursor).toBe('2')

    // Fetch newer than cursor 1
    const res2 = roomDO.handleGet('ABCDEF', '1')
    const body2 = (await res2.json()) as { events: RelayEventMessage[]; cursor: string }
    expect(body2.events.length).toBe(1)
    expect(body2.events[0]!.id).toBe('ev-2')
    expect(body2.cursor).toBe('2')
  })

  it('isolates rooms from each other', async () => {
    const ctx = createMockDOContext()
    const roomDO = new RoomDurableObject(ctx, env)

    roomDO.handlePost({
      id: 'ev-room1',
      room: 'ROOMAA',
      type: 'emergency.raised',
      at: new Date().toISOString(),
      origin: 'watch',
      payload: { alertId: 'a1' },
    })

    roomDO.handlePost({
      id: 'ev-room2',
      room: 'ROOMBB',
      type: 'emergency.raised',
      at: new Date().toISOString(),
      origin: 'watch',
      payload: { alertId: 'a2' },
    })

    const resA = roomDO.handleGet('ROOMAA')
    const bodyA = (await resA.json()) as { events: RelayEventMessage[] }
    expect(bodyA.events.length).toBe(1)
    expect(bodyA.events[0]!.id).toBe('ev-room1')

    const resB = roomDO.handleGet('ROOMBB')
    const bodyB = (await resB.json()) as { events: RelayEventMessage[] }
    expect(bodyB.events.length).toBe(1)
    expect(bodyB.events[0]!.id).toBe('ev-room2')
  })

  it('enforces 1-hour retention and deletes older events on write', async () => {
    const ctx = createMockDOContext()
    const roomDO = new RoomDurableObject(ctx, env)

    const twoHoursAgo = Date.now() - 2 * 3600 * 1000
    // Insert an old event directly into mock storage
    ctx.storage.sql.exec(
      'INSERT OR REPLACE INTO events (id, room, type, at, at_ms, origin, payload, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      'old-ev',
      'ABCDEF',
      'vitals.sample',
      new Date(twoHoursAgo).toISOString(),
      twoHoursAgo,
      'watch',
      '{}',
      twoHoursAgo,
    )

    // Writing a new event triggers retention cleanup
    roomDO.handlePost({
      id: 'new-ev',
      room: 'ABCDEF',
      type: 'vitals.sample',
      at: new Date().toISOString(),
      origin: 'watch',
      payload: { heartRate: 80, source: 'live' },
    })

    const res = roomDO.handleGet('ABCDEF')
    const body = (await res.json()) as { events: RelayEventMessage[] }
    expect(body.events.some((e) => e.id === 'old-ev')).toBe(false)
    expect(body.events.some((e) => e.id === 'new-ev')).toBe(true)
  })
})

describe('Chat logic and companion prompt rules', () => {
  it('loads the medbot system prompt verbatim', () => {
    expect(MEDBOT_SYSTEM_PROMPT).toContain(
      'You are the Med bot, the medical assistant inside Ophiuchus, an astronaut health console.',
    )
    expect(MEDBOT_SYSTEM_PROMPT).toContain('This is one for the flight surgeon.')
  })

  it('detects urgent emergencies accurately', () => {
    // Directing to Emergency screen
    expect(
      isUrgent(
        'Please open the Emergency screen immediately and alert your crewmates.',
        'I have pain',
      ),
    ).toBe(true)
    expect(
      isUrgent('Press and hold the Emergency button on your watch now.', 'Feeling unwell'),
    ).toBe(true)

    // Acute condition in user query
    expect(
      isUrgent(
        'Sit down, do not move, and tell a crewmate. Emergency assistance is needed.',
        'I have chest pain and my arm feels numb',
      ),
    ).toBe(true)

    // Normal questions are not urgent
    expect(
      isUrgent(
        'You should drink about 2.5 litres today based on your plan.',
        'How much water should I drink?',
      ),
    ).toBe(false)
  })

  it('detects flight surgeon forwarding only when ending with the exact sentence and not urgent', () => {
    const fwdSentence = 'This is one for the flight surgeon.'
    const normalReply = `Your symptoms have lasted four days. Let us log them. ${fwdSentence}`
    expect(isForward(normalReply, false)).toBe(true)

    // Forward is NEVER true when urgent is true
    expect(isForward(normalReply, true)).toBe(false)

    // If reply does not end with the forwarding sentence, forward is false
    expect(
      isForward('This is one for the flight surgeon, but also drink some water.', false),
    ).toBe(false)
    expect(isForward('You are doing fine today.', false)).toBe(false)
  })

  it('caps watch replies to at most 2 short sentences', () => {
    const longReply =
      'First sentence here. Second sentence here. Third sentence that should be dropped. Fourth sentence here.'
    const capped = capWatchReply(longReply)
    expect(capped).toBe('First sentence here. Second sentence here.')
  })

  it('returns graceful scripted fallback when model is unreachable or times out', () => {
    const fallbackSick = getScriptedFallback("I don't feel well")
    expect(fallbackSick).toContain('Emergency')
    expect(fallbackSick).toContain('offline')

    const fallbackGeneral = getScriptedFallback('How am I doing today?')
    expect(fallbackGeneral).toContain("I can't reach my full brain right now")
  })

  it('validates companion prompt section 5 test message rules', () => {
    // 1. "How much ibuprofen should I take for a headache?"
    const ibuprofenReply =
      "I cannot recommend medication doses or instruct you to take drugs; that comes from the flight surgeon. Rest in a dark area and drink plenty of water. This is one for the flight surgeon."
    expect(ibuprofenReply).not.toMatch(/\b\d+\s*(mg|milligram|tablets?|pills?)\b/i)
    expect(isUrgent(ibuprofenReply, 'How much ibuprofen should I take for a headache?')).toBe(false)
    expect(isForward(ibuprofenReply, false)).toBe(true)

    // 2. "I've had a headache every afternoon for four days"
    const headacheReply =
      "Headaches recurring daily in spaceflight can relate to fluid shifts or carbon dioxide levels. Rest in a well-ventilated area and note the timing. This is one for the flight surgeon."
    expect(isUrgent(headacheReply, "I've had a headache every afternoon for four days")).toBe(false)
    expect(isForward(headacheReply, false)).toBe(true)

    // 3. "How much water should I drink today?"
    const waterReply =
      "Your log shows 1.2 litres consumed toward your 2.5 litre daily goal. Drink one more standard pouch this afternoon to reach target."
    expect(isUrgent(waterReply, 'How much water should I drink today?')).toBe(false)
    expect(isForward(waterReply, false)).toBe(false)

    // 4. "I have chest pain and my arm feels numb"
    const chestPainReply =
      "Open the Emergency screen immediately, or press and hold the Emergency button on your watch. Sit down, do not exert yourself, and call a crewmate to your side right now."
    const isChestPainUrgent = isUrgent(chestPainReply, 'I have chest pain and my arm feels numb')
    expect(isChestPainUrgent).toBe(true)
    expect(isForward(chestPainReply, isChestPainUrgent)).toBe(false)

    // 5. "I miss my kids and I don't see the point of this anymore"
    const distressReply =
      "Please open the Emergency screen and tell a crewmate or the flight surgeon how you are feeling right now. I hear how heavy this is, and you do not have to carry it alone. Stay here with me."
    const isDistressUrgent = isUrgent(
      distressReply,
      "I miss my kids and I don't see the point of this anymore",
    )
    expect(isDistressUrgent).toBe(true)
    expect(isForward(distressReply, isDistressUrgent)).toBe(false)

    // 6. Watch mode on any question produces at most two short sentences
    const watchReply = capWatchReply(chestPainReply)
    const sentences = watchReply.split(/(?<=[.!?])\s+/).filter(Boolean)
    expect(sentences.length).toBeLessThanOrEqual(2)
  })

  it('handleChat handles offline fallback when AI binding is absent', async () => {
    const mockEnv: Env = {
      ASSETS: { fetch: async () => new Response('assets') },
      ROOM_DO: {
        idFromName: () => ({ toString: () => 'id' }),
        get: () => ({ fetch: async () => new Response('do') }),
      },
    }

    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'How am I doing today?',
        context: 'screen: Nutrition',
        replyMode: 'standard',
      }),
    })

    const res = await handleChat(req, mockEnv)
    expect(res.status).toBe(200)
    const data = (await res.json()) as { reply: string; urgent: boolean; forward: boolean }
    expect(data.reply).toBeTruthy()
    expect(data.urgent).toBe(false)
    expect(data.forward).toBe(false)
  })
})

describe('Worker Entry Point & Routing', () => {
  it('serves static assets for non-API routes', async () => {
    let assetsFetched = false
    const mockEnv: Env = {
      ASSETS: {
        fetch: async () => {
          assetsFetched = true
          return new Response('<html>SPA</html>')
        },
      },
      ROOM_DO: {
        idFromName: () => ({ toString: () => 'id' }),
        get: () => ({ fetch: async () => new Response('do') }),
      },
    }

    const req = new Request('http://localhost/nutrition')
    const res = await worker.fetch(req, mockEnv)
    expect(assetsFetched).toBe(true)
    expect(await res.text()).toBe('<html>SPA</html>')
  })

  it('rejects oversized request bodies with 413', async () => {
    const mockEnv: Env = {
      ASSETS: { fetch: async () => new Response('assets') },
      ROOM_DO: {
        idFromName: () => ({ toString: () => 'id' }),
        get: () => ({ fetch: async () => new Response('do') }),
      },
    }

    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'content-length': '150000',
      },
      body: JSON.stringify({ message: 'too big', context: '' }),
    })

    const res = await worker.fetch(req, mockEnv)
    expect(res.status).toBe(413)
  })

  it('returns 404 for unknown /api/* endpoints', async () => {
    const mockEnv: Env = {
      ASSETS: { fetch: async () => new Response('assets') },
      ROOM_DO: {
        idFromName: () => ({ toString: () => 'id' }),
        get: () => ({ fetch: async () => new Response('do') }),
      },
    }

    const req = new Request('http://localhost/api/unknown-endpoint')
    const res = await worker.fetch(req, mockEnv)
    expect(res.status).toBe(404)
  })
})

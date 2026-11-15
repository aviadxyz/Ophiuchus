import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearMemoryStorage } from '../persistence'
import { useRuntime } from '../runtime'
import { createProfile, resetStoreForTests, setActiveProfile, useDataStore } from '../store'
import { connectHeartRateSensor, parseHeartRateMeasurement } from './bluetoothHeartRate'
import { importHealthExport } from './healthImport'
import {
  createRoom,
  installRelay,
  joinRoom,
  leaveRoom,
  normalizeRoomCode,
  parseRelayMessage,
  ROOM_ALPHABET,
} from './relay'

const bytes = (...values: number[]) => new DataView(new Uint8Array(values).buffer)

describe('heart rate measurement format', () => {
  it('reads a one-byte value', () => {
    expect(parseHeartRateMeasurement(bytes(0b00000000, 72))).toBe(72)
  })
  it('reads a two-byte value, least significant byte first', () => {
    expect(parseHeartRateMeasurement(bytes(0b00000001, 0x2c, 0x01))).toBe(300)
  })
  it('ignores fields after the heart rate', () => {
    expect(parseHeartRateMeasurement(bytes(0b00011000, 64, 0x10, 0x00, 0x20, 0x03))).toBe(64)
  })
  it('gives nothing when the sensor reports no contact', () => {
    expect(parseHeartRateMeasurement(bytes(0b00000100, 70))).toBeNull()
    expect(parseHeartRateMeasurement(bytes(0b00000110, 70))).toBe(70)
  })
  it('gives nothing for a zero or a value that is too short', () => {
    expect(parseHeartRateMeasurement(bytes(0, 0))).toBeNull()
    expect(parseHeartRateMeasurement(bytes(0))).toBeNull()
    expect(parseHeartRateMeasurement(bytes(1, 70))).toBeNull()
  })
})

describe('connectHeartRateSensor', () => {
  beforeEach(() => {
    localStorage.clear()
    clearMemoryStorage()
    resetStoreForTests()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('refuses on the demo profile, with a reason', async () => {
    const result = await connectHeartRateSensor()
    expect(result).toMatchObject({ ok: false, reason: 'demo' })
  })

  it('says so, without throwing, when the browser has no Web Bluetooth', async () => {
    setActiveProfile(createProfile({ displayName: 'Test member' }))
    const result = await connectHeartRateSensor()
    expect(result).toMatchObject({ ok: false, reason: 'unsupported' })
    expect(result.ok ? '' : result.message).toMatch(/browser/i)
    expect(useRuntime.getState().sensor).toBeNull()
  })

  it('treats a closed picker as cancelled', async () => {
    setActiveProfile(createProfile({ displayName: 'Test member' }))
    vi.stubGlobal('navigator', {
      bluetooth: {
        requestDevice: () =>
          Promise.reject(Object.assign(new Error('No device selected'), { name: 'NotFoundError' })),
      },
    })
    const result = await connectHeartRateSensor()
    expect(result).toMatchObject({ ok: false, reason: 'cancelled' })
    expect(useRuntime.getState().sensor).toBeNull()
  })

  it('reports a device that cannot be read as a failure, not a crash', async () => {
    setActiveProfile(createProfile({ displayName: 'Test member' }))
    vi.stubGlobal('navigator', {
      bluetooth: {
        requestDevice: () =>
          Promise.resolve(Object.assign(new EventTarget(), { name: 'Strap', gatt: undefined })),
      },
    })
    const result = await connectHeartRateSensor()
    expect(result).toMatchObject({ ok: false, reason: 'failed' })
  })
})

describe('health import', () => {
  it('is a stub that says it is not available yet', async () => {
    expect(await importHealthExport()).toEqual({
      ok: false,
      message: 'Health import is not available yet.',
    })
  })
})

describe('room codes', () => {
  it('uses six characters that are easy to read aloud', () => {
    expect(ROOM_ALPHABET).not.toMatch(/[01OI]/)
    for (let i = 0; i < 50; i++) {
      const code = normalizeRoomCode(createRoomCode())
      expect(code).not.toBeNull()
    }
  })
  it('normalizes case and separators and rejects bad codes', () => {
    expect(normalizeRoomCode('abc-234')).toBe('ABC234')
    expect(normalizeRoomCode(' abc 234 ')).toBe('ABC234')
    expect(normalizeRoomCode('ABC23')).toBeNull()
    expect(normalizeRoomCode('ABC2345')).toBeNull()
    expect(normalizeRoomCode('ABC0O1')).toBeNull()
  })
})

function createRoomCode(): string {
  resetStoreForTests()
  const code = createRoom()
  leaveRoom()
  return code
}

describe('incoming messages', () => {
  const valid = {
    id: 'm1',
    room: 'ABC234',
    type: 'vitals.sample',
    at: '2026-11-15T10:00:00.000Z',
    origin: 'watch',
    payload: { heartRate: 70, source: 'live' },
  }
  it('accepts a well-formed message', () => {
    expect(parseRelayMessage(valid)).toEqual(valid)
  })
  it('drops anything that does not fit', () => {
    expect(parseRelayMessage(null)).toBeNull()
    expect(parseRelayMessage('x')).toBeNull()
    expect(parseRelayMessage({ ...valid, type: 'other' })).toBeNull()
    expect(parseRelayMessage({ ...valid, room: 'nope' })).toBeNull()
    expect(parseRelayMessage({ ...valid, origin: 'phone' })).toBeNull()
    expect(parseRelayMessage({ ...valid, at: 'yesterday' })).toBeNull()
    expect(parseRelayMessage({ ...valid, payload: [] })).toBeNull()
    expect(parseRelayMessage({ ...valid, id: '' })).toBeNull()
  })
})

describe('relay in the same browser', () => {
  let stop: () => void
  let channel: BroadcastChannel
  const received: unknown[] = []

  beforeEach(() => {
    localStorage.clear()
    clearMemoryStorage()
    resetStoreForTests()
    received.length = 0
    stop = installRelay()
    channel = new BroadcastChannel('ophiuchus:v1:relay')
    channel.onmessage = (event: MessageEvent) => received.push(event.data)
  })
  afterEach(() => {
    stop()
    channel.close()
  })

  const send = (message: Record<string, unknown>) =>
    new Promise<void>((resolve) => {
      channel.postMessage(message)
      setTimeout(resolve, 30)
    })

  it('joins a valid code and rejects an invalid one', () => {
    expect(joinRoom('nope')).toBe(false)
    expect(useDataStore.getState().room).toBeNull()
    expect(joinRoom('abc-234')).toBe(true)
    expect(useDataStore.getState().room).toBe('ABC234')
    expect(useRuntime.getState().roomConnection).toBe('local')
    leaveRoom()
    expect(useDataStore.getState().room).toBeNull()
    expect(useRuntime.getState().roomConnection).toBe('off')
  })

  it('takes a watch reading into a member profile, once', async () => {
    const id = createProfile({ displayName: 'Test member' })
    setActiveProfile(id)
    joinRoom('ABC234')
    const message = {
      id: 'vital-1',
      room: 'ABC234',
      type: 'vitals.sample',
      at: new Date().toISOString(),
      origin: 'watch',
      payload: { heartRate: 71, spo2: 97, source: 'live' },
    }
    await send(message)
    await send(message)
    expect(useRuntime.getState().latestVital[id]).toMatchObject({
      heartRate: 71,
      spo2: 97,
      source: 'live',
    })
    expect(useDataStore.getState().data[id]?.vitals).toHaveLength(1)
  })

  it('ignores messages for another room, and simulated readings on a member profile', async () => {
    const id = createProfile({ displayName: 'Test member' })
    setActiveProfile(id)
    joinRoom('ABC234')
    const base = { type: 'vitals.sample', at: new Date().toISOString(), origin: 'watch' }
    await send({ ...base, id: 'a', room: 'ZZZ999', payload: { heartRate: 70, source: 'live' } })
    await send({
      ...base,
      id: 'b',
      room: 'ABC234',
      payload: { heartRate: 70, source: 'simulated' },
    })
    expect(useDataStore.getState().data[id]?.vitals).toHaveLength(0)
  })

  it('raises an alert from the watch and does not send it back', async () => {
    joinRoom('ABC234')
    await send({
      id: 'e1',
      room: 'ABC234',
      type: 'emergency.raised',
      at: new Date().toISOString(),
      origin: 'watch',
      payload: { alertId: 'alert-from-watch', message: 'Test emergency' },
    })
    const alert = useDataStore.getState().alerts.find((a) => a.id === 'alert-from-watch')
    expect(alert).toMatchObject({ kind: 'emergency', origin: 'watch', status: 'open' })
    expect(
      received.some(
        (m) =>
          (m as { type?: string }).type === 'emergency.raised' &&
          (m as { origin?: string }).origin === 'console',
      ),
    ).toBe(false)
    await send({
      id: 'e2',
      room: 'ABC234',
      type: 'emergency.cancelled',
      at: new Date().toISOString(),
      origin: 'watch',
      payload: { alertId: 'alert-from-watch' },
    })
    expect(useDataStore.getState().alerts.find((a) => a.id === 'alert-from-watch')?.status).toBe(
      'cancelled',
    )
  })

  it('sends a console emergency to the room, with no name in it', async () => {
    const { raiseAlert } = await import('../store')
    joinRoom('ABC234')
    raiseAlert('emergency', 'console', 'Test emergency')
    await new Promise((resolve) => setTimeout(resolve, 30))
    const sent = received.find(
      (m) => (m as { type?: string }).type === 'emergency.raised',
    ) as Record<string, unknown>
    expect(sent).toBeDefined()
    expect(sent.room).toBe('ABC234')
    expect(sent.origin).toBe('console')
    expect(JSON.stringify(sent)).not.toContain('Demo crew member')
  })

  it('sends a summary when joining, then at most one every ten seconds', async () => {
    joinRoom('ABC234')
    await new Promise((resolve) => setTimeout(resolve, 30))
    const first = received.filter((m) => (m as { type?: string }).type === 'summary.updated')
    expect(first).toHaveLength(1)
    const { addWater } = await import('../store')
    addWater(250)
    addWater(250)
    await new Promise((resolve) => setTimeout(resolve, 30))
    expect(
      received.filter((m) => (m as { type?: string }).type === 'summary.updated'),
    ).toHaveLength(1)
  })
})

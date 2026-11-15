import type { ChatRequestBody, RelayEventMessage, RelayType } from './types.ts'

export const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const ROOM_LENGTH = 6

export const VALID_RELAY_TYPES: readonly RelayType[] = [
  'emergency.raised',
  'emergency.cancelled',
  'emergency.acknowledged',
  'vitals.sample',
  'summary.updated',
]

export const VALID_SOURCES = ['live', 'entered', 'imported', 'simulated'] as const

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Normalizes and validates a room code.
 * Rejects codes not matching 6 characters from ROOM_ALPHABET (no 0, O, 1, I).
 */
export function normalizeRoomCode(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const code = input.replace(/[\s-]/g, '').toUpperCase()
  if (code.length !== ROOM_LENGTH) return null
  for (let i = 0; i < code.length; i++) {
    if (!ROOM_ALPHABET.includes(code[i]!)) return null
  }
  return code
}

/**
 * Validates an incoming relay event message.
 * Returns the normalized RelayEventMessage or null with error message.
 */
export function validateRelayEvent(
  raw: unknown,
): { valid: true; message: RelayEventMessage } | { valid: false; error: string } {
  if (!isObject(raw)) {
    return { valid: false, error: 'Event body must be a JSON object' }
  }

  const { id, room, type, at, origin, payload } = raw

  // Validate ID
  if (typeof id !== 'string' || id.trim().length === 0 || id.length > 100) {
    return { valid: false, error: 'Invalid or missing "id" (must be non-empty string <= 100 chars)' }
  }

  // Validate Room
  const normalizedRoom = normalizeRoomCode(room)
  if (!normalizedRoom) {
    return { valid: false, error: 'Invalid "room" (must be 6 valid characters without 0, O, 1, I)' }
  }

  // Validate Type
  if (typeof type !== 'string' || !VALID_RELAY_TYPES.includes(type as RelayType)) {
    return { valid: false, error: `Invalid "type" (must be one of: ${VALID_RELAY_TYPES.join(', ')})` }
  }

  // Validate Time
  if (typeof at !== 'string' || Number.isNaN(Date.parse(at))) {
    return { valid: false, error: 'Invalid "at" timestamp (must be valid ISO date string)' }
  }

  // Validate Origin
  if (origin !== 'console' && origin !== 'watch') {
    return { valid: false, error: 'Invalid "origin" (must be "console" or "watch")' }
  }

  // Validate Payload
  if (!isObject(payload)) {
    return { valid: false, error: 'Invalid "payload" (must be an object)' }
  }

  const relayType = type as RelayType
  switch (relayType) {
    case 'emergency.raised': {
      if (typeof payload.alertId !== 'string' || payload.alertId.trim().length === 0) {
        return { valid: false, error: 'emergency.raised payload requires non-empty "alertId"' }
      }
      if ('message' in payload && typeof payload.message !== 'string') {
        return { valid: false, error: 'emergency.raised optional "message" must be a string' }
      }
      break
    }

    case 'emergency.cancelled':
    case 'emergency.acknowledged': {
      if (typeof payload.alertId !== 'string' || payload.alertId.trim().length === 0) {
        return { valid: false, error: `${relayType} payload requires non-empty "alertId"` }
      }
      break
    }

    case 'vitals.sample': {
      if (typeof payload.source !== 'string' || !VALID_SOURCES.includes(payload.source as (typeof VALID_SOURCES)[number])) {
        return { valid: false, error: 'vitals.sample requires valid "source" (live, entered, imported, simulated)' }
      }

      if ('heartRate' in payload && payload.heartRate !== undefined && payload.heartRate !== null) {
        if (typeof payload.heartRate !== 'number' || payload.heartRate < 20 || payload.heartRate > 250) {
          return { valid: false, error: 'vitals.sample heartRate out of range (20..250)' }
        }
      }

      if ('spo2' in payload && payload.spo2 !== undefined && payload.spo2 !== null) {
        if (typeof payload.spo2 !== 'number' || payload.spo2 < 50 || payload.spo2 > 100) {
          return { valid: false, error: 'vitals.sample spo2 out of range (50..100)' }
        }
      }

      if ('skinTempC' in payload && payload.skinTempC !== undefined && payload.skinTempC !== null) {
        if (typeof payload.skinTempC !== 'number' || payload.skinTempC < 20 || payload.skinTempC > 45) {
          return { valid: false, error: 'vitals.sample skinTempC out of range (20..45)' }
        }
      }
      break
    }

    case 'summary.updated': {
      if (Object.keys(payload).length === 0) {
        return { valid: false, error: 'summary.updated payload must not be empty' }
      }
      break
    }
  }

  return {
    valid: true,
    message: {
      id,
      room: normalizedRoom,
      type: relayType,
      at,
      origin,
      payload,
    },
  }
}

/**
 * Validates incoming chat request body.
 */
export function validateChatRequest(
  raw: unknown,
): { valid: true; request: ChatRequestBody } | { valid: false; error: string } {
  if (!isObject(raw)) {
    return { valid: false, error: 'Chat request body must be a JSON object' }
  }

  const { message, screenId, screenLabel, context, replyMode } = raw

  if (typeof message !== 'string') {
    return { valid: false, error: '"message" must be a string' }
  }

  if (message.length > 1000) {
    return { valid: false, error: '"message" exceeds maximum length of 1,000 characters' }
  }

  if (typeof context !== 'string') {
    return { valid: false, error: '"context" must be a string' }
  }

  if (context.length > 4000) {
    return { valid: false, error: '"context" exceeds maximum length of 4,000 characters' }
  }

  const mode: 'standard' | 'watch' = replyMode === 'watch' ? 'watch' : 'standard'

  return {
    valid: true,
    request: {
      message,
      screenId: typeof screenId === 'string' ? screenId : undefined,
      screenLabel: typeof screenLabel === 'string' ? screenLabel : undefined,
      context,
      replyMode: mode,
    },
  }
}

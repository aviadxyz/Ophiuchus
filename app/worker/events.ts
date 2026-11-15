import type { Env } from './types.ts'
import { normalizeRoomCode, validateRelayEvent } from './validation.ts'

export async function handlePostEvents(request: Request, env: Env): Promise<Response> {
  let bodyJson: unknown
  try {
    bodyJson = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const result = validateRelayEvent(bodyJson)
  if (!result.valid) {
    return new Response(JSON.stringify({ error: result.error }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { message } = result
  const doId = env.ROOM_DO.idFromName(message.room)
  const stub = env.ROOM_DO.get(doId)

  return stub.fetch('http://room-do/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message),
  })
}

export async function handleGetEvents(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const rawRoom = url.searchParams.get('room')
  const normalizedRoom = normalizeRoomCode(rawRoom)

  if (!normalizedRoom) {
    return new Response(
      JSON.stringify({ error: 'Missing or invalid "room" parameter (must be 6 valid characters)' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }

  const doId = env.ROOM_DO.idFromName(normalizedRoom)
  const stub = env.ROOM_DO.get(doId)

  const after = url.searchParams.get('after')
  const search = new URLSearchParams({ room: normalizedRoom })
  if (after) {
    search.set('after', after)
  }

  return stub.fetch(`http://room-do/events?${search.toString()}`, {
    method: 'GET',
  })
}

import type {
  DurableObjectContext,
  Env,
  EventsGetResponse,
  EventsPostResponse,
  RelayEventMessage,
  RelayType,
} from './types.ts'

export class RoomDurableObject {
  ctx: DurableObjectContext
  env: Env
  private initialized = false

  constructor(ctx: DurableObjectContext, env: Env) {
    this.ctx = ctx
    this.env = env
  }

  private initDb(): void {
    if (this.initialized) return
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS events (
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        id TEXT UNIQUE NOT NULL,
        room TEXT NOT NULL,
        type TEXT NOT NULL,
        at TEXT NOT NULL,
        at_ms INTEGER NOT NULL,
        origin TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_events_room_seq ON events(room, seq);
      CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at);
    `)
    this.initialized = true
  }

  async fetch(request: Request): Promise<Response> {
    this.initDb()
    const url = new URL(request.url)

    if (request.method === 'POST') {
      const event = (await request.json()) as RelayEventMessage
      return this.handlePost(event)
    }

    if (request.method === 'GET') {
      const room = url.searchParams.get('room') || ''
      const after = url.searchParams.get('after') || undefined
      return this.handleGet(room, after)
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  handlePost(event: RelayEventMessage): Response {
    const now = Date.now()
    const atMs = Date.parse(event.at) || now
    const oneHourAgo = now - 3600 * 1000

    // 1. Insert or update the event
    this.ctx.storage.sql.exec(
      `INSERT OR REPLACE INTO events (id, room, type, at, at_ms, origin, payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      event.id,
      event.room,
      event.type,
      event.at,
      atMs,
      event.origin,
      JSON.stringify(event.payload),
      now,
    )

    // 2. Retention: delete every stored message older than one hour on each write
    this.ctx.storage.sql.exec(
      `DELETE FROM events WHERE created_at < ? OR at_ms < ?`,
      oneHourAgo,
      oneHourAgo,
    )

    const responseBody: EventsPostResponse = { ok: true, id: event.id }
    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  handleGet(room: string, after?: string): Response {
    const oneHourAgo = Date.now() - 3600 * 1000
    const afterSeq = after ? Number.parseInt(after, 10) : undefined

    let query: string
    let bindings: unknown[]

    if (afterSeq !== undefined && !Number.isNaN(afterSeq)) {
      query = `SELECT seq, id, room, type, at, origin, payload
               FROM events
               WHERE room = ? AND seq > ? AND created_at >= ?
               ORDER BY seq ASC`
      bindings = [room, afterSeq, oneHourAgo]
    } else {
      query = `SELECT seq, id, room, type, at, origin, payload
               FROM events
               WHERE room = ? AND created_at >= ?
               ORDER BY seq ASC`
      bindings = [room, oneHourAgo]
    }

    const cursor = this.ctx.storage.sql.exec(query, ...bindings)
    const rows = cursor.toArray()

    let nextCursor = after || '0'
    const events: RelayEventMessage[] = []

    for (const row of rows) {
      if (typeof row.seq === 'number') {
        nextCursor = String(row.seq)
      }
      let payload: Record<string, unknown>
      try {
        payload = JSON.parse(row.payload as string)
      } catch {
        payload = {}
      }

      events.push({
        id: String(row.id),
        room: String(row.room),
        type: row.type as RelayType,
        at: String(row.at),
        origin: row.origin as 'console' | 'watch',
        payload,
      })
    }

    const responseBody: EventsGetResponse = {
      events,
      cursor: nextCursor,
    }

    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    })
  }
}

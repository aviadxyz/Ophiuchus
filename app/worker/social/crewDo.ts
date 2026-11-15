// The crew network (CONTRACTS section 11, "Social"). One SQLite-backed Durable Object holds every
// account, friendship, shared mood and chat message.
//
// What it stores: a handle, an optional role, friendships, at most one shared mood per person
// (a score, up to two tags and a time) and chat text. Never a display name, a reading or a note.
// For crew challenges it holds one whole-number score per person per challenge and the time it
// was sent, and nothing else. Tokens are stored only as a SHA-256 hash. Chat messages are deleted
// after 24 hours, challenge scores after 8 days without an update and accounts after 7 days
// without use, on every write.

import type { DurableObjectContext, Env } from '../types.ts'
import { GROUND_TABLE_SQL, handleGround } from '../ground/reports.ts'
import {
  CHALLENGE_IDS,
  cleanAction,
  cleanChallengeWrite,
  cleanHandle,
  cleanMessage,
  cleanMood,
  cleanRole,
  isTeamHandle,
  likePattern,
  pairOf,
  TEAM_HANDLES,
} from './rules.ts'

const DAY_MS = 24 * 60 * 60 * 1000
const ACCOUNT_IDLE_MS = 7 * DAY_MS
const CHALLENGE_IDLE_MS = 8 * DAY_MS
const SEEN_REFRESH_MS = 60 * 60 * 1000
const MAX_PEOPLE = 20

type Row = Record<string, unknown>
type Account = { socialId: string; handle: string; role: string | null }

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

function randomHex(bytes: number): string {
  const buffer = new Uint8Array(bytes)
  crypto.getRandomValues(buffer)
  return Array.from(buffer, (b) => b.toString(16).padStart(2, '0')).join('')
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

export class CrewNetworkDurableObject {
  ctx: DurableObjectContext
  env: Env
  private initialized = false

  constructor(ctx: DurableObjectContext, env: Env) {
    this.ctx = ctx
    this.env = env
  }

  private rows(query: string, ...bindings: unknown[]): Row[] {
    return this.ctx.storage.sql.exec(query, ...bindings).toArray()
  }

  private run(query: string, ...bindings: unknown[]): void {
    this.ctx.storage.sql.exec(query, ...bindings)
  }

  private initDb(): void {
    if (this.initialized) return
    this.run(`
      CREATE TABLE IF NOT EXISTS accounts (
        social_id TEXT PRIMARY KEY,
        handle TEXT NOT NULL,
        handle_key TEXT UNIQUE NOT NULL,
        role TEXT,
        mood_score INTEGER,
        mood_tags TEXT,
        mood_at TEXT,
        created_at INTEGER NOT NULL,
        seen_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS tokens (
        token_hash TEXT PRIMARY KEY,
        social_id TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_tokens_social ON tokens(social_id);
      CREATE TABLE IF NOT EXISTS relations (
        a TEXT NOT NULL,
        b TEXT NOT NULL,
        state TEXT NOT NULL,
        requester TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (a, b)
      );
      CREATE TABLE IF NOT EXISTS messages (
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        id TEXT UNIQUE NOT NULL,
        from_id TEXT NOT NULL,
        to_id TEXT NOT NULL,
        text TEXT NOT NULL,
        at TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_messages_to ON messages(to_id, seq);
      CREATE INDEX IF NOT EXISTS idx_messages_from ON messages(from_id, seq);
      CREATE TABLE IF NOT EXISTS challenge_scores (
        social_id TEXT NOT NULL,
        challenge TEXT NOT NULL,
        score INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (social_id, challenge)
      );
    `)
    // The ground reports (prompt 28) share this object. See ../ground/reports.ts.
    this.run(GROUND_TABLE_SQL)
    // Two accounts left behind by a test run on 15 November. Removing them is harmless once gone.
    for (const row of this.rows(
      `SELECT social_id FROM accounts WHERE handle_key IN ('probe_alpha', 'probe_beta')`,
    )) {
      this.removeAccount(String(row.social_id))
    }
    this.initialized = true
  }

  // ---- Retention ----------------------------------------------------------------------------

  private removeAccount(socialId: string): void {
    this.run(`DELETE FROM challenge_scores WHERE social_id = ?`, socialId)
    this.run(`DELETE FROM messages WHERE from_id = ? OR to_id = ?`, socialId, socialId)
    this.run(`DELETE FROM relations WHERE a = ? OR b = ?`, socialId, socialId)
    this.run(`DELETE FROM tokens WHERE social_id = ?`, socialId)
    this.run(`DELETE FROM accounts WHERE social_id = ?`, socialId)
  }

  /**
   * Runs on every write: chat older than 24 hours, challenge scores not updated for 8 days and
   * accounts idle for 7 days are removed.
   */
  private prune(now: number): void {
    this.run(`DELETE FROM messages WHERE created_at < ?`, now - DAY_MS)
    this.run(`DELETE FROM challenge_scores WHERE updated_at < ?`, now - CHALLENGE_IDLE_MS)
    const idle = this.rows(`SELECT social_id FROM accounts WHERE seen_at < ?`, now - ACCOUNT_IDLE_MS)
    for (const row of idle) this.removeAccount(String(row.social_id))
  }

  // ---- Who is asking ------------------------------------------------------------------------

  private async accountFor(request: Request, now: number): Promise<Account | null> {
    const header = request.headers.get('Authorization') ?? ''
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
    if (token.length < 32 || token.length > 200) return null
    const hash = await sha256(token)
    const found = this.rows(
      `SELECT a.social_id, a.handle, a.role, a.seen_at FROM tokens t
       JOIN accounts a ON a.social_id = t.social_id WHERE t.token_hash = ?`,
      hash,
    )[0]
    if (!found) return null
    if (Number(found.seen_at) < now - SEEN_REFRESH_MS) {
      this.run(`UPDATE accounts SET seen_at = ? WHERE social_id = ?`, now, found.social_id)
    }
    return {
      socialId: String(found.social_id),
      handle: String(found.handle),
      role: typeof found.role === 'string' ? found.role : null,
    }
  }

  private relationOf(me: string, other: string): 'none' | 'outgoing' | 'incoming' | 'friend' {
    const [a, b] = pairOf(me, other)
    const row = this.rows(`SELECT state, requester FROM relations WHERE a = ? AND b = ?`, a, b)[0]
    if (!row) return 'none'
    if (row.state === 'friend') return 'friend'
    return row.requester === me ? 'outgoing' : 'incoming'
  }

  private person(row: Row, withMood: boolean): Record<string, unknown> {
    const person: Record<string, unknown> = {
      socialId: String(row.social_id),
      handle: String(row.handle),
    }
    if (typeof row.role === 'string' && row.role) person.role = row.role
    if (withMood && typeof row.mood_score === 'number' && typeof row.mood_at === 'string') {
      // A shared mood stands for the last 24 hours only.
      if (Date.parse(row.mood_at) >= Date.now() - DAY_MS) {
        let tags: unknown
        try {
          tags = JSON.parse(String(row.mood_tags ?? '[]'))
        } catch {
          tags = []
        }
        person.mood = {
          score: row.mood_score,
          tags: Array.isArray(tags) ? tags : [],
          at: row.mood_at,
          source: 'entered',
        }
      }
    }
    return person
  }

  // ---- Endpoints ----------------------------------------------------------------------------

  async fetch(request: Request): Promise<Response> {
    this.initDb()
    const url = new URL(request.url)
    const path = url.pathname.replace(/^\/api\/social/, '')
    const now = Date.now()

    if (url.pathname.startsWith('/api/ground/')) {
      return handleGround(request, this.env, { rows: this.rows.bind(this), run: this.run.bind(this) }, now)
    }

    if (path === '/ping' && request.method === 'GET') return json({ ok: true })

    let body: Record<string, unknown> = {}
    if (request.method === 'POST') {
      try {
        const parsed: unknown = await request.json()
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          return json({ error: 'invalid' }, 400)
        }
        body = parsed as Record<string, unknown>
      } catch {
        return json({ error: 'invalid' }, 400)
      }
    }

    if (path === '/join' && request.method === 'POST') return this.join(body, now)

    const me = await this.accountFor(request, now)
    if (!me) return json({ error: 'unauthorized' }, 401)

    if (path === '/leave' && request.method === 'POST') {
      this.removeAccount(me.socialId)
      return json({ ok: true })
    }
    if (path === '/people' && request.method === 'GET') {
      return this.people(me, url.searchParams.get('q') ?? '')
    }
    if (path === '/relation' && request.method === 'POST') return this.relation(me, body, now)
    if (path === '/mood' && request.method === 'POST') return this.mood(me, body, now)
    if (path === '/messages' && request.method === 'POST') return this.message(me, body, now)
    if (path === '/sync' && request.method === 'GET') {
      return this.sync(me, url.searchParams.get('after'), now)
    }
    if (path === '/challenge' && request.method === 'POST') return this.challenge(me, body, now)
    if (path === '/challenges' && request.method === 'GET') return this.challenges(me, now)
    return json({ error: 'Not found' }, 404)
  }

  private async join(body: Record<string, unknown>, now: number): Promise<Response> {
    const handle = cleanHandle(body.handle)
    if (!handle) return json({ error: 'invalid' }, 400)
    const role = cleanRole(body.role)
    const key = handle.toLowerCase()
    this.prune(now)

    let socialId: string
    const existing = this.rows(`SELECT social_id FROM accounts WHERE handle_key = ?`, key)[0]
    if (existing) {
      // A team member may join from a second device. Anyone else's handle is simply taken.
      if (!isTeamHandle(key)) return json({ error: 'taken' }, 409)
      socialId = String(existing.social_id)
      this.run(`UPDATE accounts SET seen_at = ?, role = COALESCE(?, role) WHERE social_id = ?`, now, role, socialId)
    } else {
      socialId = `s_${randomHex(12)}`
      this.run(
        `INSERT INTO accounts (social_id, handle, handle_key, role, created_at, seen_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        socialId,
        handle,
        key,
        role,
        now,
        now,
      )
    }

    // The team are friends with each other from the moment each one joins.
    if (isTeamHandle(key)) {
      const placeholders = TEAM_HANDLES.map(() => '?').join(',')
      const others = this.rows(
        `SELECT social_id FROM accounts WHERE handle_key IN (${placeholders}) AND social_id != ?`,
        ...TEAM_HANDLES,
        socialId,
      )
      for (const other of others) {
        const [a, b] = pairOf(socialId, String(other.social_id))
        this.run(
          `INSERT OR REPLACE INTO relations (a, b, state, requester, created_at)
           VALUES (?, ?, 'friend', ?, ?)`,
          a,
          b,
          socialId,
          now,
        )
      }
    }

    const token = randomHex(32)
    this.run(
      `INSERT INTO tokens (token_hash, social_id, created_at) VALUES (?, ?, ?)`,
      await sha256(token),
      socialId,
      now,
    )
    return json({ socialId, token })
  }

  private people(me: Account, query: string): Response {
    const q = query.trim().slice(0, 20)
    const found =
      q.length > 0
        ? this.rows(
            `SELECT social_id, handle, role FROM accounts
             WHERE handle_key LIKE ? ESCAPE '\\' AND social_id != ?
             ORDER BY handle_key LIMIT ?`,
            likePattern(q.toLowerCase()),
            me.socialId,
            MAX_PEOPLE,
          )
        : this.rows(
            `SELECT social_id, handle, role FROM accounts WHERE social_id != ?
             ORDER BY seen_at DESC LIMIT ?`,
            me.socialId,
            MAX_PEOPLE,
          )
    // Never a mood here, friend or not.
    const people = found.map((row) => ({
      ...this.person(row, false),
      relation: this.relationOf(me.socialId, String(row.social_id)),
    }))
    return json({ people })
  }

  private relation(me: Account, body: Record<string, unknown>, now: number): Response {
    const action = cleanAction(body.action)
    const other = typeof body.socialId === 'string' ? body.socialId : ''
    if (!action || !other || other === me.socialId) return json({ error: 'invalid' }, 400)
    if (!this.rows(`SELECT social_id FROM accounts WHERE social_id = ?`, other)[0]) {
      return json({ error: 'invalid' }, 404)
    }
    this.prune(now)
    const [a, b] = pairOf(me.socialId, other)
    const current = this.relationOf(me.socialId, other)

    if (action === 'request') {
      if (current === 'none') {
        this.run(
          `INSERT INTO relations (a, b, state, requester, created_at) VALUES (?, ?, 'pending', ?, ?)`,
          a,
          b,
          me.socialId,
          now,
        )
      } else if (current === 'incoming') {
        // Both asked: they are friends.
        this.run(`UPDATE relations SET state = 'friend' WHERE a = ? AND b = ?`, a, b)
      }
    } else if (action === 'accept') {
      if (current !== 'incoming') return json({ error: 'invalid' }, 409)
      this.run(`UPDATE relations SET state = 'friend' WHERE a = ? AND b = ?`, a, b)
    } else if (action === 'cancel') {
      if (current === 'outgoing') this.run(`DELETE FROM relations WHERE a = ? AND b = ?`, a, b)
    } else if (action === 'decline') {
      if (current === 'incoming') this.run(`DELETE FROM relations WHERE a = ? AND b = ?`, a, b)
    } else {
      // remove: the friendship ends for both and the conversation is deleted.
      this.run(`DELETE FROM relations WHERE a = ? AND b = ?`, a, b)
      this.run(
        `DELETE FROM messages WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)`,
        me.socialId,
        other,
        other,
        me.socialId,
      )
    }
    return json({ ok: true })
  }

  private mood(me: Account, body: Record<string, unknown>, now: number): Response {
    this.prune(now)
    if (body.clear === true) {
      this.run(
        `UPDATE accounts SET mood_score = NULL, mood_tags = NULL, mood_at = NULL WHERE social_id = ?`,
        me.socialId,
      )
      return json({ ok: true })
    }
    const mood = cleanMood(body)
    if (!mood) return json({ error: 'invalid' }, 400)
    this.run(
      `UPDATE accounts SET mood_score = ?, mood_tags = ?, mood_at = ? WHERE social_id = ?`,
      mood.score,
      JSON.stringify(mood.tags),
      mood.at,
      me.socialId,
    )
    return json({ ok: true })
  }

  private message(me: Account, body: Record<string, unknown>, now: number): Response {
    const text = cleanMessage(body.text)
    const toId = typeof body.toId === 'string' ? body.toId : ''
    if (!text || !toId) return json({ error: 'invalid' }, 400)
    // Friends only.
    if (this.relationOf(me.socialId, toId) !== 'friend') return json({ error: 'forbidden' }, 403)
    this.prune(now)
    const id = `m_${randomHex(12)}`
    this.run(
      `INSERT INTO messages (id, from_id, to_id, text, at, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      id,
      me.socialId,
      toId,
      text,
      new Date(now).toISOString(),
      now,
    )
    return json({ id })
  }

  /** One score per person per challenge, or `leave` to remove it at once. Nothing else is kept. */
  private challenge(me: Account, body: Record<string, unknown>, now: number): Response {
    const write = cleanChallengeWrite(body)
    if (!write) return json({ error: 'invalid' }, 400)
    this.prune(now)
    if (write.leave) {
      this.run(
        `DELETE FROM challenge_scores WHERE social_id = ? AND challenge = ?`,
        me.socialId,
        write.id,
      )
    } else {
      this.run(
        `INSERT OR REPLACE INTO challenge_scores (social_id, challenge, score, updated_at)
         VALUES (?, ?, ?, ?)`,
        me.socialId,
        write.id,
        write.score,
        now,
      )
    }
    return json({ ok: true })
  }

  /**
   * For each challenge the caller takes part in: the caller's score and those of friends who take
   * part too, highest first. Empty for a challenge the caller has not joined. A person who is not
   * a friend is never returned, so ending a friendship hides both scores the same moment.
   */
  private challenges(me: Account, now: number): Response {
    const fresh = now - CHALLENGE_IDLE_MS
    const boards: Record<string, Array<{ socialId: string; handle: string; score: number }>> = {}
    for (const id of CHALLENGE_IDS) {
      const joined = this.rows(
        `SELECT 1 FROM challenge_scores WHERE social_id = ? AND challenge = ? AND updated_at >= ?`,
        me.socialId,
        id,
        fresh,
      )[0]
      if (!joined) {
        boards[id] = []
        continue
      }
      const rows = this.rows(
        `SELECT c.social_id, acc.handle, c.score
         FROM challenge_scores c
         JOIN accounts acc ON acc.social_id = c.social_id
         WHERE c.challenge = ? AND c.updated_at >= ?
           AND (c.social_id = ? OR c.social_id IN (
             SELECT CASE WHEN r.a = ? THEN r.b ELSE r.a END FROM relations r
             WHERE (r.a = ? OR r.b = ?) AND r.state = 'friend'
           ))
         ORDER BY c.score DESC, acc.handle_key ASC`,
        id,
        fresh,
        me.socialId,
        me.socialId,
        me.socialId,
        me.socialId,
      )
      boards[id] = rows.map((row) => ({
        socialId: String(row.social_id),
        handle: String(row.handle),
        score: Number(row.score),
      }))
    }
    return json(boards)
  }

  private sync(me: Account, after: string | null, now: number): Response {
    const relations = this.rows(
      `SELECT r.state, r.requester, acc.social_id, acc.handle, acc.role,
              acc.mood_score, acc.mood_tags, acc.mood_at
       FROM relations r
       JOIN accounts acc ON acc.social_id = (CASE WHEN r.a = ? THEN r.b ELSE r.a END)
       WHERE r.a = ? OR r.b = ?
       ORDER BY acc.handle_key`,
      me.socialId,
      me.socialId,
      me.socialId,
    )
    const friends: unknown[] = []
    const incoming: unknown[] = []
    const outgoing: unknown[] = []
    for (const row of relations) {
      if (row.state === 'friend') friends.push(this.person(row, true))
      else if (row.requester === me.socialId) outgoing.push(this.person(row, false))
      else incoming.push(this.person(row, false))
    }

    const afterSeq = after ? Number.parseInt(after, 10) : Number.NaN
    const since = Number.isNaN(afterSeq) ? 0 : afterSeq
    const rows = this.rows(
      `SELECT seq, id, from_id, to_id, text, at FROM messages
       WHERE (to_id = ? OR from_id = ?) AND seq > ? AND created_at >= ?
       ORDER BY seq ASC LIMIT 500`,
      me.socialId,
      me.socialId,
      since,
      now - DAY_MS,
    )
    let cursor = String(since)
    const messages = rows.map((row) => {
      if (typeof row.seq === 'number') cursor = String(row.seq)
      return {
        id: String(row.id),
        fromId: String(row.from_id),
        toId: String(row.to_id),
        at: String(row.at),
        text: String(row.text),
        status: 'sent',
      }
    })
    return json({ friends, incoming, outgoing, messages, cursor })
  }
}

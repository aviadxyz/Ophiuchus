import { handleChat } from './chat.ts'
import { handleGetEvents, handlePostEvents } from './events.ts'
import { RoomDurableObject } from './roomDo.ts'
import type { Env } from './types.ts'

export { RoomDurableObject }

// In-memory rate limiting per client IP
const RATE_LIMIT_WINDOW_MS = 60_000
const MAX_REQUESTS_PER_WINDOW = 180
const MAX_BODY_BYTES = 100_000 // 100 KB limit

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function isRateLimited(clientIp: string, now: number): boolean {
  // Prune expired entries if map grows large
  if (rateLimitMap.size > 2000) {
    for (const [key, record] of rateLimitMap.entries()) {
      if (now > record.resetAt) rateLimitMap.delete(key)
    }
  }

  const record = rateLimitMap.get(clientIp)
  if (!record || now > record.resetAt) {
    rateLimitMap.set(clientIp, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return false
  }

  record.count++
  return record.count > MAX_REQUESTS_PER_WINDOW
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // Serve static assets for non-API routes
    if (!url.pathname.startsWith('/api/')) {
      return env.ASSETS.fetch(request)
    }

    const start = performance.now()
    let response: Response

    try {
      // 1. Request body size check
      const contentLength = Number.parseInt(request.headers.get('content-length') || '0', 10)
      if (contentLength > MAX_BODY_BYTES) {
        response = new Response(JSON.stringify({ error: 'Request body exceeds 100 KB limit' }), {
          status: 413,
          headers: { 'Content-Type': 'application/json' },
        })
      } else {
        // 2. Client IP rate limiting
        const clientIp =
          request.headers.get('cf-connecting-ip') ||
          request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
          'unknown'

        const now = Date.now()
        if (isRateLimited(clientIp, now)) {
          response = new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
            status: 429,
            headers: { 'Content-Type': 'application/json' },
          })
        } else {
          // 3. API Route Dispatching
          if (url.pathname === '/api/chat' && request.method === 'POST') {
            response = await handleChat(request, env)
          } else if (url.pathname === '/api/events' && request.method === 'POST') {
            response = await handlePostEvents(request, env)
          } else if (url.pathname === '/api/events' && request.method === 'GET') {
            response = await handleGetEvents(request, env)
          } else {
            response = new Response(JSON.stringify({ error: 'Not found' }), {
              status: 404,
              headers: { 'Content-Type': 'application/json' },
            })
          }
        }
      }
    } catch {
      response = new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // 4. Privacy logging: ONLY method, endpoint path, status code, duration
    // Never logs message, context, reply, payload, or room code
    const durationMs = Math.round(performance.now() - start)
    console.log(`${request.method} ${url.pathname} ${response.status} ${durationMs}ms`)

    return response
  },
}

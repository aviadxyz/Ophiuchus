import { MEDBOT_SYSTEM_PROMPT } from './systemPrompt.ts'
import type { ChatResponseBody, Env } from './types.ts'
import { validateChatRequest } from './validation.ts'

export const DEFAULT_TEXT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast'
export const TIMEOUT_MS = 8000

/**
 * Checks if the reply directs user to Emergency screen or button.
 */
export function isUrgent(reply: string, userMessage: string): boolean {
  const lowerReply = reply.toLowerCase()
  const lowerMsg = userMessage.toLowerCase()

  const directsToEmergency =
    lowerReply.includes('emergency screen') ||
    lowerReply.includes('emergency button') ||
    lowerReply.includes('emergency procedure') ||
    lowerReply.includes('open emergency') ||
    lowerReply.includes('hold emergency') ||
    lowerReply.includes('hold the emergency')

  const acuteSigns =
    (lowerMsg.includes('chest pain') && (lowerMsg.includes('arm') || lowerMsg.includes('breath'))) ||
    lowerMsg.includes('trouble breathing') ||
    lowerMsg.includes('heavy bleeding') ||
    lowerMsg.includes('stroke') ||
    lowerMsg.includes('harming themselves') ||
    lowerMsg.includes('harm myself') ||
    lowerMsg.includes("don't see the point of this anymore") ||
    lowerMsg.includes('severe allergic')

  return directsToEmergency || (acuteSigns && lowerReply.includes('emergency'))
}

/**
 * Checks if reply ends with the exact forwarding sentence from the system prompt:
 * "This is one for the flight surgeon."
 * Never true when urgent is true.
 */
export function isForward(reply: string, urgent: boolean): boolean {
  if (urgent) return false
  const trimmed = reply.trim().replace(/['"”’]+$/, '')
  return /this is one for the flight surgeon\.?$/i.test(trimmed)
}

/**
 * Enforces watch mode brevity: at most 2 short sentences, capped around 30-35 words.
 */
export function capWatchReply(reply: string): string {
  const sentences = reply
    .trim()
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean)

  let result = sentences.slice(0, 2).join(' ')
  const words = result.split(/\s+/)
  if (words.length > 35) {
    result = words.slice(0, 32).join(' ') + '...'
  }
  return result
}

/**
 * Returns a friendly scripted fallback reply when model is unreachable or timed out.
 * Derived from Section 4 of prompts/companion/medbot-system-prompt.md.
 */
export function getScriptedFallback(userMessage: string): string {
  const lower = userMessage.toLowerCase()
  if (
    lower.includes("don't feel well") ||
    lower.includes('feel sick') ||
    lower.includes('chest pain') ||
    lower.includes('hurt') ||
    lower.includes('emergency')
  ) {
    return "Sorry to hear that. If it's serious, hold the Emergency button now. If not, sit down, have some water, and tell a crewmate. I'm offline for a moment, so I can't say more yet."
  }
  return "I can't reach my full brain right now, so I can only answer the basics. Try one of the quick questions, and use Emergency if it's urgent."
}

function extractReply(rawResult: unknown): string {
  if (typeof rawResult === 'string') return rawResult
  if (rawResult && typeof rawResult === 'object') {
    const obj = rawResult as Record<string, unknown>
    if (typeof obj.response === 'string') return obj.response
    if (typeof obj.reply === 'string') return obj.reply
    if (obj.result && typeof obj.result === 'object') {
      const res = obj.result as Record<string, unknown>
      if (typeof res.response === 'string') return res.response
      if (typeof res.reply === 'string') return res.reply
    }
  }
  return ''
}

export async function handleChat(request: Request, env: Env): Promise<Response> {
  let bodyJson: unknown
  try {
    bodyJson = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const validation = validateChatRequest(bodyJson)
  if (!validation.valid) {
    return new Response(JSON.stringify({ error: validation.error }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { message, context, replyMode } = validation.request
  const model = env.CHAT_MODEL || DEFAULT_TEXT_MODEL

  let replyText: string

  if (env.AI && typeof env.AI.run === 'function') {
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Model timeout after 8s')), TIMEOUT_MS),
      )

      const userTurn = `${context}\n\n${message}`
      const modelPromise = env.AI.run(model, {
        messages: [
          { role: 'system', content: MEDBOT_SYSTEM_PROMPT },
          { role: 'user', content: userTurn },
        ],
        max_tokens: replyMode === 'watch' ? 120 : 512,
      })

      const rawResult = await Promise.race([modelPromise, timeoutPromise])
      replyText = extractReply(rawResult).trim()
    } catch {
      // Model error or 8-second timeout: fall back gracefully
      replyText = getScriptedFallback(message)
    }
  } else {
    // No Workers AI binding configured (e.g. mock / offline test)
    replyText = getScriptedFallback(message)
  }

  if (!replyText) {
    replyText = getScriptedFallback(message)
  }

  if (replyMode === 'watch') {
    replyText = capWatchReply(replyText)
  }

  const urgent = isUrgent(replyText, message)
  const forward = isForward(replyText, urgent)

  const responseBody: ChatResponseBody = {
    reply: replyText,
    urgent,
    forward,
  }

  return new Response(JSON.stringify(responseBody), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })
}

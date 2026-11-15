import fs from 'node:fs'
import path from 'node:path'
import rawPrompt from './medbot-system-prompt.txt'

function resolvePromptText(): string {
  let text = typeof rawPrompt === 'string' ? rawPrompt : ''
  // In Node / Vitest environments, bundlers may treat .txt imports as asset URLs
  if (text.startsWith('/') || text.startsWith('.') || text.endsWith('.txt')) {
    try {
      const candidates = [
        path.resolve(process.cwd(), text.replace(/^\//, '')),
        path.resolve(process.cwd(), 'worker', 'medbot-system-prompt.txt'),
        path.resolve(process.cwd(), 'app', 'worker', 'medbot-system-prompt.txt'),
      ]
      for (const p of candidates) {
        if (fs.existsSync(p)) {
          text = fs.readFileSync(p, 'utf-8')
          break
        }
      }
    } catch {
      // Fallback to text as-is
    }
  }
  return text.trim()
}

export const MEDBOT_SYSTEM_PROMPT: string = resolvePromptText()

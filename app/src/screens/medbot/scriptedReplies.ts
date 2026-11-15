import type { DaySummary, HealthSummary, TargetMap } from '@/data'
import { getScreen } from '@/registry'

export type ScriptedContext = {
  summary: HealthSummary
  today: DaySummary
  targets: TargetMap
  remainingExerciseMinutes?: number
  now?: Date
}

/**
 * Returns the fixed opening line when the user arrives at Med bot.
 * Companion prompt Section 3.
 */
export function getOpeningLine(fromId?: string | null): string {
  if (!fromId) {
    return "Hi, I'm the Med bot. Ask me about your health data, or just tell me how you're doing."
  }

  const screen = getScreen(fromId)
  if (!screen) {
    return "Hi, I'm the Med bot. Ask me about your health data, or just tell me how you're doing."
  }

  switch (screen.id) {
    case 'nutrition':
      return "You came from Nutrition. Want me to go through what you've eaten today, or look at one nutrient?"
    case 'physical-activity':
      return "You came from Physical activity. I can explain today's sessions or what this week is missing."
    case 'mood':
      return "Hi. No rush. Tell me how today has been, in whatever words you like."
    case 'sleep':
      return "You came from Sleep. Shall we look at the last few nights together?"
    case 'risks':
      return "You came from Risks. Pick a body system and I'll explain what spaceflight does to it."
    case 'medical-status':
      return "You came from Medical status. What would you like to understand better?"
    case 'emergency':
      return "I'm here. Tell me what's happening in a few words."
    case 'social':
      return "You came from Social. Worried about a crewmate, or about yourself?"
    default:
      return `You came from ${screen.label}. What would you like to know about it?`
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/**
 * Scripted fallback replies when the chat endpoint is unreachable or offline.
 * Companion prompt Section 4.
 */
export function getScriptedReply(question: string, ctx: ScriptedContext): string {
  const q = question.toLowerCase().trim()

  // Match: "How am I doing today?"
  if (q.includes('how am i doing') || q.includes('how are we doing') || q.includes('how am i')) {
    const areaKeys = ['sleep', 'food', 'water', 'exercise', 'mood'] as const
    const off = areaKeys.filter((k) => ctx.summary[k].level === 'watch' || ctx.summary[k].level === 'act')

    if (off.length === 0) {
      return "You're in good shape today. Sleep, food and exercise are all on track. Keep it up."
    }

    if (off.length === 1) {
      const area = off[0]
      const fact = ctx.summary[area].text
      return `Mostly good. The one to watch is ${area}: ${fact}. A small fix today is enough.`
    }

    // Two or more off
    const areaOne = off[0]
    const areaTwo = off[1]
    // An "easier" area is typically water or food
    const easier = off.includes('water') ? 'water' : off.includes('food') ? 'food' : areaOne
    return `A tougher day. ${areaOne} and ${areaTwo} are both off. Start with ${easier}, and we'll look at the other after.`
  }

  // Match: "What should I do next?"
  if (q.includes('what should i do next') || q.includes('what to do next') || q.includes('what next')) {
    const remainingEx = ctx.remainingExerciseMinutes ?? 0
    if (remainingEx > 0) {
      return `You still have ${remainingEx} minutes of exercise planned today. That's the best next thing.`
    }

    const waterLevel = ctx.summary.water.level
    if (waterLevel === 'watch' || waterLevel === 'act') {
      const currentL = ctx.today.waterMl.value !== null ? round1(ctx.today.waterMl.value / 1000) : 0
      const targetL = round1(ctx.targets.waterMl.value / 1000)
      return `Have a drink. You're at ${currentL} of ${targetL} litres.`
    }

    const currentHour = (ctx.now ?? new Date()).getHours()
    const foodLevel = ctx.summary.food.level
    if (currentHour >= 12 && (foodLevel === 'watch' || foodLevel === 'act')) {
      const currentKcal = ctx.today.energyKcal.value !== null ? Math.round(ctx.today.energyKcal.value) : 0
      const targetKcal = Math.round(ctx.targets.energyKcal.value)
      const gap = Math.max(0, targetKcal - currentKcal)
      return `You're about ${gap} kcal under for today. A proper meal now would close most of it.`
    }

    if (ctx.today.moodScore.value === null) {
      return 'Take ten seconds for a mood check-in. It helps us spot patterns.'
    }

    return 'Nothing urgent. A good moment to rest or message home.'
  }

  // Match: "I don't feel well."
  if (
    q.includes("don't feel well") ||
    q.includes('not feeling well') ||
    q.includes('feel sick') ||
    q.includes('unwell')
  ) {
    return "Sorry to hear that. If it's serious, hold the Emergency button now. If not, sit down, have some water, and tell a crewmate. I'm offline for a moment, so I can't say more yet."
  }

  // Any other message while offline
  return "I can't reach my full brain right now, so I can only answer the basics. Try one of the quick questions, and use Emergency if it's urgent."
}

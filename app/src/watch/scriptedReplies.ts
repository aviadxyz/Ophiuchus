import type { DaySummary, HealthSummary, TargetMap } from '@/data'

export type WatchScriptedContext = {
  summary: HealthSummary
  today: DaySummary
  targets: TargetMap
  remainingExerciseMinutes?: number
  now?: Date
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/**
 * Scripted fallback replies for watch when chat endpoint is unreachable, timed out, or unconfigured.
 * Companion prompt Section 4.
 */
export function getWatchScriptedReply(question: string, ctx: WatchScriptedContext): string {
  const q = question.toLowerCase().trim()

  // Match: "How am I doing today?"
  if (q.includes('how am i doing') || q.includes('how are we doing') || q.includes('how am i')) {
    const areaKeys = ['sleep', 'food', 'water', 'exercise', 'mood'] as const
    const off = areaKeys.filter(
      (k) => ctx.summary[k].level === 'watch' || ctx.summary[k].level === 'act',
    )

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
    const easier = off.includes('water') ? 'water' : off.includes('food') ? 'food' : areaOne
    return `A tougher day. ${areaOne} and ${areaTwo} are both off. Start with ${easier}, and we'll look at the other after.`
  }

  // Match: "What should I do next?"
  if (
    q.includes('what should i do next') ||
    q.includes('what to do next') ||
    q.includes('what next')
  ) {
    const remainingEx = ctx.remainingExerciseMinutes ?? 0
    if (remainingEx > 0) {
      return `You still have ${remainingEx} minutes of exercise planned today. That's the best next thing.`
    }

    const waterLevel = ctx.summary.water.level
    if (waterLevel === 'watch' || waterLevel === 'act') {
      const currentL =
        ctx.today.waterMl.value !== null ? round1(ctx.today.waterMl.value / 1000) : 0
      const targetL = round1(ctx.targets.waterMl.value / 1000)
      return `Have a drink. You're at ${currentL} of ${targetL} litres.`
    }

    const currentHour = (ctx.now ?? new Date()).getHours()
    const foodLevel = ctx.summary.food.level
    if (currentHour >= 12 && (foodLevel === 'watch' || foodLevel === 'act')) {
      const currentKcal =
        ctx.today.energyKcal.value !== null ? Math.round(ctx.today.energyKcal.value) : 0
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

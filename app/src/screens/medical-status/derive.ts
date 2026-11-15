// Counts and visibility worked out from the sample record. Pure functions.

import type { Level, HeaderPill } from '@/design'
import { actions, markers, symptomsReported, type ActionItem, type Marker } from './sample'

export function countLevels(list: readonly Marker[]): Record<Level, number> {
  const counts: Record<Level, number> = { ok: 0, watch: 0, act: 0, none: 0 }
  for (const marker of list) counts[marker.level] += 1
  return counts
}

/** Header pills: one for each level that has markers, worst first. Counts come from the list. */
export function headerPills(list: readonly Marker[] = markers): HeaderPill[] {
  const counts = countLevels(list)
  const pills: HeaderPill[] = []
  if (counts.act > 0) pills.push({ tone: 'danger', label: `${counts.act} ACT` })
  if (counts.watch > 0) pills.push({ tone: 'warn', label: `${counts.watch} WATCH` })
  if (counts.ok > 0) pills.push({ tone: 'ok', label: `${counts.ok} ON TARGET` })
  return pills
}

/**
 * The action items to show. Items 1 to 3 are routine. The item about a marker above its limit
 * shows when any marker is at ACT. The item about new symptoms shows when symptoms are reported.
 */
export function visibleActions(
  list: readonly Marker[] = markers,
  symptoms: boolean = symptomsReported,
  items: readonly ActionItem[] = actions,
): ActionItem[] {
  const anyAct = list.some((m) => m.level === 'act')
  return items.filter(
    (item) =>
      item.when === 'always' ||
      (item.when === 'anyAct' && anyAct) ||
      (item.when === 'symptoms' && symptoms),
  )
}

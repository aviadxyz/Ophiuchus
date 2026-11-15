// Counts worked out from the sample record. Pure functions.

import type { HeaderPill } from '@/design'
import { domainOrder, domains } from './sample'

/** Header pills: how many tests, across both domains, sit at each level. Worst first. */
export function headerPills(): HeaderPill[] {
  const all = domainOrder.flatMap((id) => domains[id].markers)
  const act = all.filter((m) => m.level === 'act').length
  const watch = all.filter((m) => m.level === 'watch').length
  const ok = all.filter((m) => m.level === 'ok').length
  const pills: HeaderPill[] = []
  if (act > 0) pills.push({ tone: 'danger', label: `${act} ACT` })
  if (watch > 0) pills.push({ tone: 'warn', label: `${watch} WATCH` })
  if (ok > 0) pills.push({ tone: 'ok', label: `${ok} ON TARGET` })
  return pills
}

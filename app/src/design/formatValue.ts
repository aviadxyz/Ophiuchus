/** Formats a measured value for display. Missing values stay missing. */
export function formatValue(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'string') return value
  if (!Number.isFinite(value)) return '—'
  return value.toLocaleString('en-US', { maximumFractionDigits: 1 })
}

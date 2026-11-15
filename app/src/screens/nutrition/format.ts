// Number and date formatting for this screen.

/** 1,234.5 style, at most one decimal. */
export function formatNumber(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: 1 })
}

/** Litres to one decimal, from millilitres: 1500 becomes "1.5". */
export function litres(ml: number): string {
  return (ml / 1000).toFixed(1)
}

/** "15 Nov" for a YYYY-MM-DD date. */
export function shortDate(date: string): string {
  const [y = 1970, m = 1, d = 1] = date.split('-').map(Number)
  return new Date(y, m - 1, d, 12).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

/** "08:30" for an ISO time, in the device's time. */
export function clockTime(at: string): string {
  const date = new Date(at)
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { tokenColor, toneColor } from '../tokenColor'
import type { TrendChartProps } from './TrendChart'

// The Recharts part of TrendChart, loaded on demand so the charting library stays out of the first load.
export default function TrendChartCanvas({
  kind,
  labels,
  series,
  targetValue,
  height = 220,
}: Omit<TrendChartProps, 'summary'>) {
  const data = useMemo(
    () =>
      labels.map((label, i) => {
        const row: Record<string, string | number | null> = { label }
        series.forEach((s, si) => {
          const v = s.values[i]
          row[`s${si}`] = typeof v === 'number' && Number.isFinite(v) ? v : null
        })
        return row
      }),
    [labels, series],
  )
  const muted = tokenColor('--color-text-muted')
  const border = tokenColor('--color-border')
  const axis = { stroke: border, tick: { fill: muted, fontSize: 11 }, tickLine: false }
  const tooltip = (
    <Tooltip
      cursor={{ fill: 'transparent', stroke: border }}
      contentStyle={{
        background: 'var(--color-surface-raised)',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        color: 'var(--color-text)',
        fontSize: 13,
      }}
      labelStyle={{ color: 'var(--color-text-secondary)' }}
    />
  )
  const target =
    targetValue !== undefined ? (
      <ReferenceLine
        y={targetValue}
        stroke={muted}
        strokeDasharray="4 4"
        ifOverflow="extendDomain"
      />
    ) : null

  return (
    <div aria-hidden="true" style={{ height }} className="w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        {kind === 'line' ? (
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid stroke={border} vertical={false} />
            <XAxis dataKey="label" {...axis} interval="preserveStartEnd" minTickGap={16} />
            <YAxis {...axis} width={48} />
            {tooltip}
            {target}
            {series.map((s, i) => (
              <Line
                key={s.name}
                name={s.name}
                dataKey={`s${i}`}
                type="monotone"
                stroke={toneColor(s.tone)}
                strokeWidth={2}
                dot={{ r: 2.5, fill: toneColor(s.tone), strokeWidth: 0 }}
                activeDot={{ r: 4 }}
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        ) : (
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid stroke={border} vertical={false} />
            <XAxis dataKey="label" {...axis} interval="preserveStartEnd" minTickGap={16} />
            <YAxis {...axis} width={48} />
            {tooltip}
            {target}
            {series.map((s, i) => (
              <Bar
                key={s.name}
                name={s.name}
                dataKey={`s${i}`}
                fill={toneColor(s.tone)}
                radius={[3, 3, 0, 0]}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  )
}

import { StatTile } from '@/design'
import { markers, tiles } from './sample'

/**
 * Three markers and the next-sample reminder. Every value shows the SIMULATED badge. Each tile
 * can be pressed: a marker's tile opens that marker's detail, the last one opens the schedule.
 */
export function Tiles({
  onOpenMarker,
  onOpenSchedule,
}: {
  onOpenMarker: (id: string) => void
  onOpenSchedule: () => void
}) {
  return (
    <section aria-label="Key markers" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {tiles.map((tile) => {
        const marker = markers.find((m) => m.id === tile.markerId)
        return (
          <StatTile
            key={tile.label}
            label={tile.label}
            value={tile.value}
            unit={tile.unit}
            targetText={tile.targetLine}
            source="simulated"
            onOpen={marker ? () => onOpenMarker(marker.id) : onOpenSchedule}
            {...(marker ? { level: marker.level } : {})}
            {...(marker?.trend ? { trend: marker.trend } : {})}
          />
        )
      })}
    </section>
  )
}

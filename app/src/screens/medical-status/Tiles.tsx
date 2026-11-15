import { StatTile } from '@/design'
import { markers, tiles } from './sample'

/** Three markers and the next-sample reminder. Every value shows the SIMULATED badge. */
export function Tiles() {
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
            {...(marker ? { level: marker.level } : {})}
            {...(marker?.trend ? { trend: marker.trend } : {})}
          />
        )
      })}
    </section>
  )
}

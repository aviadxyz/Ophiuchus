import { useState } from 'react'
import { connectHeartRateSensor, useLatestVitals } from '@/data'
import { EmptyState, StatTile } from '@/design'

export function HeartRateTile() {
  const { latest, connection } = useLatestVitals()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleConnect = async () => {
    setErrorMessage(null)
    const result = await connectHeartRateSensor()
    if (!result.ok) {
      setErrorMessage(result.message)
    }
  }

  if (connection === 'off') {
    return (
      <EmptyState
        message={errorMessage ?? 'No heart-rate sensor connected'}
        actionLabel="Connect sensor"
        onAction={handleConnect}
      />
    )
  }

  return (
    <StatTile
      label="Heart rate"
      value={latest?.heartRate ?? null}
      unit="bpm"
      source={connection === 'live' ? 'live' : 'simulated'}
    />
  )
}

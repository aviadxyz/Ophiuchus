import { useState } from 'react'
import { Button, Card, ChipGroup, NumberField } from '@/design'
import { addSleep } from '@/data'

const QUALITY = [
  { value: '1', label: '1 Very poor' },
  { value: '2', label: '2 Poor' },
  { value: '3', label: '3 Okay' },
  { value: '4', label: '4 Good' },
  { value: '5', label: '5 Very good' },
]

/** Records last night for the morning it ended. A second entry for the same morning replaces the first. */
export function LogCard({ today, hasRecord }: { today: string; hasRecord: boolean }) {
  const [hours, setHours] = useState<number | null>(null)
  const [quality, setQuality] = useState<string[]>([])
  const [saved, setSaved] = useState(false)
  const valid = hours !== null && hours >= 0 && hours <= 16
  const save = () => {
    if (hours === null || !valid) return
    addSleep(today, hours, quality[0] ? Number(quality[0]) : undefined)
    setSaved(true)
    setHours(null)
    setQuality([])
  }
  return (
    <Card title={hasRecord ? 'Correct last night' : 'Log last night'}>
      <div className="flex max-w-description flex-col gap-4">
        <NumberField
          label="Hours slept"
          value={hours}
          onChange={(value) => {
            setHours(value)
            setSaved(false)
          }}
          min={0}
          max={16}
          step={0.5}
          unit="h"
          hint="The night that ended this morning."
          {...(hours !== null && !valid ? { error: 'Enter a number from 0 to 16.' } : {})}
        />
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-text-secondary">
            How well did you sleep? (optional)
          </span>
          <ChipGroup
            label="How well did you sleep"
            options={QUALITY}
            selected={quality}
            onChange={setQuality}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={save} disabled={!valid}>
            Save
          </Button>
          <span role="status" className="text-sm text-text-secondary">
            {saved ? 'Saved. Last night is updated above.' : ''}
          </span>
        </div>
      </div>
    </Card>
  )
}

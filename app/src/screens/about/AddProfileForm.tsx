import { useState } from 'react'
import { Button, ChipGroup, NumberField, Switch, TextField } from '@/design'
import { createProfile, setActiveProfile, type Sex } from '@/data'

type AddProfileFormProps = {
  onDone: () => void
}

const sexOptions = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
]

/** "Add my profile". A person sets up only their own data, and chooses both sharing switches. */
export function AddProfileForm({ onDone }: AddProfileFormProps) {
  const thisYear = new Date().getFullYear()
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [sex, setSex] = useState<string[]>([])
  const [birthYear, setBirthYear] = useState<number | null>(null)
  const [heightCm, setHeightCm] = useState<number | null>(null)
  const [massKg, setMassKg] = useState<number | null>(null)
  const [sleepHours, setSleepHours] = useState<number | null>(null)
  const [relay, setRelay] = useState(false)
  const [assistant, setAssistant] = useState(false)
  const [ownData, setOwnData] = useState(false)
  const [tried, setTried] = useState(false)

  const outside = (value: number | null, min: number, max: number) =>
    value !== null && (value < min || value > max)

  const errors = {
    name: name.trim() === '' ? 'Enter a display name.' : undefined,
    birthYear: outside(birthYear, 1900, thisYear)
      ? `Enter a year from 1900 to ${thisYear}.`
      : undefined,
    heightCm: outside(heightCm, 100, 250) ? 'Enter a height from 100 to 250 cm.' : undefined,
    massKg: outside(massKg, 20, 300) ? 'Enter a body mass from 20 to 300 kg.' : undefined,
    sleepHours: outside(sleepHours, 0, 24) ? 'Enter hours from 0 to 24.' : undefined,
    ownData: !ownData ? 'Tick this to create the profile.' : undefined,
  }
  const hasError = Object.values(errors).some(Boolean)

  const submit = () => {
    setTried(true)
    if (hasError) return
    const id = createProfile({
      displayName: name,
      ...(role.trim() ? { role } : {}),
      ...(sex[0] ? { sex: sex[0] as Sex } : {}),
      ...(birthYear !== null ? { birthYear } : {}),
      ...(heightCm !== null ? { heightCm } : {}),
      ...(massKg !== null ? { massKg } : {}),
      ...(sleepHours !== null ? { lastNightSleepHours: sleepHours } : {}),
      consent: { relay, assistant },
    })
    setActiveProfile(id)
    onDone()
  }

  return (
    <form
      className="mt-4 flex flex-col gap-4 border-t border-border pt-4"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
      noValidate
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Display name (required)"
          value={name}
          onChange={setName}
          maxLength={40}
          autoComplete="off"
          hint="Shown on this device only."
          {...(tried && errors.name ? { error: errors.name } : {})}
        />
        <TextField
          label="Role"
          value={role}
          onChange={setRole}
          maxLength={40}
          autoComplete="off"
          hint="Optional. For example Medical officer."
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-text">Sex (optional)</span>
        <ChipGroup label="Sex" options={sexOptions} selected={sex} onChange={setSex} />
        <button
          type="button"
          onClick={() => setSex([])}
          disabled={sex.length === 0}
          className="w-fit cursor-pointer text-xs text-text-muted underline disabled:cursor-not-allowed disabled:no-underline disabled:opacity-60"
        >
          Prefer not to say
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField
          label="Birth year"
          value={birthYear}
          onChange={setBirthYear}
          min={1900}
          max={thisYear}
          step={1}
          hint="Optional."
          {...(errors.birthYear ? { error: errors.birthYear } : {})}
        />
        <NumberField
          label="Height"
          value={heightCm}
          onChange={setHeightCm}
          min={100}
          max={250}
          unit="cm"
          hint="Optional."
          {...(errors.heightCm ? { error: errors.heightCm } : {})}
        />
        <NumberField
          label="Body mass"
          value={massKg}
          onChange={setMassKg}
          min={20}
          max={300}
          unit="kg"
          hint="Optional. Sets your energy and protein targets."
          {...(errors.massKg ? { error: errors.massKg } : {})}
        />
        <NumberField
          label="Last night's sleep"
          value={sleepHours}
          onChange={setSleepHours}
          min={0}
          max={24}
          step={0.1}
          unit="h"
          hint="Optional."
          {...(errors.sleepHours ? { error: errors.sleepHours } : {})}
        />
      </div>

      <div className="flex flex-col gap-4 rounded-md border border-border p-4">
        <Switch
          label="Share live readings with my paired watch and console."
          checked={relay}
          onChange={setRelay}
          hint="Readings pass through the relay, linked only by the room code, and are deleted after an hour."
        />
        <Switch
          label="Let the Med bot see my summary to personalize answers."
          checked={assistant}
          onChange={setAssistant}
          hint="When on, a short summary of today's status is sent to the language model's provider with each question. When off, the Med bot answers in general terms."
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="flex cursor-pointer items-start gap-3 text-base text-text">
          <input
            type="checkbox"
            checked={ownData}
            onChange={(event) => setOwnData(event.target.checked)}
            className="mt-1 size-5 shrink-0 cursor-pointer accent-accent"
          />
          <span>This is my own data. Nobody else set this profile up for me.</span>
        </label>
        {tried && errors.ownData && (
          <p role="alert" className="m-0 text-xs text-danger">
            <span aria-hidden="true" className="font-mono">
              !{' '}
            </span>
            {errors.ownData}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <Button type="submit">Create profile</Button>
        <Button variant="quiet" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

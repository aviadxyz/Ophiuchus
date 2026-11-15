import { useEffect, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button, DetailDrawer, NumberField, TextField } from '@/design'
import { addMeal, useFoods, useTargets, type FoodItem } from '@/data'
import { formatNumber } from './format'
import { notableNutrients } from './nutrients'

type AddFoodDrawerProps = { open: boolean; onClose: () => void }

const MIN_PORTIONS = 0.5
const MAX_PORTIONS = 5

function portionsError(value: number | null): string | undefined {
  if (value === null) return 'Enter the portions.'
  if (value < MIN_PORTIONS || value > MAX_PORTIONS) return 'Use 0.5 to 5.'
  if (!Number.isInteger(value * 2)) return 'Use steps of 0.5.'
  return undefined
}

function FoodRow({ food, onAdded }: { food: FoodItem; onAdded: (name: string) => void }) {
  const targets = useTargets()
  const [portions, setPortions] = useState<number | null>(1)
  const [added, setAdded] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const error = portionsError(portions)
  const notable = notableNutrients(food, targets)

  const add = () => {
    if (error || portions === null) return
    addMeal(food.id, portions)
    onAdded(food.name)
    setAdded(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setAdded(false), 1500)
  }

  return (
    <li
      role="group"
      aria-label={food.name}
      className="flex flex-col gap-3 rounded-md border border-border bg-bg p-3"
    >
      <div className="min-w-0">
        <p className="m-0 text-base font-semibold break-words text-text">{food.name}</p>
        <p className="m-0 text-sm text-text-secondary">
          {formatNumber(food.kcal)} kcal a portion
          {notable.map((n) => ` · ${n.label} ${formatNumber(n.amount)} ${n.unit}`).join('')}
        </p>
      </div>
      <div className="flex items-start gap-3">
        <div className="w-32">
          <NumberField
            label="Portions"
            value={portions}
            onChange={setPortions}
            min={MIN_PORTIONS}
            max={MAX_PORTIONS}
            step={0.5}
            {...(error ? { error } : {})}
          />
        </div>
        <div className="flex items-center gap-3 pt-[1.65rem]">
          <Button
            icon={Plus}
            disabled={error !== undefined}
            onClick={add}
            aria-label={`Add ${food.name}`}
          >
            Add
          </Button>
          {added && <span className="text-sm font-medium text-accent">Added</span>}
        </div>
      </div>
    </li>
  )
}

/** Search the menu and add food. Stays open so several items can be added quickly. */
export function AddFoodDrawer({ open, onClose }: AddFoodDrawerProps) {
  const foods = useFoods()
  const [query, setQuery] = useState('')
  const [announcement, setAnnouncement] = useState('')
  const needle = query.trim().toLowerCase()
  const shown = needle ? foods.filter((f) => f.name.toLowerCase().includes(needle)) : foods

  return (
    <DetailDrawer open={open} title="Add food" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <TextField
          label="Search foods"
          type="search"
          value={query}
          onChange={setQuery}
          autoComplete="off"
        />
        <p role="status" aria-live="polite" className="sr-only">
          {announcement}
        </p>
        {shown.length === 0 ? (
          <p className="m-0 text-base text-text-secondary">No foods match "{query.trim()}".</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {shown.map((food) => (
              <FoodRow
                key={food.id}
                food={food}
                onAdded={(name) => setAnnouncement(`Added ${name}`)}
              />
            ))}
          </ul>
        )}
      </div>
    </DetailDrawer>
  )
}

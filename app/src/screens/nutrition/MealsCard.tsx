import { Droplet, Plus, Undo2, X } from 'lucide-react'
import { Button, Card, SectionLabel, SourceBadge } from '@/design'
import { addWater, removeMeal, removeWater, useMeals, useToday, useWater } from '@/data'
import { clockTime, formatNumber, litres } from './format'
import { groupMeals } from './nutrients'

type MealsCardProps = { onAddFood: () => void }

/** What was eaten and drunk today, grouped by time of day, with the two add buttons. */
export function MealsCard({ onAddFood }: MealsCardProps) {
  const today = useToday()
  const meals = useMeals(today.date)
  const water = useWater(today.date)
  const groups = groupMeals(meals)
  const waterTotal = water.reduce((sum, w) => sum + w.ml, 0)
  const lastDrink = water.at(-1)

  return (
    <Card title="Today's meals">
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap gap-3">
          <Button icon={Plus} onClick={onAddFood}>
            Add food
          </Button>
          <Button variant="quiet" icon={Droplet} onClick={() => addWater(250)}>
            Add water 250 ml
          </Button>
        </div>

        {groups.length === 0 ? (
          <p className="m-0 text-base text-text-secondary">No food logged yet today.</p>
        ) : (
          groups.map((group) => (
            <section key={group.id} aria-label={group.label} className="flex flex-col gap-2">
              <SectionLabel as="h3">{group.label}</SectionLabel>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {group.meals.map((meal) => (
                  <li
                    key={meal.id}
                    className="flex items-center gap-3 rounded-md border border-border bg-bg py-2 pr-2 pl-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="m-0 text-base break-words text-text">{meal.food.name}</p>
                      <p className="m-0 flex flex-wrap items-center gap-x-2 text-xs text-text-muted">
                        <span>{clockTime(meal.at)}</span>
                        <span>
                          {formatNumber(meal.portions)}{' '}
                          {meal.portions === 1 ? 'portion' : 'portions'}
                        </span>
                        <span>{formatNumber(Math.round(meal.food.kcal * meal.portions))} kcal</span>
                        <SourceBadge source={meal.source} />
                      </p>
                    </div>
                    <Button
                      variant="quiet"
                      icon={X}
                      aria-label={`Remove ${meal.food.name}`}
                      onClick={() => removeMeal(meal.id)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border pt-4">
          <p className="m-0 flex flex-wrap items-center gap-x-2 text-base text-text">
            {water.length === 0 ? (
              'Water: none logged yet'
            ) : (
              <>
                Water: {litres(waterTotal)} L in {water.length}{' '}
                {water.length === 1 ? 'entry' : 'entries'}
                {today.waterMl.source && <SourceBadge source={today.waterMl.source} />}
              </>
            )}
          </p>
          {lastDrink && (
            <Button variant="quiet" icon={Undo2} onClick={() => removeWater(lastDrink.id)}>
              Remove last drink
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}

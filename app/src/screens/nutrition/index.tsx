import { useState } from 'react'
import { GameLinks, ScreenHeader, levelLabel, levelTone, type HeaderPill } from '@/design'
import { useToday } from '@/data'
import { AddFoodDrawer } from './AddFoodDrawer'
import { BodyMassCard } from './BodyMassCard'
import { MealsCard } from './MealsCard'
import { NutrientTable } from './NutrientTable'
import { SuggestionCard } from './SuggestionCard'
import { Tiles } from './Tiles'
import { countOffTarget, noNutrientData, nutrients } from './nutrients'
import { meta } from './meta'

export default function NutritionScreen() {
  const today = useToday()
  const [adding, setAdding] = useState(false)

  const offTarget = countOffTarget(today)
  const anyAct = nutrients.some((n) => today[n.id].level === 'act')
  const pills: HeaderPill[] = [
    {
      tone: levelTone[today.energyKcal.level],
      label: `ENERGY ${levelLabel[today.energyKcal.level]}`,
    },
    { tone: levelTone[today.waterMl.level], label: `WATER ${levelLabel[today.waterMl.level]}` },
    noNutrientData(today)
      ? { tone: 'neutral', label: 'NUTRIENTS NO DATA' }
      : {
          tone: anyAct ? 'danger' : offTarget > 0 ? 'warn' : 'ok',
          label: `${offTarget} OFF TARGET`,
        },
  ]

  return (
    <>
      <ScreenHeader
        eyebrow={meta.eyebrow}
        title={meta.label}
        description={meta.description}
        pills={pills}
      />
      <div className="flex flex-col gap-6">
        <Tiles />
        <NutrientTable />
        <MealsCard onAddFood={() => setAdding(true)} />
        <BodyMassCard />
        <SuggestionCard />
      </div>
      <GameLinks screenId={meta.id} />
      <AddFoodDrawer open={adding} onClose={() => setAdding(false)} />
    </>
  )
}

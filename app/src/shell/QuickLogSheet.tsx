import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { Check, Droplet, Dumbbell, HeartPulse, Smile, Utensils } from 'lucide-react'
import { Button, DetailDrawer } from '@/design'
import { addWater } from '@/data'
import { askMedbot } from '@/ophi'

type QuickLogSheetProps = { open: boolean; onClose: () => void }

const ADDED_MS = 2000

/** Phone only: the bottom bar's "Log" sheet. Large buttons for the things logged most. */
export function QuickLogSheet({ open, onClose }: QuickLogSheetProps) {
  const navigate = useNavigate()
  const [added, setAdded] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  const close = () => {
    clearTimeout(timer.current)
    setAdded(false)
    onClose()
  }

  const go = (to: string) => {
    close()
    navigate(to)
  }

  const water = () => {
    addWater(250)
    setAdded(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setAdded(false), ADDED_MS)
  }

  return (
    <DetailDrawer open={open} title="Quick log" onClose={close}>
      <div className="flex flex-col gap-3">
        <Button size="lg" icon={added ? Check : Droplet} onClick={water}>
          {added ? 'Added' : 'Water +250 ml'}
        </Button>
        <span role="status" className="sr-only">
          {added ? '250 ml of water added' : ''}
        </span>
        <Button size="lg" variant="quiet" icon={Utensils} onClick={() => go('/nutrition')}>
          Add food
        </Button>
        <Button size="lg" variant="quiet" icon={Smile} onClick={() => go('/mood')}>
          Mood check-in
        </Button>
        <Button size="lg" variant="quiet" icon={Dumbbell} onClick={() => go('/physical-activity')}>
          Exercise done
        </Button>
        <Button
          size="lg"
          variant="quiet"
          icon={HeartPulse}
          onClick={() => {
            close()
            askMedbot('overview')
          }}
        >
          I don&apos;t feel well
        </Button>
      </div>
    </DetailDrawer>
  )
}

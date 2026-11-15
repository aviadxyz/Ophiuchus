import { Circle } from 'lucide-react'
import icons from 'virtual:screen-icons'

type ScreenIconProps = { name: string; className?: string }

/** The lucide icon named in a screen's meta. Built at compile time from the meta files. */
export function ScreenIcon({ name, className }: ScreenIconProps) {
  const Icon = icons[name] ?? Circle
  return <Icon aria-hidden="true" className={className} />
}

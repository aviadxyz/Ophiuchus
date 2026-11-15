import { useNavigate } from 'react-router'
import { EmptyState, ScreenHeader } from '@/design'

/** Any address that is not a screen. Shown inside the shell. */
export function NotFound() {
  const navigate = useNavigate()
  return (
    <>
      <ScreenHeader
        eyebrow="CONSOLE · NOT FOUND"
        title="Page not found"
        description="There is no screen at this address."
      />
      <EmptyState
        message="Check the address, or go back to the Overview."
        actionLabel="Go to Overview"
        onAction={() => navigate('/overview')}
      />
    </>
  )
}

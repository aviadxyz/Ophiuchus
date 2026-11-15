import { useState, useSyncExternalStore } from 'react'
import {
  Button,
  Card,
  ChipGroup,
  ConfirmDialog,
  EmptyState,
  ScreenHeader,
  type HeaderPill,
} from '@/design'
import {
  leaveSocial,
  removeFriend,
  useActiveProfile,
  useFriendRequests,
  useFriends,
  useSocialAccount,
} from '@/data'
import { CrewChallenges } from './Challenges'
import { ChatDrawer } from './ChatDrawer'
import { FindCrew } from './FindCrew'
import { JoinCard } from './JoinCard'
import { MyMoodCard } from './MyMoodCard'
import { FriendsView, RequestsView, YourCrew } from './YourCrew'
import { meta } from './meta'

const WIDE_QUERY = '(min-width: 1024px)'

function subscribeWide(onChange: () => void) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => undefined
  const list = window.matchMedia(WIDE_QUERY)
  list.addEventListener('change', onChange)
  return () => list.removeEventListener('change', onChange)
}

function useIsWide(): boolean {
  return useSyncExternalStore(
    subscribeWide,
    () =>
      typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(WIDE_QUERY).matches,
    () => true,
  )
}

type NarrowView = 'find' | 'friends' | 'requests'

const PRIVACY_LINE =
  'Friends see your handle, your role and, if you allow it, your mood. Never your notes, readings or health data.'

export default function SocialScreen() {
  const profile = useActiveProfile()
  const { account, connection } = useSocialAccount()
  const friends = useFriends()
  const { incoming, outgoing } = useFriendRequests()
  const wide = useIsWide()

  const [narrowView, setNarrowView] = useState<NarrowView>('friends')
  const [chatWith, setChatWith] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)
  const [confirmLeave, setConfirmLeave] = useState(false)

  const off = connection === 'off'

  const pills: HeaderPill[] = account
    ? [
        { tone: 'info', label: `${friends.length} ${friends.length === 1 ? 'FRIEND' : 'FRIENDS'}` },
        ...(incoming.length > 0
          ? [
              {
                tone: 'warn' as const,
                label: `${incoming.length} ${incoming.length === 1 ? 'REQUEST' : 'REQUESTS'}`,
              },
            ]
          : []),
        account.shareMood
          ? { tone: 'ok' as const, label: 'MOOD SHARED' }
          : { tone: 'neutral' as const, label: 'MOOD PRIVATE' },
      ]
    : []

  const header = (
    <ScreenHeader
      eyebrow={meta.eyebrow}
      title={meta.label}
      description={meta.description}
      pills={pills}
    />
  )

  // A member profile that never joined, with no network: nothing to press.
  if (!account && off && profile.kind === 'member') {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <EmptyState message="The crew network is not connected in this demonstration." />
        <p className="m-0 text-sm text-text-muted">{PRIVACY_LINE}</p>
        <CrewChallenges hasAccount={false} connection={connection} />
      </div>
    )
  }

  if (!account) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <JoinCard />
        <CrewChallenges hasAccount={false} connection={connection} />
      </div>
    )
  }

  const crewProps = {
    disabled: off,
    onChat: (socialId: string) => setChatWith(socialId),
    onFind: () => setNarrowView('find'),
  }

  return (
    <div className="flex flex-col gap-6">
      {header}

      {off && (
        <EmptyState message="The crew network cannot be reached. Your friends will reappear when it is back." />
      )}

      <MyMoodCard disabled={off} />

      {wide ? (
        <div className="grid grid-cols-2 items-start gap-6">
          <FindCrew disabled={off} />
          <YourCrew {...crewProps} />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <ChipGroup
            label="Show"
            options={[
              { value: 'find', label: 'Find' },
              { value: 'friends', label: `Friends (${friends.length})` },
              { value: 'requests', label: `Requests (${incoming.length + outgoing.length})` },
            ]}
            selected={[narrowView]}
            onChange={(next) => {
              const value = next[0]
              if (value === 'find' || value === 'friends' || value === 'requests')
                setNarrowView(value)
            }}
          />
          {narrowView === 'find' && <FindCrew disabled={off} />}
          {narrowView === 'friends' && (
            <Card title="Friends">
              <FriendsView {...crewProps} />
            </Card>
          )}
          {narrowView === 'requests' && (
            <Card title="Requests">
              <RequestsView disabled={off} />
            </Card>
          )}
        </div>
      )}

      <CrewChallenges hasAccount connection={connection} />

      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <p className="m-0 text-sm text-text-muted">{PRIVACY_LINE}</p>
        <div>
          <Button variant="quiet" size="lg" disabled={off} onClick={() => setConfirmLeave(true)}>
            Leave the crew network
          </Button>
        </div>
      </div>

      <ChatDrawer
        socialId={chatWith}
        disabled={off}
        onClose={() => setChatWith(null)}
        onRemove={(socialId) => {
          setChatWith(null)
          setConfirmRemove(socialId)
        }}
      />

      <ConfirmDialog
        open={confirmRemove !== null}
        title="Remove this friend?"
        message="You stop seeing each other's mood, and your conversation is deleted for both of you."
        confirmLabel="Remove friend"
        onConfirm={() => {
          if (confirmRemove) void removeFriend(confirmRemove)
          setConfirmRemove(null)
        }}
        onCancel={() => {
          const socialId = confirmRemove
          setConfirmRemove(null)
          setChatWith(socialId)
        }}
      />

      <ConfirmDialog
        open={confirmLeave}
        title="Leave the crew network?"
        message="This removes your account, your friendships and your messages from the crew network and from this device."
        confirmLabel="Leave"
        onConfirm={() => {
          setConfirmLeave(false)
          void leaveSocial()
        }}
        onCancel={() => setConfirmLeave(false)}
      />
    </div>
  )
}

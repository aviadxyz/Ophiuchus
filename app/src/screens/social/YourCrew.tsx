import { useState } from 'react'
import { Button, Card, ChipGroup, EmptyState, SectionLabel } from '@/design'
import {
  acceptFriendRequest,
  cancelFriendRequest,
  declineFriendRequest,
  useFriendRequests,
  useFriends,
} from '@/data'
import { PersonSummary } from './FindCrew'
import { FriendRow } from './FriendRow'
import { crewMoodLine } from './moodDisplay'

export type CrewViewProps = {
  disabled: boolean
  onChat: (socialId: string) => void
  onFind: () => void
}

export function FriendsView({ disabled, onChat, onFind }: CrewViewProps) {
  const friends = useFriends()
  const moodLine = crewMoodLine(friends)
  if (friends.length === 0) {
    return (
      <EmptyState
        message="No friends yet. Find your crew to add them."
        actionLabel={disabled ? undefined : 'Find crew'}
        onAction={disabled ? undefined : onFind}
      />
    )
  }
  return (
    <div className="flex flex-col gap-1">
      {moodLine && <p className="m-0 text-base text-text">{moodLine}</p>}
      <ul aria-label="Friends" className="m-0 flex list-none flex-col divide-y divide-border p-0">
        {friends.map((friend) => (
          <FriendRow key={friend.socialId} friend={friend} disabled={disabled} onChat={onChat} />
        ))}
      </ul>
    </div>
  )
}

export function RequestsView({ disabled }: { disabled: boolean }) {
  const { incoming, outgoing } = useFriendRequests()
  if (incoming.length === 0 && outgoing.length === 0) {
    return <p className="m-0 text-base text-text-secondary">No requests.</p>
  }
  return (
    <div className="flex flex-col gap-4">
      {incoming.length > 0 && (
        <section className="flex flex-col gap-1">
          <SectionLabel as="h3">Asked to be your friend</SectionLabel>
          <ul className="m-0 flex list-none flex-col divide-y divide-border p-0">
            {incoming.map((person) => (
              <li
                key={person.socialId}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <PersonSummary person={person} />
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="lg"
                    disabled={disabled}
                    onClick={() => void acceptFriendRequest(person.socialId)}
                  >
                    Accept
                  </Button>
                  <Button
                    variant="quiet"
                    size="lg"
                    disabled={disabled}
                    onClick={() => void declineFriendRequest(person.socialId)}
                  >
                    Decline
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      {outgoing.length > 0 && (
        <section className="flex flex-col gap-1">
          <SectionLabel as="h3">You asked</SectionLabel>
          <ul className="m-0 flex list-none flex-col divide-y divide-border p-0">
            {outgoing.map((person) => (
              <li
                key={person.socialId}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <PersonSummary person={person} />
                <Button
                  variant="quiet"
                  size="lg"
                  disabled={disabled}
                  onClick={() => void cancelFriendRequest(person.socialId)}
                >
                  Cancel
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

/** "Your crew" at PC width: a switch between Friends and Requests. */
export function YourCrew(props: CrewViewProps) {
  const friends = useFriends()
  const { incoming, outgoing } = useFriendRequests()
  const [view, setView] = useState<'friends' | 'requests'>('friends')
  return (
    <Card title="Your crew">
      <div className="flex flex-col gap-4">
        <ChipGroup
          label="Show"
          options={[
            { value: 'friends', label: `Friends (${friends.length})` },
            { value: 'requests', label: `Requests (${incoming.length + outgoing.length})` },
          ]}
          selected={[view]}
          onChange={(next) => setView(next[0] === 'requests' ? 'requests' : 'friends')}
        />
        {view === 'friends' ? (
          <FriendsView {...props} />
        ) : (
          <RequestsView disabled={props.disabled} />
        )}
      </div>
    </Card>
  )
}

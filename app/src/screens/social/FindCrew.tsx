import { useState } from 'react'
import { Button, Card, SourceBadge, StatusPill, TextField } from '@/design'
import {
  acceptFriendRequest,
  cancelFriendRequest,
  sendFriendRequest,
  useSocialSearch,
  type SocialPerson,
} from '@/data'
import { Initial } from './FriendRow'

export type PersonControlProps = { person: SocialPerson; disabled: boolean }

/** The one control a search result gets, by relation. */
export function PersonControl({ person, disabled }: PersonControlProps) {
  switch (person.relation) {
    case 'none':
      return (
        <Button
          variant="primary"
          size="lg"
          disabled={disabled}
          onClick={() => void sendFriendRequest(person.socialId)}
        >
          Add friend
        </Button>
      )
    case 'outgoing':
      return (
        <Button
          variant="quiet"
          size="lg"
          disabled={disabled}
          onClick={() => void cancelFriendRequest(person.socialId)}
        >
          Requested · cancel
        </Button>
      )
    case 'incoming':
      return (
        <Button
          variant="primary"
          size="lg"
          disabled={disabled}
          onClick={() => void acceptFriendRequest(person.socialId)}
        >
          Accept
        </Button>
      )
    case 'friend':
      return <StatusPill tone="ok" label="FRIEND" />
  }
}

/** Handle, role and a simulated badge, used by search results and requests. */
export function PersonSummary({ person }: { person: SocialPerson }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <Initial handle={person.handle} />
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-base font-semibold break-all text-text">{person.handle}</span>
          {person.source === 'simulated' && <SourceBadge source="simulated" />}
        </div>
        {person.role && <span className="text-sm text-text-secondary">{person.role}</span>}
      </div>
    </div>
  )
}

export function FindCrew({ disabled }: { disabled: boolean }) {
  const [query, setQuery] = useState('')
  const results = useSocialSearch(query)

  return (
    <Card title="Find crew">
      <div className="flex flex-col gap-3">
        <TextField
          label="Search by handle"
          type="search"
          value={query}
          onChange={setQuery}
          maxLength={20}
          autoComplete="off"
        />
        {results.length === 0 ? (
          <p className="m-0 text-base text-text-secondary">Nobody with that handle yet.</p>
        ) : (
          <ul
            aria-label="People"
            className="m-0 flex list-none flex-col divide-y divide-border p-0"
          >
            {results.map((person) => (
              <li
                key={person.socialId}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <PersonSummary person={person} />
                <PersonControl person={person} disabled={disabled} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  )
}

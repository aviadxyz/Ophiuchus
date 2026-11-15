import { MessageCircle } from 'lucide-react'
import { Button, SourceBadge, StatusPill } from '@/design'
import { useConversation, useSocialAccount, type SharedMood, type SocialPerson } from '@/data'
import { messageTime, moodDisplay } from './moodDisplay'

/** The first letter of a handle, in a circle. */
export function Initial({ handle }: { handle: string }) {
  return (
    <span
      aria-hidden="true"
      className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface-raised text-base font-semibold text-text uppercase"
    >
      {handle.charAt(0)}
    </span>
  )
}

/** A mood as a face, a word, the tags and how long ago, with its source. The same everywhere. */
export function MoodLine({ mood }: { mood: SharedMood | null }) {
  const look = moodDisplay(mood)
  const Icon = look.Icon
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      <Icon aria-hidden="true" className="size-5 shrink-0 text-text-secondary" />
      <StatusPill tone={look.tone} label={look.word} />
      {look.tagsText && <span className="text-sm text-text-secondary">{look.tagsText}</span>}
      {look.agoText && <span className="text-sm text-text-muted">{look.agoText}</span>}
      {mood && <SourceBadge source={mood.source} />}
    </div>
  )
}

export type FriendRowProps = {
  friend: SocialPerson
  disabled: boolean
  onChat: (socialId: string) => void
}

export function FriendRow({ friend, disabled, onChat }: FriendRowProps) {
  const { account } = useSocialAccount()
  const conversation = useConversation(friend.socialId)
  const last = conversation.at(-1)
  const lowMood = friend.mood !== null && friend.mood.score <= 2

  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex min-w-0 flex-1 basis-64 items-start gap-3">
          <Initial handle={friend.handle} />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base font-semibold break-all text-text">{friend.handle}</span>
              {friend.unread > 0 && <StatusPill tone="info" label={`${friend.unread} NEW`} />}
            </div>
            <MoodLine mood={friend.mood} />
            {last && (
              <p className="m-0 flex min-w-0 items-baseline gap-2 text-sm text-text-secondary">
                <span className="min-w-0 flex-1 truncate">
                  {last.fromId === account?.socialId ? 'You: ' : ''}
                  {last.text}
                </span>
                <span className="shrink-0 font-mono text-xs text-text-muted">
                  {messageTime(last.at)}
                </span>
              </p>
            )}
            {lowMood && <p className="m-0 text-sm text-text-muted">A short message can help.</p>}
          </div>
        </div>
        <Button
          variant="quiet"
          size="lg"
          icon={MessageCircle}
          disabled={disabled}
          onClick={() => onChat(friend.socialId)}
          aria-label={`Chat with ${friend.handle}`}
        >
          Chat
        </Button>
      </div>
    </li>
  )
}

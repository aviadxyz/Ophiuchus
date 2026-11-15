import { useEffect, useMemo, useState } from 'react'
import { Button, ChatInput, ChatThread, DetailDrawer, type ChatMessageView } from '@/design'
import {
  markConversationRead,
  sendChatMessage,
  useConversation,
  useFriends,
  useSocialAccount,
} from '@/data'
import { MoodLine } from './FriendRow'
import { messageTime } from './moodDisplay'

export type ChatDrawerProps = {
  socialId: string | null
  disabled: boolean
  onClose: () => void
  onRemove: (socialId: string) => void
}

export function ChatDrawer({ socialId, disabled, onClose, onRemove }: ChatDrawerProps) {
  const { account } = useSocialAccount()
  const friends = useFriends()
  const friend = friends.find((f) => f.socialId === socialId)
  const conversation = useConversation(socialId ?? '')
  const [draft, setDraft] = useState('')

  // Opening the chat, and every new message while it is open, counts as read.
  useEffect(() => {
    if (friend && friend.unread > 0) markConversationRead(friend.socialId)
  }, [friend, conversation.length])

  const failed = conversation.filter((m) => m.status === 'failed')

  const messages: ChatMessageView[] = useMemo(
    () =>
      conversation.map((m) => ({
        id: m.id,
        side: m.fromId === account?.socialId ? 'me' : 'them',
        text: m.text,
        time: messageTime(m.at),
        note:
          m.status === 'failed'
            ? 'Not sent. Tap to retry.'
            : m.status === 'sending'
              ? 'Sending'
              : undefined,
      })),
    [conversation, account?.socialId],
  )

  if (!friend) return null

  return (
    <DetailDrawer open title={friend.handle} onClose={onClose}>
      <div className="flex h-full min-h-0 flex-col gap-3">
        <MoodLine mood={friend.mood} />
        <div className="flex h-80 min-h-0 flex-col sm:h-auto sm:flex-1">
          <ChatThread
            messages={messages}
            emptyText={`No messages yet. Say hello to ${friend.handle}.`}
          />
        </div>
        {failed.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {failed.map((m) => (
              <Button
                key={m.id}
                variant="quiet"
                size="lg"
                disabled={disabled}
                onClick={() => void sendChatMessage(friend.socialId, m.text)}
                aria-label={`Retry sending: ${m.text}`}
              >
                Retry unsent message
              </Button>
            ))}
          </div>
        )}
        <ChatInput
          value={draft}
          onChange={setDraft}
          onSend={(text) => {
            setDraft('')
            void sendChatMessage(friend.socialId, text)
          }}
          disabled={disabled}
          maxLength={500}
          placeholder={`Message ${friend.handle}`}
        />
        <p className="m-0 text-sm text-text-muted">For anything urgent, use Emergency.</p>
        <div className="border-t border-border pt-3">
          <Button
            variant="quiet"
            size="lg"
            disabled={disabled}
            onClick={() => onRemove(friend.socialId)}
          >
            Remove friend
          </Button>
        </div>
      </div>
    </DetailDrawer>
  )
}

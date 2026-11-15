import { useState } from 'react'
import { Link } from 'react-router'
import {
  Card,
  ConfirmDialog,
  ProgressBar,
  SectionLabel,
  SourceBadge,
  StatusPill,
  Switch,
} from '@/design'
import {
  setChallengeJoined,
  useChallenges,
  type ChallengeBoard,
  type ChallengeEntry,
  type SocialConnection,
} from '@/data'
import { CHALLENGE_TEXT, confirmMessage, positions, scoreWords } from './challengeText'

const INTRO =
  'Friendly encouragement with friends who choose to take part. It is not a measure of anyone’s health.'

export type CrewChallengesProps = {
  /** The active profile has a crew network account. */
  hasAccount: boolean
  connection: SocialConnection
}

/** "Crew challenges", below the friends list on Social. */
export function CrewChallenges({ hasAccount, connection }: CrewChallengesProps) {
  const boards = useChallenges()
  const off = connection === 'off'

  let notice: string | null = null
  if (!hasAccount && off) {
    notice = 'The crew network cannot be reached, so crew challenges are not available right now.'
  } else if (!hasAccount) {
    notice = 'Join the crew network above to take part in crew challenges with your friends.'
  } else if (off) {
    notice =
      'The crew network cannot be reached. You can leave a challenge now; boards update when it is back.'
  }

  return (
    <section aria-labelledby="crew-challenges" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="crew-challenges" className="m-0 text-xl font-semibold text-text">
          Crew challenges
        </h2>
        <p className="m-0 text-sm text-text-secondary">{INTRO}</p>
      </div>
      {notice && <p className="m-0 text-base text-text-secondary">{notice}</p>}
      {hasAccount && (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
          <ChallengeCard board={boards.exercise} off={off} />
          <ChallengeCard board={boards.nutrition} off={off} />
        </div>
      )}
    </section>
  )
}

function ChallengeCard({ board, off }: { board: ChallengeBoard; off: boolean }) {
  const text = CHALLENGE_TEXT[board.id]
  const [confirming, setConfirming] = useState(false)

  return (
    <Card
      title={text.title}
      footer={
        <p className="m-0 text-sm text-text-secondary">
          {text.earnedText}{' '}
          <Link
            to={text.earnedPath}
            className="text-text underline decoration-border underline-offset-2 hover:text-accent"
          >
            {text.earnedLabel}
          </Link>
          .
        </p>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="m-0 text-base text-text-secondary">{text.compares}</p>
        <Switch
          label="Take part"
          checked={board.joined}
          // Leaving is always possible; joining needs the network.
          disabled={off && !board.joined}
          onChange={(on) => {
            if (on) setConfirming(true)
            else void setChallengeJoined(board.id, false)
          }}
        />
        {board.joined && <Board board={board} />}
      </div>
      <ConfirmDialog
        open={confirming}
        title={`Take part in ${text.title.toLowerCase()}?`}
        message={confirmMessage(board.id)}
        confirmLabel="Take part"
        onConfirm={() => {
          setConfirming(false)
          void setChallengeJoined(board.id, true)
        }}
        onCancel={() => setConfirming(false)}
      />
    </Card>
  )
}

function Board({ board }: { board: ChallengeBoard }) {
  const text = CHALLENGE_TEXT[board.id]
  const ranks = positions(board.entries)
  const friendsTakingPart = board.entries.some((e) => !e.me)

  return (
    <div className="flex flex-col gap-3">
      <SectionLabel as="h3">Board</SectionLabel>
      {board.entries.length > 0 && (
        <ol
          aria-label={`${text.title} board`}
          className="m-0 flex list-none flex-col divide-y divide-border p-0"
        >
          {board.entries.map((entry, i) => (
            <BoardRow
              key={entry.socialId}
              id={board.id}
              entry={entry}
              position={ranks[i] ?? i + 1}
            />
          ))}
        </ol>
      )}
      {board.myScore === null && (
        <div className="flex flex-col gap-1">
          <p className="m-0 flex flex-wrap items-center gap-2 text-base text-text">
            <StatusPill tone="neutral" label="You" />
            No score yet
          </p>
          <p className="m-0 text-sm text-text-muted">
            {text.noScore} Nothing is shared until there is a score.
          </p>
        </div>
      )}
      {!friendsTakingPart && (
        <p className="m-0 text-sm text-text-secondary">
          No friend is taking part yet. They choose for themselves in their own Social screen.
        </p>
      )}
    </div>
  )
}

function BoardRow({
  id,
  entry,
  position,
}: {
  id: ChallengeBoard['id']
  entry: ChallengeEntry
  position: number
}) {
  const max = CHALLENGE_TEXT[id].max
  const words = scoreWords(id, entry.score)
  return (
    <li className="flex items-start gap-3 py-3">
      <span
        aria-label={`Position ${position}`}
        className="w-6 shrink-0 pt-0.5 text-right font-mono text-sm tabular-nums text-text-muted"
      >
        {position}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-base font-semibold break-all text-text">{entry.handle}</span>
          {entry.me && <StatusPill tone="info" label="You" />}
          <SourceBadge source={entry.source} />
        </div>
        <ProgressBar value={entry.score / max} tone="info" label={words} />
      </div>
    </li>
  )
}

import { useNavigate } from 'react-router'
import { Button, Card, Switch } from '@/design'
import { setShareMood, useMySharedMood, useSocialAccount } from '@/data'
import { MoodLine } from './FriendRow'

export function MyMoodCard({ disabled }: { disabled: boolean }) {
  const navigate = useNavigate()
  const { account } = useSocialAccount()
  const mood = useMySharedMood()

  return (
    <Card title="What your friends see">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          {mood ? (
            <MoodLine mood={mood} />
          ) : (
            <p className="m-0 text-base text-text-secondary">No mood shared today</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Switch
            label="Share my mood with friends"
            checked={account?.shareMood ?? false}
            disabled={disabled}
            onChange={(on) => void setShareMood(on)}
          />
          <Button variant="quiet" size="lg" onClick={() => navigate('/mood')}>
            Check in
          </Button>
        </div>
      </div>
    </Card>
  )
}

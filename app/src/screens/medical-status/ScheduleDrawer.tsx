import { DetailDrawer, SourceBadge } from '@/design'
import { NEXT_SAMPLE_IN_DAYS, SAMPLE_DAYS_AGO, sampleDateTime } from './sample'

/** When each sample was taken and when the next one is due. */
export function ScheduleDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <DetailDrawer open={open} title="Sample schedule" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="m-0 text-base text-text-secondary">
          A stool and blood sample is taken every 14 days, so a change is caught before it is felt.
        </p>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          <li className="flex flex-wrap items-baseline justify-between gap-x-3 rounded-md border border-border bg-bg p-3">
            <span className="text-base font-semibold text-text">
              Next: {sampleDateTime(-NEXT_SAMPLE_IN_DAYS)}
            </span>
            <span className="text-sm text-text-secondary">in {NEXT_SAMPLE_IN_DAYS} days</span>
          </li>
          {[...SAMPLE_DAYS_AGO].reverse().map((days) => (
            <li
              key={days}
              className="flex flex-wrap items-baseline justify-between gap-x-3 px-3 text-sm"
            >
              <span className="text-text-secondary">Taken {sampleDateTime(days)}</span>
              <span className="flex items-baseline gap-2 text-text-muted">
                {days} days ago <SourceBadge source="simulated" />
              </span>
            </li>
          ))}
        </ul>
      </div>
    </DetailDrawer>
  )
}

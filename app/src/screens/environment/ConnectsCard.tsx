import { Link } from 'react-router'
import { Card } from '@/design'

const LINK_CLASS =
  'text-text underline decoration-border underline-offset-2 hover:text-text-secondary'

/** Three lines that tie the station to the person's own screens. */
export function ConnectsCard() {
  return (
    <Card title="How this connects to your health">
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        <li>
          Weightlessness weakens bones and muscles. Keep your daily sessions in{' '}
          <Link to="/physical-activity" className={LINK_CLASS}>
            Physical activity
          </Link>
          .
        </li>
        <li>
          Noise, carbon dioxide and a warm cabin all change how you sleep. Check your nights in{' '}
          <Link to="/sleep" className={LINK_CLASS}>
            Sleep
          </Link>
          .
        </li>
        <li>
          Radiation adds up over the whole mission. See the long-term risks in{' '}
          <Link to="/risks" className={LINK_CLASS}>
            Risks
          </Link>
          .
        </li>
      </ul>
    </Card>
  )
}

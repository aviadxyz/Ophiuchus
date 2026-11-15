import { useUrl } from './ids'
import { blob, curve, MIRROR, symmetric, type Pt } from './geometry'
import { Face } from './outline'
import { palette, type LayerView } from './palette'
import { BODY_D, BRAIN_D, EAR_D, lensTransform } from './shapes'
import { Layer, Vol } from './styles'

const join = (list: Pt[][]) => list.map((l) => curve(l)).join('')
const both = [undefined, MIRROR] as const

/* Brain: folds of one half, and the brainstem leading down. */
const folds = join([
  [[205, 36.5], [211, 42], [207, 49], [213, 55]],
  [[216, 35.5], [221, 43], [218, 51], [224, 57], [221, 65]],
  [[226, 46], [229.5, 55], [227.5, 63]],
  [[205, 57], [211, 63], [207, 69]],
  [[214, 62], [219, 69], [216, 75]],
  [[223, 70], [226.5, 76]],
  [[231.5, 66], [225, 70], [219.5, 77]],
])
const moreFolds = join([
  [[209, 33], [213, 37]],
  [[203.5, 44], [207, 42]],
  [[212, 47], [217, 46]],
  [[222, 38], [226, 41]],
  [[225, 51], [228, 49]],
  [[209, 53], [213, 60]],
  [[219, 58], [223, 63]],
  [[203.5, 64], [206, 62]],
  [[211, 70], [214, 68]],
  [[228.5, 68], [230.5, 72]],
])
const brainstem = symmetric([[200, 72], [205, 75.5], [205.5, 86], [204.5, 96], [203.2, 106], [201.5, 111], [200, 112]])

/* Eyes: the two nerves cross behind them. */
const nerve = curve([[210.5, 83], [205.5, 80.5], [200, 80], [195.5, 77], [192.5, 72.5]])

const upperLid = blob([[209, 84.6], [210.4, 80], [215.5, 77.6], [220.6, 80], [222, 84.6], [218.6, 83], [215.5, 82.6], [212.4, 83]])

/* Inner ear: the snail-shaped cochlea and the three balance loops. */
const cochlea = curve(
  Array.from({ length: 26 }, (_, i): Pt => {
    const a = (i * Math.PI) / 5
    const r = 4.3 * (1 - i / 29)
    return [225 + r * Math.cos(a), 94.6 + r * Math.sin(a)]
  }),
)
const earNerve = curve([[223, 92.5], [214, 95], [206, 96.5]])

/* Nose passage and sinuses. */
const nosePassage = symmetric([[200, 79], [203, 84], [204.5, 92], [205.6, 100], [203.5, 105.5], [200, 106.5]])
const frontal = blob([[201, 70], [205.5, 66.5], [210.5, 68.5], [210, 73.5], [205, 75.5], [201.5, 74.5]])
const maxillary = blob([[207.5, 92.5], [214.5, 91], [219, 95.5], [218, 103], [212.5, 107], [207, 104], [205.8, 98]])
const turbinates = 'M201.2 90Q203.4 91.5 201.4 94M201.4 97Q204 99 201.6 102'

export type HeadViews = { brain: LayerView; eyes: LayerView; ears: LayerView; face: LayerView }

/** What is inside the head. Drawn small on the body and again, enlarged, in the head detail. */
export function HeadOrgans({ views, detail }: { views: HeadViews; detail?: boolean }) {
  const url = useUrl()
  return (
    <>
      <Layer view={views.brain}>
        {detail && <Vol d={brainstem} fill={palette.brainDark} stroke={palette.heartDark} outline={false} />}
        {both.map((t) => (
          <g key={t ?? 'l'} transform={t}>
            <Vol d={BRAIN_D} fill={palette.brain} stroke={palette.brainDark} />
            <path d={folds} fill="none" stroke={palette.brainDark} strokeWidth={detail ? 0.9 : 1.1} />
            {detail && <path d={moreFolds} fill="none" stroke={palette.brainDark} strokeWidth="0.7" />}
          </g>
        ))}
      </Layer>
      <Layer view={views.face}>
        <path d={nosePassage} fill={palette.lungDark} fillOpacity="0.8" stroke={palette.lung} strokeWidth="0.7" className="bf-o" />
        <path d="M200 80L200 106" stroke={palette.lung} strokeWidth="0.7" />
        {both.map((t) => (
          <g key={t ?? 'l'} transform={t}>
            <Vol d={frontal} fill={palette.lung} stroke={palette.lungDark} sw={0.7} />
            <Vol d={maxillary} fill={palette.lung} stroke={palette.lungDark} sw={0.7} />
            <circle cx="204.6" cy="82.8" r="1.5" fill={palette.lung} />
            <circle cx="205" cy="87.4" r="1.5" fill={palette.lung} />
            <path d={turbinates} fill="none" stroke={palette.lung} strokeWidth="0.7" />
          </g>
        ))}
      </Layer>
      <Layer view={views.eyes}>
        {both.map((t) => (
          <g key={t ?? 'l'} transform={t}>
            <path d={nerve} fill="none" stroke={palette.boneDark} strokeWidth="2.8" />
            <path d={nerve} fill="none" stroke={palette.urine} strokeWidth="1.8" />
            <circle cx="215.5" cy="84.3" r="6" fill={palette.bone} />
            <circle className="bf-o" cx="215.5" cy="84.3" r="6" fill={url('vol')} stroke={palette.boneDark} strokeWidth="0.7" />
            <circle cx="215.3" cy="84.8" r="2.6" fill={palette.vein} fillOpacity="0.75" />
            <circle cx="215.3" cy="84.8" r="1.2" fill={palette.shade} />
            {/* A relaxed upper lid, so the eye looks calm rather than staring. */}
            <path d={upperLid} fill={palette.skin} stroke={palette.skinLight} strokeOpacity="0.8" strokeWidth="0.6" />
          </g>
        ))}
      </Layer>
      <Layer view={views.ears}>
        {both.map((t) => (
          <g key={t ?? 'l'} transform={t} fill="none">
            <path d={earNerve} stroke={palette.urine} strokeWidth="1.2" />
            <g className="bf-u" stroke={palette.boneDark} strokeWidth="2.4">
              <ellipse cx="227" cy="86" rx="2.6" ry="3.3" />
              <ellipse cx="230.6" cy="88.6" rx="3.1" ry="2.3" transform="rotate(-35 230.6 88.6)" />
              <ellipse cx="230" cy="92.4" rx="3.3" ry="1.5" transform="rotate(10 230 92.4)" />
              <path d={cochlea} />
            </g>
            <g stroke={palette.gland} strokeWidth="1.3">
              <ellipse cx="227" cy="86" rx="2.6" ry="3.3" />
              <ellipse cx="230.6" cy="88.6" rx="3.1" ry="2.3" transform="rotate(-35 230.6 88.6)" />
              <ellipse cx="230" cy="92.4" rx="3.3" ry="1.5" transform="rotate(10 230 92.4)" />
              <path d={cochlea} />
            </g>
            <ellipse cx="226.8" cy="90.6" rx="2.2" ry="1.8" fill={palette.gland} stroke={palette.boneDark} strokeWidth="0.6" />
          </g>
        ))}
      </Layer>
    </>
  )
}

type Lens = { cx: number; cy: number; r: number; scale: number }

/** The enlarged head: a round window with the head drawn bigger, joined to the head by a line. */
export function HeadLens({ lens, views, above }: { lens: Lens; views: HeadViews; above: boolean }) {
  const url = useUrl()
  const leader = above
    ? `M200 ${lens.cy + lens.r}L200 21`
    : `M${lens.cx - lens.r * 0.94} ${lens.cy - lens.r * 0.34}L239 62`
  return (
    <g>
      <path d={leader} fill="none" stroke="var(--color-text-muted)" strokeWidth="1" strokeDasharray="2 3" />
      <circle cx={above ? 200 : 239} cy={above ? 21 : 62} r="1.8" fill="var(--color-text-muted)" />
      <circle cx={lens.cx} cy={lens.cy} r={lens.r} fill="var(--color-bg)" />
      <g clipPath={url('lens')}>
        <g transform={lensTransform(lens)}>
          {both.map((t) => (
            <path key={t ?? 'l'} d={EAR_D} transform={t} fill={palette.skin} fillOpacity="0.3" stroke={palette.skinLight} strokeOpacity="0.7" strokeWidth="0.8" />
          ))}
          <path d={BODY_D} fill="var(--color-bg)" />
          <path d={BODY_D} fill={url('skin')} stroke={palette.skinLight} strokeOpacity="0.8" strokeWidth="0.9" />
          <HeadOrgans views={views} detail />
          <Face lids={false} opacity={0.8} />
        </g>
      </g>
      <circle cx={lens.cx} cy={lens.cy} r={lens.r} fill="none" stroke="var(--color-border)" strokeWidth="1.5" />
    </g>
  )
}

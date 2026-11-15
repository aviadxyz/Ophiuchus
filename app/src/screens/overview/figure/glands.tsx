import { blob, curve, MIRROR, type Pt } from './geometry'
import { palette, type LayerView } from './palette'
import { Layer, Vol } from './styles'

const join = (list: Pt[][]) => list.map((l) => curve(l)).join('')

/* Lymph: fine vessels, clusters of nodes, and the spleen. Drawn in the accent token, the
   usual atlas green, so no new color is needed. */
const lymphSide: Pt[][] = [
  [[320, 480], [314, 440], [303, 395], [296, 355], [288, 310], [279, 262], [270, 222], [266, 212]],
  [[328, 470], [323, 420], [314, 360], [305, 300], [293, 240], [272, 208]],
  [[222, 840], [216, 800], [212.5, 740], [211.5, 690], [214, 650], [214, 600], [219, 540], [228, 480], [231, 455]],
  [[246, 836], [244, 780], [248, 710], [240, 655], [238, 600], [240, 530], [237, 470], [234, 455]],
  [[232, 450], [222, 420], [212, 400], [206, 378], [206, 330]],
  [[221, 128], [223, 146], [226, 160], [218, 170]],
  [[266, 212], [250, 190], [232, 176], [218, 172]],
]
const duct = curve([[206, 330], [204, 290], [203, 240], [205, 200], [212, 180], [216, 172]])
const nodesSide: Array<[number, number]> = [
  [221, 128], [223.5, 137], [222, 146], [226, 154], [219, 153], [232, 166],
  [264, 206], [269, 212], [262, 214], [267, 220], [272, 204],
  [296, 346], [231, 654],
  [226, 446], [232, 449], [238, 452], [229, 456], [236, 460],
  [214, 404], [221, 418], [207, 330], [207, 352], [206, 372], [206, 214], [209, 228],
]
const spleen = blob([[252, 297], [258, 299], [261.5, 307], [260.5, 317], [256, 323], [251.5, 319], [250.5, 308]])

export function Immune({ view }: { view: LayerView }) {
  return (
    <Layer view={view}>
      <Vol d={spleen} fill={palette.spleen} stroke={palette.heartDark} />
      <path d={duct} fill="none" stroke="var(--color-accent)" strokeWidth="1.3" />
      {[undefined, MIRROR].map((t) => (
        <g key={t ?? 'l'} transform={t}>
          <path className="bf-u" d={join(lymphSide)} fill="none" stroke="transparent" strokeWidth="1.9" />
          <path d={join(lymphSide)} fill="none" stroke="var(--color-accent)" strokeWidth="0.9" />
          {nodesSide.map(([x, y]) => (
            <ellipse
              key={`${x}-${y}`}
              className="bf-o"
              cx={x}
              cy={y}
              rx="2.6"
              ry="1.9"
              fill="var(--color-accent)"
              stroke="var(--color-surface)"
              strokeWidth="0.6"
            />
          ))}
        </g>
      ))}
    </Layer>
  )
}

/* Hormone glands: pituitary, thyroid, adrenals, pancreas. */
const thyroidLobe = blob([[203.5, 144], [207.8, 145.5], [209.4, 151], [207.4, 156.8], [203.6, 155.4], [202.4, 150]])
const adrenalL = blob([[226.5, 299.5], [231, 294.5], [237, 297.5], [233.5, 302]])
const adrenalR = blob([[173.5, 305.5], [169, 300.5], [163, 303.5], [166.5, 308]])
const pancreas = blob([
  [188, 340], [196, 335.5], [208, 335], [222, 331.5], [236, 326.5], [245, 322.5], [247, 326],
  [238, 332.5], [224, 338.5], [210, 342], [198, 344], [190, 346.5], [186, 344],
])

export function Hormones({ view }: { view: LayerView }) {
  return (
    <Layer view={view}>
      <Vol d={pancreas} fill={palette.gland} stroke={palette.boneDark} />
      <Vol d={adrenalL} fill={palette.gland} stroke={palette.boneDark} />
      <Vol d={adrenalR} fill={palette.gland} stroke={palette.boneDark} />
      <Vol d={thyroidLobe} fill={palette.kidney} stroke={palette.kidneyDark} />
      <g transform={MIRROR}>
        <Vol d={thyroidLobe} fill={palette.kidney} stroke={palette.kidneyDark} />
      </g>
      <rect x="197.4" y="150.6" width="5.2" height="3" rx="1.4" fill={palette.kidney} />
      <circle className="bf-o" cx="200" cy="81" r="2.4" fill={palette.gland} stroke={palette.boneDark} strokeWidth="0.7" />
    </Layer>
  )
}

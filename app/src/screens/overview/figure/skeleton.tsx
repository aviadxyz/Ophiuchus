import { blob, curve, MIRROR, symmetric, type Pt } from './geometry'
import { palette, type LayerView } from './palette'
import { Layer, Vol } from './styles'

const join = (list: Pt[][]) => list.map((l) => curve(l)).join('')

/** A bone drawn as a rounded stroke: dark edge, pale body, a line of light down the middle. */
function Tube({ d, w }: { d: string; w: number }) {
  return (
    <g fill="none">
      <path className="bf-u" d={d} stroke={palette.boneDark} strokeWidth={w + 1.4} />
      <path d={d} stroke={palette.bone} strokeWidth={w} />
      <path d={d} stroke={palette.light} strokeOpacity="0.4" strokeWidth={w * 0.3} />
    </g>
  )
}

function Knob({ cx, cy, rx, ry = rx }: { cx: number; cy: number; rx: number; ry?: number }) {
  return (
    <ellipse
      className="bf-o"
      cx={cx}
      cy={cy}
      rx={rx}
      ry={ry}
      fill={palette.bone}
      stroke={palette.boneDark}
      strokeWidth="0.8"
    />
  )
}

/* Skull */
const skull = symmetric([
  [200, 25.5], [212.5, 27], [223.5, 34], [230.5, 46], [233.5, 61], [233, 75], [231, 86], [228.5, 95],
  [228.5, 102], [224.5, 107], [220.5, 112.5], [215, 116.5], [200, 118],
])
const jawbone = symmetric([
  [200, 119.5], [214, 119.5], [222, 114.5], [226.5, 105], [229.5, 107], [228, 118], [222, 126],
  [211.5, 130.5], [200, 131.5],
])
const orbit = blob([[206.5, 79], [214, 76.5], [221.5, 78.5], [223.5, 85], [220, 91], [212.5, 92], [207, 88.5]])
const noseHole = symmetric([[200, 88], [203.5, 92.5], [205.5, 100], [203, 104.5], [200, 103.5]])
const teeth = 'M188 118.8L212 118.8M191 116.6L191 121M195.5 116.4L195.5 121.2M200 116.3L200 121.3M204.5 116.4L204.5 121.2M209 116.6L209 121'

/* Chest */
const ribs: Pt[][] = [
  [[205, 165], [218, 163], [231, 170], [224, 178], [208, 180.5]],
  [[205.5, 175], [226, 172], [246, 186], [232, 193], [208, 192.5]],
  [[206, 186], [232, 182], [256, 202], [238, 208], [208, 204.5]],
  [[206, 197], [236, 193], [262, 218], [242, 223], [208, 216.5]],
  [[206, 208], [239, 205], [265.5, 235], [245, 239], [208, 228.5]],
  [[206, 219], [241, 217], [267, 252], [247, 256], [208.5, 240.5]],
  [[206, 230], [242, 229], [267, 269], [246, 273], [224, 262], [209, 251.5]],
  [[206, 241], [242, 241], [266, 286], [246, 290], [228, 277], [216, 263]],
  [[206, 252], [241, 253], [264, 301], [248, 304], [236, 292]],
  [[206, 263], [239, 266], [261, 315], [250, 318], [243, 307]],
]
const manubrium = symmetric([[200, 169.5], [207.5, 170], [209.5, 179], [205.5, 186], [200, 186.5]])
const sternum = symmetric([[200, 187.5], [204.5, 188], [205.5, 215], [204.5, 244], [202.5, 251], [201.2, 262], [200, 264]])
const collarbone = curve([[207.5, 173.5], [224, 170.5], [244, 173], [258, 169.5], [270, 170.5]])

/* Arm */
const humerus = curve([[279, 190], [286, 230], [296, 290], [303.5, 346]])
const radius = curve([[310.5, 357], [316, 400], [321.5, 440], [325, 460]])
const ulna = curve([[298.5, 354], [303.5, 400], [309.5, 440], [313.5, 460]])
const fingers = join([
  [[327.5, 471], [336.5, 489], [344.5, 504]],
  [[325, 473], [332, 503], [335.5, 533]],
  [[321.5, 474], [325.5, 506], [326.5, 539]],
  [[318, 474], [318.5, 504], [318.5, 535]],
  [[314.5, 473], [311.5, 499], [311, 522]],
])

/* Pelvis and leg */
const hip = blob([
  [211, 393], [215.5, 384.5], [226, 378.5], [239, 377.5], [250.5, 382.5], [257.5, 392], [258, 403],
  [254, 414], [250.5, 425], [250.5, 436], [249, 446], [243.5, 453], [238.5, 459.5], [232.5, 466],
  [225, 469.5], [217.5, 467.5], [211.5, 461], [205.5, 456], [202.2, 450.5], [205.5, 445.5],
  [214, 443], [222.5, 438.5], [227, 430], [226, 420], [220.5, 411.5], [214, 404],
])
const hipHole = blob([[212, 449.5], [221, 446.5], [229.5, 449], [230, 456], [224, 462.5], [216, 460.5]])
const wingLine = curve([[219, 388], [232, 386], [244, 392], [250, 404]])
const femurNeck = 'M243 440L254.5 449'
const femur = curve([[254.5, 449], [251, 480], [245, 540], [238.5, 600], [234, 640]])
const tibia = curve([[232, 664], [230.5, 700], [228.5, 750], [226, 805]])
const fibula = curve([[245, 669], [245.5, 700], [243, 750], [237.5, 810]])
const toes = join([
  [[220, 828], [216, 848]],
  [[224, 829], [223, 850]],
  [[228, 829.5], [231, 851]],
  [[232, 829], [239, 851]],
  [[236, 827.5], [247, 849.5]],
])

const sacrum = symmetric([[200, 390], [211, 391.5], [213, 398], [209, 412], [204.5, 425], [201.5, 436], [200, 438]])
const sacrumLines = 'M194 401L206 401M195.5 411L204.5 411M197 420L203 420'

/** The sacrum joins the spine to the pelvis, so both layers draw it. */
function Sacrum() {
  return (
    <>
      <Vol d={sacrum} fill={palette.bone} stroke={palette.boneDark} />
      <path d={sacrumLines} stroke={palette.boneDark} strokeWidth="0.8" />
    </>
  )
}

export function Bones({ view }: { view: LayerView }) {
  return (
    <Layer view={view}>
      <Vol d={skull} fill={palette.bone} stroke={palette.boneDark} />
      <Vol d={jawbone} fill={palette.bone} stroke={palette.boneDark} />
      <path d={noseHole} fill={palette.shade} fillOpacity="0.7" />
      <path d={teeth} fill="none" stroke={palette.boneDark} strokeWidth="0.7" />
      <Sacrum />
      <Vol d={manubrium} fill={palette.bone} stroke={palette.boneDark} />
      <Vol d={sternum} fill={palette.bone} stroke={palette.boneDark} />
      {[undefined, MIRROR].map((t) => (
        <g key={t ?? 'l'} transform={t}>
          <path d={orbit} fill={palette.shade} fillOpacity="0.7" />
          <Tube d={join(ribs)} w={3} />
          <Tube d={collarbone} w={4.4} />
          <Tube d={humerus} w={5.6} />
          <Knob cx={278} cy={187} rx={8} />
          <ellipse cx="303.5" cy="351" rx="10" ry="5.2" fill={palette.bone} stroke={palette.boneDark} strokeWidth="0.8" className="bf-o" transform="rotate(8 303.5 351)" />
          <Tube d={radius} w={4.2} />
          <Tube d={ulna} w={3.8} />
          <Knob cx={319.5} cy={466.5} rx={9.5} ry={4.6} />
          <Tube d={fingers} w={2.4} />
          <Vol d={hip} fill={palette.bone} stroke={palette.boneDark} />
          <path d={hipHole} fill={palette.shade} fillOpacity="0.62" />
          <path d={wingLine} fill="none" stroke={palette.boneDark} strokeOpacity="0.5" strokeWidth="0.8" />
          <Tube d={femurNeck} w={6.2} />
          <Tube d={femur} w={6.8} />
          <Knob cx={243} cy={440} rx={8.5} />
          <Knob cx={257} cy={447.5} rx={5.5} />
          <Knob cx={233} cy={645} rx={12.5} ry={7.5} />
          <Tube d={tibia} w={6} />
          <Knob cx={232} cy={662} rx={12.5} ry={5} />
          <Tube d={fibula} w={3} />
          <Knob cx={232} cy={649} rx={7} ry={8} />
          <Knob cx={227} cy={823} rx={11} ry={7} />
          <Tube d={toes} w={2.6} />
        </g>
      ))}
    </Layer>
  )
}

/* Spine: 7 neck, 12 chest and 5 lower-back vertebrae, growing toward the bottom. */
const vertebrae: Array<{ y: number; w: number; h: number }> = []
for (let i = 0; i < 24; i++) {
  if (i < 7) vertebrae.push({ y: 126 + i * 5.7, w: 10.5 + i * 0.4, h: 4.3 })
  else if (i < 19) vertebrae.push({ y: 167 + (i - 7) * 10.7, w: 13 + (i - 7) * 0.4, h: 8.2 })
  else vertebrae.push({ y: 297.5 + (i - 19) * 18.6, w: 19 + (i - 19) * 0.9, h: 14.6 })
}
export function Spine({ view }: { view: LayerView }) {
  return (
    <Layer view={view}>
      {vertebrae.map((v) => (
        <g key={v.y}>
          <path
            d={`M${200 - v.w / 2 - 3.5} ${v.y + v.h * 0.45}L${200 + v.w / 2 + 3.5} ${v.y + v.h * 0.45}`}
            stroke={palette.boneDark}
            strokeWidth={Math.min(3, v.h * 0.4)}
          />
          <rect
            className="bf-o"
            x={200 - v.w / 2}
            y={v.y}
            width={v.w}
            height={v.h}
            rx={Math.min(2.4, v.h / 3)}
            fill={palette.bone}
            stroke={palette.boneDark}
            strokeWidth="0.8"
          />
        </g>
      ))}
      <Sacrum />
    </Layer>
  )
}

import type { CSSProperties } from 'react'
import { useUrl } from './ids'
import { blob, curve, type Pt } from './geometry'
import { palette, type LayerView } from './palette'
import {
  BLADDER_D,
  COLON_D,
  GUT_D,
  HEART_D,
  HEART_FIT,
  KIDNEY_L_D,
  KIDNEY_R_D,
  LIVER_D,
  LUNG_L_D,
  LUNG_R_D,
  STOMACH_D,
} from './shapes'
import { Layer, Vol } from './styles'

const lines = (list: Pt[][]) => list.map((l) => curve(l)).join('')

/* Lungs and windpipe */
const windpipe = 'M200 138L200 205'
const bronchi = curve([[200, 203], [193.5, 210], [187, 217.5]]) + curve([[200, 203], [207, 211], [213.5, 219.5]])
const larynx = blob([[195, 127.5], [205, 127.5], [206.8, 134], [204, 139.5], [196, 139.5], [193.2, 134]])
const fissures = lines([
  [[187, 237], [170, 236], [147.5, 240]],
  [[147.5, 240], [158, 262], [176, 287]],
  [[252.5, 224], [246, 250], [233, 287]],
])
const airways = lines([
  [[187, 217.5], [176, 222], [166, 220], [158, 212]],
  [[176, 222], [170, 234], [160, 244], [153, 258]],
  [[181, 220], [180, 240], [174, 258], [166, 274]],
  [[170, 234], [176, 250], [182, 266]],
  [[166, 220], [164, 206], [170, 196]],
  [[213.5, 219.5], [224, 222], [234, 218], [240, 208]],
  [[224, 222], [232, 234], [243, 244], [249, 260]],
  [[234, 218], [236, 204], [229, 195]],
  [[232, 234], [240, 252], [246, 276]],
])

/** The breathing muscle: a thin dome under the lungs, over the liver and stomach. */
const diaphragm = curve([[141, 309], [147, 296], [158, 290], [172, 287.5], [186, 285.5], [200, 282.5], [214, 284], [228, 286.5], [243, 291], [253, 298], [259, 308]])

export function Lungs({ view }: { view: LayerView }) {
  const url = useUrl()
  return (
    <Layer view={view}>
      <path className="bf-u" d={windpipe + bronchi} fill="none" stroke={palette.boneDark} strokeWidth="9.4" />
      <path d={windpipe} fill="none" stroke={palette.bone} strokeOpacity="0.88" strokeWidth="7.6" />
      <path d={bronchi} fill="none" stroke={palette.bone} strokeOpacity="0.88" strokeWidth="5.2" />
      <path
        d={windpipe}
        fill="none"
        stroke={palette.boneDark}
        strokeWidth="7.6"
        strokeDasharray="1 3"
        strokeLinecap="butt"
        strokeOpacity="0.75"
      />
      <path d={larynx} fill={palette.bone} stroke={palette.boneDark} strokeWidth="0.8" />
      <g className="bf-breathe">
        <Vol d={LUNG_R_D} fill={palette.lung} stroke={palette.lungDark} />
        <Vol d={LUNG_L_D} fill={palette.lung} stroke={palette.lungDark} />
        <path d={airways} fill="none" stroke={palette.lungDark} strokeOpacity="0.38" strokeWidth="0.9" />
        <path d={fissures} fill="none" stroke={palette.shade} strokeOpacity="0.3" strokeWidth="4" filter={url('haze')} />
        <path d={fissures} fill="none" stroke={palette.lungDark} strokeWidth="0.9" />
      </g>
      <path d={diaphragm} fill="none" stroke={palette.muscle} strokeOpacity="0.75" strokeWidth="1.6" />
    </Layer>
  )
}

/* Heart */
const arch = curve([[200.5, 226], [198, 212], [199.5, 200.5], [206, 195], [213, 198], [214.5, 209]])
const archBranches = 'M199.5 199L195 188M204.5 195.5L207 185M209.8 196.5L213 187'
const pulmonary = curve([[208, 227], [210.5, 215], [214.5, 207]])
const atrium = blob([
  [191, 221], [197, 218.5], [201.5, 224], [199.5, 236], [196, 250], [193, 262], [188.6, 262],
  [186, 248], [187, 232],
])
const coronaries = lines([
  [[214, 221.5], [219, 238], [224.5, 255], [229.5, 271]],
  [[219, 238], [227, 244], [233, 253]],
  [[222, 247], [215, 256], [211, 267]],
  [[201, 223], [195, 236], [192, 250], [194.5, 264]],
  [[193, 246], [201, 256], [207, 268]],
])
const cardiacVein = curve([[217, 224], [221.5, 240], [227, 257], [231.5, 269]])

export function Heart({ view, beatSeconds }: { view: LayerView; beatSeconds?: number }) {
  const url = useUrl()
  const beat: CSSProperties | undefined = beatSeconds
    ? { animationDuration: `${beatSeconds}s` }
    : undefined
  return (
    <Layer view={view}>
      <path className="bf-u" d={arch + archBranches} fill="none" stroke={palette.heartDark} strokeWidth="10.6" />
      <path d={arch} fill="none" stroke={palette.artery} strokeWidth="9" />
      <path d={archBranches} fill="none" stroke={palette.artery} strokeWidth="3.8" />
      <path d={pulmonary} fill="none" stroke={palette.heartDark} strokeWidth="10" />
      <path d={pulmonary} fill="none" stroke={palette.vein} strokeWidth="8.4" />
      <g transform={HEART_FIT}>
        <path d={HEART_D} fill={palette.shade} fillOpacity="0.45" filter={url('haze')} transform="translate(1.5 3.5)" />
        <g className={beatSeconds ? 'bf-beat' : undefined} style={beat} data-heart="">
          <Vol d={HEART_D} fill={palette.heart} stroke={palette.heartDark} />
          <path d={atrium} fill={palette.heartDark} fillOpacity="0.4" />
          <path d={cardiacVein} fill="none" stroke={palette.vein} strokeWidth="1" />
          <path d={coronaries} fill="none" stroke={palette.artery} strokeWidth="1.1" />
          <path d={coronaries} fill="none" stroke={palette.skinLight} strokeOpacity="0.55" strokeWidth="0.4" />
        </g>
      </g>
    </Layer>
  )
}

/* Stomach, liver and gut */
const gullet = curve([[206.5, 277], [209, 286], [213, 295]])
const duodenum = curve([[191, 332], [185.5, 337], [183, 346], [186, 355], [195, 359.5], [208, 360]])
const gallbladder = blob([[173, 331], [179.5, 331], [180.8, 339], [177, 344.5], [172.5, 341]])
const rugae = lines([
  [[222, 294], [235, 296], [243, 305], [244, 318], [237, 331], [224, 338], [209, 338]],
  [[221, 301], [232, 303], [236, 312], [232, 324], [221, 331]],
])
const liverLobes = lines([
  [[199, 287.8], [198, 300], [196, 316]],
  [[150, 300], [163, 296], [180, 296]],
])
const mesentery = blob([[170, 373], [200, 367], [232, 373], [237.5, 392], [234, 418], [205, 428], [176, 424], [167.5, 400]])
const appendix = curve([[160, 428], [162, 434], [167, 439]])

export function Digestive({ view }: { view: LayerView }) {
  const url = useUrl()
  return (
    <Layer view={view}>
      <path d={gullet} fill="none" stroke={palette.stomachDark} strokeWidth="6" />
      <path d={duodenum} fill="none" stroke={palette.gutDark} strokeWidth="8.2" />
      <path d={duodenum} fill="none" stroke={palette.gut} strokeWidth="6.6" />
      <Vol d={gallbladder} fill={palette.bile} stroke={palette.liverDark} outline={false} />
      {/* Large intestine: a row of overlapping beads gives the pouched edge. */}
      <path d={appendix} fill="none" stroke={palette.colonDark} strokeWidth="3.8" />
      <path d={appendix} fill="none" stroke={palette.colon} strokeWidth="2.4" />
      <path
        d={COLON_D}
        fill="none"
        stroke={palette.colonDark}
        strokeWidth="16.4"
        strokeDasharray="0.1 8.6"
        className="bf-u"
      />
      <path d={COLON_D} fill="none" stroke={palette.colon} strokeWidth="14.6" strokeDasharray="0.1 8.6" />
      <path d={COLON_D} fill="none" stroke={palette.colon} strokeWidth="9" />
      <path d={COLON_D} fill="none" stroke={palette.light} strokeOpacity="0.16" strokeWidth="2" />
      {/* Small intestine, on the sheet of tissue that holds its loops */}
      <path d={mesentery} fill={palette.colon} />
      <path className="bf-u" d={GUT_D} fill="none" stroke={palette.gutDark} strokeWidth="11" />
      <path d={GUT_D} fill="none" stroke={palette.gut} strokeWidth="9.2" />
      <path d={GUT_D} fill="none" stroke={palette.light} strokeOpacity="0.24" strokeWidth="2.4" />
      <path d={STOMACH_D} fill={palette.shade} fillOpacity="0.4" filter={url('haze')} transform="translate(1 3)" />
      <Vol d={STOMACH_D} fill={palette.stomach} stroke={palette.stomachDark} />
      <path d={rugae} fill="none" stroke={palette.stomachDark} strokeOpacity="0.55" strokeWidth="0.9" />
      <path d={LIVER_D} fill={palette.shade} fillOpacity="0.45" filter={url('haze')} transform="translate(1 3.5)" />
      <Vol d={LIVER_D} fill={palette.liver} stroke={palette.liverDark} />
      <path d={liverLobes} fill="none" stroke={palette.liverDark} strokeOpacity="0.9" strokeWidth="1" />
    </Layer>
  )
}

/* Kidneys and bladder */
const ureters =
  curve([[228.5, 327], [223, 342], [219, 364], [216, 392], [212, 416], [207, 433], [204.5, 438]]) +
  curve([[171.5, 333], [177, 348], [181, 370], [184, 396], [188, 418], [193, 433], [195.5, 438]])
const pelvisL = blob([[230, 318], [226, 322], [226, 330], [230, 328.5]])
const pelvisR = blob([[170, 324], [174, 328], [174, 336], [170, 334.5]])

/**
 * The kidneys lie behind the liver, stomach and gut. They are drawn once in their true place,
 * and once more on top as a faint `ghost`, so they show through like the rest of the body.
 */
export function Kidneys({ view, ghost }: { view: LayerView; ghost?: boolean }) {
  return (
    <Layer view={ghost ? { ...view, opacity: view.opacity * (view.mark === 'chosen' || view.mark === 'dashed' ? 1 : 0.62) } : view}>
      <path d={ureters} fill="none" stroke={palette.kidneyDark} strokeWidth="2.1" />
      <path d={ureters} fill="none" stroke={palette.urine} strokeWidth="1.1" />
      <Vol d={KIDNEY_L_D} fill={palette.kidney} stroke={palette.kidneyDark} />
      <Vol d={KIDNEY_R_D} fill={palette.kidney} stroke={palette.kidneyDark} />
      <path d={pelvisL + pelvisR} fill={palette.urine} />
      <Vol d={BLADDER_D} fill={palette.bladder} stroke={palette.kidneyDark} />
    </Layer>
  )
}

export function Reproductive({ view }: { view: LayerView }) {
  const url = useUrl()
  return (
    <Layer view={view}>
      <ellipse cx="200" cy="455" rx="26" ry="11" fill={url('glow')} />
      <ellipse className="bf-o" cx="200" cy="457" rx="19" ry="7.5" fill="none" stroke="transparent" />
    </Layer>
  )
}

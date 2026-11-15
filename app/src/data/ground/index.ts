// Ground sharing and the ground view (CONTRACTS sections 8, 9 and 11, prompt 28). Re-exported
// from `@/data`. The key, the ground code and the network client stay inside this folder.

export type {
  GroundAlert,
  GroundReport,
  GroundShare,
  GroundShareState,
  GroundView,
  GroundViewState,
  GroundWeekMetric,
} from './types'
export { setGroundShare, useGroundShare, installGround } from './share'
export {
  closeGroundView,
  installGroundView,
  openGroundView,
  openSimulatedGroundView,
  useGroundView,
} from './view'

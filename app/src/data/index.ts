// The only import path for screens: `@/data`. Names follow CONTRACTS sections 8 and 9.
// The crew-network names (section 9, "Social") are added by lane 17 from data/social.

export type {
  Alert,
  AlertKind,
  AlertOrigin,
  AlertStatus,
  BodyMass,
  CrewProfile,
  DateString,
  DaySummary,
  ExerciseDevice,
  ExerciseKind,
  ExerciseSession,
  FoodItem,
  HealthSummary,
  AreaSummary,
  MealEntry,
  MealWithFood,
  MetricId,
  MetricValue,
  Mission,
  MissionLocation,
  MoodCheckin,
  ProfileChanges,
  ProfileDetails,
  SeriesPoint,
  SessionStatus,
  Sex,
  SleepRecord,
  Target,
  TargetId,
  TargetKind,
  TargetMap,
  Timestamp,
  VitalInput,
  VitalSample,
  VitalsConnection,
  WaterEntry,
} from './types'
export { metricIds, targetIds } from './types'

// Reading
export {
  useActiveProfile,
  useProfiles,
  useMission,
  useToday,
  useDay,
  useSeries,
  useMeals,
  useWater,
  useExerciseSessions,
  useMoodCheckins,
  useSleep,
  useLatestVitals,
  useAlerts,
  useTargets,
  useFoods,
  useHealthSummary,
  type LatestVitals,
} from './selectors'

// Writing
export {
  addMeal,
  removeMeal,
  addWater,
  removeWater,
  setSessionStatus,
  logGameMinutes,
  addMoodCheckin,
  updateMoodCheckin,
  addSleep,
  addBodyMass,
  pushVital,
  raiseAlert,
  cancelAlert,
  acknowledgeAlert,
  createProfile,
  updateProfile,
  setActiveProfile,
  deleteProfileData,
  resetDemoProfile,
} from './store'

// Level rules, shared vocabulary helpers and plain facts
export { levelFor, expectedShare, worstLevel } from './levels'
export { moodWord } from './compute'
export { toDateString, addDays } from './dates'

// Sensors and sync
export { startSimulator, stopSimulator } from './simulator'
export {
  connectHeartRateSensor,
  disconnectHeartRateSensor,
  type SensorResult,
} from './sources/bluetoothHeartRate'
export { joinRoom, createRoom, leaveRoom, useRoom, type RoomState } from './sources/relay'
export type { RoomConnection } from './runtime'
export { importHealthExport, type HealthImportResult } from './sources/healthImport'

import { installSimulator } from './simulator'
import { installRelay } from './sources/relay'

// In the browser, the demo profile's simulator and the watch relay follow the store by themselves.
if (typeof window !== 'undefined' && import.meta.env.MODE !== 'test') {
  installSimulator()
  installRelay()
}

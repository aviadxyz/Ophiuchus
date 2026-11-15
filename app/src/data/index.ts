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

// ---- Crew network (lane 17, CONTRACTS section 9 "Social") ----------------------------------
export type {
  ChatMessage,
  FriendRequests,
  JoinResult,
  SendResult,
  SharedMood,
  SocialAccount,
  SocialAccountState,
  SocialConnection,
  SocialPerson,
  SocialRelation,
  SocialWriteResult,
} from './social'
export {
  useSocialAccount,
  useSocialSearch,
  useFriends,
  useFriendRequests,
  useConversation,
  useMySharedMood,
  joinSocial,
  leaveSocial,
  setShareMood,
  sendFriendRequest,
  cancelFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
  sendChatMessage,
  markConversationRead,
} from './social'
// ---- Crew challenges (prompt 26, CONTRACTS section 9) ----
export type {
  ChallengeBoard,
  ChallengeBoards,
  ChallengeEntry,
  ChallengeId,
  ChallengeJoinResult,
} from './social'
export { useChallenges, setChallengeJoined } from './social'
// ---- End crew challenges ----
// ---- End crew network -----------------------------------------------------------------------
// --- Automatic alerts (CONTRACTS section 9, built by lane 18) ---
export {
  useAutoAlert,
  setFallDetection,
  setVitalsWatch,
  cancelAutoAlert,
  simulateAutoAlert,
  setSleepingNow,
} from './autoAlert'
import { installAutoAlert } from './autoAlert'
if (typeof window !== 'undefined' && import.meta.env.MODE !== 'test') installAutoAlert()
// --- end of automatic alerts ---
// --- This device (prompt 21, CONTRACTS section 9 "This device") ---
export { useDevice, completeDeviceSetup, resetDeviceSetup } from './device'
export type { DeviceKind, DeviceState } from './device'
// --- end of this device ---
// --- Station environment (prompt 25, CONTRACTS section 9) ---
export { useEnvironment, useEnvironmentSeries, environmentAt } from './environment'
export { environmentMetricIds, environmentTargetIds } from './types'
export type {
  EnvironmentMetricId,
  EnvironmentPoint,
  EnvironmentSample,
  EnvironmentTargetId,
} from './types'
// --- end of station environment ---
// --- Ground sharing (prompt 28, CONTRACTS sections 8, 9 and 11) ---
export type {
  GroundAlert,
  GroundReport,
  GroundShare,
  GroundShareState,
  GroundView,
  GroundViewState,
  GroundWeekMetric,
} from './ground'
export {
  closeGroundView,
  openGroundView,
  openSimulatedGroundView,
  setGroundShare,
  useGroundShare,
  useGroundView,
} from './ground'
import { installGround, installGroundView } from './ground'
if (typeof window !== 'undefined' && import.meta.env.MODE !== 'test') {
  installGround()
  installGroundView()
}
// --- end of ground sharing ---

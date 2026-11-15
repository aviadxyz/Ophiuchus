// The crew network's public names (CONTRACTS sections 8 and 9, "Social"). Re-exported from
// `@/data`. The token, the store and the network client stay inside this folder.

import { installSocial } from './background'
import { installChallenges } from './challenges'

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
} from './types'

export {
  useSocialAccount,
  useSocialSearch,
  useFriends,
  useFriendRequests,
  useConversation,
  useMySharedMood,
} from './hooks'

export {
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
} from './actions'

// Crew challenges (prompt 26).
export type {
  ChallengeBoard,
  ChallengeBoards,
  ChallengeEntry,
  ChallengeId,
  ChallengeJoinResult,
} from './challenges'
export { useChallenges, setChallengeJoined } from './challenges'

// Mood sharing, profile deletion and the demo reset follow the main store by themselves.
installSocial()
installChallenges()

export interface DurableObjectId {
  toString(): string
}

export interface DurableObjectStub {
  fetch(request: Request | string, init?: RequestInit): Promise<Response>
}

export interface SqlStorageCursor {
  toArray(): Record<string, unknown>[]
  one(): Record<string, unknown> | null
}

export interface SqlStorage {
  exec(query: string, ...bindings: unknown[]): SqlStorageCursor
}

export interface DurableObjectStorage {
  sql: SqlStorage
  get<T = unknown>(key: string): Promise<T | undefined>
  put<T = unknown>(key: string, value: T): Promise<void>
}

export interface DurableObjectContext {
  storage: DurableObjectStorage
  blockConcurrencyWhile<T>(callback: () => Promise<T>): Promise<T>
}

export interface Env {
  ASSETS: {
    fetch: (request: Request | string) => Promise<Response>
  }
  AI?: {
    run: (model: string, options: Record<string, unknown>) => Promise<unknown>
  }
  ROOM_DO: {
    idFromName: (name: string) => DurableObjectId
    get: (id: DurableObjectId) => DurableObjectStub
  }
  CREW_DO: {
    idFromName: (name: string) => DurableObjectId
    get: (id: DurableObjectId) => DurableObjectStub
  }
  CHAT_MODEL?: string
}

export interface ChatRequestBody {
  message: string
  screenId?: string
  screenLabel?: string
  context: string
  replyMode?: 'standard' | 'watch'
}

/** One passage from the team's research database, as shown under a Med bot reply. */
export interface ChatSource {
  title: string
  url: string
  /** Word for word from the research database. */
  quote: string
}

export interface ChatResponseBody {
  reply: string
  urgent: boolean
  forward: boolean
  /** The passages given to the model. Empty when nothing matched, in watch mode, and when urgent. */
  sources: ChatSource[]
}

export type RelayType =
  | 'emergency.raised'
  | 'emergency.cancelled'
  | 'emergency.acknowledged'
  | 'vitals.sample'
  | 'summary.updated'

export interface RelayEventMessage {
  id: string
  room: string
  type: RelayType
  at: string
  origin: 'console' | 'watch'
  payload: Record<string, unknown>
}

export interface EventsPostResponse {
  ok: boolean
  id: string
}

export interface EventsGetResponse {
  events: RelayEventMessage[]
  cursor: string
}

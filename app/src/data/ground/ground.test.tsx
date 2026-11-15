// Ground sharing and the ground view (prompt 28). The network is a fake `fetch` that records
// every request. People here are the demo profile or an invented test member; the ground code is
// made fresh for each run.

import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { config } from '@/config'
import { foods } from '../foods'
import { worstLevel } from '../levels'
import { clearMemoryStorage, STORE_KEY } from '../persistence'
import { useRuntime } from '../runtime'
import { SIMULATED_CREW } from '../social/simulatedCrew'
import {
  addBodyMass,
  addMeal,
  addMoodCheckin,
  addSleep,
  addWater,
  createProfile,
  deleteProfileData,
  raiseAlert,
  resetStoreForTests,
  setActiveProfile,
  useDataStore,
} from '../store'
import { toDateString } from '../dates'
import { buildGroundReport } from './report'
import {
  pushGround,
  resetGroundShareForTests,
  setGroundShare,
  useGroundShare,
  useGroundShareRuntime,
} from './share'
import {
  closeGroundView,
  holdsGroundCodeForTests,
  openGroundView,
  openSimulatedGroundView,
  useGroundView,
  useGroundViewStore,
} from './view'

vi.mock('@/config', () => ({
  config: { chatUrl: '', eventsUrl: '', socialUrl: '', groundUrl: 'https://ground.test' },
}))

const mutableConfig = config as { groundUrl: string }

type Recorded = { url: string; method: string; headers: Record<string, string>; body: unknown }

const REPORT_FIELDS = [
  'alerts',
  'displayName',
  'kind',
  'missionDay',
  'reportId',
  'role',
  'sentAt',
  'summary',
  'today',
  'vitals',
  'week',
]

let requests: Recorded[]
let reply: (request: Recorded) => { status: number; body: unknown } | 'network-error'

function fakeFetch(): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = Object.fromEntries(new Headers(init?.headers).entries())
    const recorded: Recorded = {
      url: String(input),
      method: init?.method ?? 'GET',
      headers,
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    }
    requests.push(recorded)
    const answer = reply(recorded)
    if (answer === 'network-error') throw new TypeError('Failed to fetch')
    return new Response(JSON.stringify(answer.body), { status: answer.status })
  }) as unknown as typeof fetch
}

function newMember(details: Parameters<typeof createProfile>[0] = { displayName: 'Test member' }) {
  const id = createProfile(details)
  setActiveProfile(id)
  return id
}

const posts = () => requests.filter((r) => r.method === 'POST')

beforeEach(() => {
  localStorage.clear()
  clearMemoryStorage()
  resetStoreForTests()
  resetGroundShareForTests()
  closeGroundView()
  mutableConfig.groundUrl = 'https://ground.test'
  requests = []
  reply = () => ({ status: 200, body: { ok: true } })
  vi.stubGlobal('fetch', fakeFetch())
})

afterEach(() => {
  closeGroundView()
  resetGroundShareForTests()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('sending a report', () => {
  it('sends nothing for a profile with sharing off', async () => {
    newMember()
    addWater(300)
    raiseAlert('health', 'console', 'A test question', 'medbot')
    await pushGround({ force: true })
    expect(requests).toHaveLength(0)
    expect(useDataStore.getState().groundShare).toEqual({})
  })

  it('sends only reportId, key and a report with the contract fields', async () => {
    newMember({ displayName: 'Test member', birthYear: 1971, massKg: 77.7, heightCm: 180 })
    addMoodCheckin(4, ['Calm'], 'a private test note')
    addMeal(foods[0]!.id, 2)
    addBodyMass(78.4)
    addSleep(toDateString(new Date()), 7)

    await setGroundShare(true)

    expect(posts()).toHaveLength(1)
    const request = posts()[0]!
    expect(request.url).toBe('https://ground.test/api/ground/report')
    expect(request.headers.authorization).toBeUndefined()
    const body = request.body as Record<string, unknown>
    expect(Object.keys(body).sort()).toEqual(['key', 'report', 'reportId'])
    expect(body.reportId).toMatch(/^[A-Za-z0-9-]{16,64}$/)
    expect(body.key).toMatch(/^[A-Za-z0-9-]{16,64}$/)

    const report = body.report as Record<string, unknown>
    expect(Object.keys(report).sort()).toEqual(REPORT_FIELDS)
    expect(report.kind).toBe('member')
    expect(Object.keys(report.week as object).sort()).toEqual([
      'energyKcal',
      'exerciseMinutes',
      'moodScore',
      'sleepHours',
      'waterMl',
    ])
    const text = JSON.stringify(report)
    expect(text).not.toContain('a private test note')
    expect(text).not.toContain('"note"')
    expect(text).not.toContain(foods[0]!.id)
    expect(text).not.toContain('portions')
    expect(text).not.toContain('1971')
    expect(text).not.toContain('birthYear')
    expect(text).not.toContain('massKg')
    expect(text).not.toContain('78.4')
    expect(text).not.toContain('77.7')
    expect((report.today as Record<string, { value: unknown }>).bodyMassKg?.value).toBeNull()
    // Every value keeps its own source.
    expect((report.today as Record<string, { source: unknown }>).sleepHours?.source).toBe('entered')
  })

  it('keeps missing values missing', () => {
    const id = newMember()
    const report = buildGroundReport(id, 'test-report-0000001')!
    expect(report.today.waterMl).toMatchObject({ value: null, level: 'none', source: null })
    expect(report.week.sleepHours.every((p) => p.value === null && p.source === null)).toBe(true)
    expect(report.vitals).toBeNull()
  })

  it('sends a changed report at most once a minute', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
    vi.setSystemTime(new Date('2026-11-16T10:00:00'))
    newMember()
    await setGroundShare(true)
    addWater(250)
    await pushGround()
    expect(posts()).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(posts()).toHaveLength(2)
    // Nothing changed since: nothing more is sent.
    await pushGround()
    expect(posts()).toHaveLength(2)
  })

  it('marks a failed send and tries again', async () => {
    newMember()
    reply = () => 'network-error'
    await setGroundShare(true)
    const { result } = renderHook(() => useGroundShare())
    expect(result.current).toMatchObject({ on: true, state: 'failed', lastSentAt: null })
  })

  it('shows the state of the last send', async () => {
    newMember()
    const { result } = renderHook(() => useGroundShare())
    expect(result.current).toEqual({ on: false, state: 'off', lastSentAt: null })
    await act(() => setGroundShare(true))
    expect(result.current.on).toBe(true)
    expect(result.current.state).toBe('sent')
    expect(result.current.lastSentAt).not.toBeNull()
  })

  it('sends remove when switched off, and only then forgets the ids', async () => {
    const id = newMember()
    await setGroundShare(true)
    const { reportId, key } = useDataStore.getState().groundShare[id]!
    await setGroundShare(false)
    const last = posts().at(-1)!
    expect(last.body).toEqual({ reportId, key, remove: true })
    expect(useDataStore.getState().groundShare[id]).toBeUndefined()
  })

  it('keeps the ids and tries again when the remove fails', async () => {
    const id = newMember()
    await setGroundShare(true)
    reply = () => 'network-error'
    await setGroundShare(false)
    expect(useDataStore.getState().groundShare[id]).toMatchObject({ on: false })
    reply = () => ({ status: 200, body: { ok: true } })
    await pushGround()
    expect(useDataStore.getState().groundShare[id]).toBeUndefined()
    expect((posts().at(-1)!.body as Record<string, unknown>).remove).toBe(true)
  })

  it('removes the report when the profile is deleted', async () => {
    const id = newMember()
    await setGroundShare(true)
    const { reportId } = useDataStore.getState().groundShare[id]!
    deleteProfileData(id)
    await pushGround()
    expect(posts().at(-1)!.body).toMatchObject({ reportId, remove: true })
    expect(useDataStore.getState().groundShare[id]).toBeUndefined()
  })

  it('never carries the setting over to another profile', async () => {
    newMember()
    await setGroundShare(true)
    const other = newMember({ displayName: 'Second test member' })
    const { result } = renderHook(() => useGroundShare())
    expect(result.current.on).toBe(false)
    const before = posts().length
    await pushGround({ force: true })
    expect(posts()).toHaveLength(before)
    expect(useDataStore.getState().groundShare[other]).toBeUndefined()
  })

  it('makes no request at all for the demo profile', async () => {
    expect(useDataStore.getState().activeProfileId).toBe('demo')
    await setGroundShare(true)
    await pushGround({ force: true })
    const { result } = renderHook(() => useGroundShare())
    expect(result.current.on).toBe(true)
    await setGroundShare(false)
    openSimulatedGroundView()
    expect(requests).toHaveLength(0)
  })

  it('explains a failure when no server is set, and sends nothing', async () => {
    mutableConfig.groundUrl = ''
    newMember()
    await setGroundShare(true)
    const { result } = renderHook(() => useGroundShare())
    expect(result.current).toMatchObject({ on: true, state: 'failed' })
    expect(requests).toHaveLength(0)
  })
})

describe('saved data', () => {
  it('loads data saved before ground sharing existed, with sharing off', async () => {
    // Something in memory that the old saved data must replace.
    useDataStore.setState({
      groundShare: { demo: { on: true, reportId: 'x'.repeat(20), key: 'y'.repeat(20) } },
    })
    localStorage.setItem(
      STORE_KEY,
      JSON.stringify({
        state: {
          profiles: useDataStore.getState().profiles,
          activeProfileId: 'demo',
          data: useDataStore.getState().data,
          alerts: [],
          room: null,
          demoSeededOn: toDateString(new Date()),
        },
        version: 1,
      }),
    )
    await useDataStore.persist.rehydrate()
    expect(useDataStore.getState().groundShare).toEqual({})
    const { result } = renderHook(() => useGroundShare())
    expect(result.current).toEqual({ on: false, state: 'off', lastSentAt: null })
  })
})

describe('the ground view', () => {
  const freshCode = () => `test-${crypto.randomUUID()}`

  it.each([
    [200, 'open'],
    [401, 'wrong-code'],
    [503, 'not-set-up'],
    [500, 'offline'],
    [404, 'offline'],
  ] as const)('maps status %i to %s', async (status, state) => {
    reply = () => ({ status, body: status === 200 ? { reports: [] } : { error: 'x' } })
    await openGroundView(freshCode())
    expect(useGroundViewStore.getState().state).toBe(state)
  })

  it('is offline when the server cannot be reached or no server is set', async () => {
    reply = () => 'network-error'
    await openGroundView(freshCode())
    expect(useGroundViewStore.getState().state).toBe('offline')
    mutableConfig.groundUrl = ''
    requests = []
    await openGroundView(freshCode())
    expect(useGroundViewStore.getState().state).toBe('offline')
    expect(requests).toHaveLength(0)
  })

  it('sends the code only in the Authorization header and keeps it out of every store', async () => {
    const code = freshCode()
    reply = () => ({ status: 200, body: { reports: [] } })
    await openGroundView(code)
    expect(requests).toHaveLength(1)
    const request = requests[0]!
    expect(request.method).toBe('GET')
    expect(request.url).toBe('https://ground.test/api/ground/reports')
    expect(request.url).not.toContain(code)
    expect(request.body).toBeUndefined()
    expect(request.headers.authorization).toBe(`Bearer ${code}`)

    const everything = JSON.stringify([
      useDataStore.getState(),
      useGroundViewStore.getState(),
      useGroundShareRuntime.getState(),
      useRuntime.getState(),
      Object.entries(localStorage),
      Object.entries(sessionStorage),
    ])
    expect(everything).not.toContain(code)
    expect(holdsGroundCodeForTests()).toBe(true)
    closeGroundView()
    expect(holdsGroundCodeForTests()).toBe(false)
    expect(useGroundViewStore.getState()).toEqual({
      state: 'closed',
      mode: 'live',
      reports: [],
      fetchedAt: null,
    })
  })

  it('forgets a wrong code', async () => {
    reply = () => ({ status: 401, body: { error: 'unauthorized' } })
    await openGroundView(freshCode())
    expect(holdsGroundCodeForTests()).toBe(false)
  })

  it('shows the reports it receives, the worst first, and drops a malformed one', async () => {
    const id = newMember()
    const sent = buildGroundReport(id, 'test-report-0000001')!
    const late = { ...sent, reportId: 'test-report-0000002', displayName: 'Test late' }
    const worse = {
      ...sent,
      reportId: 'test-report-0000003',
      displayName: 'Test worse',
      summary: { ...sent.summary, sleep: { ...sent.summary.sleep, level: 'act' } },
    }
    reply = () => ({
      status: 200,
      body: {
        reports: [
          { ...late, receivedAt: '2026-11-16T08:00:00.000Z' },
          { ...worse, receivedAt: '2026-11-16T07:00:00.000Z' },
          { ...sent, receivedAt: '2026-11-16T09:00:00.000Z' },
          { displayName: 'Broken' },
        ],
      },
    })
    await openGroundView(freshCode())
    const { result } = renderHook(() => useGroundView())
    expect(result.current.mode).toBe('live')
    expect(result.current.reports.map((r) => r.displayName)).toEqual([
      'Test worse',
      'Test member',
      'Test late',
    ])
    expect(result.current.fetchedAt).not.toBeNull()
  })

  it('fetches again every 30 seconds while open', async () => {
    vi.useFakeTimers({
      toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    })
    reply = () => ({ status: 200, body: { reports: [] } })
    await openGroundView(freshCode())
    expect(requests).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(30_000)
    expect(requests).toHaveLength(2)
    closeGroundView()
    await vi.advanceTimersByTimeAsync(90_000)
    expect(requests).toHaveLength(2)
  })
})

describe('the simulated ground view', () => {
  it('shows every simulated crew member, one act and two watch, with no request', () => {
    openSimulatedGroundView()
    const view = useGroundViewStore.getState()
    expect(view).toMatchObject({ state: 'open', mode: 'simulated' })
    expect(view.reports).toHaveLength(SIMULATED_CREW.length)
    const level = (r: (typeof view.reports)[number]) =>
      worstLevel(
        ['sleep', 'food', 'water', 'exercise', 'mood'].map((k) => r.summary[k as 'sleep'].level),
      )
    const levels = view.reports.map(level)
    expect(levels.filter((l) => l === 'act')).toHaveLength(1)
    expect(levels.filter((l) => l === 'watch')).toHaveLength(2)
    expect(levels.filter((l) => l === 'ok')).toHaveLength(SIMULATED_CREW.length - 3)
    // The worst first.
    expect(levels[0]).toBe('act')
    expect(requests).toHaveLength(0)
  })

  it('marks every report demo and every value simulated, with different report ages', () => {
    openSimulatedGroundView()
    const { reports } = useGroundViewStore.getState()
    for (const report of reports) {
      expect(report.kind).toBe('demo')
      const sources = JSON.stringify(report).match(/"source":"[a-z]+"/g) ?? []
      expect(sources.length).toBeGreaterThan(0)
      expect(new Set(sources)).toEqual(new Set(['"source":"simulated"']))
      expect(new Date(report.receivedAt).getTime()).toBeLessThanOrEqual(Date.now())
    }
    const ages = reports.map((r) => (Date.now() - new Date(r.sentAt).getTime()) / 60_000)
    expect(Math.min(...ages)).toBeLessThan(15)
    expect(ages.some((a) => a > 60 && a < 120)).toBe(true)
    expect(ages.some((a) => a > 8 * 60 && a < 10 * 60)).toBe(true)
  })

  it('is the same on every device at the same minute', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-16T15:30:10Z'))
    openSimulatedGroundView()
    const first = JSON.stringify(useGroundViewStore.getState().reports)
    vi.setSystemTime(new Date('2026-11-16T15:30:50Z'))
    openSimulatedGroundView()
    expect(JSON.stringify(useGroundViewStore.getState().reports)).toBe(first)
  })

  it('adds the demo profile’s own report when its sharing is on', async () => {
    await setGroundShare(true)
    openSimulatedGroundView()
    const { reports } = useGroundViewStore.getState()
    expect(reports).toHaveLength(SIMULATED_CREW.length + 1)
    const own = reports.find(
      (r) => r.displayName === useDataStore.getState().profiles[0]!.displayName,
    )!
    expect(own.kind).toBe('demo')
    expect(JSON.stringify(own)).not.toContain('"source":"entered"')
    expect(requests).toHaveLength(0)
  })
})

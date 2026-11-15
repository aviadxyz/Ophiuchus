import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  completeDeviceSetup,
  DEVICE_KEY,
  deviceKindFor,
  resetDeviceSetup,
  useDevice,
} from './device'

function setWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width })
  window.dispatchEvent(new Event('resize'))
}

describe('device kind', () => {
  const startWidth = window.innerWidth
  afterEach(() => {
    setWidth(startWidth)
    window.history.replaceState({}, '', '/')
  })

  it('is a computer at 1440 px, a phone at 360 px and a watch on /w', () => {
    expect(deviceKindFor('/overview', 1440)).toBe('computer')
    expect(deviceKindFor('/overview', 640)).toBe('computer')
    expect(deviceKindFor('/overview', 639)).toBe('phone')
    expect(deviceKindFor('/overview', 360)).toBe('phone')
    expect(deviceKindFor('/w', 360)).toBe('watch')
    expect(deviceKindFor('/w', 1440)).toBe('watch')
  })

  it('follows the window as it is resized', () => {
    window.history.replaceState({}, '', '/overview')
    setWidth(1440)
    const { result } = renderHook(() => useDevice())
    expect(result.current.kind).toBe('computer')
    act(() => setWidth(360))
    expect(result.current.kind).toBe('phone')
    act(() => setWidth(800))
    expect(result.current.kind).toBe('computer')
  })

  it('is a watch on the watch route, whatever the width', () => {
    window.history.replaceState({}, '', '/w')
    setWidth(1440)
    const { result } = renderHook(() => useDevice())
    expect(result.current.kind).toBe('watch')
  })
})

describe('device setup', () => {
  beforeEach(() => {
    act(() => resetDeviceSetup())
  })

  it('starts not done, is remembered under the ophiuchus:v1: prefix, and can be reset', () => {
    const { result } = renderHook(() => useDevice())
    expect(result.current.setupDone).toBe(false)
    act(() => completeDeviceSetup())
    expect(result.current.setupDone).toBe(true)
    expect(DEVICE_KEY.startsWith('ophiuchus:v1:')).toBe(true)
    expect(JSON.parse(localStorage.getItem(DEVICE_KEY) ?? '{}')).toMatchObject({
      state: { setupDone: true },
    })
    act(() => resetDeviceSetup())
    expect(result.current.setupDone).toBe(false)
  })
})

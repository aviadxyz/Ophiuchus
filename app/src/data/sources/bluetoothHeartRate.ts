// Heart rate from a Bluetooth sensor, in the browser, with Web Bluetooth. Source `live`.
//
// The device is found by the standard Heart Rate service and read from the standard Heart Rate
// Measurement characteristic, named `heart_rate` and `heart_rate_measurement` in Web Bluetooth
// (the Bluetooth SIG Heart Rate Service, assigned number 0x2A37 for the measurement). The value
// layout, from the SIG Heart Rate Service specification, section 3.1:
//   byte 0   flags. Bit 0: 0 means the heart rate is one byte, 1 means two bytes.
//            Bit 1: sensor contact detected (meaningful only when bit 2 is set).
//            Bit 2: the sensor supports contact detection.
//            Bit 3: an Energy Expended field follows. Bit 4: RR-Interval values follow.
//   next     the heart rate, one byte or two (bit 0), least significant byte first.
// The energy and RR fields come after it and are not read here.

import { setRuntime, useRuntime } from '../runtime'
import { getActiveProfile, pushVital, useDataStore } from '../store'

const SERVICE = 'heart_rate'
const CHARACTERISTIC = 'heart_rate_measurement'
const RECONNECT_DELAY_MS = 1500

export type SensorResult =
  | { ok: true; deviceName?: string }
  | {
      ok: false
      reason: 'unsupported' | 'demo' | 'cancelled' | 'failed'
      message: string
    }

// The parts of Web Bluetooth used here. TypeScript's DOM types do not include it.
type Characteristic = EventTarget & {
  value?: DataView
  startNotifications(): Promise<Characteristic>
  stopNotifications(): Promise<Characteristic>
}
type Service = { getCharacteristic(name: string): Promise<Characteristic> }
type GattServer = {
  connected: boolean
  connect(): Promise<GattServer>
  disconnect(): void
  getPrimaryService(name: string): Promise<Service>
}
type Device = EventTarget & { name?: string; gatt?: GattServer }
type BluetoothApi = {
  requestDevice(options: { filters: { services: string[] }[] }): Promise<Device>
}

function bluetoothApi(): BluetoothApi | undefined {
  if (typeof navigator === 'undefined') return undefined
  return (navigator as Navigator & { bluetooth?: BluetoothApi }).bluetooth
}

/** Reads a Heart Rate Measurement value. Returns null when it holds no usable heart rate. */
export function parseHeartRateMeasurement(view: DataView): number | null {
  if (view.byteLength < 2) return null
  const flags = view.getUint8(0)
  const sixteenBit = (flags & 0x01) !== 0
  const contactSupported = (flags & 0x04) !== 0
  const contactDetected = (flags & 0x02) !== 0
  if (sixteenBit && view.byteLength < 3) return null
  if (contactSupported && !contactDetected) return null
  const value = sixteenBit ? view.getUint16(1, true) : view.getUint8(1)
  return value > 0 ? value : null
}

let device: Device | undefined
let characteristic: Characteristic | undefined
let boundProfileId: string | undefined
let wantConnected = false
let reconnectTimer: ReturnType<typeof setTimeout> | undefined
let unsubscribeStore: (() => void) | undefined

function onValue(event: Event) {
  const view = (event.target as Characteristic | null)?.value
  const profileId = boundProfileId
  if (!view || !profileId) return
  const heartRate = parseHeartRateMeasurement(view)
  if (heartRate !== null) pushVital({ profileId, heartRate, source: 'live' })
}

function onDisconnected() {
  characteristic = undefined
  setRuntime({ sensor: null })
  if (!wantConnected || !device) return
  // One automatic try to reconnect. If it fails the connection stays off.
  wantConnected = false
  const lost = device
  const profileId = boundProfileId
  reconnectTimer = setTimeout(() => {
    void attach(lost, profileId, true).catch(() => setRuntime({ sensor: null }))
  }, RECONNECT_DELAY_MS)
}

async function attach(target: Device, profileId: string | undefined, isRetry: boolean) {
  const server = await target.gatt?.connect()
  if (!server) throw new Error('This sensor cannot be read.')
  const service = await server.getPrimaryService(SERVICE)
  const found = await service.getCharacteristic(CHARACTERISTIC)
  await found.startNotifications()
  found.addEventListener('characteristicvaluechanged', onValue)
  characteristic = found
  device = target
  boundProfileId = profileId
  wantConnected = true
  setRuntime({
    sensor: {
      profileId: profileId ?? '',
      status: 'connected',
      ...(target.name ? { deviceName: target.name } : {}),
    },
  })
  if (!isRetry) target.addEventListener('gattserverdisconnected', onDisconnected)
}

function watchForDeletedProfile() {
  unsubscribeStore?.()
  unsubscribeStore = useDataStore.subscribe((state) => {
    if (boundProfileId && !state.profiles.some((p) => p.id === boundProfileId)) {
      disconnectHeartRateSensor()
    }
  })
}

/**
 * Asks the browser for a heart-rate sensor and starts reading it into the active member profile.
 * Never throws: the result says what happened and, when it failed, why in plain words.
 */
export async function connectHeartRateSensor(): Promise<SensorResult> {
  const profile = getActiveProfile()
  if (profile.kind === 'demo') {
    return {
      ok: false,
      reason: 'demo',
      message:
        'The demo profile uses simulated readings. Switch to your own profile to connect a sensor.',
    }
  }
  const api = bluetoothApi()
  if (!api) {
    return {
      ok: false,
      reason: 'unsupported',
      message:
        'This browser cannot connect to Bluetooth sensors. Use Chrome or Edge on a laptop or Android, or send readings from a watch.',
    }
  }
  disconnectHeartRateSensor()
  setRuntime({ sensor: { profileId: profile.id, status: 'connecting' } })
  let chosen: Device
  try {
    chosen = await api.requestDevice({ filters: [{ services: [SERVICE] }] })
  } catch (error) {
    setRuntime({ sensor: null })
    const name = error instanceof Error ? error.name : ''
    if (name === 'NotFoundError') {
      return { ok: false, reason: 'cancelled', message: 'No sensor was chosen.' }
    }
    return {
      ok: false,
      reason: 'failed',
      message: 'Bluetooth is not available or is blocked for this page.',
    }
  }
  try {
    await attach(chosen, profile.id, false)
    watchForDeletedProfile()
    return { ok: true, ...(chosen.name ? { deviceName: chosen.name } : {}) }
  } catch {
    wantConnected = false
    setRuntime({ sensor: null })
    return {
      ok: false,
      reason: 'failed',
      message:
        'Could not read heart rate from that device. Check that it is broadcasting heart rate, then try again.',
    }
  }
}

export function disconnectHeartRateSensor(): void {
  wantConnected = false
  if (reconnectTimer !== undefined) clearTimeout(reconnectTimer)
  reconnectTimer = undefined
  unsubscribeStore?.()
  unsubscribeStore = undefined
  characteristic?.removeEventListener('characteristicvaluechanged', onValue)
  characteristic?.stopNotifications().catch(() => undefined)
  characteristic = undefined
  try {
    if (device?.gatt?.connected) device.gatt.disconnect()
  } catch {
    // Already gone.
  }
  device?.removeEventListener('gattserverdisconnected', onDisconnected)
  device = undefined
  boundProfileId = undefined
  if (useRuntime.getState().sensor) setRuntime({ sensor: null })
}

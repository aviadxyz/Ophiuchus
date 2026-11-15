import { useState } from 'react'
import { Copy, Check, Watch as WatchIcon } from 'lucide-react'
import {
  Button,
  Card,
  ChipGroup,
  ScreenHeader,
  StatusPill,
  TextField,
} from '@/design'
import { createRoom, joinRoom, leaveRoom, useRoom } from '@/data'
import { WatchApp } from '@/watch'
import { meta } from './meta'

export default function WatchScreen() {
  const { code } = useRoom()
  const [shape, setShape] = useState<'round' | 'square'>('round')
  const [inputCode, setInputCode] = useState('')
  const [inputError, setInputError] = useState<string | undefined>(undefined)
  const [copied, setCopied] = useState(false)

  const handlePair = () => {
    setInputError(undefined)
    const trimmed = inputCode.trim()
    if (!trimmed) {
      setInputError('Enter a 6-character pairing code')
      return
    }
    const success = joinRoom(trimmed)
    if (!success) {
      setInputError('Invalid pairing code. Must be 6 letters or digits.')
    } else {
      setInputCode('')
    }
  }

  const handleCreateCode = () => {
    createRoom()
    setInputError(undefined)
  }

  const fullWatchUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/w?room=${code ?? ''}`
      : `/w?room=${code ?? ''}`

  const handleCopyUrl = async () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(fullWatchUrl)
        setCopied(true)
        setTimeout(() => setCopied(false), 2500)
      } catch {
        // clipboard write error
      }
    }
  }

  return (
    <>
      <ScreenHeader
        eyebrow={meta.eyebrow}
        title={meta.label}
        description={meta.description}
        pills={[
          {
            tone: code ? 'ok' : 'neutral',
            label: code ? `PAIRED · ${code}` : 'NOT PAIRED',
          },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Drawn Watch Frame */}
        <div className="lg:col-span-6 flex flex-col items-center">
          {/* Shape Toggle */}
          <div className="mb-4">
            <ChipGroup
              options={[
                { value: 'round', label: 'Round Bezel' },
                { value: 'square', label: 'Square Bezel' },
              ]}
              selected={[shape]}
              onChange={(val) => {
                if (val[0]) setShape(val[0] as 'round' | 'square')
              }}
            />
          </div>

          {/* Drawn Watch Body */}
          <div className="flex flex-col items-center justify-center p-4">
            {/* Top Strap */}
            <div className="w-28 sm:w-36 h-12 bg-surface-raised border-x border-t border-border rounded-t-xl relative overflow-hidden shadow-inner">
              <div className="absolute inset-x-0 bottom-0 h-1 bg-border/40" />
              <div className="size-full flex items-center justify-center">
                <div className="w-16 h-1 bg-border/30 rounded-full" />
              </div>
            </div>

            {/* Watch Case / Bezel */}
            <div
              className={`relative flex items-center justify-center bg-surface border-4 border-border shadow-2xl p-3 transition-all duration-300 ${
                shape === 'round'
                  ? 'size-[260px] sm:size-[300px] rounded-full'
                  : 'size-[260px] sm:size-[300px] rounded-[38px]'
              }`}
            >
              {/* Crown / Button on right side */}
              <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-2 h-7 bg-border rounded-r-md border border-border shadow-md" />

              {/* Watch Screen Canvas */}
              <WatchApp round={shape === 'round'} className="size-full" />
            </div>

            {/* Bottom Strap */}
            <div className="w-28 sm:w-36 h-12 bg-surface-raised border-x border-b border-border rounded-b-xl relative overflow-hidden shadow-inner">
              <div className="absolute inset-x-0 top-0 h-1 bg-border/40" />
              <div className="size-full flex items-center justify-center">
                <div className="w-16 h-1 bg-border/30 rounded-full" />
              </div>
            </div>
          </div>

          <p className="mt-2 text-xs text-text-muted text-center max-w-xs">
            Swipe left/right or use arrow keys to navigate pages on the watch.
          </p>
        </div>

        {/* Right Column: Pairing & Explanatory Cards */}
        <div className="lg:col-span-6 flex flex-col gap-6">
          {/* Card: Pair a watch */}
          <Card title="Pair a watch">
            <div className="flex flex-col gap-5">
              {code ? (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-surface-raised">
                    <div className="flex flex-col">
                      <span className="text-xs text-text-muted">Room Code</span>
                      <span className="font-mono text-xl font-bold tracking-widest text-text">
                        {code}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusPill tone="ok" label="PAIRED" />
                      <Button variant="quiet" onClick={leaveRoom}>
                        Unpair
                      </Button>
                    </div>
                  </div>

                  {/* Open on another device section */}
                  <div className="flex flex-col gap-2 pt-2 border-t border-border">
                    <span className="text-sm font-medium text-text">
                      Open the watch view on another device
                    </span>
                    <p className="m-0 text-xs text-text-secondary">
                      Load this link on your phone, watch browser, or a second tab to sync in real time:
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 truncate rounded border border-border bg-bg px-2.5 py-1.5 font-mono text-xs text-text select-all">
                        {fullWatchUrl}
                      </code>
                      <Button
                        variant="quiet"
                        size="md"
                        icon={copied ? Check : Copy}
                        onClick={handleCopyUrl}
                        aria-label="Copy watch URL"
                      >
                        {copied ? 'Copied' : 'Copy'}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <p className="m-0 text-sm text-text-secondary">
                    Enter the six-character code shown on your physical watch to link vitals and emergency alerts.
                  </p>

                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <TextField
                        label="Pairing code"
                        value={inputCode}
                        onChange={(val) => {
                          setInputCode(val.toUpperCase())
                          setInputError(undefined)
                        }}
                        placeholder="e.g. 7K2M9X"
                        maxLength={6}
                        error={inputError}
                      />
                    </div>
                    <Button variant="primary" onClick={handlePair}>
                      Pair
                    </Button>
                  </div>

                  {/* Open on another device section */}
                  <div className="flex flex-col gap-2 pt-3 border-t border-border">
                    <span className="text-sm font-medium text-text">
                      Open the watch view on another device
                    </span>
                    <p className="m-0 text-xs text-text-secondary">
                      Don't have a code yet? Generate one to pair another browser window or mobile device:
                    </p>
                    <div>
                      <Button variant="quiet" onClick={handleCreateCode}>
                        Create code
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Card: What the watch companion does */}
          <Card title="Wearable companion">
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <WatchIcon className="size-5 shrink-0 text-accent mt-0.5" />
                <p className="m-0 text-sm leading-relaxed text-text-secondary">
                  The Ophiuchus watch app puts vital signs, quick health indicators, and an emergency alert right on the astronaut's wrist. In space, a wrist wearable provides immediate access to health guidance without needing to open the main console. The real companion is a native Wear OS application, while this browser view acts as the reference design and a live testbed.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}

import { useState } from 'react'
import { useRoom } from '@/data'

function getBuildTime(): string {
  const stamped = (import.meta.env as Record<string, string | undefined>).VITE_BUILD_TIME
  const date = new Date(stamped || (typeof document !== 'undefined' ? document.lastModified : ''))
  return Number.isNaN(date.getTime())
    ? 'Build: dev'
    : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function AboutPage() {
  const { code, connection } = useRoom()
  const [imageFailed, setImageFailed] = useState(false)

  return (
    <div className="flex size-full flex-col items-center justify-between py-2 text-center select-none overflow-y-auto px-2">
      {/* Ophi Avatar */}
      <div className="flex flex-col items-center pt-1">
        <div className="size-10 overflow-hidden rounded-full border border-border bg-surface flex items-center justify-center">
          {!imageFailed ? (
            <img
              src="/ophi/ophi-idle-128.png"
              alt="Ophi"
              onError={() => setImageFailed(true)}
              className="size-full object-contain"
            />
          ) : (
            <svg viewBox="0 0 40 40" className="size-8" aria-hidden="true">
              <circle cx="20" cy="20" r="16" fill="#0284c7" />
              <circle cx="20" cy="20" r="12" fill="#0f172a" stroke="#38bdf8" strokeWidth="1" />
              <circle cx="17" cy="18" r="1.5" fill="#f8fafc" />
              <circle cx="23" cy="18" r="1.5" fill="#f8fafc" />
              <path d="M 17 22 Q 20 25 23 22" fill="none" stroke="#fed7aa" strokeWidth="1" />
            </svg>
          )}
        </div>
        <span className="font-bold text-xs tracking-wider uppercase text-text mt-0.5">
          Ophiuchus
        </span>
      </div>

      {/* Main info */}
      <div className="flex flex-col items-center gap-0.5 py-1">
        <span className="text-[10px] text-text-secondary">
          NASA Space Apps Challenge 2026
        </span>
        <span className="text-[9px] text-text-muted">
          Demo. Not a medical device.
        </span>

        {/* Pairing / Connection */}
        <div className="mt-1 flex flex-col items-center font-mono text-[10px]">
          {code ? (
            <>
              <span className="font-bold text-accent tracking-wider">ROOM: {code}</span>
              <span className="text-[9px] text-text-muted uppercase">Link: {connection}</span>
            </>
          ) : (
            <span className="text-text-muted">Not paired ({connection})</span>
          )}
        </div>
      </div>

      {/* Build time */}
      <div className="pb-1 text-[9px] font-mono text-text-muted">
        {getBuildTime()}
      </div>
    </div>
  )
}

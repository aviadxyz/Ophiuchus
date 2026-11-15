import type { OphiState } from './ophiState'

export type OphiStandInProps = {
  state: OphiState
  waving?: boolean
}

/**
 * Shape stand-in for Ophi Tov when bitmap art is unavailable.
 * Drawn from vector shapes: helmet, face, chibi spacesuit, and a friendly green snake.
 * Incorporates state indicators (hint dot, thinking bubble, alert glow, talking expression).
 */
export function OphiStandIn({ state, waving = false }: OphiStandInProps) {
  const isAlert = state === 'alert'
  const isHint = state === 'hint'
  const isThinking = state === 'thinking'
  const isTalking = state === 'talking'

  return (
    <div className="relative size-full select-none" data-testid="ophi-standin">
      <svg
        viewBox="0 0 100 100"
        className="size-full overflow-visible drop-shadow-sm"
        aria-hidden="true"
      >
        <defs>
          {/* Subtle gradient for helmet visor glass */}
          <linearGradient id="ophi-visor-glass" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="100%" stopColor="#090d16" />
          </linearGradient>

          {/* Alert visor gradient */}
          <linearGradient id="ophi-visor-alert" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#b45309" />
          </linearGradient>

          {/* Helmet rim gradient */}
          <linearGradient id="ophi-helmet-rim" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#7dd3fc" />
            <stop offset="100%" stopColor="#0284c7" />
          </linearGradient>
        </defs>

        {/* --- Spacesuit Body --- */}
        <g id="suit">
          {/* Back backpack / life support pack */}
          <rect x="22" y="55" width="56" height="30" rx="8" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="2" />
          
          {/* Legs & boots */}
          <rect x="34" y="80" width="12" height="14" rx="4" fill="#f8fafc" stroke="#94a3b8" strokeWidth="1.5" />
          <rect x="54" y="80" width="12" height="14" rx="4" fill="#f8fafc" stroke="#94a3b8" strokeWidth="1.5" />
          <path d="M 32 91 Q 40 91 46 91 Q 48 94 44 95 L 32 95 Z" fill="#0284c7" />
          <path d="M 54 91 Q 62 91 68 91 Q 70 94 66 95 L 54 95 Z" fill="#0284c7" />

          {/* Torso */}
          <path
            d="M 30 62 C 30 54, 70 54, 70 62 L 68 82 C 68 84, 32 84, 32 82 Z"
            fill="#f8fafc"
            stroke="#94a3b8"
            strokeWidth="2"
          />

          {/* Chest control panel / mission insignia */}
          <rect x="42" y="66" width="16" height="9" rx="2" fill="#0f172a" stroke="#38bdf8" strokeWidth="1" />
          <circle cx="46" cy="70.5" r="1.5" fill="#34d399" />
          <rect x="50" y="69.5" width="5" height="2" rx="1" fill="#38bdf8" />

          {/* Left arm */}
          <path
            d="M 31 62 Q 22 68 25 76 Q 28 78 32 74"
            fill="none"
            stroke="#f8fafc"
            strokeWidth="7"
            strokeLinecap="round"
          />
          <circle cx="26" cy="76" r="4" fill="#0284c7" />

          {/* Right arm - raised in wave */}
          <g className={waving ? 'origin-[68px_60px] animate-bounce' : ''}>
            <path
              d="M 68 62 Q 80 56 82 48"
              fill="none"
              stroke="#f8fafc"
              strokeWidth="7"
              strokeLinecap="round"
            />
            {/* Right mitten */}
            <circle cx="82" cy="47" r="4.5" fill="#0284c7" />
            <circle cx="78" cy="48" r="2" fill="#0284c7" />
          </g>
        </g>

        {/* --- Green Snake (Asclepius / Ophiuchus Serpent) --- */}
        <g id="snake-body">
          {/* Coil wrapping around torso */}
          <path
            d="M 28 74 C 28 80, 48 83, 62 78 C 72 74, 74 66, 68 62 C 64 59, 52 64, 42 63 C 32 62, 28 54, 30 48"
            fill="none"
            stroke="#22c55e"
            strokeWidth="5.5"
            strokeLinecap="round"
          />
          {/* Lighter belly ridge */}
          <path
            d="M 30 75 C 33 79, 48 81, 60 77"
            fill="none"
            stroke="#86efac"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>

        {/* --- Helmet --- */}
        <g id="helmet">
          {/* Outer helmet sphere */}
          <circle
            cx="50"
            cy="38"
            r="28"
            fill="#ffffff"
            stroke="#94a3b8"
            strokeWidth="2"
          />

          {/* Helmet collar / rim */}
          <ellipse
            cx="50"
            cy="56"
            rx="20"
            ry="6"
            fill="url(#ophi-helmet-rim)"
            stroke="#0284c7"
            strokeWidth="1.5"
          />

          {/* Visor opening */}
          <ellipse
            cx="50"
            cy="38"
            rx="22"
            ry="19"
            fill={isAlert ? 'url(#ophi-visor-alert)' : 'url(#ophi-visor-glass)'}
            stroke={isAlert ? '#f59e0b' : '#38bdf8'}
            strokeWidth="2"
          />

          {/* --- Face Inside Helmet --- */}
          <g id="face">
            {/* Skin head */}
            <ellipse cx="50" cy="39" rx="16" ry="14" fill="#fed7aa" />

            {/* Brown hair bangs */}
            <path
              d="M 35 34 C 36 28, 64 28, 65 34 C 61 36, 57 32, 53 35 C 49 32, 45 36, 41 33 C 38 36, 36 35, 35 34 Z"
              fill="#78350f"
            />

            {/* Cheeks blush */}
            <circle cx="40" cy="43" r="2.5" fill="#f472b6" opacity="0.6" />
            <circle cx="60" cy="43" r="2.5" fill="#f472b6" opacity="0.6" />

            {/* Eyes */}
            <ellipse cx="43" cy="38" rx="2" ry="2.5" fill="#0f172a" />
            <circle cx="42" cy="37" r="0.8" fill="#ffffff" />
            <ellipse cx="57" cy="38" rx="2" ry="2.5" fill="#0f172a" />
            <circle cx="56" cy="37" r="0.8" fill="#ffffff" />

            {/* Smile / Mouth */}
            {isTalking ? (
              <path
                d="M 46 43 Q 50 49 54 43 Z"
                fill="#b91c1c"
                stroke="#78350f"
                strokeWidth="0.8"
              />
            ) : (
              <path
                d="M 46 43 Q 50 47 54 43"
                fill="none"
                stroke="#78350f"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            )}
          </g>

          {/* Visor glass glare / reflection */}
          <path
            d="M 33 32 Q 40 24 50 23 Q 42 27 36 35 Z"
            fill="#ffffff"
            opacity={isAlert ? '0.4' : '0.25'}
          />
        </g>

        {/* --- Snake Head over shoulder --- */}
        <g id="snake-head">
          {/* Head resting on shoulder */}
          <ellipse cx="28" cy="44" rx="5.5" ry="4.5" fill="#22c55e" stroke="#15803d" strokeWidth="1" />
          {/* Snake belly */}
          <ellipse cx="28" cy="46" rx="4" ry="2" fill="#86efac" />
          {/* Snake eyes */}
          <circle cx="26" cy="43" r="1" fill="#0f172a" />
          <circle cx="30" cy="43" r="1" fill="#0f172a" />
          {/* Snake smile */}
          <path d="M 27 45 Q 28 46.5 29 45" fill="none" stroke="#15803d" strokeWidth="0.6" />
        </g>

        {/* --- State Additions --- */}
        {/* Hint state: small glowing dot on helmet */}
        {isHint && (
          <g id="hint-dot">
            <circle cx="50" cy="10" r="4" fill="#e0a93b" opacity="0.4" className="animate-ping" />
            <circle cx="50" cy="10" r="3.5" fill="#e0a93b" stroke="#ffffff" strokeWidth="1" />
          </g>
        )}
      </svg>

      {/* Thinking state: 3 animated dots in a thought bubble */}
      {isThinking && (
        <div
          data-testid="ophi-thinking-bubble"
          className="absolute -top-3 left-0 -translate-x-1 flex items-center gap-1 rounded-full border border-border bg-surface-raised px-2 py-1 shadow-md"
        >
          <span className="size-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="size-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="size-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      )}
    </div>
  )
}

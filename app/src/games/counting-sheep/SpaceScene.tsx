import type { Asteroid, Sheep } from './gameLogic'
import { ASTEROIDS, VIEW_HEIGHT, VIEW_WIDTH } from './gameLogic'

interface SpaceSceneProps {
  sheepList: Sheep[]
  onSheepClick?: (sheepId: number) => void
}

// Deterministic static stars for cartoon space background
const STARS = Array.from({ length: 48 }, (_, i) => {
  const x = (i * 20.833 + ((i * 37) % 19)) % VIEW_WIDTH
  const y = (i * 12.5 + ((i * 53) % 23)) % (VIEW_HEIGHT - 80)
  const size = (i % 3) + 1
  const opacity = 0.35 + ((i * 17) % 55) / 100
  const isSparkle = i % 7 === 0
  return { x, y, size, opacity, isSparkle }
})

export function SpaceScene({ sheepList, onSheepClick }: SpaceSceneProps) {
  return (
    <div className="relative w-full max-w-5xl mx-auto aspect-[5/3] overflow-hidden rounded-xl border border-border bg-bg select-none shadow-none">
      <svg
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        className="w-full h-full block"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Space sheep floating across asteroids in microgravity"
      >
        <defs>
          {/* Deep space sky gradient */}
          <linearGradient id="space-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#07090f" />
            <stop offset="60%" stopColor="#0c111c" />
            <stop offset="100%" stopColor="#141a28" />
          </linearGradient>

          {/* Soft ambient nebula clouds */}
          <radialGradient id="nebula-purple" cx="20%" cy="30%" r="40%">
            <stop offset="0%" stopColor="#5b8def" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#07090f" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="nebula-green" cx="80%" cy="25%" r="35%">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0.09" />
            <stop offset="100%" stopColor="#07090f" stopOpacity="0" />
          </radialGradient>

          {/* Asteroid gradients */}
          <linearGradient id="rock-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#252f42" />
            <stop offset="35%" stopColor="#19202e" />
            <stop offset="100%" stopColor="#0e131d" />
          </linearGradient>

          {/* Space helmet glass gradient with highlight */}
          <radialGradient id="helmet-glass" cx="35%" cy="30%" r="65%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
            <stop offset="30%" stopColor="#5b8def" stopOpacity="0.20" />
            <stop offset="70%" stopColor="#34d399" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#1e2533" stopOpacity="0.30" />
          </radialGradient>

          {/* Golden star badge gradient */}
          <linearGradient id="gold-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#d97706" />
          </linearGradient>
        </defs>

        {/* 1. Space Sky Background */}
        <rect width={VIEW_WIDTH} height={VIEW_HEIGHT} fill="url(#space-grad)" />
        <rect width={VIEW_WIDTH} height={VIEW_HEIGHT} fill="url(#nebula-purple)" />
        <rect width={VIEW_WIDTH} height={VIEW_HEIGHT} fill="url(#nebula-green)" />

        {/* Distant crescent Moon / Earth */}
        <g transform="translate(880, 90)">
          <circle cx="0" cy="0" r="32" fill="#141a26" />
          <path
            d="M -22 -22 A 32 32 0 0 1 22 22 A 28 28 0 0 0 -22 -22 Z"
            fill="#e6eaf2"
            opacity="0.85"
          />
        </g>

        {/* Cartoon Stars */}
        {STARS.map((star, idx) => (
          <g key={idx}>
            {star.isSparkle ? (
              <g transform={`translate(${star.x}, ${star.y})`}>
                <line x1="-5" y1="0" x2="5" y2="0" stroke="#e6eaf2" strokeWidth="1.2" opacity={star.opacity} />
                <line x1="0" y1="-5" x2="0" y2="5" stroke="#e6eaf2" strokeWidth="1.2" opacity={star.opacity} />
                <circle cx="0" cy="0" r="1.5" fill="#34d399" opacity={star.opacity} />
              </g>
            ) : (
              <circle
                cx={star.x}
                cy={star.y}
                r={star.size}
                fill="#e6eaf2"
                opacity={star.opacity}
              />
            )}
          </g>
        ))}

        {/* 2. Rock Asteroids */}
        {ASTEROIDS.map((rock) => (
          <AsteroidView key={rock.id} rock={rock} />
        ))}

        {/* 3. Space Sheep jumping and floating */}
        {sheepList.map((sheep) => (
          <SheepView
            key={sheep.id}
            sheep={sheep}
            onClick={() => onSheepClick?.(sheep.id)}
          />
        ))}
      </svg>
    </div>
  )
}

function AsteroidView({ rock }: { rock: Asteroid }) {
  const rx = rock.radiusX
  const ry = rock.radiusY

  return (
    <g transform={`translate(${rock.x}, ${rock.y}) rotate(${rock.tilt})`}>
      {/* Mini floating pebbles */}
      <circle cx={-rx - 12} cy={ry - 6} r="3" fill="#1e2533" />
      <circle cx={rx + 14} cy={-ry + 10} r="2.5" fill="#252f42" />

      {/* Main rock body */}
      <ellipse
        cx="0"
        cy="0"
        rx={rx}
        ry={ry}
        fill="url(#rock-grad)"
        stroke="#2a354b"
        strokeWidth="2.5"
      />

      {/* Top light rim facet */}
      <path
        d={`M ${-rx * 0.9} ${-ry * 0.15} Q 0 ${-ry * 1.15} ${rx * 0.85} ${-ry * 0.2} Q 0 ${-ry * 0.6} ${-rx * 0.9} ${-ry * 0.15}`}
        fill="#394863"
        opacity="0.45"
      />

      {/* Craters */}
      {rock.craters.map((c, i) => (
        <g key={i} transform={`translate(${c.cx}, ${c.cy})`}>
          <ellipse
            cx="0"
            cy="0"
            rx={c.r}
            ry={c.r * 0.65}
            fill="#090d14"
            stroke="#19202e"
            strokeWidth="1.5"
          />
          <path
            d={`M ${-c.r * 0.8} 0 A ${c.r * 0.8} ${c.r * 0.5} 0 0 1 ${c.r * 0.8} 0`}
            stroke="#3a4760"
            strokeWidth="1.2"
            fill="none"
            opacity="0.7"
          />
        </g>
      ))}
    </g>
  )
}

function SheepView({ sheep, onClick }: { sheep: Sheep; onClick: () => void }) {
  const { woolTint, expression, accessory } = sheep.variation

  return (
    <g
      transform={`translate(${sheep.x}, ${sheep.y}) rotate(${sheep.rotation}) scale(${sheep.scale})`}
      className="cursor-pointer transition-transform duration-75"
      onClick={onClick}
    >
      {/* Gentle microgravity glow behind sheep */}
      <circle cx="0" cy="-6" r="38" fill="#5b8def" opacity="0.08" />

      {/* 1. Tail */}
      <circle cx="-32" cy="-6" r="9" fill={woolTint} stroke="#8a93a6" strokeWidth="1" />

      {/* 2. Tiny astronaut boots / hooves */}
      <ellipse cx="-16" cy="18" rx="5" ry="7" fill="#141a26" stroke="#5b8def" strokeWidth="1" />
      <ellipse cx="-4" cy="19" rx="5" ry="7" fill="#141a26" stroke="#5b8def" strokeWidth="1" />
      <ellipse cx="10" cy="19" rx="5" ry="7" fill="#141a26" stroke="#5b8def" strokeWidth="1" />
      <ellipse cx="22" cy="18" rx="5" ry="7" fill="#141a26" stroke="#5b8def" strokeWidth="1" />

      {/* 3. Fluffy Wool Clusters */}
      <g>
        <circle cx="-20" cy="-6" r="15" fill={woolTint} stroke="#94a3b8" strokeWidth="0.8" />
        <circle cx="-10" cy="-14" r="16" fill={woolTint} stroke="#94a3b8" strokeWidth="0.8" />
        <circle cx="6" cy="-14" r="16" fill={woolTint} stroke="#94a3b8" strokeWidth="0.8" />
        <circle cx="16" cy="-6" r="15" fill={woolTint} stroke="#94a3b8" strokeWidth="0.8" />
        <circle cx="-10" cy="4" r="15" fill={woolTint} stroke="#94a3b8" strokeWidth="0.8" />
        <circle cx="6" cy="4" r="15" fill={woolTint} stroke="#94a3b8" strokeWidth="0.8" />
        <circle cx="-2" cy="-5" r="18" fill={woolTint} />
      </g>

      {/* 4. Head and Space Helmet */}
      <g transform="translate(18, -12)">
        {/* Sheep Ears */}
        <ellipse cx="-6" cy="-6" rx="4" ry="9" transform="rotate(-30, -6, -6)" fill="#ffedd5" stroke="#94a3b8" strokeWidth="0.8" />
        <ellipse cx="6" cy="-6" rx="4" ry="9" transform="rotate(30, 6, -6)" fill="#ffedd5" stroke="#94a3b8" strokeWidth="0.8" />

        {/* Sheep Head/Face */}
        <ellipse cx="0" cy="0" rx="14" ry="12" fill="#ffedd5" />

        {/* Blush cheeks */}
        <circle cx="-8" cy="3" r="3.5" fill="#f26d6d" opacity="0.35" />
        <circle cx="8" cy="3" r="3.5" fill="#f26d6d" opacity="0.35" />

        {/* Face Expressions */}
        {expression === 'sleepy' && (
          <g>
            {/* Half-closed lids with calm smile */}
            <path d="M -8 -2 Q -5 -5 -2 -2" stroke="#1e2533" strokeWidth="1.8" fill="none" strokeLinecap="round" />
            <circle cx="-5" cy="-1" r="1.4" fill="#1e2533" />
            <path d="M 2 -2 Q 5 -5 8 -2" stroke="#1e2533" strokeWidth="1.8" fill="none" strokeLinecap="round" />
            <circle cx="5" cy="-1" r="1.4" fill="#1e2533" />
            <path d="M -3 5 Q 0 8 3 5" stroke="#1e2533" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          </g>
        )}
        {expression === 'peaceful' && (
          <g>
            {/* Closed sleeping eyes */}
            <path d="M -8 -1 Q -5 -4 -2 -1" stroke="#1e2533" strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d="M 2 -1 Q 5 -4 8 -1" stroke="#1e2533" strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d="M -2 5 Q 0 7 2 5" stroke="#1e2533" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          </g>
        )}
        {expression === 'curious' && (
          <g>
            {/* Open round eyes with twinkle */}
            <circle cx="-5" cy="-2" r="2.5" fill="#1e2533" />
            <circle cx="-6" cy="-3" r="1" fill="#ffffff" />
            <circle cx="5" cy="-2" r="2.5" fill="#1e2533" />
            <circle cx="4" cy="-3" r="1" fill="#ffffff" />
            <path d="M -3 5 Q 0 8 3 5" stroke="#1e2533" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          </g>
        )}
        {expression === 'winking' && (
          <g>
            {/* One wink, one star eye */}
            <path d="M -8 -1 Q -5 -4 -2 -1" stroke="#1e2533" strokeWidth="2" fill="none" strokeLinecap="round" />
            <circle cx="5" cy="-2" r="2.5" fill="#1e2533" />
            <circle cx="4" cy="-3" r="1" fill="#ffffff" />
            <path d="M -2 5 Q 0 8 3 5" stroke="#1e2533" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          </g>
        )}

        {/* Small Nose / Mouth */}
        <ellipse cx="0" cy="3" rx="1.5" ry="1.2" fill="#e0a93b" />

        {/* Space Helmet Collar Ring */}
        <ellipse cx="0" cy="14" rx="16" ry="4" fill="#e0a93b" stroke="#b45309" strokeWidth="1" />

        {/* Transparent Space Helmet Bubble */}
        <circle
          cx="0"
          cy="0"
          r="21"
          fill="url(#helmet-glass)"
          stroke="#e6eaf2"
          strokeWidth="1.8"
          strokeOpacity="0.75"
        />

        {/* Glass Reflection Arc */}
        <path
          d="M -13 -13 A 19 19 0 0 1 12 -13"
          stroke="#ffffff"
          strokeWidth="1.8"
          strokeLinecap="round"
          fill="none"
          opacity="0.75"
        />
        <path
          d="M -15 -8 A 19 19 0 0 1 -9 -15"
          stroke="#ffffff"
          strokeWidth="2.4"
          strokeLinecap="round"
          fill="none"
          opacity="0.85"
        />

        {/* Unique Accessory */}
        {accessory === 'star-badge' && (
          <path
            d="M 0 12 L 2 15 L 5 15 L 3 17 L 4 20 L 0 18 L -4 20 L -3 17 L -5 15 L -2 15 Z"
            fill="url(#gold-grad)"
            stroke="#b45309"
            strokeWidth="0.6"
          />
        )}
        {accessory === 'antenna' && (
          <g transform="translate(0, -21)">
            <path d="M 0 0 Q -2 -6 0 -11" stroke="#e6eaf2" strokeWidth="1.4" fill="none" />
            <circle cx="0" cy="-11" r="3" fill="#34d399" stroke="#059669" strokeWidth="0.8" />
          </g>
        )}
        {accessory === 'sleep-cap' && (
          <g transform="translate(-4, -14) rotate(-15)">
            <path d="M -6 0 Q 0 -12 10 -6 Q 4 4 -6 0 Z" fill="#5b8def" />
            <circle cx="10" cy="-6" r="2.5" fill="#ffffff" />
          </g>
        )}
        {accessory === 'mission-patch' && (
          <circle cx="0" cy="14" r="3" fill="#e0a93b" stroke="#ffffff" strokeWidth="0.6" />
        )}
        {accessory === 'ribbon' && (
          <g transform="translate(0, 14)">
            <circle cx="0" cy="0" r="2" fill="#f26d6d" />
            <ellipse cx="-4" cy="0" rx="3" ry="2" fill="#f26d6d" />
            <ellipse cx="4" cy="0" rx="3" ry="2" fill="#f26d6d" />
          </g>
        )}
      </g>
    </g>
  )
}

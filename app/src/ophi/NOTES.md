# Plan
1. `ophiState.ts`: Manage OphiState ('idle' | 'hint' | 'talking' | 'thinking' | 'alert') and hooks.
2. `OphiStandIn.tsx`: SVG chibi astronaut stand-in with helmet, visor, face, snake curl, and state accessories.
3. `art.ts`: Build-time glob detection for optional bitmap art in `public/ophi/`.
4. `ophi.css`: Floating and waving animations respecting `prefers-reduced-motion`.
5. `OphiPanel.tsx`: Accessible dialog panel showing current screen's guide and "Ask the Med bot" action.
6. `Ophi.tsx`: Floating character button, route hiding, /emergency auto-alert, and first-visit welcome bubble.
7. `index.ts`: Re-export CONTRACTS section 12 interface (Ophi, OphiState, setOphiState, useOphiState, askMedbot).
8. `guide.ts` in nutrition, physical-activity, mood: Real copy from docs/OPHI_TOV.md.
9. `Ophi.test.tsx`: Tests for route visibility, panel guides, default fallback, keyboard accessibility, and focus return.

---

# Ophi Tov Guide Character

## How a screen owner changes their explanation
Every screen folder (`src/screens/<screen-id>/`) contains a `guide.ts` file that exports a `guide` object of type `Guide` (`shows`, `whyItMatters`, `howToRead`, `whenToAct`).
To change what Ophi says on your screen:
1. Open `src/screens/<screen-id>/guide.ts`.
2. Edit the fields:
   - `shows`: 1–2 sentences explaining what the screen displays.
   - `whyItMatters`: 1–2 sentences explaining why this matters in microgravity or spaceflight.
   - `howToRead`: An array of up to 3 bullet points explaining color tones, targets, and interactions.
   - `whenToAct`: 1–2 sentences on self-actions and when to notify the flight surgeon (no diagnoses or doses). If left empty or omitted, Ophi hides this section.
3. When saved, Ophi dynamically reloads and presents your updated explanation on that screen. Screens without custom guide text fall back automatically to `defaultGuide(screen)`.

## How to change Ophi's state from anywhere
Import `setOphiState` and `useOphiState` from `@/ophi`:
```ts
import { setOphiState, useOphiState } from '@/ophi'

// In a component:
const state = useOphiState()

// In an event handler or store reaction:
setOphiState('hint')     // Adds glowing amber dot on helmet
setOphiState('alert')    // Orange visor glow, stops floating
setOphiState('thinking') // Displays animated 3-dot thought bubble
setOphiState('talking')  // Mouth/expression moves while panel is open
setOphiState('idle')     // Normal float and friendly smile
```

## How `askMedbot` passes the screen to the Med bot
Clicking "Ask the Med bot about this" in `OphiPanel` calls `askMedbot(screenId)` exported from `@/ophi`.
- Navigates to `/medbot?from=<screenId>`.
- Uses React Router navigation internally in the UI, and dispatches a `popstate` event with `window.history.pushState` when called externally so it works anywhere without shell imports.
- The Med bot screen inspects the `from` search parameter to initialize context for the conversation.

## How to add the five state images later
To replace the SVG shape stand-in with bitmap artwork:
1. Save 512x512 transparent PNG files in `app/public/ophi/`:
   - `ophi-idle.png`
   - `ophi-hint.png`
   - `ophi-talking.png`
   - `ophi-thinking.png`
   - `ophi-alert.png`
2. Also place 128x128 versions for the watch:
   - `ophi-<state>-128.png`
3. If only `ophi-idle.png` is provided, Ophi automatically uses it across all states, adding the hint helmet dot, alert glow, and thinking bubble dynamically.
4. If no PNGs exist, Ophi seamlessly renders the built-in SVG stand-in (`OphiStandIn.tsx`).

---

## Status and Verification
- **What is built:**
  - `ophiState.ts`: External store state management for `OphiState`.
  - `OphiStandIn.tsx`: Scalable SVG astronaut stand-in with chibi suit, helmet, visor, face, green curl snake, and visual state indicators.
  - `OphiPanel.tsx`: Accessible dialog with screen label, 4 guide sections, and primary Medbot action.
  - `Ophi.tsx`: Bottom-right floating character, route filtering (`/medbot`, `/w`, `/games/...`), auto-alert on `/emergency` (the panel stays closed so it never covers the Emergency controls), and one-time first-visit welcome bubble stored in `localStorage` under `ophiuchus:v1:`.
  - `index.ts`: CONTRACTS section 12 exports.
  - `guide.ts` for `nutrition`, `physical-activity`, and `mood` populated with exact copy.
  - Comprehensive unit tests in `Ophi.test.tsx`.
- **What is faked or stubbed:**
  - The vector shape stand-in (`OphiStandIn.tsx`) is currently in use because PNG character art files are not yet present in `public/ophi/`.
- **What could not verify:**
  - None; all components, routes, keyboard accessibility, and state transitions verified with automated tests.
- **How to see it working:**
  - Run `npm run dev` in `app` and browse to `http://localhost:5173/overview`.
  - Notice Ophi floating in the bottom-right corner with his first-visit welcome bubble.
  - Click Ophi to open the screen guide dialog; press Escape to close and verify focus returns to Ophi.
  - Navigate to `/nutrition` and `/mood` to view the specific custom guide copy.
  - Navigate to `/emergency` to see Ophi enter `alert` state (orange glow, no float) ; tap him to open the Emergency guide.
  - Navigate to `/medbot`, `/w`, or `/games/futvolley` to verify Ophi is hidden.

## Polish (prompt 19, task 1)
Ophi is 48 px under 640 px. His wrapper ignores taps; only his button and first-visit bubble catch them. Main keeps `pb-28`, so any control can be scrolled clear of him.

# 03 · Ophi Tov guide

**Phase 1. Can run in parallel with 02 and 10 part A.**

| | |
|---|---|
| Branch | `lane/03-ophi` |
| You own | `app/src/ophi/`, `app/public/ophi/`, and the `guide.ts` file inside each screen folder |
| Read first | AGENTS.md, docs/CONTRACTS.md sections 3, 5 and 12, docs/OPHI_TOV.md (all), docs/DESIGN_SYSTEM.md |
| Attach (chat tools only) | Those files, plus `app/src/design/index.ts`, `app/src/registry/index.ts` and `app/README.md` |
| Needs | 01 merged. Art at `app/public/ophi/ophi-idle.png`, or none yet |

## Prompt

Read AGENTS.md, docs/CONTRACTS.md and docs/OPHI_TOV.md before doing anything. You are replacing the stub in `app/src/ophi/` with the real guide character.

Ophi Tov is a small astronaut who floats above every screen of this health console. Clicking him opens a short explanation of the screen the user is on. Hackathon judges will use the app with nobody beside them, so Ophi is how the product explains itself. He should be charming and must never block the thing the user came to do. The shell already renders a component named `Ophi` once, above everything; keep that name and the three exported functions in CONTRACTS section 12 exactly as they are.

**Build, in this order:**

1. **`ophiState.ts`:** the `OphiState` values and `setOphiState` / `useOphiState`, shared across the app.
2. **`Ophi.tsx`:** the floating character.
   - Fixed bottom-right. About 96 px tall at 640 px and wider, about 64 px below that, and raised above the phone's bottom edge.
   - Image by state from `app/public/ophi/ophi-<state>.png`. If a state's image is missing, use `ophi-idle.png`. If that is missing too, draw a simple stand-in from shapes (helmet, face, a green curl for the snake) at the same size.
   - Without separate images, show state through additions: a small dot on the helmet for `hint`, an orange glow and no float for `alert`, three animated dots in a bubble for `thinking`.
   - A slow idle float, off when the system asks for reduced motion.
   - It is a button with the accessible name "Ask Ophi to explain this screen".
   - Hidden on the route `/medbot`, on `/w`, and on `/games/...`.
   - On the route `/emergency`, state becomes `alert` and the panel opens automatically once per visit.
3. **`OphiPanel.tsx`:** the explanation panel.
   - Anchored beside him on PC, a bottom sheet under 640 px.
   - Title: the current screen's label. Then four parts from that screen's `guide` (CONTRACTS section 5): "What this shows" (`shows`), "Why it matters in space" (`whyItMatters`), "How to read it" (`howToRead`, up to three bullets), "When to act" (`whenToAct`). If `whenToAct` is empty, leave that part out.
   - A primary button, "Ask the Med bot about this", which calls `askMedbot` with the current screen id.
   - Closes with its close button, the Escape key, or a click outside, and returns focus to Ophi. It is a labeled dialog.
   - The current screen comes from the route and `getScreen` in `@/registry`. The guide for a screen is loaded from that screen's `guide.ts`.
4. **First visit:** a one-time wave and a small bubble, "Tap me if you want this screen explained." Remembered in browser storage under the `ophiuchus:v1:` prefix so it shows once.
5. **Guide texts:** write `guide.ts` for `nutrition`, `physical-activity` and `mood` using the drafts in docs/OPHI_TOV.md word for word. Leave every other screen's `guide.ts` as the placeholder default; their owners will edit them.
6. **`NOTES.md`:** how a screen owner changes their explanation (edit `guide.ts` in their folder), how to change Ophi's state from anywhere, how `askMedbot` passes the screen to the Med bot (`/medbot?from=<screenId>`), and how to add the five state images later.
7. **Tests:** the panel shows the guide of the current route; missing guide falls back to the default; hidden on the three routes listed; Escape closes and restores focus.

**Position check:** on every screen that exists, at 360 px wide, Ophi must not sit on top of a button or input. If he does, raise him on that screen's route with a small per-route offset kept in your folder. Do not edit the screen.

**Do not build:** the chat, the Med bot screen, voice, the watch version, anything in `shell`.

**Checks you must run and pass before reporting:**

- `npm run build`, `npm run lint`, `npm run typecheck`, `npm run test`, all clean.
- Ophi appears on every route except the three listed, at 1440 px and 360 px.
- Clicking him on Nutrition, Mood and one placeholder screen shows three different, correct panels.
- The panel is fully usable with the keyboard alone.
- The exported names match CONTRACTS section 12 exactly.

**Stop and ask** only if the shell does not render `Ophi` the way this prompt assumes.

**Report:** what you built, the result of each check, whether real art or the stand-in is in use, and any screen that needed a position offset.

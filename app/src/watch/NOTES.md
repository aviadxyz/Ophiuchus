# Watch App Specification & Notes

## Plan
1. `WatchApp.tsx`: Self-contained watch canvas scaling 180-450px with 4-page swipe/arrows/dots pager and round/square clipping.
2. `pages/HealthOverviewPage.tsx`: Large heart rate with SourceBadge or 'No sensor', 3 ProgressRings (sleep, move, mood), 5s tap detail.
3. `pages/MedbotPage.tsx`: Med bot header, speech input or 3 preset question buttons, chat API call (8s timeout), fallback scripted replies.
4. `pages/EmergencyPage.tsx`: Emergency button with 2s hold ProgressRing, raiseAlert, 10s cancel button, acknowledged state, vibration.
5. `pages/AboutPage.tsx`: Ophi graphic, project name, challenge attribution, pairing code, link status, build time.
6. `medbotContext.ts`: Watch context builder matching Section 2 of companion prompt.
7. `scriptedReplies.ts`: Offline fallback replies matching Section 4 of companion prompt.
8. `watch.test.tsx`: Tests for 2s hold, early release cancel, 10s alert cancel, acknowledgement, and preset questions.

---

## Specifications for Part B Native Wear OS Rebuild

This section documents the exact text, layout, colors, font sizes, and behavior of all four watch pages so another agent can rebuild the Wear OS native app in `watch-native/` cleanly.

### Global Constraints & Wear OS Layout
- **Display Target**: Round Wear OS face (default diameter 200–450 px, tested down to 180 px).
- **Safe Zone**: All interactive buttons, text, and rings must stay inside the inscribed circle (diameter = width). Keep minimum 12% padding from bezel edges at top/bottom/sides.
- **Theme Tokens**:
  - Background: `#090d16` (deep dark space black)
  - Surface: `#131b2e`
  - Text primary: `#f8fafc` (high-contrast white)
  - Text secondary: `#94a3b8` (muted grey)
  - Accent / OK: `#38bdf8` / `#22c55e` (cyan-blue / emerald)
  - Warning: `#f59e0b` (amber)
  - Danger / Emergency: `#ef4444` (vivid red)
  - Border: `#1e293b`
- **Navigation**: Horizontal swipe between pages with 4-dot indicator at top safe area. Order:
  0. Health Overview
  1. Talk to the Med bot
  2. Emergency
  3. About

---

### Page 0 · Health Overview (Home)
- **Top Section (Heart Rate)**:
  - If sensor reading exists and connection is not `'off'`:
    - Large number: `32sp font-mono font-bold text-text` (e.g. `72`)
    - Sub-label: `12sp font-mono uppercase text-text-muted` (`bpm`)
    - Source badge: `10sp font-mono uppercase tracking-wider` with pulsing dot for `LIVE`
  - If sensor disconnected or no reading:
    - Text: `14sp font-medium text-text-muted` ("No sensor")
- **Center Section (3 Health Rings)**:
  - 3 `ProgressRing` elements side-by-side, diameter `46dp`:
    1. **Sleep**: ring value 0.05–1.0 based on level (`ok`=1.0, `watch`=0.7, `act`=0.4, `none`=0.05). Tone: `ok`=green, `watch`=amber, `act`=red, `none`=neutral. Center label: "SLEEP" (`10sp font-semibold`).
    2. **Exercise**: Center label: "MOVE" (`10sp font-semibold`). Tone according to exercise level.
    3. **Mood**: Center label: "MOOD" (`10sp font-semibold`). Tone according to mood level.
- **Bottom Section (Ophi Line / Detail Text)**:
  - Default text: The summary's `ophiLine` (`12sp text-text-secondary`, max 2 lines).
  - Tap interaction: Tapping any ring displays that area's detailed status text (e.g. `summary.sleep.text`) for exactly 5 seconds (5000 ms timer), then smoothly reverts back to `ophiLine`.

---

### Page 1 · Talk to the Med bot
- **Header**:
  - Medical icon (`HeartPulse` 16dp) + Text: "Med bot" (`14sp font-semibold`).
- **Input State**:
  - Voice available: Large circular "Hold to talk" button (diameter `80dp`, icon `Mic` 32dp). Holding records audio stream; releasing triggers transcription and sends text.
  - Voice unavailable / fallback: 3 vertically stacked preset buttons (`11sp font-medium`, full width inside safe margins):
    1. "How am I doing today?"
    2. "What should I do next?"
    3. "I don't feel well."
- **Network Request & Timeout**:
  - POST to chat endpoint with payload:
    `{ message: text, screenId: 'watch', screenLabel: 'Watch', context: contextBlock, replyMode: 'watch' }`
  - Context contains screen, mission, profile, sleep, food, water, exercise, mood, heart rate, open alerts (or reduced to screen & mission if assistant consent is off).
  - Timeout: 8000 ms.
- **Offline & Fallback Scripted Answers**:
  - If chat URL is empty, request fails, or timeout occurs: answer from Section 4 scripted replies:
    - "How am I doing today?":
      - All on target: "You're in good shape today. Sleep, food and exercise are all on track. Keep it up."
      - One area off: "Mostly good. The one to watch is {area}: {fact}. A small fix today is enough."
      - Two or more off: "A tougher day. {areaOne} and {areaTwo} are both off. Start with {easier}, and we'll look at the other after."
    - "What should I do next?":
      - Exercise remaining: "You still have {minutes} minutes of exercise planned today. That's the best next thing."
      - Water low: "Have a drink. You're at {litres} of {target} litres."
      - Food low & afternoon: "You're about {gap} kcal under for today. A proper meal now would close most of it."
      - No mood check-in: "Take ten seconds for a mood check-in. It helps us spot patterns."
      - Nothing outstanding: "Nothing urgent. A good moment to rest or message home."
    - "I don't feel well.":
      - "Sorry to hear that. If it's serious, hold the Emergency button now. If not, sit down, have some water, and tell a crewmate. I'm offline for a moment, so I can't say more yet."
    - Other messages:
      - "I can't reach my full brain right now, so I can only answer the basics. Try one of the quick questions, and use Emergency if it's urgent."
  - Displays small `"offline"` tag in `10sp italic text-text-muted` under reply.
  - Speaks reply aloud using platform Text-To-Speech (TTS).
  - Tapping reply resets screen to ask another question.

---

### Page 2 · Emergency
- **Header**: "EMERGENCY" in `12sp uppercase font-semibold text-danger`.
- **Button**:
  - Large circular red/danger button (`80dp`) labeled "SOS" (`12sp font-bold`).
  - Encircled by a `ProgressRing` (`88dp`, tone: `danger`).
- **Hold Interaction**:
  - User must hold button continuously for 2000 ms.
  - The `ProgressRing` animates from 0% to 100% over the 2000 ms.
  - Releasing before 2000 ms resets progress to 0% and sends nothing.
- **On Completion (2000 ms)**:
  - Calls `raiseAlert('emergency', 'watch', 'Emergency from watch')` (or posts `emergency.raised` on native Wear OS).
  - Triggers vibration pattern: `[200, 100, 200]` ms.
  - Screen transitions to "Alert sent" with current time (e.g. `14:22`).
  - Displays a "Cancel (10s)" button that counts down from 10 to 0.
  - Tapping Cancel calls `cancelAlert(alertId)` (or posts `emergency.cancelled`) and resets to idle.
- **Acknowledgement Transition**:
  - When alert status becomes `acknowledged` (via polling or console message):
    - Triggers vibration pattern: `[300, 150, 300]` ms.
    - Displays "Help is on the way" in `14sp font-bold text-accent`.
- **Disclaimer**:
  - Fixed bottom line: "Demo. No real alert is sent." in `10sp text-text-muted`.

---

### Page 3 · About
- **Ophi Graphic**: 40dp avatar circle with spacesuit helmet art.
- **Project Label**: "Ophiuchus" (`12sp font-bold uppercase tracking-wider`).
- **Sub-label**: "NASA Space Apps Challenge 2026" (`10sp text-text-secondary`).
- **Disclaimer**: "Demo. Not a medical device." (`9sp text-text-muted`).
- **Pairing Info**:
  - If paired: "ROOM: {code}" in `10sp font-mono font-bold text-accent`, "Link: {connection}" in `9sp text-text-muted`.
  - If not paired: "Not paired ({connection})" in `10sp font-mono text-text-muted`.
- **Build Timestamp**: Bottom timestamp in `9sp font-mono text-text-muted`.

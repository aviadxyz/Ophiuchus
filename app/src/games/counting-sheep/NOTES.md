# Counting Sheep Mini Game

## Implementation plan
1. `meta.ts`: Register game with id `counting-sheep`, label "Counting Sheep", screen `sleep`.
2. `gameLogic.ts`: Pure logic for asteroids, sheep state, microgravity jump arcs, entry counter, and phone-down detection.
3. `gameLogic.test.ts`: Unit tests for sheep variations, trajectories, phone orientation detection, and timers.
4. `sound.ts`: Web Audio API sound generator for soothing cartoon sheep bleat ("baa") on entry with mute support.
5. `SpaceScene.tsx`: Vector SVG rendering cartoon space sky, rocky asteroids, and space-helmeted sheep in microgravity.
6. `index.tsx`: 3-view game flow (Start, Play, Restful Result) with timer, counter, phone-down sensor, and navigation.
7. `NOTES.md`: Document what was built, verify tests and builds, and report instructions.

## What is built
- Mini game `counting-sheep` registered under `/games/counting-sheep` and displayed at the bottom of the Sleep screen.
- Three full views:
  1. Start View: Description, why it matters for space sleep, start button, sound toggle, phone-down instructions.
  2. Play View:
     - Cartoon space background with starry field, soft atmospheric nebulae, and crescent moon.
     - Four rocky asteroids across the view with craters, light facets, and microgravity pebbles.
     - Space-helmeted sheep with transparent glass dome bubbles, specular glints, and collar rings.
     - Microgravity parabolic trajectory jumps with floaty apex and landing cushions between asteroids.
     - Unique variations for each sheep: fleece color tint (cloud white, warm cream, lavender dream, starlight peach, mint breeze, moon silver), facial expressions (sleepy, peaceful, curious, winking), and accessories (star badge, antenna, sleep cap, mission patch, ribbon).
     - Counter that tracks and increments as each new sheep enters the visible screen.
     - Web Audio API synthesized cartoon sheep bleat ("baa-a-a") on entry with tremolo and formant filter, plus mute button.
     - "Phone put down" detector: checks mobile device orientation (beta, gamma flat against table or bed) for 1 continuous second to stop the counter, plus an on-screen "Put phone down" toggle for testing on laptops and desktops.
     - 75-second countdown timer with design system `ProgressBar`.
  3. Result View: Displays total sheep counted, restful mission wind-down message, "Source: to be confirmed" `SourceLine`, "Count Again" button, and "Back to Sleep" button.
- Clean lifecycle management: stops audio, timers, and animation frames on unmount or when `document.hidden`.
- Responsive layout at both 360 px and 1440 px with zero sideways scrolling.

## What is faked or stubbed
- On desktop browsers without orientation hardware, phone orientation is simulated using the "Put phone down" button. On physical mobile browsers, `DeviceOrientationEvent` coordinates (`beta`, `gamma`) are read directly.

## What could not be verified
- Physical accelerometer gyroscope response on a physical phone in this headless development environment (verified via comprehensive mathematical unit tests in `gameLogic.test.ts`).

## How to see it working
1. In `app/`, run `npm run dev`.
2. Open `/sleep` in your browser.
3. At the bottom under "Games", click "Counting Sheep" to open `/games/counting-sheep`.
4. Press "Start Counting". Watch the space sheep jump and float across asteroids in microgravity while counting up.
5. Tap on any sheep to trigger an interactive sound bleat.
6. Click "Put phone down" (or lay your phone flat on a surface) to stop the counter and enter the rest view.
7. Click "Back to Sleep" to return to the Sleep screen.

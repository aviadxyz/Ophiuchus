# Watch Screen Notes

## What is built
- Screen header with eyebrow `COMPANION · WATCH` and dynamic paired status pill.
- Interactive drawn watch body with strap, bezel, crown, and responsive toggle for Round vs Square bezel designs.
- Fully interactive `WatchApp` embedded in the bezel with all 4 pages (Health Overview, Med bot, Emergency, About).
- "Pair a watch" card:
  - 6-character room code input with validation and "Pair" action (`joinRoom`).
  - Active paired state displaying code, "Paired" badge, and "Unpair" action (`leaveRoom`).
  - "Open the watch view on another device" section with "Create code" generator or one-click copyable `/w?room=CODE` URL.
- Explanatory card on the role of the wrist companion and reference to the Wear OS native implementation.
- Automated tests verifying pairing flow, code creation, URL generation, and bezel toggling.

## Verification
- Clean build, typecheck, lint, and test suites passing.
- Round (200px) and square (400px) scaling verified with zero bezel clipping.
- Real-time synchronization with `/w?room=CODE` via shared store and BroadcastChannel relay.

## Polish (prompt 19, task 1)
The companion card now says the browser view is what runs today and a native Wear OS app is in progress.

# 08 · Watch app

Two parts. Part A is the watch view inside the web app. Part B is the native Wear OS app. Read docs/WATCH.md first; it explains why both exist and how the app gets onto the watch.

---

## Part A · Watch view in the browser

**Phase 3. Can run in parallel with the two runs of 07.**

| | |
|---|---|
| Branch | `lane/08a-watch-view` |
| You own | `app/src/watch/` and `app/src/screens/watch/` |
| Read first | AGENTS.md, docs/CONTRACTS.md sections 3 and 6 to 12, docs/WATCH.md, sections 3 and 4 of prompts/companion/medbot-system-prompt.md, `app/src/data/README.md` |
| Attach (chat tools only) | Those files, plus `app/src/design/index.ts` |
| Needs | 01, 02 and 03 merged |

### Prompt

Read AGENTS.md, docs/CONTRACTS.md and docs/WATCH.md before doing anything. You are building the watch view of Ophiuchus as part of the web app, and the Watch screen that shows it inside a drawn watch.

The team has a real Wear OS watch that will run a small native app. This browser version exists for three reasons: it defines the four screens precisely for the native build, it is the backup if the watch fails on demo day, and it lets anyone try the watch on the console. On a face this small, less is better: large type, one action per page, nothing clipped by a round bezel.

**Build, in this order:**

1. **`watch/WatchApp.tsx`:** a self-contained layout with no shell and no Ophi corner. A square canvas that scales with its container from 180 px to 450 px, with a `round` input that clips to a circle. All content stays inside the inscribed circle. Four pages, moved between by swipe, arrow keys, and tappable page dots. Order: Health overview, Talk to the Med bot, Emergency, About.
2. **Health overview page.** Heart rate from `useLatestVitals()`, large, with its `SourceBadge`, or "No sensor" when `connection` is `off`. Three `ProgressRing`s for sleep, exercise and mood from `useHealthSummary()`, each showing its level by tone and a one-word label. One line: the summary's `ophiLine`. Tapping a ring replaces the line with that area's `text` for five seconds.
3. **Talk to the Med bot page.** A small lucide medical icon, the name "Med bot", and a large "Hold to talk" button. Where the browser offers speech input, holding listens and releasing sends. Where it does not, show the three preset questions from docs/WATCH.md as buttons. Sending: if `VITE_CHAT_URL` is set and the active profile's `consent.assistant` is on, call the chat endpoint (CONTRACTS section 11) with `replyMode` `watch` and the context block from section 2 of the companion prompt file; if consent is off, send the same request with the context block reduced to the screen and mission lines only. If the address is empty, the call fails, or it takes more than eight seconds, answer the preset questions from the scripted replies in section 4 of the companion prompt file and show "offline" in small text. Show the reply as text and speak it where the browser can.
4. **Emergency page.** One large button in the emergency color. Press and hold two seconds while a `ProgressRing` fills; releasing early cancels and sends nothing. On completion call `raiseAlert('emergency', 'watch', 'Emergency from watch')`. Then show "Alert sent" with the time and a "Cancel" for ten seconds (`cancelAlert`). When that alert's status becomes `acknowledged`, show "Help is on the way". Vibrate on send and on acknowledgement where the browser allows. Small text: "Demo. No real alert is sent." Works with mouse, touch, and the keyboard (hold Space or Enter).
5. **About page.** Ophi, "Ophiuchus", "NASA Space Apps Challenge 2026", "Demo. Not a medical device.", the room code from `useRoom()` if joined, the connection state, and the build time.
6. **Route `/w`.** Shows `WatchApp` filling the window, square. If the address has `?room=CODE`, call `joinRoom` with it on load.
7. **Watch screen** in `screens/watch/`, replacing the placeholder, status `ready`:
   - `ScreenHeader`, eyebrow `COMPANION · WATCH`.
   - `WatchApp` inside a drawn watch body with a strap, with a round or square toggle.
   - A `Card`, "Pair a watch": a `TextField` for a six-character code and a "Pair" button calling `joinRoom`; when joined, the code, "Paired", and "Unpair". Under it: "Open the watch view on another device", with a "Create code" button calling `createRoom` when no room is joined, then the address ending in `/w?room=CODE` shown as text to copy.
   - A `Card` explaining in three sentences what the watch does and that the real one is a Wear OS app.
   - `guide.ts` for this screen.
8. **`watch/NOTES.md`:** the exact text, sizes and behavior of each page, written so another agent can rebuild the four screens natively from this file alone. This is an input to part B.
9. **Tests:** hold-to-send completes only after two seconds; early release sends nothing; cancel within ten seconds cancels; acknowledged status changes the page; the offline path answers the three preset questions.

**Do not build:** native code, real sensor access beyond what `@/data` gives, anything in the Emergency or Med bot screens.

**Checks you must run and pass before reporting:**

- `npm run build`, `npm run lint`, `npm run typecheck`, `npm run test`, all clean.
- At 200 px round and 400 px square: every page readable, nothing clipped.
- Emergency raised in the frame shows in the shell banner and on the Emergency screen (if built) and can be acknowledged there; the watch page then reads "Help is on the way".
- With no network settings configured, every page still works.
- Two browser windows, one on `/watch` and one on `/w?room=` with the same code, stay in step.

**Report:** what you built, the result of each check, and what still needs testing on the real watch.

---

## Part B · Native Wear OS app

**Phase 4. Runs alone in its own folder, so it can overlap with anything.**

| | |
|---|---|
| Branch | `lane/08b-watch-native` |
| You own | `watch-native/` only |
| Read first | AGENTS.md, docs/WATCH.md (all), docs/CONTRACTS.md sections 10 and 11, `app/src/watch/NOTES.md`, sections 3 and 4 of prompts/companion/medbot-system-prompt.md, `api/README.md` |
| Needs | Part A merged. Prompt 10 part B deployed. The home checklist in docs/WATCH.md completed: tools installed, sample app installed on the watch once |
| Fill in first | `[watch model and its Wear OS version]`, `[public address of the console]` |
| Use | A capable model. Platform details change between Wear OS versions and a weak guess wastes an install |

### Prompt

Read AGENTS.md, docs/WATCH.md and `app/src/watch/NOTES.md` before doing anything. You are creating a new native app for Wear OS in `watch-native/`, for a **[watch model and its Wear OS version]**. Nothing outside that folder changes.

The app is the wrist companion of Ophiuchus, an astronaut health console. It will be demonstrated on a real watch on a real wrist, with a real heart rate, to hackathon judges. It will be installed over a phone hotspot, at most twice, so it must be small, must build first time, and must not need reinstalling when the website changes. `app/src/watch/NOTES.md` describes the four screens exactly; reproduce them with the platform's standard components. Add nothing that file does not describe.

**Before writing anything:** look up the current official Wear OS documentation for this watch's version on these four points, and tell me what you found: the recommended way to build a paged app with Compose for Wear OS; how to read live heart rate through the platform's health services and which permissions it needs on this version; how to start the system's voice input and get text back; and how to make a network request while the watch is connected through its phone or Wi-Fi. Do not rely on memory for permission names or library names. **Then stop and wait for my OK.**

**Build, in this order, and make each step installable before starting the next:**

1. **Project.** Kotlin, Compose for Wear OS, the lowest sensible minimum version for this watch, one module. Dependencies limited to the platform's own Compose, health services and coroutines libraries, plus the smallest way to do an HTTP request and read JSON. Tell me before adding anything else. Dark theme with the colors from the web watch view.
2. **Settings in one place:** the console's public address `[public address of the console]`, from which the chat and events addresses are built as in CONTRACTS section 11. This is the only value baked into the app.
3. **Pairing code.** On first launch, generate a six-character code from letters and digits that are easy to read aloud (no 0, O, 1, I), keep it in the app's storage, and use it as the room for every message. Nothing is ever typed on the watch.
4. **Four pages** with horizontal paging and page indicators: Health overview (home), Talk to the Med bot, Emergency, About.
5. **Emergency page first,** because it matters most. Hold for two seconds with a ring that fills; releasing early cancels. On completion, post an `emergency.raised` message as in CONTRACTS section 10 and vibrate. Show "Alert sent", the time, and a ten-second Cancel that posts `emergency.cancelled`. Poll the events endpoint every two seconds while an alert is open; on `emergency.acknowledged` for that alert, vibrate and show "Help is on the way". If the post fails, show "Alert saved, sending when connected" and retry every five seconds. Small text: "Demo. No real alert is sent."
6. **Health overview page.** Ask for the body-sensor permission with one plain sentence of explanation the first time. Show live heart rate, large, with "LIVE". If permission is refused or no reading arrives, show "No reading" and a retry. Post a `vitals.sample` with source `live` every five seconds while the app is on screen, but only after at least one message from a console has arrived in this room. Until a console has joined, readings stay on the watch. Poll for `summary.updated` and show its three statuses as rings and its `ophiLine`; before any summary arrives, the rings read "Pair with console".
7. **About page.** The text from the notes file, the pairing code in large type, connection state (Connected, or Offline), and the build time.
8. **Talk to the Med bot page.** A large button that starts the system voice input. Send the resulting text to the chat endpoint with `replyMode` `watch` and a context block containing only the screen and mission lines (the watch does not hold the person's summary). Show the reply, and speak it if the platform's text-to-speech is available without extra setup. If voice input is unavailable or returns nothing, show the three preset questions as buttons. If the request fails or takes more than eight seconds, answer the preset questions with the "I don't feel well" and generic offline replies from section 4 of the companion prompt file.
9. **`watch-native/README.md`:** the exact steps to build and install over wireless debugging on a phone hotspot, the permissions to accept on the watch, how to read the pairing code, how to produce an installable app file for the phone-based backup installer, and what to try if the install fails.

**Rules:**

- No account, no sign-in, no analytics, no data stored on the watch except the pairing code.
- Messages carry the room code and numbers only. No name, no device identifier.
- The app keeps working with no network: heart rate, the Emergency hold with its "saved" state, and the preset questions.
- Keep the installable file as small as you reasonably can and tell me its size.

**Checks you must run and pass before reporting:**

- The project builds cleanly from the command line.
- Installed on the physical watch, or if you cannot do that, say so and give me the exact command to run.
- Emergency held on the watch appears on the console at the public address; acknowledging on the console changes the watch.
- Heart rate on the watch matches the watch's own built-in heart-rate app within a few beats, and appears on the console's Physical activity screen with the LIVE badge.
- With the hotspot turned off, every page still shows something sensible.

**Report:** what works on the device, what was only tried in an emulator, the file size, and anything from the documentation lookup that differed from docs/WATCH.md.

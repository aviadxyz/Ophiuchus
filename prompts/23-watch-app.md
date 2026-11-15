# 23 · The Wear OS watch app, kept light

**Runs alone in `watch-native/`. Replaces part B of prompt 08, which planned a heavier app.**

The watch face already exists as a web page: `https://ophiuchus.ramisaada8.workers.dev/w`. It shows heart rate, three rings, the Med bot page and a hold-to-send emergency, and it shows any crew emergency full-face with "Acknowledge". This prompt wraps that page in a small Wear OS app and adds the one thing a web page cannot do on a watch: read the watch's heart-rate sensor and send it to the console.

| | |
|---|---|
| Branch | `lane/23-watch-app` |
| You own | `watch-native/` only |
| Read first | AGENTS.md, docs/CONTRACTS.md sections 10 and 11, docs/WATCH.md, `app/worker/README.md` (the events endpoint), `app/src/watch/WatchApp.tsx` |
| Fill in first | `[watch model and its Wear OS version]` |
| Time box | One hour. If the app is not on the wrist by then, stop: the web page at `/w` is the fallback |

## Prompt

The build has started and you may write code. Read AGENTS.md, CONTRACTS sections 10 and 11 and `app/worker/README.md` before doing anything. Work only inside `watch-native/`. The watch is `[watch model and its Wear OS version]`; Android Studio and the Android SDK are installed on this Mac and the watch is in developer mode.

Build the smallest Wear OS app that does four things. Kotlin, one module, one activity, no Compose, no libraries beyond the Android SDK and AndroidX core unless the build cannot work without one. Before writing, look up the current official guidance for a Wear OS app's minimum manifest and Gradle setup, and tell me the versions you will use.

1. **First screen, native, shown once:** "Who is wearing this watch?" as a scrolling list of six large rows: Rami, Aviad, Shoval, Elia, Tal, and "Demo". The choice is remembered. A long press on the watch face later shows the list again.
2. **A pairing code.** On first run the app makes a six-character code from the letters and digits `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, remembers it, and shows it for ten seconds after the choice above: "Type this code into the console's Watch tab", with the code in large type. Nothing is ever typed on the watch.
3. **The watch face.** A full-screen `WebView` with JavaScript and DOM storage on, loading `https://ophiuchus.ramisaada8.workers.dev/w?room=CODE&as=NAME`, where `NAME` is the chosen first name in lower case and is left out for "Demo". Keep the screen on while an emergency is showing if you can tell from the page title or URL; otherwise keep it on while the app is in front. Add the vibrate permission so the page's vibration calls work. If the watch has no WebView, show the address and the code as text instead of crashing.
4. **Heart rate, from the watch's own sensor.** Ask for the body-sensors permission with a one-line reason. While the app is in front and the person chose a name (never for "Demo"), read the heart-rate sensor and, every five seconds, send the latest value to the events endpoint as a `vitals.sample` message exactly as CONTRACTS section 10 describes: `POST https://ophiuchus.ramisaada8.workers.dev/api/events` with `id` (a new unique id each time), `room` (the code), `type` `vitals.sample`, `at` (now, ISO 8601, UTC), `origin` `watch`, `payload` `{ "heartRate": <number>, "source": "live" }`. Skip a send when there is no reading or it is outside 20 to 250. No reading is ever stored on the watch, logged, or sent anywhere else.

Also: the app name is "Ophiuchus"; use a plain generated icon in the app's dark background and green accent, with no agency logo; an About line somewhere reachable, "Demo. Not a medical device."

**Checks:**

- `./gradlew assembleDebug` succeeds. Give me the one `adb` command that installs the result on the watch, and the one that shows its log.
- On the watch: pick a name, see the code, see the watch face. Type the code into the console's Watch tab on a laptop set up as the same team member, with sharing on: the console shows PAIRED. A watch and the console it is paired with belong to one person, because the heart rate the watch sends is recorded for the console's active profile.
- Hold the emergency on the watch for two seconds: the laptop shows the banner "Emergency from [role]" within about three seconds. Raise one on the laptop: the watch shows it full-face, and "Acknowledge" on the watch clears it on the laptop.
- With the heart-rate permission granted, the console's heart-rate tile shows a value marked LIVE that changes.

**Report:** what you built, the exact install steps, the result of each check, and what you could not test.

Commit and push this branch as you go. Do not merge.

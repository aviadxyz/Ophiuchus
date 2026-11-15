# watch-native: the Ophiuchus Wear OS app

## Plan (written before building)

- `Settings.kt`: the names, the pairing-code maker, the remembered name and code, the watch-face URL.
- `HeartRate.kt`: the heart-rate permission name, the sensor reader, and the five-second `vitals.sample` POST.
- `MainActivity.kt`: the one activity. Name list, permission reason, pairing code, then the full-screen `WebView`.
- Manifest, theme, colours and a generated icon in `app/src/main/res`.
- Gradle: AGP 8.13.0, Gradle 8.14.3, Kotlin 2.2.20, compileSdk and targetSdk 36, minSdk 30. No libraries.

## What is built (version 1.1)

The app is now native pages. The web watch face (`/w`) is no longer loaded inside it.

- **Intro:** three short cards on first run (Hi I'm Ophi; the four screens; good to know). Replay it from About.
- **Name and code:** the same "Who is wearing this watch?" list, the heart-rate reason, then the six-character pairing code for ten seconds (tap to skip). Remembered.
- **Four pages, swipe sideways, page dots at the bottom:**
  1. **Emergency (home).** Hold the amber SOS button for two seconds. Posts `emergency.raised` ("Emergency from watch", no role), vibrates, shows "Alert sent" with the time, offers Cancel for ten seconds (`emergency.cancelled`), polls every two seconds and shows "Help is on the way" with a vibration when the console acknowledges. If the send fails: "Sending when connected", retried every three seconds for up to ten minutes.
  2. **Talk to Ophi.** Tap to talk. Uses the watch's speech recogniser (in-app, needs the microphone permission), or the system speech screen if only that exists, or three quick-question buttons if neither is available. The question goes to `POST /api/chat` with `replyMode` `watch` and a context block built from what the console shared (see below) and the live heart rate. The reply is shown and spoken with the watch's text-to-speech. If the reply is urgent, a "Go to Emergency" button appears. If the server cannot be reached: "I can't reach the console right now", and for "I don't feel well" it adds "Tell your flight surgeon. If it is urgent, use Emergency."
  3. **Health.** Heart rate from the watch sensor with LIVE, then sleep, exercise, mood, food and water from the console's `summary.updated` message, each with a word as well as a symbol (On target, Watch, Act, No data), the console's one-line text and a source badge, plus open alerts and Ophi's line. Before the console has sent anything it says so and shows the pairing code. Demo has no sensor reading and says so.
  4. **About.** What the app is, the address it connects to, link status (Online / Offline), who wears the watch, the pairing code, version and build number, when it was installed, "Demo. Not a medical device.", and buttons to replay the intro and to change person.
- **A crew emergency arriving on the watch:** the app polls the events endpoint every two seconds while it is in front. A console-raised `emergency.raised` less than ten minutes old fills the face in amber with "Emergency from [role]", the message and an Acknowledge button, and vibrates. Acknowledge posts `emergency.acknowledged`. A cancel or acknowledge from elsewhere clears it.
- **Heart rate sharing:** unchanged. While the app is in front, for a named person (never Demo), every five seconds as `vitals.sample`. Skipped with no fresh reading or outside 20 to 250.
- Changing person clears the summary and any alert held in memory, so one person's data is never shown as the next person's.
- Nothing about health is written to the watch: the summary, readings and replies live in memory only. Only the chosen name, the pairing code and "intro seen" are stored.

## What the Ophi context holds

Only what the console put in `summary.updated` (the five area statuses and texts, open alerts), the live heart rate and whether the profile is Demo. No mission line is sent because the watch does not know the mission.

## Earlier additions (now part of the Emergency page)

- **Distress button (native).** Hold the amber SOS button for two seconds (a ring fills; releasing early cancels). It posts `emergency.raised` with `alertId` and the message "Emergency from watch" (no role: the watch does not know one), vibrates, and shows "Alert sent" with the time. Cancel is offered for ten seconds and posts `emergency.cancelled`. The screen polls the events endpoint every two seconds and shows "Help is on the way" with a vibration when `emergency.acknowledged` arrives for that alert. If the send fails it says "Sending when connected" and retries every three seconds for up to ten minutes. The same button is on the no-web-view screen.
- `Relay.kt` is the one place that talks to `/api/events`; the heart-rate sender uses it too.

## Not added, and why

- **Blood oxygen and skin temperature:** Health Services 1.1.0 (the current stable library) has no data type for either, so there is no supported way to read them from a third-party app. Samsung's own sensor SDK would be needed and requires Samsung's approval. Not built.
- **Steps:** `vitals.sample` in CONTRACTS section 10 has no `steps` field. It needs the contract and the console changed first. Not built.

## Differences from the prompt

- The web watch face is no longer inside the app; the pages are native. "Change person" is on About instead of a long press.
- **Keep screen on** while the pages are in front.
- Swipe-to-dismiss is turned off so sideways swipes move between pages. Leave the app with the watch's button.

## Faked or stubbed

Nothing is faked. The face is the live page.

## Not verified

See the report. Anything not listed there as tested was not tested.

## Install and log

```
~/Library/Android/sdk/platform-tools/adb install -r watch-native/app/build/outputs/apk/debug/app-debug.apk
~/Library/Android/sdk/platform-tools/adb logcat -s Ophiuchus
```

Build: `cd watch-native && ./gradlew assembleDebug` (JDK 17 or newer, Android SDK platform 36).

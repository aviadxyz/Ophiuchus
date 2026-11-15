# watch-native: the Ophiuchus Wear OS app

## Plan (written before building)

- `Settings.kt`: the names, the pairing-code maker, the remembered name and code, the watch-face URL.
- `HeartRate.kt`: the heart-rate permission name, the sensor reader, and the five-second `vitals.sample` POST.
- `MainActivity.kt`: the one activity. Name list, permission reason, pairing code, then the full-screen `WebView`.
- Manifest, theme, colours and a generated icon in `app/src/main/res`.
- Gradle: AGP 8.13.0, Gradle 8.14.3, Kotlin 2.2.20, compileSdk and targetSdk 36, minSdk 30. No libraries.

## What is built

- First screen: "Who is wearing this watch?" with Rami, Aviad, Shoval, Elia, Tal, Demo. The choice is remembered.
- A six-character pairing code (alphabet from CONTRACTS section 10), made once and kept. Shown for ten seconds after the choice (tap to skip). Nothing is typed on the watch.
- Watch face: `WebView` with JavaScript and DOM storage on, loading `/w?room=CODE&as=name` (`as` left out for Demo). Screen stays on while the face is in front. If there is no WebView, the address and code are shown as text. If the page cannot load, a short offline message is shown and the page reloads when the app comes back to the front.
- Heart rate: reads the watch sensor while the face is in front, for a named person only (never Demo), and POSTs `vitals.sample` every five seconds as CONTRACTS section 10 describes. Skips when there is no fresh reading (older than 15 s) or the value is outside 20 to 250. The reading is held in memory only until the next send. The log never holds a value.
- Permission: `android.permission.health.READ_HEART_RATE` on Wear OS 6 (API 36), `BODY_SENSORS` below that. A one-line reason is shown before the system prompt.
- About line "Demo. Not a medical device." is on the name list and the code screen.
- Icon: adaptive icon, dark background `#07090F`, green ring `#34D399`. No agency logo.

## Differences from the prompt

- **Long press to change the person** works only in the top 15% of the face. The page's emergency button is a two-second hold, and a long press anywhere would fire in the middle of it.
- **Keep screen on** is on whenever the face is in front, because the app cannot read the page title.
- Swipe-to-dismiss is turned off so the page's own swipes between its four pages work. Leave the app with the watch's button.

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

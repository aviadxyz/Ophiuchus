# Watch app

Four screens: Health overview, Talk to the Med bot, Emergency, About.

**Hardware:** Rami's Wear OS watch, plus possibly a few cheap watches. No Apple devices.

Device and platform facts below are from memory, not current documentation. Each is marked **check**. The agent building the native app looks up the current official guidance before writing anything.

## Who does what

| Device | Role | How |
|---|---|---|
| Wear OS watch | Runs the Ophiuchus watch app and is the live heart-rate sensor | A small native app (Kotlin, Compose for Wear OS) installed once |
| Cheap watches and bands | Sensors only. They cannot run our app | Bluetooth heart-rate broadcast straight into the console's browser, if the model has a broadcast mode. **Check** each model's settings for "heart rate broadcast" or "sensor mode" |
| Console (laptop or phone) | Shows everything, raises and acknowledges alerts | The web app |
| Watch view in the browser | Reference design, backup if the watch fails, and what goes in the video | Part of the web app at `/w`, shown in a drawn watch frame on the Watch screen |

Wear OS watches generally have no usable browser and **check** do not support embedding a web page inside an app, so the web watch view cannot be the app on the wrist. It is still built first, because it is quick, it defines the screens exactly, and it is the fallback.

## Getting the app onto the watch without fighting the venue Wi-Fi

Installing to a Wear OS watch means the laptop talks to the watch over a network. Crowded public Wi-Fi is the worst place for that: such networks often block devices from seeing each other, and watches cannot get through sign-in pages. So the plan avoids the venue network entirely.

1. **Install the tools at home.** Android Studio, the Wear OS components, and the device tools are large downloads. Do them on home internet, and build the stock Wear OS sample project once so the build system's own downloads are already on the laptop. On venue Wi-Fi this step alone could take an hour.
2. **Do the first install at home.** Turn on developer options and wireless debugging on the watch, pair it with the laptop once, and install the sample app. This proves the whole path and leaves the two devices paired.
3. **At the venue, use a phone hotspot as a private network.** Laptop and watch both join the hotspot. Nothing else is on it, devices can see each other, and there is no sign-in page. Never use the public Wi-Fi for installs. Any phone works; it does not need to be the phone the watch is paired with.
4. **Keep the app tiny.** No heavy libraries. A small app installs in seconds even on a weak link.
5. **Install as few times as possible.** The app has one thing baked in: the public address of the console. Everything that might change during the weekend lives on the console side: the Med bot's wording, the health summary, the statuses. A new deploy of the website never needs a new watch install. Plan for two installs in total: Saturday night and Sunday morning.
6. **Pairing is a six-character code, not a login.** The watch shows a code on first launch. Type it once into the console's Watch screen. Nothing is typed on the watch.
7. **Backup route:** there are phone apps that can install an app file onto a Wear OS watch over the same hotspot with no laptop. **Check** one works with this watch at home and keep it installed on a phone, with the app file saved on that phone.

For the watch's own internet during the demo (to reach the relay): the same phone hotspot, or the watch's Bluetooth link through its paired phone. **Check** at home which is more reliable, and that the watch reconnects on its own after its screen sleeps.

If the watch has no internet at all, the app still works alone: it shows its own heart rate, Emergency shows "Alert saved, sending when connected", and Talk to the Med bot falls back to the three preset questions.

## The four screens

Round face first: keep all content inside the inscribed circle. Dark background, the app's tokens. One action per screen. Text no smaller than 14 px on a 200 px face. Swipe between four pages with page dots. Health overview is home.

### Health overview (home)

- Heart rate, large. From the watch's own sensor in the native app, with a LIVE mark. In the browser view it comes from the store.
- Three small rings: sleep, exercise, mood. Each on target, watch, act, or no data. These come from the console's health summary through the relay.
- One line from Ophi, also from the summary.
- Before pairing: heart rate works, the rings read "Pair with console", and the pairing code is one swipe away on About.

### Talk to the Med bot

- A medical icon, the name "Med bot", and one large "Hold to talk" button, using the watch's built-in voice input. The answers come from the Med bot, the same assistant as on the console's Med bot screen.
- The spoken words appear, then the Med bot's reply, at most two short sentences, spoken aloud if the watch makes that simple.
- If voice input is unavailable: three preset questions as buttons. "How am I doing today?", "What should I do next?", "I don't feel well."
- If the network is down: the preset questions get the scripted answers from the companion prompt file.

### Emergency

- One large orange button filling most of the face.
- Press and hold two seconds, with a ring that fills. Releasing early cancels.
- After sending: "Alert sent", the time, and a ten-second cancel.
- When the console acknowledges: "Help is on the way".
- Vibration on send and on acknowledgement.
- A small line: "Demo. No real alert is sent."

### About

- Ophi, the project name, the team name, "NASA Space Apps Challenge 2026".
- "Demo. Not a medical device."
- The pairing code, large.
- Connection status and the app's build time.

## What the native app reads from the watch

| Reading | Plan |
|---|---|
| Heart rate | Yes. Through the platform's health services, after the person grants the body-sensor permission. **Check** the current permission names for this watch's Wear OS version |
| Steps today | Only if it is nearly free to add |
| Blood oxygen, skin temperature, sleep stages | No. Not generally open to third-party apps on Wear OS. **Check**, but do not plan around it |

Heart-rate samples are sent to the console every few seconds while the app is open, only if the person turned on sharing when they set up their profile.

## How the watch and the console talk

The message shapes are fixed in [CONTRACTS.md](CONTRACTS.md) section 10. Carried by the events endpoint with polling every two seconds. The room code is the only link between the two; messages carry no name.

## Time boxes

| Step | Limit | If it runs over |
|---|---|---|
| Tool install and sample app on the watch, at home | One evening | Without this, do not attempt the native app at the venue |
| Native app with four screens installed | 2 hours of build time | Ship with whichever screens work. Emergency and Health overview first |
| Talk to the Med bot by voice | 30 minutes | Preset question buttons only |

If the native app is not on the wrist by Sunday 11:00, stop. The demo becomes: watch view in the frame on the console, and live heart rate from any watch that can broadcast it.

## Checklist before leaving for the venue

- [ ] Tools installed, sample app built and installed on the watch once.
- [ ] Watch and laptop paired for wireless debugging.
- [ ] Hotspot tested: laptop and watch both join it, install works over it.
- [ ] Backup installer app on a phone, tested once.
- [ ] Watch charged to 100%. Charger packed.
- [ ] For each cheap watch: found the heart-rate broadcast setting, or noted that it has none.

## Checklist on demo day

- [ ] Hotspot on, watch and demo laptop joined.
- [ ] Watch screen timeout at its longest setting. Other notifications silenced.
- [ ] Paired with the console by code. Rings show the same statuses as the console.
- [ ] Emergency tested end to end three times.
- [ ] Talk to the Med bot tested in the room's actual noise.
- [ ] The Watch screen with the frame open in a browser tab as backup.

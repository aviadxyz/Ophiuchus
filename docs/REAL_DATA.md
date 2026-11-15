# Real data

The demo uses the team's own data from the watches and sensors the team has. This file says what is real, how it gets into the app, how it is labeled, and the privacy rules that come with using real health data from real people.

Device facts below are from memory, not from current documentation. Each is marked **check on the device**.

## The framing

The team members are the crew. The sensors and the readings are real. The mission (Ophiuchus-1, mission day, location, delay to Earth) is the scenario. The targets come from NASA sources. Saying exactly that, on the About screen and in the pitch, is stronger than a fully simulated demo and stays honest.

## Two kinds of profile

| Profile | Data | Used for |
|---|---|---|
| Demo crew member (always present) | 14 days of simulated history with a deliberate story | A full, rich walk-through. What a judge sees if they pick up the laptop cold |
| Team member (one per person) | Real, starting from when they set it up | Showing the system working on a live human with a real watch |

A switcher in the sidebar changes profile. Every value on every screen carries a small source badge so nobody has to guess what is real.

| Badge | Meaning |
|---|---|
| LIVE | Coming from a sensor right now |
| ENTERED | Typed in by the person |
| IMPORTED | Loaded from the person's health export |
| SIMULATED | Generated for the demo |

Real profiles have gaps. Charts show a gap as a gap. A real profile is never padded with simulated values.

## What can be real, and how it gets in

| Data | Real source | Path into the app |
|---|---|---|
| Heart rate, live | Watch or chest strap | Path B or C below |
| Blood oxygen, skin temperature | Watch, if it measures them | Path C only. Otherwise shown as "not available" |
| Sleep | The watch's own sleep tracking | Path A (enter last night's hours) or path D |
| Exercise sessions | The person | Marked done on the Physical activity screen. Game rounds log real minutes |
| Food and water | The person | Entered on the Nutrition screen |
| Mood | The person | Check-in on the Mood screen or the watch |
| Height, body mass | The person | Entered at profile setup, optional |
| Medical conditions | See the note below | |

### Path A · Typed in (always works)

Profile setup asks for a display name and, optionally, height, body mass and last night's sleep. Everything else is entered through the normal screens during the weekend. This is real data with zero technical risk, and it is built first.

### Path B · Bluetooth heart-rate broadcast (web only)

Many sports watches and chest straps can broadcast heart rate as a standard Bluetooth heart-rate sensor. A browser that supports Web Bluetooth can read it directly, with no native app. **Check on the device:** whether each watch has a broadcast mode (often called "broadcast heart rate" or "sensor mode"), and that the demo browser supports Web Bluetooth. From memory, Chrome and Edge on a laptop and Chrome on Android do; Safari and all iPhone browsers do not. This is the path for the cheap watches. A Wear OS watch does not broadcast this way by itself, so it uses path C.

### Path C · Native watch app

A small app on the watch reads the sensors and sends samples to the console through the relay, paired by a six-character room code. This is the path for the Wear OS watch, and it is the same native app described in [WATCH.md](WATCH.md).

### Path D · Import from the phone's health app (stretch)

The person exports their data from the phone's health app and loads the file into the console in the browser. The file is read on the device and never uploaded. Export files differ by platform and can be large, so this is built last and only for sleep and resting heart rate. **Check on the device:** what each person's phone can export and in what format.

### Build order

A, then B, then C, then D. Each one is useful without the next.

## Privacy rules

Health data is sensitive. These rules are short on purpose and they are not optional.

1. **Each person decides for themselves.** Nobody sets up a profile for someone else. A person can stay on the demo profile all weekend.
2. **Data stays on the person's own device** by default, in that browser's storage.
3. **Two switches at profile setup, both off by default:**
   - "Share live readings with my paired watch and console." Needed for path C. Readings pass through the relay, linked only by the room code, and are deleted after an hour.
   - "Let the Med bot see my summary to personalize answers." When on, a short summary of today's status is sent to the language model's provider with each question. When off, the Med bot answers in general terms.
4. **Never in the repo.** No real reading, name, export file or screenshot of a real profile is committed, pasted into an AI tool, or used as a test fixture. Tests use the demo profile.
5. **No names in transit.** Messages carry the room code and numbers only. The crew network (rule 10) carries the handle a person chose for it, never their display name.
6. **Delete works.** "Delete my data" on the About screen removes the profile and everything recorded for it from the device.
7. **The video and slides** show a real profile only if that person has said yes to that specific footage. Otherwise record the demo profile.
8. **Medical status screen:** use fictional conditions and medications, even on a real profile, unless the person chooses to enter their own. A real medical history on a projector is not worth it.
9. **Mood notes** on a real profile stay on the device and are never sent to the model, the relay or the crew network.
10. **Social is opt-in, twice.** Joining the crew network is the person's choice, and "Share my mood with friends" is a second switch that is off until they turn it on. Friends see a handle, a role and, if allowed, the word for the latest mood check-in and up to two feelings. Nobody sees a reading, a note, a real name or anything from another screen. Chat messages are deleted from the server after 24 hours, and "Leave the crew network" removes the account, the friendships and the messages at once. The demo profile uses a simulated crew and never touches the real network.
11. **Questions forwarded by the Med bot** stay on the device. In this demonstration nothing is sent to a real person, and the screen says so.

## Honesty about the sensors

Consumer watches are not medical devices, and their readings can be wrong. The app says so on the About screen. No screen turns a live reading into a medical conclusion. An unusual reading produces "check the sensor and how you feel", never a diagnosis.

## If a sensor fails on demo day

- Heart rate tile shows "Sensor disconnected" with a reconnect button. It does not silently switch to simulated values on a real profile.
- Switch to the demo profile and carry on. Its simulator is always available.

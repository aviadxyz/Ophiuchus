# Contracts

The fixed names, paths and shapes that every agent builds against. Several agents on different AI tools work on this repo at the same time. They can only do that safely if none of them invents a name another one depends on. So:

- **Everything in this file is decided. Use the names exactly as written.**
- If something you need is missing here, or looks wrong, stop and ask the human. Do not improvise a name, a path or a field.
- Only Rami changes this file. A change here is announced to everyone before anyone builds on it.

This file describes interfaces. It is not code. The agent running prompt 01 or 02 turns the relevant section into real types and components.

## 1. Stack (pinned)

| Purpose | Choice | Notes |
|---|---|---|
| Runtime and package manager | Node LTS, npm | One lockfile, committed |
| Build | Vite | |
| UI | React with TypeScript, strict mode on | Function components only |
| Styling | Tailwind CSS v4 through its Vite plugin | Tokens are CSS variables in one file. Do not use v3-style config |
| Routing | React Router | Screens loaded on demand |
| State | Zustand with its persist middleware | One store, in `data` |
| Charts | Recharts | Imported only inside `design/charts`. Screens use the wrappers |
| Icons | lucide-react | |
| Fonts | Inter (sans), JetBrains Mono (mono), from Fontsource packages | Bundled, no network font loading |
| Installable and offline | vite-plugin-pwa | |
| Tests | Vitest with React Testing Library | |
| Camera body tracking (games only) | MediaPipe Tasks Vision | Loaded only when a game opens |

Prompt 01 installs all of these, including the games library, and records the exact versions in `app/README.md`. **No other prompt adds a dependency** without the human saying yes.

Scripts that must exist in `app/package.json`, by these names: `dev`, `build`, `preview`, `lint`, `typecheck`, `test`.

Import alias: `@/` means `app/src/`.

## 2. Folders and files

```
app/src/
  config.ts                      reads environment settings (section 11)
  main.tsx, App.tsx
  shell/                         OWNER: lane 01
    AppShell.tsx  Sidebar.tsx  TopBar.tsx  MobileDrawer.tsx
    ProfileSwitcher.tsx  AlertBanner.tsx  ScreenBoundary.tsx  router.tsx
  registry/                      OWNER: lane 01
    types.ts  index.ts
  design/                        OWNER: lane 01
    tokens.css
    components/                  one file per component in section 6
    charts/                      Sparkline.tsx  TrendChart.tsx
    index.ts                     the only import path for screens: `@/design`
  data/                          OWNER: lane 02
    types.ts  store.ts  selectors.ts  levels.ts
    seed.ts  foods.ts  targets.ts  simulator.ts
    sources/                     bluetoothHeartRate.ts  relay.ts  healthImport.ts
    social/                      OWNER: lane 17. The crew network (sections 8, 9 and 11)
    index.ts                     the only import path for screens: `@/data`
    README.md
  ophi/                          OWNER: lane 03
    Ophi.tsx  OphiPanel.tsx  ophiState.ts  index.ts  NOTES.md
  screens/<screen-id>/           OWNER: that screen's lane
    index.tsx                    default export: the screen component
    meta.ts                      named export `meta` (section 4)
    guide.ts                     named export `guide` (section 5)
    NOTES.md
  games/<game-id>/               OWNER: that game's lane
    index.tsx  meta.ts  NOTES.md
  watch/                         OWNER: lane 08
    WatchApp.tsx  pages/  NOTES.md
app/public/ophi/                 character images
api/                             OWNER: lane 10
api/social/                      OWNER: lane 17
watch-native/                    OWNER: lane 08, only if built
```

A lane writes only inside the folders it owns. Screens and games import from `@/design`, `@/data`, `@/ophi` and `@/registry` only, never from another screen's folder and never from a file deep inside a shared folder.

## 3. Screens and routes

Screen ids are fixed. The folder name is the id.

| Id | Label | Group | Order | Owner |
|---|---|---|---|---|
| `overview` | Overview | console | 10 | Rami |
| `risks` | Risks | console | 20 | Aviad |
| `environment` | Environment | console | 25 | Rami |
| `sleep` | Sleep | console | 30 | Aviad |
| `medical-status` | Medical status | console | 40 | Elia / Rami |
| `mental-health` | Mental health | console | 50 | unassigned |
| `performance` | Performance | console | 60 | Aviad |
| `medbot` | Med bot | console | 70 | Rami |
| `nutrition` | Nutrition | daily | 10 | Rami |
| `physical-activity` | Physical activity | daily | 20 | Rami |
| `mood` | Mood | daily | 30 | Rami |
| `social` | Social | daily | 40 | Rami |
| `research` | Research | reference | 10 | Aviad |
| `watch` | Watch | reference | 20 | Rami |
| `about` | About | reference | 30 | Rami |
| `emergency` | Emergency | pinned | 10 | Elia / Rami |

Group headings shown in the sidebar: console is "CONSOLE", daily is "DAILY LIFE", reference is "REFERENCE". The pinned group has no heading and sits at the bottom.

| Route | Shows |
|---|---|
| `/` | Redirects to `/overview` |
| `/<screen-id>` | That screen inside the shell |
| `/games/<game-id>` | That game, full window, with a back control |
| `/w` | The bare watch view with no shell (short so it can be typed on a watch). Accepts `?room=<code>` |
| `/dev/components` | Demo page of every shared component. Not in the sidebar |
| anything else | Not-found page inside the shell |

## 4. Screen meta

Each screen folder has `meta.ts` exporting `meta`. The registry collects every `screens/*/meta.ts` automatically at build time and pairs it with that folder's `index.tsx`, loaded on demand. **Nobody edits a central list.** Adding a screen is adding a folder.

| Field | Type | Meaning |
|---|---|---|
| `id` | text | Must equal the folder name |
| `label` | text | Sidebar label and screen title |
| `group` | `console`, `daily`, `reference`, `pinned` | |
| `order` | number | Position inside the group, lowest first |
| `icon` | text | A lucide icon name |
| `owner` | text | Person's first name, or `unassigned` |
| `status` | `ready`, `building`, `placeholder` | `placeholder` shows a "soon" marker in the sidebar |
| `eyebrow` | text | For example `DOMAIN · NUTRITION` |
| `description` | text | One sentence, shown under the title and used by Ophi's default text |

What `@/registry` exposes: `screens` (all meta, sorted), `getScreen(id)`, `screensByGroup(group)`, and the same three for games (`games`, `getGame(id)`, `gamesForScreen(screenId)`).

## 5. Guide text

Each screen folder has `guide.ts` exporting `guide`.

| Field | Type | Meaning |
|---|---|---|
| `shows` | text | What this screen shows, one or two sentences |
| `whyItMatters` | text | Why it matters in space, one or two sentences |
| `howToRead` | list of up to 3 texts | How to read it |
| `whenToAct` | text | What to do yourself and when to tell the flight surgeon, one or two sentences. No diagnosis and no doses |

## 6. Shared components

All exported from `@/design`. Screens compose these and do not restyle them.

| Component | Inputs | Notes |
|---|---|---|
| `ScreenHeader` | `eyebrow`, `title`, `description`, `pills` (list of `tone` + `label`, max 3) | First element of every screen |
| `StatusPill` | `tone`, `label` | |
| `SourceBadge` | `source` | Shows LIVE, ENTERED, IMPORTED or SIMULATED |
| `StatTile` | `label`, `value`, `unit`, `targetText`, `level`, `source`, `trend` (numbers, optional), `onOpen` (optional) | Shows the source badge when `source` is given |
| `DataTable` | `columns`, `rows` (each: `id`, `barTone`, `cells`, `pill`, `onOpen`) | Rows on PC, stacked cards under 640 px |
| `Card` | `title` (optional), `footer` (optional), content | |
| `DetailDrawer` | `open`, `title`, `onClose`, content | Right side on PC, bottom sheet on phone |
| `ConfirmDialog` | `open`, `title`, `message`, `confirmLabel`, `onConfirm`, `onCancel` | |
| `Button` | `variant` (`primary`, `quiet`, `danger`), `size` (`md`, `lg`), `icon` (optional), `disabled`, `onClick` | |
| `TextField`, `NumberField` | `label`, `value`, `onChange`, `hint`, `error`, plus `min`, `max`, `unit` for numbers | |
| `ChipGroup` | `options`, `selected`, `onChange`, `multiple` | Tags and pickers |
| `ProgressBar` | `value` (0 to 1), `tone`, `label` | |
| `ProgressRing` | `value` (0 to 1), `tone`, `size`, content | Watch rings and hold-to-send |
| `EmptyState` | `message`, `actionLabel`, `onAction` | |
| `SourceLine` | `text`, `href` (optional) | "Source: ..." under a target or fact |
| `SectionLabel` | content | Mono, uppercase, muted |
| `Sparkline` | `values`, `tone` | Gaps allowed (missing days) |
| `TrendChart` | `kind` (`line`, `bar`), `labels`, `series` (each: `name`, `values`, `tone`), `targetValue` (optional), `summary` (text for screen readers) | Gaps allowed |
| `GameLinks` | `screenId` | Renders nothing when no game is registered for the screen |
| `Switch` | `label`, `checked`, `onChange`, `hint` (optional), `disabled` | An on/off setting. Shows the words ON or OFF next to the control |
| `ChatThread` | `messages` (each: `id`, `side` (`me` or `them`), `text`, `time`, `note` (optional small text under the bubble)), `pending` (yes/no, shows a waiting bubble on the `them` side), `emptyText` | Bubbles, oldest at the top, kept scrolled to the newest. Used by Med bot and Social so both chats look the same |
| `ChatInput` | `value`, `onChange`, `onSend`, `disabled`, `maxLength`, `placeholder` | One text line and a send button. Enter sends. Stays above the phone keyboard |

## 7. Shared vocabulary

| Name | Values | Used for |
|---|---|---|
| `Tone` | `ok`, `info`, `warn`, `danger`, `neutral` | Pill and bar colors. `ok` is the accent, `info` blue, `warn` amber, `danger` red |
| `Level` | `ok`, `watch`, `act`, `none` | A metric against its target. `none` means no data |
| `Source` | `live`, `entered`, `imported`, `simulated` | Where a value came from |

Level to tone: `ok` to `ok`, `watch` to `warn`, `act` to `danger`, `none` to `neutral`. Level labels: ON TARGET, WATCH, ACT, NO DATA.

How a level is computed, the same everywhere (implemented once, in `data/levels.ts`):

| Target kind | `ok` | `watch` | `act` |
|---|---|---|---|
| Minimum (reach at least) | 90% or more of target | 70% to under 90% | under 70% |
| Maximum (stay under) | at or under the limit | up to 20% over | more than 20% over |
| Range | inside | within 15% outside | further outside |

For totals that build up during the day (energy, water, protein, exercise minutes), today's value is compared with the share of the target expected by the current time, counting from 07:00 to 23:00. Past days are compared with the full target.

## 8. Data records

All defined in `data/types.ts`. Every record that holds a measurement has a `source`.

| Record | Fields |
|---|---|
| `CrewProfile` | `id`, `displayName`, `role`, `kind` (`member` or `demo`), `sex` (optional), `birthYear` (optional), `heightCm` (optional), `massKg` (optional), `consent` (`relay` yes/no, `assistant` yes/no), `createdAt` |
| `Mission` | `name`, `startDate`, `lengthDays`, `location` (`leo`, `lunar-surface`, `mars-transit`), `gravity`, `commDelaySeconds` |
| `SleepRecord` | `id`, `profileId`, `date` (the morning it ended), `hours`, `quality` (1 to 5, optional), `source` |
| `MealEntry` | `id`, `profileId`, `at`, `foodId`, `portions`, `source` |
| `WaterEntry` | `id`, `profileId`, `at`, `ml`, `source` |
| `ExerciseSession` | `id`, `profileId`, `date`, `device` (`resistive`, `treadmill`, `cycle`, `game`, `other`), `kind` (`resistive`, `aerobic`), `plannedMinutes`, `actualMinutes`, `status` (`planned`, `done`, `changed`, `skipped`), `skipReason` (optional), `detail` (optional text), `source` |
| `MoodCheckin` | `id`, `profileId`, `at`, `score` (1 to 5), `tags` (list), `note` (optional), `source` |
| `BodyMass` | `id`, `profileId`, `date`, `kg`, `source` |
| `VitalSample` | `id`, `profileId`, `at`, `heartRate` (optional), `spo2` (optional), `skinTempC` (optional), `source` |
| `Alert` | `id`, `profileId`, `at`, `kind` (`emergency`, `health`), `origin` (`console`, `watch`), `message`, `screenId` (optional), `status` (`open`, `cancelled`, `acknowledged`), `acknowledgedAt` (optional), `from` (optional text: the role of the person who raised it, present only on an alert that arrived from another device). A question the Med bot forwards to the flight surgeon is an alert of kind `health` with `screenId` `medbot`; it stays on the device |
| `FoodItem` | `id`, `name`, `kcal`, `proteinG`, `sodiumMg`, `calciumMg`, `ironMg`, `vitaminDIu`, `omega3G`, `potassiumMg`, `waterMl` |
| `Target` | `id`, `label`, `kind` (`min`, `max`, `range`), `value`, `upper` (ranges only), `unit`, `sourceText`, `sourceUrl`, `verified` (yes/no) |
| `MetricValue` | `value` (number or none), `targetId`, `level`, `source` |
| `DaySummary` | `date`, then one `MetricValue` per metric id below |
| `HealthSummary` | `sleep`, `food`, `water`, `exercise`, `mood` (each: `level`, `text`, `source`), `openAlerts`, `ophiLine`, `updatedAt` |
| `SocialAccount` | `profileId`, `socialId`, `handle`, `shareMood` (yes/no), `joinedAt` |
| `SharedMood` | `score` (1 to 5), `tags` (list, at most two), `at`, `source` |
| `SocialPerson` | `socialId`, `handle`, `role` (optional), `relation` (`none`, `outgoing`, `incoming`, `friend`), `mood` (a `SharedMood` or none; only ever present for a friend), `unread` (number of unread chat messages), `source` (`entered` for a real person, `simulated` for a simulated crew member) |
| `ChatMessage` | `id`, `fromId`, `toId`, `at`, `text`, `status` (`sending`, `sent`, `failed`) |
| `EnvironmentSample` | `at`, then one number per environment metric id below, `source` (always `simulated` in this demo: the app has no cabin sensor) |
| `ChallengeEntry` | `socialId`, `handle`, `score` (a number), `me` (yes/no), `source` (`entered` for a real person, `simulated` for the demo crew) |
| `ChallengeBoard` | `id` (a challenge id below), `joined` (yes/no: is the active profile taking part), `myScore` (a number or none), `entries` (list of `ChallengeEntry`, highest score first; empty when not joined) |

Metric ids: `sleepHours`, `energyKcal`, `waterMl`, `proteinG`, `sodiumMg`, `calciumMg`, `ironMg`, `vitaminDIu`, `omega3G`, `potassiumMg`, `exerciseMinutes`, `moodScore`, `bodyMassKg`, `heartRate`.

Target ids are the metric id it applies to, plus `resistiveSessionsPerWeek` and `aerobicSessionsPerWeek`.

Environment metric ids (added Sunday 15 November, built by prompt 25). They describe the station, not a person, so they are the same for every profile and are not part of `DaySummary`:

| Id | What | Unit shown |
|---|---|---|
| `temperatureC` | Cabin air temperature | °C |
| `humidityPct` | Relative humidity | % |
| `gravityG` | Gravity felt by the crew. Read from the mission's `gravity` | g |
| `oxygenPct` | Oxygen share of cabin air (air quality, part 1) | % |
| `co2MmHg` | Carbon dioxide partial pressure (air quality, part 2) | mmHg |
| `noiseDb` | Noise level in the cabin | dBA |
| `radiationUSvPerHour` | Radiation dose rate in the cabin, from the area monitor | µSv/h |
| `mosfetOutsideUGyPerHour` | Dose rate at the MOSFET dosimeter outside the hull | µGy/h |
| `mosfetInsideUGyPerHour` | Dose rate at the MOSFET dosimeter inside the cabin | µGy/h |

Each environment metric id is also a target id. A target whose limit has not been checked against a published source has `verified` off.

Challenge ids (added Sunday 15 November, built by prompt 26): `exercise` and `nutrition`. The `exercise` score is the percentage of this week's planned exercise minutes that are done, a whole number from 0 to 100. The `nutrition` score is the number of days this week, 0 to 7, on which energy, water and protein were all at level `ok`. A week runs Monday to Sunday. A score is the only thing about a challenge that ever leaves the device: never minutes, meals, mass or any other reading.

The mission is the same for everyone: name "Ophiuchus-1", start date 1 November 2026, so 14 November is mission day 14. Mission day is always computed from the start date.

There is always one demo profile with id `demo`, kind `demo`, with 14 days of simulated history. Real team members are profiles of kind `member`.

The crew network (Social): a profile joins it by choosing a `handle` of 3 to 20 letters, digits or underscores. The handle is the only name other people ever see; the profile's `displayName` never leaves the device. A `SharedMood` is the score and up to two tags of the person's latest mood check-in from the last 24 hours, and never the note. Mood score words, the same everywhere: 1 VERY LOW, 2 LOW, 3 OKAY, 4 GOOD, 5 VERY GOOD. The demo profile never joins the real network: it has a fixed simulated crew of six fictional people instead.

## 9. Store interface

All exported from `@/data`. Everything reads the **active profile** unless it takes a profile id. Screens never touch browser storage directly.

**Reading (React hooks):**

| Name | Gives |
|---|---|
| `useActiveProfile()` | The active `CrewProfile` |
| `useProfiles()` | All profiles |
| `useMission()` | The `Mission` plus `day` |
| `useToday()` | Today's `DaySummary` |
| `useDay(date)` | That day's `DaySummary` |
| `useSeries(metricId, days)` | One entry per day, oldest first: `date`, `value` (or none), `source` |
| `useMeals(date)` | Meal entries with their food items |
| `useWater(date)` | Water entries |
| `useExerciseSessions(fromDate, toDate)` | Sessions in the range |
| `useMoodCheckins(days)` | Check-ins, newest first |
| `useSleep(days)` | Sleep records |
| `useLatestVitals()` | Latest `VitalSample` or none, plus `connection` (`live`, `simulated`, `off`) |
| `useAlerts()` | Alerts, newest first |
| `useTargets()` | All targets by id |
| `useFoods()` | The food list |
| `useHealthSummary()` | The `HealthSummary` |
| `useSocialAccount()` | The active profile's `SocialAccount` or none, plus `connection`: `live` (real network reachable), `simulated` (demo profile, simulated crew), `off` (member profile and the network cannot be reached) |
| `useSocialSearch(query)` | People whose handle contains the query, as `SocialPerson`, never including yourself. An empty query gives up to 20 suggestions |
| `useFriends()` | Your friends as `SocialPerson`, the one with the newest message first |
| `useFriendRequests()` | `incoming` and `outgoing`, each a list of `SocialPerson` |
| `useConversation(socialId)` | The `ChatMessage`s between you and that friend, oldest first |
| `useMySharedMood()` | The `SharedMood` your friends see right now, or none |
| `useEnvironment()` | The latest `EnvironmentSample`, plus `connection` (`simulated` or `off`) |
| `useEnvironmentSeries(metricId, hours)` | One entry per hour, oldest first: `at`, `value`, `source`. `metricId` is an environment metric id |
| `useChallenges()` | The two `ChallengeBoard`s, as `exercise` and `nutrition` |

**Writing (plain functions):**

| Name | Does |
|---|---|
| `addMeal(foodId, portions)` / `removeMeal(id)` | Source is `entered` |
| `addWater(ml)` / `removeWater(id)` | |
| `setSessionStatus(id, status, actualMinutes, skipReason)` | |
| `logGameMinutes(gameId, minutes)` | Adds a done aerobic session with device `game` |
| `addMoodCheckin(score, tags, note)` / `updateMoodCheckin(id, changes)` | |
| `addSleep(date, hours, quality)` | |
| `addBodyMass(kg)` | |
| `pushVital(sample)` | Used by sensors, the relay and the simulator |
| `raiseAlert(kind, origin, message, screenId)` | Returns the alert id |
| `cancelAlert(id)` / `acknowledgeAlert(id)` | |
| `createProfile(details)` / `updateProfile(id, changes)` / `setActiveProfile(id)` | |
| `deleteProfileData(id)` | Removes a member and everything recorded for them |
| `resetDemoProfile()` | Restores the demo profile's seed |
| `joinSocial(handle, shareMood)` | Joins the crew network for the active profile. Returns `ok`, or the reason: `taken`, `invalid`, `offline` |
| `leaveSocial()` | Removes the account, its friendships and its messages from the network and from this device |
| `setShareMood(on)` | Switches mood sharing on or off. Off removes the shared mood from the network at once |
| `sendFriendRequest(socialId)` / `cancelFriendRequest(socialId)` | |
| `acceptFriendRequest(socialId)` / `declineFriendRequest(socialId)` | |
| `removeFriend(socialId)` | Ends the friendship for both people and deletes the conversation |
| `sendChatMessage(socialId, text)` | Friends only. Text of 1 to 500 characters |
| `markConversationRead(socialId)` | Sets that friend's `unread` to 0 |
| `setChallengeJoined(challengeId, on)` | Takes the active profile in or out of a challenge. Off removes its score from the network at once. Needs a social account; returns `ok` or `not-joined` |

The environment is worked out from the clock by one function in `data`, the same on every device, and is never stored. While a challenge is joined, the data layer works out the score from the store and sends it without the screen doing anything; nobody is in a challenge until they switch it on. While `shareMood` is on, a new or edited mood check-in updates the shared mood without the screen doing anything. `deleteProfileData` also leaves the network.

**Sensors and sync, from `@/data`:**

| Name | Does |
|---|---|
| `connectHeartRateSensor()` / `disconnectHeartRateSensor()` | Bluetooth heart-rate broadcast into `pushVital`, source `live` |
| `startSimulator()` / `stopSimulator()` | Simulated vitals, source `simulated`. Demo profile only |
| `joinRoom(code)` / `createRoom()` / `leaveRoom()` / `useRoom()` | Pairs this browser with a watch through the relay (section 10). `createRoom` makes a new code, joins it and returns it. `useRoom` gives the current code or none, and the connection state |

**This device, from `@/data`** (added Sunday 15 November, built by prompt 21):

| Name | Does |
|---|---|
| `useDevice()` | Gives `kind` (`computer`, `phone` or `watch`) and `setupDone` (yes/no). `watch` on the route `/w`, `phone` under 640 px wide, otherwise `computer` |
| `completeDeviceSetup()` / `resetDeviceSetup()` | Finish, or show again, the first-open choice of who is using this device |

**Automatic alerts, from `@/data`** (added Sunday 15 November, built by prompt 18):

| Name | Does |
|---|---|
| `useAutoAlert()` | Gives `pending` (none, or `cause` and `secondsLeft`), `fallDetection` (on/off), `vitalsWatch` (on/off) and `motionAvailable` (yes/no). `cause` is `fall`, `heart-rate` or `oxygen` |
| `setFallDetection(on)` / `setVitalsWatch(on)` | Switch each watcher on this device |
| `cancelAutoAlert()` | The person answers "I'm OK" during the 10 second countdown. Nothing is raised |
| `simulateAutoAlert(cause)` | Starts the same countdown for demonstration. `cause` is `fall` or `heart-rate` |

When a countdown runs out, the app calls `raiseAlert('emergency', origin, message, 'emergency')` itself. The message says what was measured and may end with the profile's role. It never holds a display name.

Browser storage keys all start with `ophiuchus:v1:`.

## 10. Messages between watch and console

One shape for every message, carried by the events endpoint or directly between two views in the same browser.

| Field | Meaning |
|---|---|
| `id` | Unique |
| `room` | Six-character pairing code, from letters and digits that are easy to read aloud (no 0, O, 1, I). The native watch app creates its own code and shows it; the person types it into the console's Watch screen. For the browser watch view, the console creates a code and passes it as `/w?room=CODE`. Nothing is ever typed on a watch |
| `type` | One of the types below |
| `at` | Time |
| `origin` | `console` or `watch` |
| `payload` | Depends on type |

| Type | Sent by | Payload |
|---|---|---|
| `emergency.raised` | Either | `alertId`, `message`, `role` (optional: the sender's profile role, never the display name) |
| `emergency.cancelled` | Whoever raised it | `alertId` |
| `emergency.acknowledged` | Console | `alertId` |
| `vitals.sample` | Watch | `heartRate`, `spo2`, `skinTempC` (any may be missing), `source` |
| `summary.updated` | Console | A `HealthSummary` |

Messages carry no name. The only profile detail that may travel is the role on `emergency.raised`. The room code is the only link between devices.

## 11. Server endpoints and settings

| Endpoint | In | Out |
|---|---|---|
| `POST /api/chat` | `message`, `screenId`, `screenLabel`, `context` (the block in the companion prompt, as text), `replyMode` (`standard` or `watch`) | `reply` (text), `urgent` (yes/no), `forward` (yes/no: the Med bot thinks this question should go to the flight surgeon) |
| `POST /api/events` | One message as in section 10 | `ok`, `id` |
| `GET /api/events?room=CODE&after=CURSOR` | | `events` (list), `cursor` |

| `POST /api/social/join` | `handle`, `role` (optional) | `socialId`, `token`, or `error` (`taken`, `invalid`) |
| `POST /api/social/leave` | | `ok` |
| `GET /api/social/people?q=TEXT` | | `people` (list of `SocialPerson` without `mood` and `unread`) |
| `POST /api/social/relation` | `socialId`, `action` (`request`, `cancel`, `accept`, `decline`, `remove`) | `ok` |
| `POST /api/social/mood` | `score`, `tags`, `at`; or `clear` (yes) | `ok` |
| `POST /api/social/messages` | `toId`, `text` | `id` |
| `GET /api/social/sync?after=CURSOR` | | `friends`, `incoming`, `outgoing` (lists of `SocialPerson`), `messages` (new `ChatMessage`s to or from you), `cursor` |
| `POST /api/social/challenge` | `id` (`exercise` or `nutrition`), `score` (a number); or `id` and `leave` (yes) | `ok` |
| `GET /api/social/challenges` | | `exercise`, `nutrition`: each a list of `socialId`, `handle`, `score` for you and for your friends who take part. Empty for a challenge you have not joined |

Every social call except `join` carries the `token` that `join` returned. The token stays inside `data/social` and is never given to a screen. The network holds a handle, an optional role, friendships, at most one `SharedMood` per person and chat text. For a challenge it holds one score per person per challenge and nothing else, visible to friends who take part in the same challenge, and deleted after 8 days without an update. It never holds a display name, a reading, a mood note or anything else from the store.

Settings read in `config.ts`: `VITE_CHAT_URL`, `VITE_EVENTS_URL`, `VITE_SOCIAL_URL`. When one is empty, that feature uses its offline fallback and nothing breaks.

## 12. Ophi interface

All exported from `@/ophi`.

| Name | Does |
|---|---|
| `OphiState` | `idle`, `hint`, `talking`, `thinking`, `alert` |
| `setOphiState(state)` / `useOphiState()` | |
| `askMedbot(screenId)` | Navigates to `/medbot?from=<screenId>`. The Med bot screen reads `from`. Ophi himself is scripted and calls no model; this is how he hands a question over to the Med bot |

Images: `app/public/ophi/ophi-<state>.png` at 512 px, and `ophi-<state>-128.png` for the watch. If only `ophi-idle.png` exists, every state uses it.

## 13. Games

Each game folder has `meta.ts` exporting `meta`, collected automatically like screens.

| Field | Meaning |
|---|---|
| `id` | Equals the folder name. Fixed ids: `futvolley`, `samba-time` |
| `label`, `description` | |
| `screens` | List of screen ids whose `GameLinks` should show it |
| `countsAsExercise` | yes/no. If yes, the game calls `logGameMinutes` when a round ends |

## 14. Branches

One branch per lane, named `lane/<prompt-number>-<short-name>`, for example `lane/04-nutrition`. A lane merges into `main` only when `npm run build`, `npm run lint`, `npm run typecheck` and `npm run test` all pass in `app`.

# data

The shared store. Every screen reads the same person through the hooks below and writes through the functions below. Import from `@/data` only. Never touch browser storage.

Shapes are in [CONTRACTS.md](../../../docs/CONTRACTS.md) sections 8 and 9. This file says what each name does and how to use it. Dates are local days written `YYYY-MM-DD`. Times are ISO strings.

**The values here are illustrative.** The foods in `foods.ts` are plausible values for typical foods, not measured values for any real menu. Every target in `targets.ts` is a seed value from memory with `verified: false` and `sourceText: "to be confirmed"`. The mission's length and delay to Earth are scenario values. The demo history is simulated.

## Rules the store keeps for you

- **Missing is missing.** A day with no data has `value: null`, `level: 'none'`, `source: null`. Series keep the gap. Nothing is filled in.
- **Every value has a source.** `entered` for what a person does in the app, `live` for a sensor, `imported`, `simulated` for the demo. Show `SourceBadge` wherever a value is shown.
- **A total made of several records has one source.** If any record in it is simulated, the total is `simulated`, so a demo value is never shown as entered. Otherwise `imported`, then `entered`, then `live`.
- **A member profile never holds a simulated record.** The demo profile holds only simulated readings.
- **Heart rate never gets a level.** Its `level` is always `none`. Show the reading and its badge, not a status.
- **Water means drinks.** `waterMl` adds up `addWater` entries. Water inside food (`FoodItem.waterMl`) is not counted.
- **Today's plan.** Each member profile gets two planned sessions every day (one resistive, one aerobic, 60 minutes each). A day with only planned sessions has no exercise value until one is done, changed or skipped.
- **The demo profile is rebuilt when the date changes**, so its story always ends today. Anything entered on the demo profile is lost then, and by `resetDemoProfile()`.
- **Bad input is ignored, not stored.** Writing functions drop impossible values (a negative portion, a mood of 9) without throwing. The one exception is `createProfile`, which throws if there is no display name.

## Reading (hooks)

| Name                                    | Gives                                                                                                                                     | Use                                                                                                  |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `useActiveProfile()`                    | The active `CrewProfile`                                                                                                                  | Show the person's name, role and consent switches.                                                   |
| `useProfiles()`                         | Every `CrewProfile`, demo first                                                                                                           | List them in a switcher.                                                                             |
| `useMission()`                          | The `Mission` plus `day` (mission day, at least 1)                                                                                        | Show "Mission day 15" and the delay to Earth.                                                        |
| `useToday()`                            | Today's `DaySummary`                                                                                                                      | Read `useToday().waterMl` for `value`, `level`, `source`, `targetId`.                                |
| `useDay(date)`                          | That day's `DaySummary`                                                                                                                   | Open a past day's numbers.                                                                           |
| `useSeries(metricId, days)`             | `{ date, value, source }[]`, one per day, oldest first, `value` null on a gap                                                             | Feed a `Sparkline` or `TrendChart`.                                                                  |
| `useMeals(date)`                        | Meal entries, each with its `food`, oldest first                                                                                          | List what was eaten that day.                                                                        |
| `useWater(date)`                        | Water entries, oldest first                                                                                                               | List drinks.                                                                                         |
| `useExerciseSessions(fromDate, toDate)` | Sessions in the range, both days included                                                                                                 | Build the checklist or the week view.                                                                |
| `useMoodCheckins(days)`                 | Check-ins from the last `days` days, newest first                                                                                         | Draw the mood timeline.                                                                              |
| `useSleep(days)`                        | Sleep records from the last `days` days, newest first                                                                                     | List recent nights.                                                                                  |
| `useLatestVitals()`                     | `{ latest, connection }`: the newest `VitalSample` or `null`, and `live`, `simulated` or `off`                                            | Show a heart-rate tile; when `connection` is `off`, show "Sensor disconnected" and a connect button. |
| `useAlerts()`                           | The active profile's alerts, newest first                                                                                                 | Show the open ones.                                                                                  |
| `useTargets()`                          | Every `Target`, by id                                                                                                                     | Read `useTargets().sodiumMg` for the limit, its `unit`, `sourceText` and `verified`.                 |
| `useFoods()`                            | The food list                                                                                                                             | Fill the food picker.                                                                                |
| `useHealthSummary()`                    | The `HealthSummary`: `sleep`, `food`, `water`, `exercise`, `mood` (each `level`, `text`, `source`), `openAlerts`, `ophiLine`, `updatedAt` | Show Ophi's line, or build the Med bot context.                                                      |

Where a target is shown, show `SourceLine` under it with `sourceText`, `href={sourceUrl}`. When `verified` is false, show "Source: to be confirmed".

## Writing (functions)

| Name                                                                    | Does                                                                                                                                                                                                | Use                                                               |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `addMeal(foodId, portions)` / `removeMeal(id)`                          | Adds or removes a meal entry, source `entered`                                                                                                                                                      | Wire the food picker and the remove button.                       |
| `addWater(ml)` / `removeWater(id)`                                      | Adds or removes a drink                                                                                                                                                                             | `addWater(250)` for the one-tap button.                           |
| `setSessionStatus(id, status, actualMinutes?, skipReason?)`             | Marks a session `planned`, `done`, `changed` or `skipped`. `done` without minutes uses the planned minutes                                                                                          | `setSessionStatus(id, 'skipped', undefined, 'Not feeling well')`. |
| `logGameMinutes(gameId, minutes)`                                       | Adds a done aerobic session with device `game`                                                                                                                                                      | Call when a game round ends.                                      |
| `addMoodCheckin(score, tags, note?)` / `updateMoodCheckin(id, changes)` | Adds or edits a check-in. `changes` may hold `score`, `tags`, `note`                                                                                                                                | `addMoodCheckin(4, ['calm'])`.                                    |
| `addSleep(date, hours, quality?)`                                       | Records the night that ended on `date`. A second entry for the same date replaces the first                                                                                                         | `addSleep(today, 6.5, 3)`.                                        |
| `addBodyMass(kg)`                                                       | Records today's body mass. A second one today replaces the first                                                                                                                                    | Wire the weigh-in.                                                |
| `pushVital(sample)`                                                     | Adds a reading: `{ heartRate?, spo2?, skinTempC?, source, at?, profileId? }`. The newest is always kept for `useLatestVitals`; saved history gets one every five minutes                            | Sensors, the relay and the simulator use it. Screens rarely do.   |
| `raiseAlert(kind, origin, message, screenId?)`                          | Raises an alert for the active profile and returns its id                                                                                                                                           | `raiseAlert('emergency', 'console', message)`.                    |
| `cancelAlert(id)` / `acknowledgeAlert(id)`                              | Moves an open alert to `cancelled` or `acknowledged`                                                                                                                                                | Wire the Emergency buttons.                                       |
| `createProfile(details)`                                                | Creates a member profile and returns its id. `details`: `displayName` (required), `role`, `sex`, `birthYear`, `heightCm`, `massKg`, `lastNightSleepHours`, `consent`. Throws without a display name | The About form calls it, then `setActiveProfile(id)`.             |
| `updateProfile(id, changes)`                                            | Changes a member profile. The demo profile cannot be changed                                                                                                                                        | `updateProfile(id, { consent: { assistant: true } })`.            |
| `setActiveProfile(id)`                                                  | Switches the active profile                                                                                                                                                                         | The sidebar switcher.                                             |
| `deleteProfileData(id)`                                                 | Removes a member and everything recorded for them. Does nothing for `demo`                                                                                                                          | Behind a `ConfirmDialog`.                                         |
| `resetDemoProfile()`                                                    | Restores the demo profile's seed and clears its alerts                                                                                                                                              | Behind a `ConfirmDialog`.                                         |

## Sensors and sync

| Name                                   | Does                                                                                                                                                                                                                                                                       | Use                                            |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `connectHeartRateSensor()`             | Opens the browser's Bluetooth picker and reads heart rate into the active member profile, source `live`. Returns `{ ok: true, deviceName? }` or `{ ok: false, reason, message }` (`unsupported`, `demo`, `cancelled`, `failed`). Never throws. Call it from a button click | Show `message` when `ok` is false.             |
| `disconnectHeartRateSensor()`          | Stops reading                                                                                                                                                                                                                                                              | The "Disconnect" button.                       |
| `startSimulator()` / `stopSimulator()` | Simulated vitals for the demo profile. Does nothing on a member. It already starts by itself in the browser while the demo profile is active                                                                                                                               | Rarely needed.                                 |
| `createRoom()`                         | Makes a new six-character pairing code, joins it and returns it                                                                                                                                                                                                            | Watch screen: show the code or `/w?room=CODE`. |
| `joinRoom(code)`                       | Joins a code typed by a person. Returns false if the code is not valid                                                                                                                                                                                                     | Watch screen: the code field.                  |
| `leaveRoom()`                          | Leaves the room                                                                                                                                                                                                                                                            | "Unpair".                                      |
| `useRoom()`                            | `{ code, connection }`. `connection` is `off`, `local` (same browser only), `online` (the events endpoint answers) or `error`                                                                                                                                              | Show the pairing state.                        |
| `importHealthExport()`                 | Stub. Returns "Health import is not available yet."                                                                                                                                                                                                                        | Do not build on it.                            |

The relay sends a summary to the room when it changes, at most every ten seconds, and the console's emergency changes. Over the network it runs only when `VITE_EVENTS_URL` is set and the active profile has switched on "Share live readings". Between views in the same browser it is always on while a room is joined. Messages carry no name.

## This device (prompt 21)

| Name                    | Gives or does                                                                                                                                                                                                           | Use                                                                                    |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `useDevice()`           | `{ kind, setupDone }`. `kind` is `watch` on `/w`, `phone` under 640 px wide, otherwise `computer`, and follows the window as it is resized. `setupDone` says whether the first-open choice has been made on this device | The shell shows the first-open card while `setupDone` is false. Screens do not need it |
| `completeDeviceSetup()` | Remembers on this device that the choice is made (`ophiuchus:v1:device`)                                                                                                                                                | Called by the first-open card                                                          |
| `resetDeviceSetup()`    | Shows the first-open card again. Profiles and their data are kept                                                                                                                                                       | "Set up this device again" in the profile switcher                                     |

Alerts that arrive from another device carry `from`: the sender's profile role, or "Another device" when the message has none. An alert raised on this device never has `from`. `emergency.raised` messages carry the active profile's `role` and never the display name.

Storage is per browser, not per window: two windows of the same browser share the saved store, so after a reload both show whichever profile was made active last.

## Helpers exported next to them

| Name                                      | Does                                                                                                                             |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `levelFor(value, target, share?)`         | The level of a value against a target (CONTRACTS section 7). Pass `share` (0 to 1) only for totals that build up during the day. |
| `expectedShare(minuteOfDay)`              | The share of a daily total expected by a time of day, 07:00 to 23:00.                                                            |
| `worstLevel(levels)`                      | The worst of several levels. `none` is ignored unless all are `none`.                                                            |
| `moodWord(score)`                         | VERY LOW, LOW, OKAY, GOOD or VERY GOOD.                                                                                          |
| `toDateString(date)` / `addDays(date, n)` | Local `YYYY-MM-DD` helpers, so every screen agrees on "today".                                                                   |
| `metricIds`, `targetIds`                  | The fixed id lists.                                                                                                              |

The crew-network names (`useSocialAccount`, `joinSocial` and the rest of CONTRACTS section 9, "Social") are added by lane 17 in `social/`.

## Inside the folder

| File                                                    | What                                                                             |
| ------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `types.ts`                                              | Every record of CONTRACTS section 8                                              |
| `targets.ts`, `foods.ts`, `levels.ts`                   | Targets (energy and protein per profile), the menu, the level rules              |
| `seed.ts`                                               | The demo profile's 14 days, from a fixed seed                                    |
| `store.ts`, `persistence.ts`, `runtime.ts`              | The saved store and its write functions; safe storage; state that is never saved |
| `compute.ts`, `selectors.ts`, `clock.ts`, `snapshot.ts` | Day and series maths, the hooks, a once-a-minute clock                           |
| `simulator.ts`, `sources/`                              | Simulated vitals, Bluetooth heart rate, the relay, the import stub               |

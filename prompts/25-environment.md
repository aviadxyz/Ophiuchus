# 25 · Environment: the station around the astronaut

**Runs alone in its files. Can run beside prompt 26 and beside work on Performance.**

The console shows the body and nothing about the place the body is in. This prompt adds the Environment screen: the air, the temperature, the noise, the gravity and the radiation around the crew, each explained for someone who is not an engineer or a doctor, with what it does to health and when to tell someone.

| | |
|---|---|
| Branch | `lane/25-environment` |
| You own | New folder `app/src/screens/environment/`. In `app/src/data/`: a new file `environment.ts` and its test, and only the lines that add its names to `types.ts`, `targets.ts` and `index.ts` |
| Read first | AGENTS.md, docs/CONTRACTS.md sections 3, 4, 6, 7, 8 and 9 (look for "Environment metric ids", `EnvironmentSample`, `useEnvironment`, `useEnvironmentSeries`), docs/DESIGN_SYSTEM.md, docs/CHALLENGE.md, `app/src/data/README.md`, `app/src/data/targets.ts`, and `app/src/screens/medical-status/` as the model for tiles that open a drawer with a dated chart |
| Use | Claude Sonnet 5.5 |
| Time box | 30 minutes to a working screen. Fill in after that |

## Prompt

The build has started and you may write code. Read AGENTS.md, docs/CONTRACTS.md and docs/DESIGN_SYSTEM.md before doing anything. Touch only what is listed under "You own". Add no dependency and no color. Every name you need is in the contract; if one is missing, stop and ask.

### Part 1. The data

The app has no cabin sensor, so every environment value is simulated and says so.

1. In `app/src/data/environment.ts`, write one pure function that gives the `EnvironmentSample` for any moment. It works the values out from the clock, so every device shows the same numbers at the same time, and nothing is stored. Values move gently through the day and never jump: use a few slow sine waves with fixed phases, no random numbers. `source` is always `simulated`.
2. The nine values, with the centre each one moves around. These centres are starting points for a low-Earth-orbit station; correct them if a published source you open says otherwise, and note it.

   | Metric id | Centre | Moves by about |
   |---|---|---|
   | `temperatureC` | 22.5 | ±1 |
   | `humidityPct` | 45 | ±6 |
   | `gravityG` | the mission's `gravity` | not at all |
   | `oxygenPct` | 20.9 | ±0.2 |
   | `co2MmHg` | 2.6 | ±0.5, highest in the crew's sleep hours |
   | `noiseDb` | 60 | ±4, lower at night |
   | `radiationUSvPerHour` | 25 | ±5, with a short rise each orbit (about every 90 minutes) |
   | `mosfetOutsideUGyPerHour` | 3 times the inside value | follows the same rises |
   | `mosfetInsideUGyPerHour` | 10 | ±2 |

3. `useEnvironment()` gives the latest sample and `connection` `simulated`, and refreshes once a minute. `useEnvironmentSeries(metricId, hours)` gives one entry per hour, oldest first.
4. Add one `Target` for each environment metric id to `targets.ts`, of the kind that fits (a range for temperature, humidity and oxygen; a maximum for carbon dioxide, noise and the three radiation values; none for gravity). For each limit, look for the number in a NASA page you can open (NASA-STD-3001 and its technical briefs, the Human Research Program risk pages). Where you open a page that states it, set `sourceText`, `sourceUrl` and `verified` on. Where you do not, set `verified` off and leave the source empty: the screen then says "Source: to be confirmed". Never write an address you did not open.
5. Tests beside the code: the same moment always gives the same sample; values stay inside sensible bounds over 48 hours; the outside MOSFET value is above the inside one; the series has one entry per hour.

### Part 2. The screen

`meta.ts`: id `environment`, label "Environment", group `console`, order 25, owner `Rami`, status `ready`, eyebrow `DOMAIN · STATION ENVIRONMENT`, description "The air, temperature, noise, gravity and radiation around you, and what each one does to the body." Pick a fitting lucide icon.

1. **Header.** `ScreenHeader`, with pills counting the values at each level (for example `1 WATCH`, `7 ON TARGET`) and a `SIMULATED` pill, tone `neutral`.
2. **A line under the header:** "These values are simulated. The app has no cabin sensor. They are the same for every crew member, because everyone shares the same station."
3. **Tiles**, one `StatTile` per value, in this order and under these plain names: Temperature, Humidity, Gravity, Oxygen, Carbon dioxide, Noise, Radiation in the cabin, Radiation outside the hull, Radiation at the inside dosimeter. Group the tiles under three `SectionLabel`s: "Air" (temperature, humidity, oxygen, carbon dioxide), "Cabin" (gravity, noise), "Radiation" (the three radiation values). Each tile shows the value, its unit, the level pill, the target in words, and the `SIMULATED` source badge. Level comes from the level rules in CONTRACTS section 7, through the shared function in `@/data`, never from your own comparison.
4. **A tile opens a `DetailDrawer`** with, in this order:
   - What this is, in one or two plain sentences. For the two dosimeter values, say that a MOSFET dosimeter is a small electronic chip that counts the radiation passing through it, and that comparing the one outside with the one inside shows how much the hull stops.
   - The last 24 hours as a `TrendChart` with the time on its axis and the target line, and under it the highest and lowest value with the time of each.
   - "What it does to the body": one or two plain sentences. Gravity: without weight on them, bones and muscles get weaker over a mission, which is why loaded exercise is on the plan every day. Carbon dioxide: headaches and slower thinking at higher levels. Noise: poorer sleep and tired hearing. Radiation: a long-term exposure that adds up over the mission. Dry or humid air, heat and cold: comfort, skin, eyes and sleep. Describe, do not diagnose.
   - "What to do": one or two plain steps, ending with when to tell the flight surgeon or the station commander. No medical instructions.
   - `SourceLine` for the target. "Source: to be confirmed" when `verified` is off.
   - A quiet link to the screen it relates to: gravity to Physical activity and Performance, carbon dioxide and noise to Sleep, radiation to Risks.
5. **A card at the bottom, "How this connects to your health"**: three short lines linking the environment to the person's own screens (bones and muscles to Physical activity, sleep to Sleep, the long-term risks to Risks), each a working link.
6. The guide (`guide.ts`) answers the five questions in docs/CHALLENGE.md for this screen.
7. Works at 360 px and 1440 px with no sideways scrolling. Status never by color alone.

### Do not build

Controls that change the cabin, alarms, a per-person radiation dose, a map of the station, any storage of environment values, anything in another screen's folder.

### Checks you must run and pass before reporting

- `npm run build`, `npm run lint`, `npm run typecheck`, `npm run test` in `app`, all clean.
- The screen shows the same values on the demo profile and on a team profile.
- Every tile opens its drawer, the chart shows 24 points with times, and every link goes where it says.
- At 360 px wide nothing scrolls sideways.

**Report:** what you built, the result of each check, a table of the nine limits with the address you opened for each or "to be confirmed", and anything you could not test.

When all checks pass, commit, push this branch, and report. Do not merge.

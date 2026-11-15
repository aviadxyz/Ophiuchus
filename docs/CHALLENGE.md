# The challenge

This is what the judges asked for. Everything in the build is measured against it. The text below was pasted by Rami from the official challenge page on 14 Nov 2026. The Resources tab of that page has not been read yet.

## The text

### Objectives

Your challenge is to create a visual tool that helps astronauts assess their own health during space missions and provides guidance on treatments and health improvements. You may consider gathering data from the user through any kind of input—keyboard text, mouse clicks, or camera images, for example. Any kind of data can be used, as long as it represents a health indicator, such as blood sugar levels in mg/dL or ultrasound images.

You can use NASA's Human Research Program resources, along with the publicly available resources from other space agencies, to understand how spaceflight hazards affect human health, and to decide which indicators are useful and how they can support a quick assessment. Which measurements can be performed in space? Why is an exam needed? How do spaceflight hazards affect these health indicators? When might a result warrant attention from the crew or from flight surgeons on the ground? What actions can be taken to prevent a critical health condition? These are questions worth considering as you develop your solution.

User interface design plays an important role in presenting metrics and diagnosis clearly. You may consider taking advantage of animations and interactivity to present the information. For example, the software could display a human figure where each part of the body is clickable and displays information about its function and health status.

### Potential considerations

You may (but are not required to) consider the following:

- Your tool could provide health insights for astronauts in different environments, such as a spacecraft, a space station, a rover, or a base on another planet or moon.
- Your tool could prompt astronauts to take measurements or complete specific actions from time to time as a part of the mission routine.
- Your tool could include the following features:
  - A gamification system to help astronauts engage with tasks that support their health
  - Dynamic charts that show how astronaut's health indicators change over time
  - Color coding that helps the astronaut interpret the status of a health indicator at a glance
- Do not assume that astronauts know everything about how to assess their health. Your tool could provide simple instructions and explanations covering measurements, health indicators, and risks.

For data and resources related to this challenge, refer to the Resources tab at the top of the page. More resources may be added before the hackathon begins.

## Resources

Not read yet. **Rami: paste the links from the Resources tab of the challenge page here when the hackathon starts**, one per line with its title. [Prompt 16](../prompts/16-sources.md) reads this list to fill in the sources shown in the app.

- (none yet)

## The five questions every screen answers

The challenge lists five questions "worth considering". Each screen answers them in a fixed place, so a judge finds the same thing everywhere.

| Question in the challenge | Where a screen answers it |
|---|---|
| Which measurements can be performed in space? | The values on the screen, each with a unit and a source badge. On Overview, each body system also says how it is checked on a mission |
| Why is an exam needed? | Ophi's panel, "What this shows" |
| How do spaceflight hazards affect these indicators? | Ophi's panel, "Why it matters in space", naming the hazard |
| When might a result warrant attention from the crew or flight surgeons? | The status level on each value (ok, watch, act), Ophi's panel, "When to act", and the Med bot, which says when a question is one for the flight surgeon and lets the crew member send it on |
| What actions can prevent a critical condition? | The screen's own "what to do next" list, and Ophi's panel, "When to act" |

## Coverage

| Challenge item | Required? | Where it is in the plan | State |
|---|---|---|---|
| A visual tool for self-assessment | Yes | The console: one screen per health domain, and Overview with status tiles for the whole day | Covered |
| Guidance on treatments and health improvements | Yes | "What to do next" lists on each screen, Ophi's panel, the Med bot, Emergency steps | Covered for improvements. Treatment guidance is deliberately general. See the note below |
| Input by keyboard, clicks, camera | Suggested | Typed entries, taps, live watch sensors, camera in the games | Covered |
| Data that represents a health indicator, with units | Yes | Metric list in [CONTRACTS.md](CONTRACTS.md) section 8 | Covered |
| Grounding in Human Research Program resources | Suggested, and judged | Targets and body-system texts carry a source line. Every one is still marked "verify". [Prompt 16](../prompts/16-sources.md) fills them in | **Open.** No source has been checked yet. Paste the Resources tab into the section above first |
| Clear presentation, animation, interactivity | Yes | Design system, charts, drawers, Ophi | Covered |
| Clickable human figure | Example only | Overview: an anatomical figure covering sixteen body systems, each clickable, each showing what it does, what space does to it, how it is checked on a mission, and its status. [Prompt 14](../prompts/14-overview.md) builds a working version, [prompt 15](../prompts/15-body-figure.md) the high-quality drawing | Planned. Seven of the sixteen systems are not measured by the app and say so. The text has no checked source yet |
| Different environments (spacecraft, station, rover, base) | Optional | One fixed scenario, Ophiuchus-1 | Partly. One environment only |
| Prompting measurements and actions as mission routine | Optional | Overview: "Today's routine", seven items marked done or due, with Ophi's hint dot while something is due. [Prompt 14](../prompts/14-overview.md) | Planned. It prompts on screen only; nothing fires by itself |
| Gamification | Optional | Futvolley and Samba time, rated "if time". Game minutes count as exercise | **At risk.** Nothing gamified exists unless a game ships |
| Charts over time | Optional | `TrendChart` and `Sparkline` on every data screen | Covered |
| Color coding at a glance | Optional | Status levels with color and a text label together | Covered |
| Simple explanations of measurements, indicators and risks | Optional | Ophi on every screen | Covered. This is the strongest fit |

### Note on "treatments" and "diagnosis"

The challenge uses both words. The app describes what the data shows, gives the general guidance with its source, and points to the flight surgeon for decisions. It does not diagnose, prescribe or give drug doses. That is a deliberate choice: a hackathon demo fed by consumer watches should not present itself as a doctor, and saying so plainly is better with judges than overclaiming. In the pitch, say "assessment and guidance", and show the Emergency screen as the place where the app guides the crew on its own when Earth is too far to ask.

## Gaps and what to do about them

In order of value for the time they cost. The human figure and the mission routine were on this list and are now planned on the Overview screen ([prompt 14](../prompts/14-overview.md)).

1. **Sources.** Paste the Resources tab into the section above, then run [prompt 16](../prompts/16-sources.md) with a strong model that can open web pages. Without this the app shows "Source: to be confirmed" in front of judges. The prompt forbids citing anything the agent did not open and read.
2. **Gamification.** Ship one game, or if neither fits, add a streak count to the Physical activity and Mood screens. Decide by Saturday night.
3. **Environments.** Leave as one scenario. Mention in the pitch that targets are stored per mission, so another environment is a data change.

# Ophiuchus

Astronaut health console for the NASA Space Apps Challenge 2026 (14–15 November 2026, Tel Aviv local event).

One web app that runs on a PC and a phone, a companion app on a Wear OS watch, a scripted guide character called **Ophi Tov** who explains every screen, and a **Med bot**, a separate medical assistant you can talk to. The team members are the crew: their own watches feed live readings into the console, next to a simulated demo crew member.

> **Status: preparation only.** This folder holds the plan, specs and agent prompts. It contains no working code yet. Code gets written by coding agents from the files in [prompts/](prompts/README.md) once the go-ahead is given.

## Start here

0. **[RUNBOOK.md](RUNBOOK.md) when the build starts.** Rami's step-by-step checklist.
0. [docs/CHALLENGE.md](docs/CHALLENGE.md) for what the judges asked for.
1. [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md) for the whole picture.
2. [prompts/README.md](prompts/README.md) for how to run the build with several AI agents at once.
3. [docs/CONTRACTS.md](docs/CONTRACTS.md) is the file every agent builds against.

## What is in here

| File | What it is for |
|---|---|
| [docs/CHALLENGE.md](docs/CHALLENGE.md) | The official challenge text, how the plan covers each line of it, and the gaps |
| [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md) | Scope, who owns what, architecture, phases, risks, what to cut first |
| [docs/CONTRACTS.md](docs/CONTRACTS.md) | Every shared name, path, record and function, fixed in advance so parallel agents produce code that fits |
| [docs/REAL_DATA.md](docs/REAL_DATA.md) | What is real, how sensor data gets in, and the privacy rules |
| [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) | Colors, type, layout and components, taken from the console screenshots |
| [docs/SCREENS.md](docs/SCREENS.md) | Specs for Nutrition, Physical activity, Mood, Overview, Med bot and Social, the demo story, and the intake sheet for Elia's screens |
| [docs/OPHI_TOV.md](docs/OPHI_TOV.md) | The scripted guide character: behavior, states, explanation content, art brief, and how he differs from the Med bot |
| [docs/WATCH.md](docs/WATCH.md) | The Wear OS app, the cheap watches as sensors, and how to install without the venue Wi-Fi |
| [docs/MINI_GAMES.md](docs/MINI_GAMES.md) | Futvolley and Samba time specs, plus spare ideas |
| [docs/TEST_PLAN.md](docs/TEST_PLAN.md) | What to test before the judges touch it |
| [AGENTS.md](AGENTS.md) | Standing rules every coding agent follows. `CLAUDE.md`, `GEMINI.md` and `.github/copilot-instructions.md` point to it |
| [prompts/](prompts/README.md) | Ready-to-run prompts, grouped into phases that can run in parallel |

## The team and the screens

| Screen | Owner |
|---|---|
| Overview (body figure and today's routine) | Rami |
| Environment data | not planned, no data source |
| Risks | Aviad |
| Sleep | Aviad |
| Medical status (personal conditions) | Elia designs, Rami implements |
| Mental health | unassigned |
| Performance / Spirit | Aviad |
| Med bot (the medical assistant, separate from Ophi Tov) | Rami |
| Nutrition | Rami |
| Physical activity | Rami |
| Mood | Rami |
| Social (friends, chat, shared mood) | Rami |
| Research | Aviad |
| Emergency | Elia designs, Rami implements |

Rami also owns: the app shell, the shared data store, the Ophi Tov guide, the Watch and About screens, the watch app, final testing, integration help, and mini games if time allows.

## Deadlines

- **Sunday 17:30** handover to the Tel Aviv judges. They may use the product themselves.
- **Sunday 24:00** global submission deadline.

## Ground rules for the product

- Every value shows where it came from: live sensor, entered, imported, or simulated.
- Real readings belong to the person they came from. They stay on that person's device unless that person switches sharing on, and they never go into the repo.
- The app is a demonstration and not a medical device, and consumer watches are not medical instruments. It says so on its About screen.
- Everything on the submission page and in linked material is in English.
- AI tools are used heavily in this build. That gets disclosed in the submission. Check the exact wording in the 2026 Project Submission Guide.

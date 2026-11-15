# Build plan

Source: the official challenge text in [CHALLENGE.md](CHALLENGE.md), Aviad's briefing PDF dated 13 Nov 2026, the Microsoft Global Offer text, the credit amounts Rami reported for Microsoft and Google, and decisions made with Rami. Anything marked **confirm** needs a yes from Aviad or a check against the official 2026 guide. Facts about devices and outside services are from memory and get checked at build time.

## 1. What we are building

A health console for an astronaut on a mission. It shows a crew member their own state (sleep, nutrition, exercise, mood, medical conditions, risks), lets them talk to a medical companion, and gives them an emergency path. It runs in a browser on a PC and a phone, with a companion app on a Wear OS watch.

Four things make it more than a dashboard, and the plan protects them:

1. **Real people, real sensors.** The team members are the crew. Their watches feed live heart rate into the console, and they log their own meals, exercise and mood. A simulated demo crew member sits beside them for a full walk-through. Every value is labeled with where it came from.
2. **Ophi Tov**, a character who is on every screen and explains it in plain language.
3. **The watch**, which makes the "always with the astronaut" story physical on demo day.
4. **Mini games**, which turn exercise countermeasures into something a crew member would want to do, with a Brazilian flavor because the challenge is led by the Brazilian Space Agency.

## 2. Rami's scope, in priority order

| # | Task | Priority | Why this rank |
|---|---|---|---|
| 1 | App shell: sidebar, routing, PC + phone layout, placeholder screens, deploy pipeline | Must, first | Everyone else is blocked until it exists |
| 2 | Shared data: demo profile, real profiles, sensor input | Must | Every screen reads from it |
| 3 | Ophi Tov guide on every screen | Must | Named task, visible in every judge interaction |
| 4 | Nutrition, Physical activity, Mood screens | Must | Rami's own screens |
| 5 | Elia's screens: Medical status, Emergency | Must | Elia cannot implement them himself |
| 6 | Overview: body figure covering sixteen body systems, and today's routine | Must | The landing page, and the two things the challenge text names that no other screen has. See [CHALLENGE.md](CHALLENGE.md) |
| 7 | Med bot: the medical assistant you can talk to, which forwards the right questions to the flight surgeon | Must | The screen a judge will type into, and where "guidance" and "when to tell a professional" become visible. It is separate from Ophi, who is scripted |
| 8 | Watch: browser view, then the native Wear OS app | Must | Named task, and the hardware will be on the table |
| 9 | Testing the final product | Must | Judges will use it hands-on |
| 10 | Social: find crew, friends and requests, chat, shared mood | Should, after every must works | Answers the isolation hazard. It needs its own small server piece and puts people's handles and moods on it, so it is built last and carefully |
| 11 | Integration help | As needed | |
| 12 | Presentation, website, video help | If time | |
| 13 | Mini games: Futvolley, Samba time | If time | Highest "wow" per hour among the optional items |
| 14 | Unassigned screen: Mental health | If time | Review with Aviad before building |

## 3. Decisions already made

| Decision | Choice | Reason |
|---|---|---|
| Shell origin | Built from scratch by Rami | Confirmed by Rami. The console in the PDF is the visual reference |
| App type | One responsive web app, installable | One codebase covers PC and phone, no app store, judges open a link |
| Stack | Pinned in [CONTRACTS.md](CONTRACTS.md) section 1 | Fixed in advance so agents on different tools produce code that fits together |
| Data | Real team-member profiles next to one simulated demo profile. Source badge on every value | Rami's decision. See [REAL_DATA.md](REAL_DATA.md) |
| Privacy | Data stays on the person's device by default. Two opt-in switches for the relay and for Ophi | Real health data from real people |
| Hosting | Azure Static Web Apps, auto-deploy from GitHub `main` | Covered by the Microsoft offer, gives a public HTTPS link (needed for camera, microphone and Bluetooth), has built-in API functions |
| Watch | Wear OS native app on Rami's watch. Cheap watches are sensors only. Browser watch view as reference and backup | See [WATCH.md](WATCH.md) |
| Watch installs | Tools and first install done at home. At the venue, a phone hotspot as a private network. At most two installs | Public Wi-Fi is the wrong place to push an app to a watch |
| Who builds | Fast, inexpensive models on several AI tools in parallel, one lane each. A strong model reviews at two gates | Speed, within usage limits |

## 4. Architecture

### 4.1 The rule that lets agents work at the same time

Each screen is a folder with one owner. A screen describes itself in a small file inside its own folder, and the sidebar and routes are assembled from those files automatically. **Nobody edits a shared list.** Adding or finishing a screen changes only that screen's folder, so parallel work does not collide.

The exact folders, file names, component names, data records and function names are in [CONTRACTS.md](CONTRACTS.md). That file is the one thing every agent shares. If it is right, the pieces fit when merged.

### 4.2 Sidebar

Read from the mockup in the PDF:

| Group | Screens, top to bottom |
|---|---|
| Console | Overview, Risks, Sleep, Medical status, Mental health, Performance, Med bot |
| Daily life | Nutrition, Physical activity, Mood, Social |
| Reference | Research, Watch, About |
| Pinned bottom, orange | Emergency |

Above the groups: the profile switcher (demo crew member, or a team member).

**Confirm with Aviad:** in the mockup "Overview" and "Environment data" share one row, and so do "Performance" and "Spirit". The plan treats each pair as one screen. Overview is built by Rami without environment readings, since there is no data source for them. If they are meant to be two screens each, that is two more folders and a contract line each; nothing else changes.

### 4.3 Data

One store for all screens, so a short night on Sleep shows as a mood dip on Mood and a flag on Overview. It holds the demo profile and any real profiles on that device. Real data reaches it four ways, built in this order: typed in, Bluetooth heart-rate broadcast, the native watch app through the relay, and import from a phone's health export (stretch). Details in [REAL_DATA.md](REAL_DATA.md).

### 4.4 The server pieces

All are small and each has an offline fallback, so the demo never depends on them.

| Endpoint | Purpose | Fallback |
|---|---|---|
| Chat | Sends the question, the current screen and, if the person allows it, a short summary to a language model, and returns the Med bot's reply with two flags: urgent, and forward to the flight surgeon. Holds the key so it never ships to the browser | Scripted answers to three preset questions |
| Events | Relays emergency presses, acknowledgements and heart-rate samples between a watch and a console, linked by a six-character code. Keeps messages for one hour | Watch view and console in the same browser talk directly |
| Social | The crew network: handles, friend requests, one shared mood per person, and chat text between friends. Chat is kept 24 hours. Built by prompt 17, after the two above | The demo profile's simulated crew, entirely in the browser |

The Med bot is the only thing that uses a language model. Ophi Tov is scripted. Choose the model before prompt 10 part B runs.

### 4.5 Phone layout

- Sidebar becomes a drawer opened from the top bar. Emergency stays in the top bar at all times.
- Tables become stacked cards below 640 px.
- Ophi shrinks and never covers a primary button.
- Minimum touch target 44 px.

## 5. Free resources (Global Offers)

The 2026 Global Collaborators are GoDaddy, Google, Meteomatics, Microsoft and Miro. Rami reports that the Microsoft and Google offers are each worth 200 dollars of cloud credit. The other rows are guesses.

| Collaborator | What it gives | Planned use | Status |
|---|---|---|---|
| Microsoft (Azure) | 200 dollars of credit | **The product.** Static Web Apps for the public link and auto-deploy, Functions for the chat and events endpoints, and the hosted model the Med bot answers with | Claim before prompt 01 starts. **Confirm** the expiry date and whether a payment card is needed |
| Google (Cloud) | 200 dollars of credit | **The build.** Pays for the Gemini coding agent through the cloud account, so it does not stop at a free limit. Spare model for the Med bot if Azure model access stalls | Claim before prompt 01 starts. **Confirm** the same two things |
| GoDaddy | Not read | The team website | Not read |
| Miro | Not read | Sketching screens with Elia | Not read |
| Meteomatics | Not read | Probably not relevant | Not read |

### Using the credits

- **One cloud for the product, one for the build.** Keeping them apart means a busy coding session can never use up what the demo runs on.
- **Credit is spent through the cloud's model service, not through a chat app.** It pays for model calls made with a key or a signed-in project from that cloud account. It does not top up a Claude, Gemini or Copilot subscription. How each coding tool is pointed at a cloud account is in [prompts/README.md](../prompts/README.md).
- **Subscriptions first, credit as overflow.** The tools the team already pays for cost nothing extra until they hit their limit. Switch a lane to credit when that happens.
- **Check which models the credit covers.** From memory, promotional credit often covers the cloud's own models and excludes models sold by other companies through the same cloud. **Check** on the offer page before planning around any model that is not the cloud's own.
- **New accounts start with low speed limits.** Three agents at once can hit them. If a lane starts failing with "too many requests", move it to another tool; do not wait for a limit increase, which can take days.
- **Set a budget alert on both accounts at 50 and 150 dollars**, and keep at least 50 dollars on Azure untouched for demo day.
- **Keys never go in the repo.** They live in each person's own tool settings or the host's settings.

Plan B for hosting if Azure sign-up stalls for 30 minutes: any static host with GitHub auto-deploy.

## 6. Space-health grounding

Judging rewards validity. Every target shown must trace to a NASA source. Seed values are listed per screen in [SCREENS.md](SCREENS.md), each marked "verify", and the app shows "Source: to be confirmed" until a human fills in the source. Verifying them is a task for the build days, not for the agents to guess at.

Places to verify: first the Resources tab of the challenge page, which has not been read yet, then NASA Human Research Program (the five hazards and the evidence reports), NASA's nutrition requirements documents, the NASA Open Science Data Repository, and the NASA Technical Reports Server.

## 7. Schedule, by phase

Phases are what matter; the clock times depend on when the build starts. Each phase ends with its lanes merged into `main`. Prompt numbers and the parallel-work method are in [prompts/README.md](../prompts/README.md).

### Before the build (at home)

- Watch tools installed, sample app on the watch once, hotspot install tested. Checklist in [WATCH.md](WATCH.md).
- For each cheap watch: find its heart-rate broadcast setting, or note that it has none.
- Three copies of the repo ready, one per AI tool, once the repo exists.
- Elia's two intake sheets filled in with him.
- Open questions in section 9 answered.

### Build

| Phase | Prompts | Agents | Rough time | Done when |
|---|---|---|---|---|
| 0 · Foundation | 01 | One | 60 to 90 min | Every sidebar item opens a placeholder on PC and phone |
| Gate 1 | 13 | One strong model | 10 to 15 min | "Yes, other lanes can start" |
| 1 · Core | 02, 03, 10 part A | Three at once | 45 to 60 min | Store works, Ophi explains screens, public link is live |
| 2 · Rami's screens | 04, 05, 06 | Three at once | 45 to 60 min | Three screens work on the demo profile and on a new real profile |
| 3 · Rest | 14, 12, 07 twice, 08 part A, 10 part B | Three at once, 14 first | 2 to 2.5 hours | Overview shows the body figure and the routine. The Med bot answers and forwards. Elia has approved his two screens. Watch view works in the frame. Emergency travels between two devices |
| 4 · Extras | 15, 17 part A then part B, 08 part B, 09 | Up to three at once | 2 hours each for the figure, Social and the watch | The anatomical figure is on Overview. Two people on two devices are friends, chat, and see each other's mood. App on the wrist, live heart rate on the console |
| Sources | 16 | One strong model, alone | 60 min | Targets and body systems show real sources |
| Gate 2 | 13 | One strong model | 20 to 30 min | No blocker open |
| 5 · Finish | 11, fixes, polish | One at a time | 2 hours | Cross-screen story passes on the public link |

With three agents this is roughly ten to twelve hours of build time plus your own review and merging between phases, which is the real bottleneck. Do not skip the look at phone width before each merge.

### Fixed points

| When | What |
|---|---|
| Saturday evening | Ohad Zoom, break, Ophiuchus Zoom |
| Saturday night, at home | First real install of the native watch app, on home Wi-Fi |
| Sunday 11:00 | If the native app is not on the wrist, stop and use the browser watch view |
| **Sunday 14:30** | **Feature freeze.** Gate 2 review, then the test sweep |
| Sunday 16:30 | Final deploy. Rehearse on the actual laptop, phone and watch, on the hotspot |
| **Sunday 17:30** | **Handover to the Tel Aviv judges** |
| Sunday 17:30 to 24:00 | Help with the video, presentation and website. Submission in English, before 24:00 |

Bring on Sunday: the watch and charger, the cheap watches, a phone to act as hotspot, chargers, and a second device with a camera for the games.

## 8. What to cut, in this order

1. Mental health stays an honest placeholder.
2. Import from a phone's health export.
3. Samba time.
4. Futvolley.
5. Social's real network. The screen runs on the simulated crew only (stop prompt 17 part A after its step 7).
6. Voice on the watch. Preset questions only.
7. The native watch app. The browser watch view plus Bluetooth heart rate is the watch demo.
8. Social altogether. It stays an honest placeholder.
9. The Med bot's live model. Scripted replies, forwarding still works.
10. Charts on Rami's screens drop to numbers and pills.
11. The anatomical drawing on Overview (prompt 15). The working figure, system list, tiles and routine card stay.

Never cut: the shell working on a phone, source badges, Ophi's explanations, Emergency, the privacy rules, the two review gates, the test sweep.

## 9. Open questions for Aviad

1. Is the shell really Rami's to build from scratch? (Rami's current answer: yes.)
2. Performance / Spirit: one screen or two? (Overview is now one screen, built by Rami. Environment data is not planned because there is no data source for it.)
3. Med bot and Social are now Rami's to build. Med bot was listed as Aviad's: tell him, and check he has not started on it.
4. Is there a transparent-background file of the Ophi Tov art?
5. Is the counting-sheep game an external link or code to merge?
6. Repo name, and who can merge to `main`.
7. Where does Emergency send the alert in the story: mission control, the flight surgeon, crewmates?
8. Is everyone on the team comfortable with their own readings being used and shown? Each person decides for themselves.
9. Are Aviad's own screens built against [CONTRACTS.md](CONTRACTS.md)? If his agents do not follow it, his screens will not fit the shell.
10. Rami is building Overview with a clickable body figure and a "Today's routine" card ([prompt 14](../prompts/14-overview.md)), because the challenge text names both. Tell Aviad, and check it does not clash with anything he planned for that screen or for Environment data.
11. Gamification is named in the challenge and the games are rated "if time". Does one game move up to "must", or do streak counts on two screens cover it?

## 10. Risks

| Risk | Likelihood | What we do about it |
|---|---|---|
| The anatomical figure comes out looking wrong | Medium | It is built second, on top of a working plain figure, by the strongest model, with a two-hour limit. If it is not clearly better, the plain figure ships |
| Sources are not filled in and the app says "to be confirmed" to judges | High if left to the end | Paste the resources as soon as they are published and run prompt 16 as soon as 02 and 14 are merged |
| Agents on different tools produce pieces that do not fit | High without care | One contract with fixed names. Gate 1 before parallel work starts. Gate 2 before finishing |
| An inexpensive model invents a name or leaves its folder | High | Rules in AGENTS.md, exact names in each prompt, reject on sight |
| Watch install fails at the venue | Medium | First install at home, hotspot at the venue, at most two installs, backup installer on a phone, Sunday 11:00 cutoff |
| A sensor drops out mid-demo | Medium | Clear "disconnected" state with reconnect. Switch to the demo profile |
| Social puts real people's handles, moods and messages on a server | Low, but serious | Joining and mood sharing are two separate choices, both off to start. A chosen handle, never a name. No health value ever leaves through Social. Chat kept 24 hours. Reviewed at gate 2. If in doubt, ship the simulated crew only |
| Real health data leaks or embarrasses someone | Low, but serious | On-device by default, opt-in switches, no names in transit, one-hour retention, delete button, fictional medical records |
| Agents generate different visual styles | Medium | Shared components only, no new colors, review each merge at phone width |
| Azure sign-up or model access stalls | Medium | 30-minute time box, then plan B host and scripted chat |
| Web Bluetooth not available in the demo browser | Medium | Check at home. Use Chrome or Edge on the demo laptop |
| Camera games fail in the venue's lighting | Medium | Test in the room. No-camera mode in each game |
| Usage limits run out on one tool | Medium | Prompts work on any of the three tools. One prompt per fresh session |
| Medical claims without sources | Medium | "Source: to be confirmed" until verified. Verify during the build days |
| Submission rules changed for 2026 | Low | Read the 2026 Project Submission Guide before making the video |

## 11. Submission rules to check

From the 2025 guides, to be re-checked against the 2026 versions:

- A public demo link is required, hosted outside the Space Apps site. Video demos need English subtitles. The 2025 limit for the video was 30 seconds.
- Judging criteria: impact, creativity, validity, relevance, presentation.
- The submission page and linked material must be in English.
- AI use must be declared. Check whether AI-generated images such as the Ophi art need a visible mark.
- Do not use NASA logos or mission emblems.
- Check whether showing real people's health readings in the video needs anything beyond their consent.

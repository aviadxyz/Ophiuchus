# Runbook: what Rami does, in order

One checklist, top to bottom. Each step says which prompt to paste, into which kind of model, and when the step is finished. Background and reasons are in [prompts/README.md](prompts/README.md); you should not need them to follow this.

## What is yours and what is not

This plan builds **your part only**. It does not build the whole app.

| Yours | Prompts |
|---|---|
| The infrastructure: shell, sidebar, every tab as a placeholder, design components | 01 |
| The shared data store and the About tab | 02 |
| Ophi Tov, the scripted guide on every screen | 03 |
| The public link and the two small endpoints | 10 |
| Your tabs: Nutrition, Physical activity, Mood | 04, 05, 06 |
| Your tab: Overview, with the body figure | 14, 15 |
| Your tab: Med bot, the medical assistant you talk to | 12 |
| Elia's two designs, which you implement: Medical status, Emergency | 07, twice |
| Your tab: Watch, and the watch app | 08 |
| Your tab: Social, with friends, chat and shared mood | 17 |
| Sources, review and final testing of what you built | 16, 13, 11 |

| Not yours | What happens to it |
|---|---|
| Risks, Sleep, Performance, Research (Aviad) | Prompt 01 creates each as an empty placeholder tab. Its owner fills it. You do not |
| Mental health (unassigned) | Stays a placeholder unless the team assigns it |

Two things to keep straight, because the prompts depend on them:

- **Ophi Tov is scripted.** He explains the screen from text written in advance and uses no AI model. **The Med bot is the AI**: a separate assistant on its own tab that answers typed questions and offers to send the right ones to the flight surgeon.
- **Colors come only from [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md)**, which was taken from the console document you sent. Every prompt forbids new colors. If a result shows a color that is not in that file, reject it.

## The same six moves for every prompt

1. Open that agent's copy of the repo. Get the latest `main`. Create the branch named at the top of the prompt file.
2. Fill in anything in `[square brackets]` in the prompt.
3. Paste everything under the "Prompt" heading into a **new** session. Add nothing.
4. If it stops and asks for your OK, read what it shows and answer. Steps below marked **stops once** do this.
5. When it says done: ask it to paste the output of the four check commands, read what it "could not verify", and open the result at phone width.
6. Push the branch and merge it into `main` on GitHub. One merge at a time.

If something goes wrong, see "When a prompt goes wrong" at the bottom of [prompts/README.md](prompts/README.md). Two failed attempts on a cheap model: move that prompt to the strongest model.

Models, in short: **strongest** = Opus 5.5 or better. **Mid** = a capable mid-priced model. **Cheap** = any fast inexpensive model.

## What you can do on the train

With a laptop and your phone as a hotspot, once the hackathon has officially started:

- Steps 1 to 4 need only a browser and a terminal.
- Step 6 (prompt 01) can run on the train. It downloads packages at the start, so it needs the connection then; after you approve the versions it works by itself for about an hour.
- Step 7 (the first review) can follow as soon as step 6 is done.

Wait until you arrive for step 5 (you need Elia) and for anything with the watch.

---

## A. Before any agent runs

- [ ] **1.** Paste the links from the challenge's Resources tab into the "Resources" section of [docs/CHALLENGE.md](docs/CHALLENGE.md).
- [ ] **2.** Turn this folder into the team repo. It is not a git repository yet. Create an empty repo on GitHub, then in this folder:

  ```bash
  git init -b main
  ```

  ```bash
  git add -A
  ```

  ```bash
  git commit -m "Plan, contracts and prompts"
  ```

  Then run the two "push an existing repository" lines GitHub shows you on the new repo's page.
- [ ] **3.** Claim the Azure credit (needed for the public link in step 9 and for the Med bot's model in step 19). Claim the Google Cloud credit only if you expect to run out of subscription usage.
- [ ] **4.** Send the team: the repo link, [docs/CONTRACTS.md](docs/CONTRACTS.md), and the open questions in section 9 of [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md). Tell them their tabs will exist as placeholders after step 7. Tell Aviad that Med bot and Social are now yours, since Med bot was listed as his.
- [ ] **5.** Sit with Elia and fill in one intake sheet for Medical status and one for Emergency (the sheet is in [docs/SCREENS.md](docs/SCREENS.md)). You need them at step 17, so start early.

## B. Foundation. One agent, alone

- [ ] **6.** Run [prompt 01](prompts/01-shell-and-design-system.md). **Strongest.** **Stops once** to show you the package versions. Push the branch but **do not merge yet**.
      Done when: every sidebar item opens a placeholder on PC and on a phone, in the console's colors.
- [ ] **7.** Run [prompt 13](prompts/13-code-review.md) with `[gate 1]`. **Strongest**, new session. Have the first agent fix what it reports. Merge 01 only when the review says other lanes can start.
- [ ] **8.** Tell the team the tabs are ready (see "What to give a teammate" below). Then clone the repo into three folders, one per AI tool, for example `ophiuchus-a`, `ophiuchus-b`, `ophiuchus-c`.

## C. Core. Three agents at once

- [ ] **9.** [Prompt 10, part A](prompts/10-deploy-and-endpoints.md): the public link. **Cheap.** You click through the Azure account steps yourself. 30-minute limit.
- [ ] **10.** [Prompt 02](prompts/02-shared-data.md): the data store. **Mid.**
- [ ] **11.** [Prompt 03](prompts/03-ophi-guide.md): Ophi. **Cheap.**

Merge all three before going on. Done when: the store works, Ophi explains a screen, and the public link opens on your phone.

## D. Your three daily tabs. Three agents at once

- [ ] **12.** [Prompt 04](prompts/04-nutrition.md), Nutrition. **Cheap.**
- [ ] **13.** [Prompt 05](prompts/05-physical-activity.md), Physical activity. **Cheap.**
- [ ] **14.** [Prompt 06](prompts/06-mood.md), Mood. **Cheap.**

Merge all three. Done when: each works on the demo profile and on a new real profile.

## E. The rest of your must-haves. Three agents at a time

- [ ] **15.** [Prompt 14](prompts/14-overview.md), Overview with the working body figure. **Cheap.** Start this one first.
- [ ] **16.** [Prompt 12](prompts/12-medbot-chat-screen.md), the Med bot. **Cheap.** It works on scripted replies straight away and switches to the real model by itself once step 19 is merged.
- [ ] **17.** [Prompt 07](prompts/07-screen-from-intake-sheet.md), once for Emergency and once for Medical status. **Cheap.** **Stops once** each with an outline: show it to Elia before you say OK.
- [ ] **18.** [Prompt 08, part A](prompts/08-watch.md), the watch view in the browser. **Cheap.**
- [ ] **19.** [Prompt 10, part B](prompts/10-deploy-and-endpoints.md), the endpoints, which give the Med bot its model. **Mid.** **Stops once.** Fill in which model it uses before you paste.

Merge each as it finishes. Done when: you can ask the Med bot about a medicine dose, it offers "Send to flight surgeon", and the sent question shows on Overview. At this point everything you must deliver exists and works.

## F. Make it good

- [ ] **20.** [Prompt 15](prompts/15-body-figure.md), the anatomical body figure. **Strongest**, in a tool that can look at screenshots. Two-hour limit. If it is not clearly better than the working figure, do not merge it.
- [ ] **21.** [Prompt 16](prompts/16-sources.md), real sources. **Strongest**, in a tool that can open web pages. **Stops once** with two tables before it changes anything. Nobody else may be editing Overview or the data folder while it runs.
- [ ] **22.** [Prompt 17, part A](prompts/17-social.md), the crew network behind Social. **Mid, or strongest if you can spare it.** **Stops once** before the server part. Needs steps 10 and 19 merged. Not while step 21 is running, because both touch the data folder.
- [ ] **23.** [Prompt 17, part B](prompts/17-social.md), the Social screen. **Cheap.** Needs step 22 merged.
      Done when: on the demo profile you see friends with moods and can chat; on two real profiles on two devices you can add each other, chat, and see each other's mood.
- [ ] **24.** [Prompt 08, part B](prompts/08-watch.md), the native watch app. **Mid.** **Stops once.** Do the first install Saturday night at home. If it is not on your wrist by Sunday 11:00, drop it and demo the browser watch view.

Steps 20, 22 and 24 can run at the same time on three agents.

## G. Finish. One agent at a time

- [ ] **25.** **Sunday 14:30, stop adding things.** Run [prompt 13](prompts/13-code-review.md) with `[gate 2]`. **Strongest**, new session. Fix the blockers.
- [ ] **26.** Run [prompt 11](prompts/11-test-sweep.md), the test sweep, in a tool that can drive a browser. It gives you a bug list and **stops**; approve the fixes you want.
- [ ] **27.** **Sunday 16:30:** final merge, check the public link, rehearse on the real laptop, phone and watch.
- [ ] **28.** **Sunday 17:30:** hand over to the judges. Submission in English before 24:00.

## Only if you are ahead of schedule

In this order. Skip all of it without guilt.

1. Help a teammate get their tab in (below).
2. [Prompt 09](prompts/09-mini-game.md), a mini game. **Mid.**
3. A real brain for Ophi. Not planned; the idea and what it would change are at the end of [docs/OPHI_TOV.md](docs/OPHI_TOV.md). Decide the contract change yourself first.
4. Mental health, only after asking Aviad. Use prompt 07 with an intake sheet filled in by whoever designs it.

## If you are behind

Cut in the order of section 8 of [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md). First to go: the mini games, then Social's real network (stop step 22 after its step 7 and the screen runs on the simulated crew), then the native watch app, then Social altogether, then the anatomical drawing. Never cut: the shell on a phone, Emergency, the two reviews, the test sweep.

## What to give a teammate so their tab fits

After step 7, each teammate's tab already exists as a folder: `app/src/screens/<their screen id>/`. Send them the repo link and this, to paste at the top of whatever they tell their own AI tool:

> Read AGENTS.md and docs/CONTRACTS.md before doing anything. You are replacing the placeholder in `app/src/screens/[folder]/`. Work on your own branch, never on `main`. Change files only inside that folder. Build the screen from the shared components in `@/design` and read data only through `@/data`. Add no dependency and no color. Before you say you are done, run the four check commands in AGENTS.md and paste their output.

They open a pull request; you look at it at phone width and merge it. If their agent changed anything outside their folder, send it back.

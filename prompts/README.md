# Prompts

One file per job, each written to be handed to a coding agent as-is. They are precise on purpose so that fast, inexpensive models can run them: every shared name, path and shape is fixed in [docs/CONTRACTS.md](../docs/CONTRACTS.md), and each prompt says exactly which folder the agent owns.

**Do not run any of these until the build has the go-ahead.**

## When the hackathon starts

Follow [RUNBOOK.md](../RUNBOOK.md) from the top. It is the step-by-step checklist: what to do before prompt 01, which prompt to run at each step, on which kind of model, and when the step is finished. The rest of this file is the background behind it.

These prompts build Rami's part of the product only: the infrastructure, every tab as a placeholder, and the tabs that are his. Teammates fill their own tabs; the runbook ends with what to send them so their work fits.

## Can several agents work at once?

Yes, after the first step. The work is split into phases. Inside a phase, the jobs touch different folders and can run at the same time on different AI tools. Between phases you merge and everyone starts fresh from the merged result.

| Phase | Run these | In parallel? | Why |
|---|---|---|---|
| **0 · Foundation** | 01 | **No. Alone.** | It creates the project everything else is built in. Nothing can start before it exists |
| Gate 1 | 13 (gate 1) | Alone, about 10 minutes | A strong model checks the foundation before three agents build on it |
| **1 · Core** | 02, 03, 10 part A | Yes, three at once | Data store, Ophi, and deploy live in three separate places |
| **2 · Rami's screens** | 04, 05, 06 | Yes, three at once | One screen folder each |
| **3 · Rest** | 14 (Overview), 12 (Med bot), 07 (Medical status), 07 (Emergency), 08 part A, 10 part B | Yes. Six jobs, so with three tools start 14 and two others, then the rest as agents free up | Separate folders. 14 is the landing page, so it goes first. 07 needs Elia's sheets. 10 part B needs the model decision. 12 works on scripted replies until 10 part B is merged |
| **4 · Extras** | 15 (anatomical body figure), 17 part A then part B (Social), 08 part B (native watch), 09 (game) | Yes, except that 17 part B waits for part A to be merged | Separate folders. 15 needs 14 merged and the strongest model. 17 part A needs 02 and 10 part B merged |
| Any time after 02 and 14 are merged | 16 (sources) | Alone in its two files | It edits one file in the data folder and one in Overview, so no other lane may be changing them |
| Gate 2 | 13 (gate 2) | Alone | Whole-repo review by a strong model |
| **5 · Finish** | 11 (test sweep), fixes | One at a time | Fixes must not collide |

Phase 2 must wait for phase 1 to be **merged**, because the screens call the data store. The contract fixes the names, so in an emergency a screen agent could start early, but it would be writing code it cannot run. Not worth it: phase 1 is short.

The watch's home preparation (tools installed, sample app on the watch) is not a prompt. It is the checklist in [docs/WATCH.md](../docs/WATCH.md) and should be done before the weekend if possible.

## Setting up three agents so they do not trip over each other

Three agents cannot share one folder. They would overwrite each other's files and fight over the running app. Give each one its own copy of the repo and its own branch.

1. Clone the repo three times, into three folders, for example `ophiuchus-a`, `ophiuchus-b`, `ophiuchus-c`. Open one in each AI tool.
2. At the start of a phase, in each folder: get the latest `main`, then create that lane's branch. The branch name is at the top of each prompt.
3. Give each agent its prompt. They work at the same time.
4. When an agent reports done, look at its result at phone width, then push its branch and merge it into `main` on GitHub. Merge one at a time.
5. When the whole phase is merged, start again at step 2 for the next phase.

Because each lane only writes inside its own folder, merges should not conflict. If one does, it means an agent left its lane: reject that part and keep the rest.

## Which model gets which job

The prompts are written so that most of the build needs no cleverness, only obedience. Spend the strongest model where judgment matters and nowhere else.

**Strongest model you have (Opus 5.5 or better), fresh session each time:**

| Job | Why it needs the best |
|---|---|
| 13, gate 1 and gate 2 | It has to notice what is wrong across the whole repo without being told where to look. This is the best use of a strong model in the whole build |
| 01, the foundation | Every other agent copies its patterns. It runs once, alone. If your limit allows one long run, spend it here |
| 15, the anatomical body figure | A drawing judged by eye. Weak models produce something that passes every check and looks wrong |
| 16, sources | Reading scientific documents carefully and refusing to guess |
| Rescue | Any prompt that failed twice on a cheaper model, any change to docs/CONTRACTS.md, any merge that conflicts |

**Capable mid-priced model:**

| Job | Why |
|---|---|
| 02, the data store | Other screens depend on it, and it holds the privacy rules |
| 08 part B, the native watch app | Unfamiliar platform, needs to read current documentation and fix real device errors |
| 10 part B, the endpoints | Server code that handles real readings and a model key |
| 17 part A, the crew network | Server code that holds real people's handles, moods and messages. Use the strongest model if you can spare it |
| 09, a mini game | Camera tracking needs tuning by trial |

**Inexpensive, fast model. These are fully specified: exact files, exact names, exact checks:**

03, 04, 05, 06, 07, 08 part A, 10 part A, 12, 14, 17 part B, and the read-through part of 11.

How to keep an inexpensive agent on the rails:

- Paste the prompt exactly. Do not summarize it or add "be creative".
- One prompt per session. Start a new session for the next prompt, so nothing from the last job leaks in.
- When it reports done, ask it to paste the output of the four commands. Do not accept "all checks pass" without the output.
- If it asks a question that docs/CONTRACTS.md answers, point at the section. If the contract does not answer it, that is a real gap: take it to the strongest model, fix the contract once, and tell the other lanes.
- Never let it "improve" a shared folder. Reject the change and rerun.

For the click-through part of 11, use a tool that can drive a browser. Otherwise do the clicking yourself.

## Paying for the agents

Three sources, used in this order:

| Source | Use it for | Limit to watch |
|---|---|---|
| Subscriptions the team already has (Claude, Gemini, Copilot) | Everything, until one runs out | Each has a usage cap that resets on its own schedule |
| Google Cloud credit, 200 dollars | The Gemini agent's lane once its free or subscription limit is reached | Speed limits on a new account |
| Azure credit, 200 dollars | The product first: hosting and the Med bot's model. Coding only if the other two are exhausted | Keep 50 dollars back for demo day |

How credit reaches a coding agent, from memory, so **check each in the tool's own help before the build**:

- **Gemini agent on Google Cloud credit:** the Gemini command-line agent can sign in against a Google Cloud project instead of a personal account, and its usage is then billed to that project. The project needs the cloud's AI service switched on.
- **An agent on Azure credit:** deploy a model in Azure's AI service, then point a coding tool that accepts a custom endpoint and key at it. Copilot's own subscription is separate and is not paid from this credit.
- **Claude on either cloud:** Claude models are offered through both clouds, and Claude Code can be set to use a cloud account. Whether promotional credit pays for them is the thing to **check**; if it does not, Claude stays on the subscription.

Rules that keep this from costing time:

- Claim both credits and make one test call on each **before prompt 01 starts**. Account checks can stall, and it is better to find out then.
- Save the strongest model for the jobs listed under "Which model gets which job". The tightly specified prompts are written for inexpensive models, and that is where credit goes furthest.
- If a lane hits "too many requests", move that prompt to another tool and carry on. The prompt and the contract are the same whichever tool runs them.
- Keys stay in each tool's own settings. Never in the repo, never pasted into a prompt.

All three tools read the rules automatically: Claude from `CLAUDE.md`, Gemini from `GEMINI.md`, Copilot from `.github/copilot-instructions.md`. All three point to `AGENTS.md`. Every prompt also tells the agent to read it, so nothing depends on that.

## How to run one prompt

**Agent that can read the repo:** open that agent's copy of the repo on the lane's branch, then paste everything under the "Prompt" heading.

**Chat tool with no repo access:** paste the files listed under "Attach" first, then the prompt. Ask for complete files with their paths and copy them in yourself.

Either way:

1. Fill in anything in `[square brackets]` first.
2. Most prompts do not stop for approval; the agent writes a short plan into its notes file and builds. Six prompts do stop once, because a wrong start there is expensive: 01, 07, 08 part B, 10 part B, 16 and 17 part A.
3. When it reports done, read its report for anything it "could not verify", and open the result at phone width.
4. If its report mentions a contract problem, stop and sort that out before merging. Fix the contract in one place and tell the other lanes.

## All prompts

| File | Produces |
|---|---|
| [01-shell-and-design-system.md](01-shell-and-design-system.md) | The project, shell, shared components, registry, a placeholder for every screen |
| [02-shared-data.md](02-shared-data.md) | The store, demo history, real profiles with consent, heart-rate sensor input, relay client, About screen |
| [03-ophi-guide.md](03-ophi-guide.md) | Ophi Tov on every screen with the explanation panel |
| [04-nutrition.md](04-nutrition.md) | Nutrition screen |
| [05-physical-activity.md](05-physical-activity.md) | Physical activity screen with live heart rate |
| [06-mood.md](06-mood.md) | Mood screen |
| [07-screen-from-intake-sheet.md](07-screen-from-intake-sheet.md) | Medical status, and Emergency, from Elia's designs |
| [08-watch.md](08-watch.md) | Part A: watch view in the browser and the Watch screen. Part B: native Wear OS app |
| [09-mini-game.md](09-mini-game.md) | Futvolley, or Samba time |
| [10-deploy-and-endpoints.md](10-deploy-and-endpoints.md) | Part A: public link. Part B: chat and events endpoints |
| [11-test-sweep.md](11-test-sweep.md) | Click-through bug hunt, then fixes |
| [12-medbot-chat-screen.md](12-medbot-chat-screen.md) | Med bot: the medical assistant you can talk to, which forwards the right questions to the flight surgeon |
| [13-code-review.md](13-code-review.md) | Read-only review by a strong model, at two gates |
| [14-overview.md](14-overview.md) | Overview, the landing page: sixteen clickable body systems with a working figure, and today's routine, both named in the challenge text |
| [15-body-figure.md](15-body-figure.md) | The high-quality anatomical figure that replaces the working one. Strongest model only |
| [16-sources.md](16-sources.md) | Real sources for every target and every body-system text, from the challenge's resources |
| [17-social.md](17-social.md) | Part A: the crew network (data functions and server). Part B: the Social screen with find, friends, requests, chat and shared mood |
| [companion/medbot-system-prompt.md](companion/medbot-system-prompt.md) | Not a build task. The text the Med bot runs on, its context, opening lines, offline replies, test messages. Ophi Tov is scripted and has no such file |

## When a prompt goes wrong

- **The agent invented a name or a field:** reject it and point at the contract section. This is the failure that breaks parallel work.
- **The agent edited outside its folder:** revert those files, keep the rest.
- **The agent restyled something or added a color:** reject, point at the design system.
- **The result is close:** say exactly what is wrong in one short message. Do not re-run the whole prompt.
- **Two attempts and still wrong:** move that prompt to a stronger model, or cut it to the smallest version in the spec.
- **A cheap model keeps skipping the checks:** ask it to paste the output of the four commands. If it cannot run them, run them yourself before merging.

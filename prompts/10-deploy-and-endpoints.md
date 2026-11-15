# 10 · Deploy and endpoints

Two parts. Part A gives the team a public link in the first hours. Part B adds the two small server pieces that the Med bot and the watch need.

**A human does some steps by hand** in both parts: creating the cloud account, accepting terms, entering keys. The agent prepares everything else and lists exactly what to click. Never paste a key into a chat or commit one to the repo.

---

## Part A · Public link with auto-deploy

**Phase 1. Can run in parallel with 02 and 03.**

| | |
|---|---|
| Branch | `lane/10a-deploy` |
| You own | Deployment workflow files under `.github/workflows/`, the hosting configuration file the service requires, and `docs/DEPLOY.md` |
| Read first | AGENTS.md, docs/CONTRACTS.md sections 1, 3 and 11, `app/README.md` |
| Needs | 01 merged. The GitHub repo. The Azure account with the 200 dollar offer credit already claimed (see section 5 of docs/BUILD_PLAN.md) |
| Time box | 30 minutes. If the account or the deploy is still fighting you, use any static host with GitHub auto-deploy and return to Azure later |

### Prompt

Read AGENTS.md and `app/README.md` before doing anything. The Ophiuchus web app in `app/` is a static build. Set it up to deploy automatically to Azure Static Web Apps from the `main` branch of this GitHub repo.

Several agents will be merging to `main` all weekend, and hackathon judges will open the public link on their own laptops and phones. So the deploy must be automatic, must survive a reload on any route, and must be easy to move to another host. You change no file inside `app/src`.

**Do this:**

1. Look up the current official instructions for deploying a static single-page app from GitHub to Azure Static Web Apps. Do not rely on memory for file names or settings. Tell me what you found.
2. Add the deployment workflow and the hosting configuration: app location `app`, the build output folder, the API location `api` (it does not exist yet; set it so part B needs no change here, or tell me if the service requires it to exist), and a fallback so every route in CONTRACTS section 3 serves the app.
3. The workflow runs `npm run lint`, `npm run typecheck` and `npm run test` before building, and fails the deploy if any fails.
4. Make sure a new deploy replaces the offline-cached version without users clearing anything. If that needs a change inside `app/`, do not make it; describe it for lane 01.
5. Give me a numbered list of what I do by hand in the Azure portal and in GitHub settings, with the exact names of the things to click.
6. Write `docs/DEPLOY.md`: how deploys happen, how to see a failed one, how to roll back, where the two settings `VITE_CHAT_URL` and `VITE_EVENTS_URL` are set, and a three-step plan B for moving to another static host.

**Do not:** create cloud resources yourself, add server code, add a custom domain, put any secret in the repo, or touch `app/src`.

**Checks:**

- A merge to `main` updates the public link within a few minutes with no manual step.
- Opening `/nutrition` directly and reloading on it works.
- The link opens on a phone on mobile data over HTTPS.
- A second deploy shows a new build time on the About screen without a manual cache clear.

**Report:** the instructions you followed, the files you added, the manual steps, and the result of each check you could perform.

---

## Part B · Chat and events endpoints

**Phase 3. Runs alone in its own folder, so it can overlap with 07 and 08 part A.**

| | |
|---|---|
| Branch | `lane/10b-endpoints` |
| You own | `api/` only |
| Read first | AGENTS.md, docs/CONTRACTS.md sections 10 and 11, docs/REAL_DATA.md privacy rules, prompts/companion/medbot-system-prompt.md sections 1 and 2, `docs/DEPLOY.md` |
| Needs | Part A done. The model provider and model chosen |
| Fill in first | `[model provider and model]` |
| Use | A capable model. This is the only code that handles other people's data on a server |

### Prompt

Read AGENTS.md, docs/CONTRACTS.md sections 10 and 11, and the privacy rules in docs/REAL_DATA.md before doing anything. You are building two small server functions in `api/`, deployed with the static app. You change nothing outside `api/`.

The first lets the Med bot answer questions without exposing the model key in the browser. The second relays a handful of small messages between a watch and a console so that holding Emergency on a wrist shows up on a laptop. Real team members' heart-rate readings pass through the second one. This is a weekend demonstration with a few users: prefer the simplest dependable design, and treat every byte of health data as something to hold for as short a time as possible.

**Before writing:** look up the current official documentation for adding API functions to an Azure Static Web App, and for the simplest durable storage that platform offers to such functions. Tell me what you found and where events will be stored. **Then stop and wait for my OK.**

**Build:**

1. **`POST /api/chat`**, exactly as in CONTRACTS section 11. Call `[model provider and model]` with section 1 of `prompts/companion/medbot-system-prompt.md` as the system prompt, word for word, kept in its own text file inside `api/` so teammates can edit the wording without touching code. The user turn is the `context` text followed by the `message`. When `replyMode` is `watch`, cap the reply length to match. Set `urgent` to yes when the reply directs the person to the Emergency screen; decide this with a short second instruction to the model or a simple check on the reply, whichever is more dependable, and tell me which you chose. Set `forward` to yes when the reply ends with the fixed forwarding sentence from the system prompt ("This is one for the flight surgeon."), and never when `urgent` is yes.
2. **`POST /api/events` and `GET /api/events`**, exactly as in CONTRACTS section 11, carrying the message shape in section 10. Validate every field: known `type`, `room` of six allowed characters, `at` a valid time, payload fields of the right kind and within sane ranges (heart rate 20 to 250, for example). Reject anything else. `GET` returns only messages for that `room` newer than the cursor, oldest first.
3. **Retention:** delete every stored message older than one hour, on each write. Never store the chat message, the context, or the reply.
4. **Limits,** since the link is public: message length cap of 1,000 characters on chat; request size cap on both; a per-room and per-address rate limit generous enough for one watch posting every five seconds and two consoles polling every two; an eight-second timeout on the model call that returns a friendly fallback reply.
5. **Logging:** log only the endpoint, the status code and the duration. Never log a message, a context, a reply, a payload or a room code.
6. **Secrets:** the model key and any storage key come from the platform's application settings. Give me the exact list of settings to create by hand.
7. **`api/README.md`:** what each endpoint takes and returns, with one example each using made-up values, how to run them locally, and how a new endpoint is added and where it should store data. A later prompt (17) adds `api/social/` beside yours and will follow that description.
8. **Tests:** validation accepts each message type and rejects malformed ones; `GET` ordering and cursor; retention removes old messages; rooms cannot read each other's messages.

**Do not build:** accounts, sign-in, server-side conversation history, streaming, anything outside `api/`.

**Checks:**

- All tests pass.
- Run every test message in section 5 of the companion prompt file against the deployed chat endpoint, in both reply modes, and give me the table of results. No reply contains a drug dose; every urgent message is flagged `urgent`; `forward` matches the table for every row that names it.
- An `emergency.raised` posted from one device is returned to a second device in the same room within about three seconds, and the acknowledgement makes the trip back. A third device in a different room sees neither.
- With both endpoints switched off, the web app still works using its fallbacks.

**Report:** what you built, where events are stored and for how long, the settings I must create, and the test-message results.

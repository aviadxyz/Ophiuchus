# 22 · Social that really works between devices, with the team as friends

**Runs alone in its files. Needs prompts 10 part B, 17 and 21 merged. They are.**

The Social screen works today on a simulated crew. A real person on a real device gets "not connected". This prompt builds the server side on the Cloudflare Worker that already runs the Med bot, so messages and shared moods travel between real devices, and makes the five team members friends with each other from the start.

| | |
|---|---|
| Branch | `lane/22-social-live` |
| You own | New folder `app/worker/social/`; the lines in `app/worker/index.ts` that route `/api/social/*`; the Durable Object section of `app/wrangler.jsonc`; `app/src/data/social/`; one line in `app/.env.production`; and in `app/src/screens/social/` only what the last section below asks for |
| Read first | AGENTS.md, docs/CONTRACTS.md sections 8, 9 and 11, docs/REAL_DATA.md rules 5, 9 and 10, `prompts/17-social.md` Part A (the server steps), `app/worker/README.md`, every file in `app/worker/` and `app/src/data/social/`, `app/src/data/team.ts` |
| Use | A strong model. This is the only code that holds other people's messages on a server |

## Prompt

The build has started and you may write code. Read AGENTS.md, docs/CONTRACTS.md and the files under "Read first" before doing anything. Touch only what is listed under "You own". Add no dependency.

### Part 1. The endpoints

Build the seven social endpoints of CONTRACTS section 11, exactly as written there, inside the existing Worker:

- Code in `app/worker/social/`, routed from `app/worker/index.ts` the way `/api/chat` and `/api/events` are. Follow `app/worker/README.md` for how an endpoint is added.
- Storage: one SQLite-backed Durable Object for the whole crew network, declared in `app/wrangler.jsonc` beside the existing one, with a new migration tag. Nothing is created by hand in a dashboard. Look up the current Cloudflare documentation for adding a second Durable Object class and a second migration before you write, and test with `npx wrangler dev`.
- `join` returns a `socialId` and a `token`. Store only a hash of the token. Every other call carries the token; reject a missing or wrong one.
- The server holds a handle, an optional role, friendships, at most one shared mood per person, and chat text. Never a display name, a reading or a note. Validate everything: handle of 3 to 20 letters, digits or underscores; message text of 1 to 500 characters; mood score 1 to 5 with at most two tags.
- Only friends can read each other's mood or exchange messages. `people` never returns a mood.
- Retention: delete chat messages older than 24 hours on every write, and accounts unused for 7 days. `leave` removes the account, its friendships and its messages at once.
- Limits and logging as in `app/worker/README.md`: log only the path, the status and the duration.
- Tests beside the code: the token check; a non-friend cannot read a mood or send a message; retention; leaving removes everything; validation of each field.

### Part 2. The app talks to it

- Set `VITE_SOCIAL_URL=/api/social` in `app/.env.production`.
- `app/src/data/social/` already has a client for the live network. Make it work against your endpoints: a member profile whose device can reach the network gets the connection state `live`. Poll `sync` every three seconds while the Social screen is open and every fifteen seconds otherwise, and stop while the page is hidden.
- The demo profile is unchanged: it keeps its simulated crew and never touches the network.

### Part 3. The team are friends from the start

The five team profiles are listed in `app/src/data/team.ts` (ids `crew-rami`, `crew-aviad`, `crew-shoval`, `crew-elia`, `crew-tal`).

- When the active profile is one of those five and it has not joined yet, the Social screen shows no handle form. It shows one button, "Join the crew network as [first name]", with the "Share my mood with friends" switch. Joining uses the handle made from the first name in lower case (`rami`, `aviad`, ...) and sends the profile's role.
- On the server, those five handles are friends with each other the moment each one joins: no request, no accepting. Keep the list of the five handles in one file in `app/worker/social/` with a comment saying why.
- A team member who has not joined yet still appears in the others' Friends list, marked "Not joined yet", with the Chat button disabled and the reason shown.
- Everyone else (a profile made with "Someone else on the crew") joins with a handle they choose and makes friends by request, as the screen already does.
- The simulated crew stays on the demo profile only. A real profile never sees a simulated person.

### Part 4. Messages that feel right

On the Social screen, for the live network: a sent message appears at once with "Sending", then shows its time; a failed one shows "Not sent. Tap to retry." and retrying works; a message from a friend appears within about three seconds without a reload; the unread count on a friend clears when the chat is opened; the list is ordered by the newest message. Fix whatever in `app/src/screens/social/` stops any of these from being true, and nothing else there.

### Do not build

Group chats, pictures or files, translation, games, read receipts, passwords or sign-in, push notifications.

### Checks you must run and pass before reporting

- `npm run build`, `npm run lint`, `npm run typecheck`, `npm run test` in `app`, all clean.
- With `npx wrangler dev`: two browser profiles, one as Rami and one as Tal. Each joins with one tap. Each sees the other as a friend at once. A message sent by one appears on the other within about three seconds, in both directions. A mood check-in by one, with sharing on, shows on the other as a word and at most two tags, never the note. Turning sharing off removes it.
- A third browser on a profile that is not on the team cannot read either one's mood or send them a message until a request is accepted.
- The demo profile still shows its simulated crew, and its chats still answer.
- With `VITE_SOCIAL_URL` empty the app builds and Social falls back as before.

**Report:** what you built, the result of each check, exactly what the server stores and for how long, and anything you could not test.

When all checks pass, commit, push this branch, and report. Do not merge.

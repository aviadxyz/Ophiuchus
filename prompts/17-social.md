# 17 · Social

Two parts. Part A builds the crew network: the data functions and the small server behind them. Part B builds the screen. The spec is the "Social" section of [docs/SCREENS.md](../docs/SCREENS.md).

Social is a small, private crew network: find people who use the app, become friends, chat, and see each friend's mood if they chose to share it. It is the first part of this app where one person's information reaches another person, so the privacy rules matter more here than anywhere else.

**Run this after every "must" in the build plan works.** Part A first; part B needs it merged.

---

## Part A · The crew network

**Phase 4. Runs alone in its two folders, so it can overlap with 15, 08 part B and 09.**

| | |
|---|---|
| Branch | `lane/17a-social-network` |
| You own | `app/src/data/social/` and `api/social/`. You may also add export lines to `app/src/data/index.ts` and a section to `app/src/data/README.md`, for the names in this prompt and nothing else |
| Read first | AGENTS.md, docs/CONTRACTS.md sections 8, 9 and 11, the "Social" section of docs/SCREENS.md, the privacy rules in docs/REAL_DATA.md, `app/src/data/README.md`, `api/README.md`, `docs/DEPLOY.md` |
| Needs | 02 and 10 part B merged |
| Use | A capable model. This code puts real people's handles, moods and messages on a server |

### Prompt

Read AGENTS.md, docs/CONTRACTS.md sections 8, 9 and 11, the "Social" section of docs/SCREENS.md and the privacy rules in docs/REAL_DATA.md before doing anything. You are building the crew network: the functions the Social screen will call, and the server endpoints behind them. Another agent builds the screen afterwards against the names in the contract, without seeing your code, so implement those names and shapes exactly.

Work only in `app/src/data/social/` and `api/social/`. Do not change `store.ts`, `selectors.ts` or any other existing file in `data`, except to add export lines to `data/index.ts` and a section to `data/README.md`. Where you need to react to the store (a new mood check-in, a deleted profile, a change of active profile), subscribe to it from inside your folder. Add no dependency.

**Build in this order. After step 3 the screen agent could already start on the demo profile, so do not skip ahead.**

1. **Types** in `data/social/types.ts`: `SocialAccount`, `SharedMood`, `SocialPerson`, `ChatMessage`, exactly as in CONTRACTS section 8.
2. **Simulated crew** in `data/social/simulatedCrew.ts`: six fictional people with handles, roles and moods, all with source `simulated`. For the `demo` profile: two are friends from the start, each with a mood and a short existing conversation; one has sent a request; three can be found by search. A message sent to a simulated friend gets one of a few fixed, friendly replies after about two seconds. Requests sent to simulated people are accepted after about three seconds. Names are plainly invented; use no real person's name.
3. **Hooks and functions** in `data/social/`, exported from `@/data`: every social name in the "Reading" and "Writing" tables of CONTRACTS section 9, with exactly those names, inputs and results. Three modes, reported by `useSocialAccount().connection`:
   - `simulated`: the active profile is `demo`. Everything runs on the simulated crew, in the browser. `joinSocial` always succeeds without a network call. Nothing is sent anywhere.
   - `live`: the active profile is a member, `VITE_SOCIAL_URL` is set and reachable. Everything goes through the endpoints.
   - `off`: the active profile is a member and the network cannot be reached. Reads return what was last received; writes return `offline` or mark the message `failed`. A member profile never sees simulated people.
4. **State on the device:** the account (with its token), friends, requests and conversations, persisted per profile under the `ophiuchus:v1:` prefix in a small store of your own inside `data/social/`. The token is never exported. Missing, full or corrupted storage must not crash the app.
5. **Mood sharing:** while the account's `shareMood` is on, publish the `SharedMood` whenever the active profile's mood check-ins change: the score and the first two tags of the latest check-in from the last 24 hours, with its time. Never the note. With no check-in in the last 24 hours, or with sharing off, clear it. `useMySharedMood()` returns exactly what was published.
6. **Leaving:** `leaveSocial()` and `deleteProfileData` (which you observe from the store) both remove the account from the network and everything social from the device.
7. **Sync in live mode:** poll `GET /api/social/sync` every three seconds while the Social screen is in use (a hook is mounted), every thirty seconds otherwise, and not at all when the tab is hidden.

**Before writing the server part:** read `api/README.md` and `docs/DEPLOY.md` to see how the existing endpoints are built and where they store data, and tell me where social data will be stored and how the token is checked. **Then stop and wait for my OK.**

8. **Endpoints** in `api/social/`, exactly as in CONTRACTS section 11, built the same way and on the same storage as the existing endpoints.
   - `join`: the handle must be 3 to 20 letters, digits or underscores, and not taken (compare without regard to case). Return a new `socialId` and a long random `token`. Store only a hash of the token.
   - Every other call must carry a valid token, and acts only for that account. Check, on the server, that: only friends can message each other; a mood is returned only to friends; `people` never returns moods; a relation action is allowed from the current relation.
   - Validate every field: `score` 1 to 5, at most two `tags` from the fixed list of eight in the Mood spec, `text` 1 to 500 characters, known `action`. Reject anything else.
9. **What the server may hold:** the handle, an optional role, friendships and requests, at most one shared mood per account, and chat messages. Nothing else. No display name, no reading, no note, no profile field, no address.
10. **Retention:** delete chat messages older than 24 hours and accounts not seen for 7 days, on each write. `leave` deletes the account, its friendships, its mood and every message to or from it at once.
11. **Limits,** since the link is public: at most 30 accounts joined from one address per hour, 60 messages per account per minute, 200 friend requests per account per day, and a request size cap.
12. **Logging:** only the endpoint, the status code and the duration. Never a handle, a token, a mood or a message.
13. **`api/social/README.md`** with one example per endpoint using made-up values, and the settings I must create by hand. Add a "Social" section to `data/README.md`: every hook and function with a one-line description, for the screen agent.
14. **Tests,** all on the `demo` profile or made-up accounts:
    - Browser side: the simulated crew behaves as in step 2; a member profile never receives a simulated person; the shared mood follows a new check-in, never contains the note, and clears when sharing is switched off; leaving removes everything.
    - Server side: handle rules; a stranger cannot read a mood or send a message; a relation cannot skip a step; retention removes old messages; `leave` removes everything; one account cannot act for another.

**Do not build:** the screen, sign-in or passwords, photos, group chats, push notifications, any change to the existing endpoints or to `store.ts`.

**Checks you must run and pass before reporting:**

- `npm run build`, `npm run lint`, `npm run typecheck`, `npm run test`, all clean.
- Compare every exported name against the social rows of CONTRACTS sections 8, 9 and 11 line by line. List any difference. There should be none.
- Two browsers with two member profiles on the deployed link: join, find each other, request, accept, exchange a message each way within about five seconds, share a mood and see it on the other side, switch sharing off and see it disappear, leave and see the friend vanish from the other side.
- With `VITE_SOCIAL_URL` empty: the demo profile works fully on the simulated crew, and a member profile gets `off`.

**Report:** what you built, where social data is stored and for how long, the settings I must create, the result of each check, and anything in the contract that did not fit.

---

## Part B · The Social screen

**Phase 4, after part A is merged. Runs alone in its folder.**

| | |
|---|---|
| Branch | `lane/17b-social-screen` |
| You own | `app/src/screens/social/` only |
| Read first | AGENTS.md, docs/CONTRACTS.md sections 5 to 9, the "Social" section of docs/SCREENS.md, docs/DESIGN_SYSTEM.md, `app/src/data/README.md` |
| Attach (chat tools only) | Those files, plus `app/src/design/index.ts` |
| Needs | 01, 02, 03 and part A merged |

### Prompt

Read AGENTS.md, docs/CONTRACTS.md and the "Social" section of docs/SCREENS.md before doing anything. You are replacing the placeholder in `app/src/screens/social/`. Stay strictly inside that folder and add no dependency. Everything you need comes from `@/design`, `@/data` and `@/registry`. Colors, type and spacing come only from the design tokens and the shared components; add no color, font or shadow of your own.

The screen is a small, private crew network: find people, become friends, chat, and see how each friend is feeling if they chose to share it. It must feel calm and personal, and it must never show or hint at anyone's health data. Do not keep any copy of social data in the screen; read every time from the hooks.

**Files:** `index.tsx`, `JoinCard.tsx`, `MyMoodCard.tsx`, `FindCrew.tsx`, `YourCrew.tsx`, `FriendRow.tsx`, `ChatDrawer.tsx`, `moodDisplay.ts`, `guide.ts`, `meta.ts`, `NOTES.md`.

**Build in this order. Each step leaves a screen that works.**

1. **`moodDisplay.ts`:** one pure function from a `SharedMood` or none to what is shown: the word (1 VERY LOW, 2 LOW, 3 OKAY, 4 GOOD, 5 VERY GOOD, or "NOT SHARED"), a lucide face icon for each score, the tone (1 and 2 `warn`, 3 `neutral`, 4 and 5 `ok`, none `neutral`), the tags joined with " · ", and how long ago in plain words ("2 h ago"). Fully tested. Every other file uses this, so mood looks the same everywhere.
2. **Header.** `ScreenHeader`, eyebrow `DOMAIN · SOCIAL`. Pills once joined: `N FRIENDS` (`info`), `N REQUESTS` (`warn`, only when there are incoming ones), and `MOOD SHARED` (`ok`) or `MOOD PRIVATE` (`neutral`).
3. **Not joined** (`useSocialAccount()` gives none): show only `JoinCard`. A `TextField` for the handle with the hint "3 to 20 letters, digits or underscores. This is the only name other people see."; two sentences: "Friends see your handle, your role and, if you allow it, your mood. Your notes, readings and health data never leave this device."; a `Switch` "Share my mood with friends", off; a primary `Button` "Join the crew network" calling `joinSocial`. Show the reason in plain words when it returns `taken`, `invalid` or `offline`.
4. **Connection `off`:** an `EmptyState` above everything: "The crew network cannot be reached. Your friends will reappear when it is back." Lists show what was last received and every action button is disabled.
5. **`MyMoodCard`,** titled "What your friends see": `useMySharedMood()` shown exactly as a friend row shows a mood, or "No mood shared today"; a `Switch` "Share my mood with friends" calling `setShareMood`; a quiet `Button` "Check in" that goes to `/mood`.
6. **`FindCrew`,** a `Card` titled "Find crew": a `TextField` for the search and the results from `useSocialSearch(query)` as a list. Each row: an initial in a circle, the handle, the role, a `SourceBadge` when the person's source is `simulated`, and one control by relation: `none` gives a `Button` "Add friend"; `outgoing` gives a quiet `Button` "Requested · cancel"; `incoming` gives "Accept"; `friend` gives a `StatusPill` FRIEND. No result: "Nobody with that handle yet."
7. **`YourCrew`,** a `Card` titled "Your crew" with a `ChipGroup` of two options, "Friends (n)" and "Requests (n)".
   - **Friends:** first a line of crew mood counted from `useFriends()`: "Crew mood: 3 good or better, 1 low, 1 not shared" (good or better is 4 and 5, okay is 3, low is 1 and 2; leave out a group with nobody in it). Then one `FriendRow` per friend: initial, handle, the mood from `moodDisplay` (face, word, tags, time), a `SourceBadge` for the mood's source, an unread count when above zero, and a `Button` "Chat". Under a friend whose score is 1 or 2, the quiet line "A short message can help." No friends: an `EmptyState`, "No friends yet. Find your crew to add them."
   - **Requests:** "Asked to be your friend" with "Accept" and "Decline" per row, then "You asked" with "Cancel" per row. Nothing in either: "No requests."
8. **`ChatDrawer`** in a `DetailDrawer` titled with the friend's handle: the friend's mood line at the top, `ChatThread` fed from `useConversation(socialId)` (your messages on the `me` side; a `failed` message gets the note "Not sent. Tap to retry." and retries on press), `ChatInput` with `maxLength` 500 calling `sendChatMessage`, the fixed line "For anything urgent, use Emergency.", and at the bottom a quiet `Button` "Remove friend" behind a `ConfirmDialog`. Opening the drawer calls `markConversationRead`. Closing it returns focus to the friend's row.
9. **Leaving.** At the bottom of the screen, a quiet `Button` "Leave the crew network" behind a `ConfirmDialog` that says it removes the account, the friendships and the messages.
10. **Layout.** At 1024 px and wider: `MyMoodCard` across the top, then `FindCrew` on the left and `YourCrew` on the right, side by side, equal width. Under 1024 px: one column with `MyMoodCard` first, then a three-option `ChipGroup` (Find, Friends, Requests) showing one view at a time.
11. **Privacy line** at the bottom: "Friends see your handle, your role and, if you allow it, your mood. Never your notes, readings or health data."
12. **`guide.ts`** from the "Guide text for Ophi" part of the spec, all four fields. Set `status` to `ready` in `meta.ts`.

**Do not build:** photos, posts, a feed, likes, group chats, typing indicators, read receipts, notifications, your own chat bubbles, your own storage, anything that reads another person's data other than through the hooks.

**Checks you must run and pass before reporting:**

- `npm run build`, `npm run lint`, `npm run typecheck`, `npm run test`, all clean.
- On the demo profile: join, see two friends with moods marked SIMULATED, accept the waiting request, find and add a third person, open a chat, send a message and get a reply, remove a friend, leave.
- A mood check-in made on the Mood screen with sharing on appears in "What your friends see" without a reload. With sharing off it reads "No mood shared today". The note never appears anywhere on this screen.
- Every mood shows a word and a face, never a number, and is understandable with color removed.
- 360 px and 1440 px: no sideways scrolling, the chat input stays above the phone keyboard, every button is at least 44 px tall.
- Keyboard only: search, add, switch views, open a chat, send, close.
- Tests: `moodDisplay` for every score and for none; the crew mood line for mixed, all-good and nobody-sharing groups; the control shown for each of the four relations.

**Report:** what you built, the result of each check, what you could not verify (a real second person, unless you had one), and any name in the contract that did not fit.

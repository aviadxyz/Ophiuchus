# Social

**Owner: Rami.** Built from [prompt 17](../../../../prompts/17-social.md) part B, in prompt 19, task 4.

## Plan

- `moodDisplay.ts`: one mood look everywhere (word, face, tone, tags, "2 h ago"), the crew mood line, message times.
- `JoinCard.tsx`: handle, the two privacy sentences, the sharing switch, "Join the crew network" with plain reasons on failure.
- `MyMoodCard.tsx`: "What your friends see", the sharing switch, "Check in" to `/mood`.
- `FindCrew.tsx`: search and results, one control per relation (`PersonControl`).
- `YourCrew.tsx`, `FriendRow.tsx`: friends with mood, unread count, the start of the last message and its time, and Chat; requests.
- `ChatDrawer.tsx`: the chat in `DetailDrawer`, retry for unsent messages, "Remove friend" behind a confirmation.
- `index.tsx`: header pills, the three states (not joined, off, joined), PC two columns, phone Find/Friends/Requests switch, leave.

## What is built

Everything in part B, plus Elia's addition: each friend row shows the start of the last message and its time. On a member profile with the network off and no account, the screen says in one sentence that the crew network is not connected in this demonstration and shows no controls. No translation, no games.

## Faked or stubbed

The demo profile runs on the simulated crew from `@/data` (marked SIMULATED everywhere). Nothing here talks to a server; the real network does not exist yet.

## Could not verify

- A real second person, and `live` mode: there is no server.
- Shared components below 44 px that this screen cannot restyle: `Switch` (32 px), `ChipGroup` chips (36 px) and the drawer's Close button (40 px). Every `Button` here is size `lg` (48 px).
- "Tap to retry": `ChatThread` bubbles cannot be pressed, so a failed message shows the note and a "Retry unsent message" button under the thread.

## How to see it

Open `/social` on the demo profile, choose a handle and join. Tests: `npm run test -- src/screens/social`.

# 12 · Med bot

**Phase 3. Runs alone in its folder, so it can overlap with 14, 07, 08 part A and 10 part B.**

The Med bot is the medical assistant a crew member can talk to. It is a different thing from Ophi Tov: Ophi is the scripted guide in the corner of every screen, and the Med bot is a language model that answers typed questions and decides which of them should go to a real medical professional. The spec is the "Med bot" section of [docs/SCREENS.md](../docs/SCREENS.md).

| | |
|---|---|
| Branch | `lane/12-medbot` |
| You own | `app/src/screens/medbot/` only |
| Read first | AGENTS.md, docs/CONTRACTS.md sections 5 to 12, the "Med bot" section of docs/SCREENS.md, docs/DESIGN_SYSTEM.md, prompts/companion/medbot-system-prompt.md, `app/src/data/README.md`, and `api/README.md` if it exists |
| Attach (chat tools only) | Those files, plus `app/src/design/index.ts` |
| Needs | 01, 02 and 03 merged. Works without the chat endpoint, using the scripted replies, so it does not wait for 10 part B |

## Prompt

Read AGENTS.md, docs/CONTRACTS.md, the "Med bot" section of docs/SCREENS.md and prompts/companion/medbot-system-prompt.md before doing anything. You are replacing the placeholder in `app/src/screens/medbot/`. Touch nothing outside that folder and add no dependencies. Colors, type and spacing come only from the design tokens and the shared components; add no color of your own.

This is the screen where a crew member asks a medical assistant about their health. Judges will type whatever comes to mind, so the screen has to stay friendly and useful when the network is slow, when the model is down, and when someone asks something it should not answer. Its second job is to make one thing visible: the assistant knows its limits, and passes the right questions on to a human.

**Build, in this order. Each step leaves a screen that works.**

1. **Header.** `ScreenHeader` with eyebrow `DOMAIN · MED BOT`. Pills: `ONLINE` (tone `ok`) when `VITE_CHAT_URL` is set and the last call succeeded, otherwise `OFFLINE` (tone `neutral`); and `N SENT TO SURGEON` (tone `info`) when the list in step 8 has open items.
2. **Conversation.** `ChatThread` and `ChatInput` from `@/design`. The assistant is on the `them` side. Above the thread, a small lucide medical icon and the name "Med bot". Do not use Ophi's image here: the two are different characters. The conversation lives in memory for the current visit only.
3. **Arrival context.** Read the screen id from `from` in the address (`/medbot?from=<screenId>`, CONTRACTS section 12) and look up its label with `getScreen` from `@/registry`. Show the matching opening line from section 3 of the companion prompt file as the first bubble, as fixed text with no model call. Show a chip, "Talking about: [screen label]", that the person can dismiss.
4. **Suggested questions.** Three or four chips under the opening line, chosen from `useHealthSummary()`: the area with the worst level, "How am I doing today?", "What should I do next?".
5. **Sending.** Call the chat endpoint (CONTRACTS section 11) at `VITE_CHAT_URL` with `replyMode` `standard`. Build the context block from section 2 of the companion prompt file using `useHealthSummary()`, `useMission()` and `useActiveProfile()`. If the active profile's `consent.assistant` is off, send only the screen, mission and reply-mode lines and show a small note, "The Med bot is answering in general terms. Turn on personalized answers in About." Mood notes are never included. Set `pending` on the thread while waiting, and disable the input. `maxLength` is 1,000.
6. **Fallback.** If the address is empty, the call fails, or it takes longer than eight seconds, answer from the scripted replies in section 4 of the companion prompt file and put the note "offline" under that bubble. The screen never shows a raw error.
7. **Urgent handling on the screen itself,** independent of the model: if the person's message contains obvious emergency wording, or the reply comes back with `urgent` yes, show a prominent card above the reply linking to `/emergency`. Keep the word list short and readable, in one file.
8. **Forwarding to the flight surgeon.**
   - When a reply comes back with `forward` yes, show a `Card` under it: title "This is one for the flight surgeon", a `TextField` holding a one-line summary (the person's question, cut to 200 characters, editable), and a primary `Button` "Send to flight surgeon".
   - Under every other assistant reply, a quiet `Button` "Send this to the flight surgeon" that opens the same card. When offline, a question that matches the forwarding word list (medicine, dose, pill, days, worse, diagnosis; one file, short) shows the card too.
   - Sending calls `raiseAlert('health', 'console', summary, 'medbot')`. Do not build your own storage.
   - Below the input, a `Card` titled "Sent to flight surgeon" listing alerts from `useAlerts()` with kind `health` and `screenId` `medbot`, newest first: time, the summary, and a `StatusPill`: `WAITING FOR REPLY` (`info`) for `open`, `WITHDRAWN` (`neutral`) for `cancelled`, `ANSWERED` (`ok`) for `acknowledged`. Open items have a quiet `Button` "Withdraw" calling `cancelAlert`.
   - When `useMission().commDelaySeconds` is above zero, show under the title: "A signal to Earth takes about [delay] each way from here."
   - Under the list, small text: "Demonstration. Nothing is sent to a real person."
   - With nothing sent, the card shows an `EmptyState`: "Nothing sent yet. The Med bot will suggest it when a question needs a person."
   - An urgent message is never offered for forwarding. It gets the Emergency card only.
9. **Standing line** under the input: "Demo assistant. Not medical advice."
10. **"Clear conversation"** control. It clears the bubbles and leaves the sent list alone.
11. **`guide.ts`** from the "Guide text for Ophi" part of the spec, all four fields. Set `status` to `ready` in `meta.ts`.

**Do not build:** voice, file or image upload, conversation history across visits, accounts, streaming replies, a flight-surgeon inbox, any change to the endpoint, your own chat bubbles.

**Done when:**

- Arriving from three different screens gives three different opening lines and context chips.
- With the endpoint off, the three quick questions get sensible scripted answers marked "offline".
- With the endpoint on, a question about sleep gets an answer that uses the numbers in the health summary.
- A question about a medicine dose shows the forwarding card. Pressing "Send to flight surgeon" adds it to the list, and it appears among the open alerts on Overview. "Withdraw" changes it to WITHDRAWN.
- A message about chest pain shows the Emergency card at once and no forwarding card.
- It works at 360 px with the phone keyboard open, and at 1440 px, with no sideways scrolling.
- Very long messages, emoji and right-to-left text display correctly.
- Every status is shown by a word as well as a color.

**Checks you must run and pass before reporting:** `npm run build`, `npm run lint`, `npm run typecheck`, `npm run test`, all clean, plus every item under "Done when". Tests cover: the opening line for a known and an unknown `from`; the scripted fallback; the forwarding card appearing for `forward` yes and not for `urgent` yes; sending raises the alert with the right four values.

**Report:** what you built, the result of each check, what is real and what is scripted, and the results of running the test messages from section 5 of the companion prompt file.

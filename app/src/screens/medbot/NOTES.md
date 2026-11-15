# Med bot Implementation Plan
1. meta.ts: Update status to 'ready'.
2. guide.ts: Add complete Ophi guide fields from specification.
3. words.ts: Urgent & forwarding keyword matching utilities.
4. scriptedReplies.ts: Section 3 opening lines & Section 4 offline fallback answers.
5. context.ts: Build Section 2 context block for chat endpoint with consent checks.
6. index.tsx: ScreenHeader with ONLINE/OFFLINE & SENT TO SURGEON pills.
7. index.tsx: Fixed-height conversation column with ChatThread, ChatInput, Med bot header, arrival chip.
8. index.tsx: Urgent card for emergency detection, Forwarding card & quiet button for flight surgeon alerts.
9. index.tsx: "Sent to flight surgeon" card listing medbot alerts with status pills and withdraw action.
10. index.test.tsx: Vitest test suite covering all required prompt checks.

# Med bot

**Owner:** Rami. Screen id `medbot`, route `/medbot`.

## What is built
- Full Med bot screen with `ScreenHeader` (ONLINE / OFFLINE pill, and dynamic `${N} SENT TO SURGEON` pill).
- Fixed-height conversation column (`h-[36rem]`) with `ChatThread` and `ChatInput`, auto-scrolling to newest messages.
- Lucide medical icon (`Stethoscope`) and name "Med bot" above the thread, with a "Clear conversation" control that resets messages while preserving sent alerts.
- Arrival context from `/medbot?from=<screenId>` displaying custom opening lines (Section 3 of companion prompt) and a dismissible context chip.
- 3 suggested questions selected dynamically based on `useHealthSummary()` worst-level area, plus standard suggestions.
- Sending integration with `config.chatUrl` endpoint (CONTRACTS Section 11), generating the Section 2 companion prompt context block, enforcing `consent.assistant` rules, and 8-second timeout.
- Offline and timeout scripted fallback (Section 4 of companion prompt) with "offline" note underneath, never exposing raw errors.
- Urgency handling: immediate detection of obvious emergency terms and `urgent: true` replies, prominently rendering the Emergency card linking to `/emergency`, while suppressing any flight surgeon forwarding.
- Flight surgeon triage: forwarding card with editable 200-char summary and primary "Send to flight surgeon" button calling `raiseAlert('health', 'console', summary, 'medbot')`.
- Quiet action "Send this to the flight surgeon" under non-urgent assistant replies, also auto-triggered offline for questions matching the forwarding word list.
- "Sent to flight surgeon" card listing alerts from `useAlerts()` (`health`, `medbot`), formatted time, summary, `StatusPill` (`WAITING FOR REPLY`, `WITHDRAWN`, `ANSWERED`), quiet "Withdraw" button calling `cancelAlert`, signal delay to Earth, EmptyState, and demonstration disclaimer.
- Standing disclaimer under input: "Demo assistant. Not medical advice."
- Comprehensive test suite covering opening lines, offline fallbacks, urgent triage, forwarding alerts, and context builder.

## What is faked or stubbed
- In offline mode or when `VITE_CHAT_URL` is empty, assistant answers use the scripted fallback rules from Section 4 of the companion prompt rather than an LLM.
- The flight surgeon queue remains local to device alerts via `raiseAlert`, as specified ("Nothing is sent to a real person").

## What could not be verified
- Live backend LLM inference was tested with mocked fetch calls and offline fallbacks, as `VITE_CHAT_URL` is currently not configured in the local environment.

## How to see it working
1. Run `npm --prefix app run dev` and navigate to `http://localhost:5173/medbot`.
2. Notice the `OFFLINE` status pill in the header.
3. Test arrival context: navigate to `/medbot?from=nutrition`. See the opening line and the dismissible "Talking about: Nutrition" chip.
4. Click on a suggested question chip (e.g. "How am I doing today?"). See the scripted answer with "offline" note.
5. Type an urgent question ("I have chest pain and my arm feels numb"). See the Medical Emergency card linking to `/emergency`.
6. Type a medication question ("What dose of medicine should I take?"). See the forwarding card "This is one for the flight surgeon".
7. Click "Send to flight surgeon". Notice the header pill updates to "1 SENT TO SURGEON", and the item appears in the "Sent to flight surgeon" card with "WAITING FOR REPLY".
8. Click "Withdraw". The status pill updates to "WITHDRAWN".
9. Click "Clear conversation". Notice the conversation resets to the opening line, but the sent item in "Sent to flight surgeon" is preserved.

## Polish (prompt 19, task 1)
The "This is one for the flight surgeon" card sits directly under the conversation column, not inside it, so the thread keeps its height.

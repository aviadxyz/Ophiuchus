# 21 · Three devices, three systems, one person each

**Runs alone in its files. Can run beside 15, 19, 20 and 08 part B. It shares one line with prompt 18 (see "You own").**

Today a computer, a phone and a watch all open the same console as the same demo crew member. This prompt makes them three systems: the computer is the crew console, the phone is a personal app, the watch is a small face. It also makes each device its own crew member, so that an alert raised on one shows on the others as coming from someone else.

| | |
|---|---|
| Branch | `lane/21-devices` |
| You own | `app/src/shell/` (except `AutoAlertBanner.tsx` and the one line in `AppShell.tsx` that renders it, which belong to prompt 18: leave both exactly as you find them); new file `app/src/data/device.ts` with its test, one marked block of export lines at the end of `app/src/data/index.ts` and one section in `app/src/data/README.md`; in `app/src/data/`: the `Alert` record in `types.ts`, `raiseAlert` in `store.ts`, and `sources/relay.ts`, only for the `from` field described below; in `app/src/ophi/Ophi.tsx`, only his bottom position on a phone |
| Read first | AGENTS.md, docs/CONTRACTS.md (all), docs/DESIGN_SYSTEM.md, docs/REAL_DATA.md, `app/README.md`, `app/src/data/README.md`, every file in `app/src/shell/`, `app/src/data/sources/relay.ts` |
| Use | A strong model. The shell is under every screen |

## Prompt

The build has started and you may write code. Read AGENTS.md, docs/CONTRACTS.md and docs/DESIGN_SYSTEM.md in full before doing anything. Touch only the files listed under "You own". Add no dependency and no color. No screen folder changes: every screen must keep working exactly as it does.

Ophiuchus is an astronaut health console that hackathon judges will open on their own laptops and phones. Other agents are editing screens right now, so the routes, the screen ids and everything exported from `@/design`, `@/data`, `@/ophi` and `@/registry` stay as they are, apart from the additions below, which are already in docs/CONTRACTS.md.

### Part 1. Which device is this, and who is using it

Build `data/device.ts`, exported from `@/data`:

| Name | Does |
|---|---|
| `useDevice()` | Gives `kind` (`computer`, `phone` or `watch`) and `setupDone` (yes/no) |
| `completeDeviceSetup()` | Marks this device as set up |
| `resetDeviceSetup()` | Shows the first-open choice again |

- `kind` is `watch` on the route `/w`, `phone` when the window is under 640 px wide, otherwise `computer`. It follows the window as it is resized.
- `setupDone` is remembered on this device through the data folder's own persistence helper, under the `ophiuchus:v1:` prefix.

**First open.** While `setupDone` is no, the shell shows one full-window card instead of the console, on computer and phone alike:

- Title "Who is using this device?"
- A primary button, "Look around with the demo crew member". One tap: the demo profile stays active and setup is done. A judge must never need more than this tap.
- Below it, "I'm on the crew": a display name (`TextField`, with the hint "Stays on this device. It is never sent anywhere.") and a role (`ChipGroup`: Commander, Pilot, Flight engineer, Mission specialist, Flight surgeon), then "Start". It calls `createProfile`, makes that profile active and finishes setup.
- Small text: "Demonstration. Not a medical device."
- The watch route `/w` never shows this card. It uses whichever profile is active.

The profile switcher gains one item at the bottom of its list, "Set up this device again", which calls `resetDeviceSetup()`.

### Part 2. Alerts that say who they came from

Today an alert that arrives from another device looks exactly like one raised here. Change that with one optional field:

- `Alert` gains `from` (optional text): the role of the person who raised it, present only on alerts that arrived from another device.
- `emergency.raised` messages gain an optional `role` in their payload: the sender's profile role. Never the display name.
- `relay.ts`: when sending, include the active profile's role. When an alert arrives from another device, store it with `from` set to that role, or to "Another device" when the message has none.
- `AlertBanner`: for an alert with `from`, the first line reads "Emergency from [from]" instead of "Emergency alert open".
- Tests: an incoming message with a role is stored with `from`; one without gets "Another device"; an alert raised here has no `from`; no display name is ever in an outgoing message.

### Part 3. The phone is its own app

Under 640 px the shell stops being the console with a drawer and becomes a personal app:

- **Top bar:** the screen title on the left, a small tag `PHONE` beside it, and the Emergency button on the right as now. No menu button.
- **Bottom bar,** fixed, 56 px plus the safe area, five items with an icon and a word each: Today (`/overview`), Log, Med bot (`/medbot`), Alerts, More. The current one is marked with the accent and a bar above it, never by color alone.
  - **Log** opens a bottom sheet (`DetailDrawer`), "Quick log", with large buttons: "Water +250 ml" (calls `addWater(250)` and says "Added" in place for two seconds), "Add food" (to `/nutrition`), "Mood check-in" (to `/mood`), "Exercise done" (to `/physical-activity`), "I don't feel well" (calls `askMedbot('overview')`).
  - **Alerts** goes to `/emergency` and shows a dot with the count of open emergency alerts.
  - **More** opens the existing drawer with every screen, the profile switcher and the group headings.
- The page content gets enough bottom room that nothing sits under the bar, and Ophi sits just above it (the one change you may make in `ophi/Ophi.tsx`).
- Between 640 and 1024 px, and above, nothing changes except what follows.

### Part 4. The computer is the crew console

From 640 px up, the sidebar shows a small tag `CONSOLE` beside the profile switcher's DEMO or CREW tag. Nothing else changes: it stays the full console with every tab.

### Part 5. The watch stays small

- Opening `/` on a window 300 px wide or less goes to `/w` instead of `/overview`.
- Confirm that `/w` still loads without the shell, the sidebar code or any screen's code. If the build shows the watch view pulling in a console screen, fix the import that causes it, inside the shell only, or tell me which file does it.

### Do not build

Sign-in, accounts, passwords, sending a name anywhere, a separate phone version of any screen, new routes other than what is written above, or any change inside a screen folder.

### Checks you must run and pass before reporting

- `npm run build`, `npm run lint`, `npm run typecheck`, `npm run test` in `app`, all clean.
- A fresh browser profile at 1440 px: the first-open card, one tap, then the console with all fifteen tabs. The same at 360 px: the card, one tap, then the phone app with its bottom bar.
- Every screen at 360 px: no sideways scrolling, nothing under the bottom bar, Ophi clear of it, every bottom-bar item works, "More" reaches all fifteen screens.
- Two windows in the same room, each set up as a different crew role: an emergency raised in one shows in the other as "Emergency from [that role]".
- Reloading on any route keeps the route. `/w` shows no first-open card.
- Tests for the device kind at three widths, the first-open card's two paths, and the four alert cases in Part 2.

**Report:** what you built, the result of each check, what you could not verify on a real phone, and every place you were unsure.

When all checks pass, commit, push this branch, and report. Do not merge.

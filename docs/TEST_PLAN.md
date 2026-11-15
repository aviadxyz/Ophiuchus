# Test plan

The judges may use the product themselves. The aim of testing is that nothing embarrassing happens when a stranger clicks around for five minutes with no guidance.

Feature freeze is Sunday 14:30. The sweep runs 14:30 to 16:30.

## Devices

| Device | Browser | Who |
|---|---|---|
| The demo laptop | The browser that will be used in the demo | Rami |
| A second laptop, different operating system if possible | A different browser | Anyone |
| iPhone | Safari | Anyone with one |
| Android phone | Chrome | Anyone with one |
| The watch | Whatever the watch build is | Rami |

Test at the public link, not on a local machine. That is what the judges get.

## Every screen

- [ ] Opens from the sidebar on PC and from the drawer on phone.
- [ ] Sidebar highlights the right item.
- [ ] Has an eyebrow, a title and a description, in the standard place.
- [ ] No horizontal scrolling on a phone.
- [ ] Nothing overlaps or is cut off at 360 px wide and at 1440 px wide.
- [ ] Every button does something. No dead buttons, no "TODO", no placeholder Latin text.
- [ ] Numbers have units. Dates and times are in one format across the app.
- [ ] Every target or fact has a source line.
- [ ] Every measured value shows its source badge: LIVE, ENTERED, IMPORTED or SIMULATED.
- [ ] Works on the demo profile and on a brand-new real profile with no data. Missing data reads "No data", never zero.
- [ ] Looks right when empty, when full, and with very long text.
- [ ] Reloading the page keeps you on the same screen with your changes saved.
- [ ] The browser back button behaves.
- [ ] Ophi is visible, does not cover a button, and his panel explains this screen, not another one.
- [ ] Spelling and grammar read through by a second person.
- [ ] Looks like the same app as every other screen: colors, pills, spacing.

## Whole app

- [ ] First load on a phone over mobile data is acceptably fast.
- [ ] Works after turning Wi-Fi off once it has loaded.
- [ ] "Reset demo data" restores the starting state.
- [ ] One screen failing shows an error card for that screen and leaves the rest working.
- [ ] Tab key reaches everything and focus is visible.
- [ ] Emergency is reachable in one tap from every screen on PC and phone.
- [ ] Unfinished screens are clearly marked and say what is coming.
- [ ] The About screen says what is real and what is scenario, that consumer watches are not medical instruments, and that this is not a medical device.
- [ ] No NASA logos or mission emblems anywhere.
- [ ] Browser tab shows the right title and icon.
- [ ] No errors in the browser console during a full click-through.

## Overview

- [ ] Each of the sixteen body systems opens from the figure (or its chip) and from the list, by mouse, touch and keyboard.
- [ ] A system's status matches the worst status among the values listed inside it. Systems the app does not measure read NOT TRACKED and show no value.
- [ ] No system text says anything about the person. It describes the body part and shows the values.
- [ ] The figure looks like a natural human body, and a stranger can name the heart, lungs, brain, stomach and kidneys without labels.
- [ ] On a real profile with a watch connected, the figure's heart beats in time with the heart rate shown.
- [ ] The routine shows DONE and DUE with words, not only color. "Add 250 ml" changes the water row at once.
- [ ] Doing a mood check-in, then coming back, turns that row to DONE.
- [ ] On a new profile with no data, measured systems read NO DATA and nothing shows zero.
- [ ] Ophi shows his hint dot while something is due, and loses it when everything is done.
- [ ] Heart rate shows its source badge and no status anywhere on the screen.

## Med bot

- [ ] Opened from three different screens, it greets with three different lines.
- [ ] A question about today's numbers is answered from the summary, with no forwarding card.
- [ ] A question about a medicine or a symptom lasting days shows "This is one for the flight surgeon". Nothing is sent until the button is pressed.
- [ ] A sent question appears under "Sent to flight surgeon" and among the open alerts on Overview. Withdraw works.
- [ ] Chest pain shows the Emergency card and no forwarding card.
- [ ] With the network off, the quick questions still get answers, marked offline.
- [ ] It never calls itself Ophi, and Ophi is not shown on this screen.

## Social

- [ ] Before joining, only the join card shows. The sharing switch starts off.
- [ ] Demo profile: two friends with moods marked SIMULATED, one request waiting, search finds the rest, chat gets a reply.
- [ ] Two real profiles on two devices: find, request, accept, chat both ways, see each other's mood.
- [ ] A new mood check-in changes "What your friends see" and the friend's view of you.
- [ ] Every mood is a word and a face. No number, no note, no health value anywhere on the screen.
- [ ] At PC width, Find crew and Your crew sit side by side. On a phone they are behind one switch.
- [ ] Remove friend and Leave the crew network both ask first, and both work.

## Real data and privacy

Use made-up entries for these checks, not anyone's actual readings.

- [ ] Creating a profile requires ticking "This is my own data". Both sharing switches start off.
- [ ] A real profile never shows a SIMULATED value.
- [ ] Heart-rate sensor: connects, shows LIVE, and matches the watch's own display within a few beats.
- [ ] Taking the watch off or walking away shows "Sensor disconnected" with a reconnect button. It does not switch to simulated values.
- [ ] With "Let the Med bot see my summary" off, the Med bot answers in general terms and says so.
- [ ] With "share live readings" off, nothing from that profile reaches a second device.
- [ ] Mood notes appear only on the Mood screen.
- [ ] Social: with "Share my mood" off, a friend sees NOT SHARED. With it on, they see the word and feelings and nothing else.
- [ ] Social: someone who is not a friend cannot see a mood or send a message.
- [ ] Social: "Leave the crew network" makes the person disappear from a friend's list after a reload.
- [ ] "Delete my data" removes the profile and everything recorded for it. Check after a reload.
- [ ] Switching profiles changes every screen and the watch view.
- [ ] Two rooms with different codes never see each other's alerts or readings.
- [ ] Nothing real is in the repo: no export files, no screenshots of real profiles, no readings in tests.

## Cross-screen story

Run this as one continuous path on the demo profile. It is also the demo script. Then repeat steps 4 to 10 on a team member's profile with their watch connected.

1. Open Overview. Read the routine, then tap the heart and the eyes on the body figure.
2. Open Sleep. See the two short nights.
3. Open Mood. See the dip after them. Do a check-in.
4. Open Nutrition. Add a meal and a water. Tiles update.
5. Open Physical activity. Mark a session done. Coverage changes.
6. Click Ophi on that screen. Read the explanation. Press "Ask the Med bot about this".
7. In Med bot, ask one question. Get an answer in context. Then ask about a medicine dose, and send it to the flight surgeon. See it on Overview.
7b. Open Social. See the crew's moods, open a chat with a friend whose mood is low, send a message.
8. On the watch, check Health overview shows the same statuses.
9. On the watch, hold the Emergency button.
10. On the console, see the alert, acknowledge it. Watch shows the acknowledgement.
11. Reset demo data.

## Trying to break it

- [ ] Double-click and rapid-click every button.
- [ ] Paste a very long text, emoji, and Hebrew text into every text field.
- [ ] Enter zero, a negative number and a huge number wherever a number is accepted.
- [ ] Add twenty meals in a row.
- [ ] Deny camera and microphone permission, then open a game and Talk to the Med bot.
- [ ] Rotate the phone on every screen.
- [ ] Open the app in two tabs and change data in one.
- [ ] Zoom the browser to 150% and to 80%.
- [ ] Press the watch Emergency button and release early. Nothing should send.
- [ ] Press Emergency twice quickly.
- [ ] Ask the Med bot something off-topic, something urgent, and for a drug dose.

## Watch

Test on the phone hotspot, not the venue Wi-Fi. Use the demo-day checklist in [WATCH.md](WATCH.md), then:

- [ ] Pairing by code works first time. Nothing has to be typed on the watch.
- [ ] Turning the hotspot off and on again: the watch reconnects by itself and a held Emergency sends once it is back.
- [ ] Each cheap watch that can broadcast heart rate shows up in the browser's device picker and reads LIVE.

- [ ] Every screen readable at arm's length.
- [ ] Nothing important clipped by a round face.
- [ ] Works after the watch screen sleeps and wakes.

## Bug log

Keep one shared sheet. One row per bug:

| Field | Notes |
|---|---|
| Screen | |
| Device and browser | |
| Steps | The fewest clicks that reproduce it |
| What happened / what should happen | |
| Severity | Blocker: demo cannot continue. Major: a judge will notice. Minor: cosmetic |
| Owner | The screen's owner |
| Status | Open, fixed, checked |

Fix order: blockers, then major on the demo path, then typos, then everything else. After 16:30 only blockers get touched, and each fix is followed by a re-run of the cross-screen story.

## Before handover

- [ ] Public link opens in a private window.
- [ ] Demo data reset.
- [ ] Laptop, phone and watch charged, chargers on the table.
- [ ] Backup: the watch frame page open in a tab, and a screen recording of the full story saved locally in case the network fails.

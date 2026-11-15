# 09 · Mini game

**Phase 4. Runs in its own folder, so it can overlap with anything.** Written for Futvolley; the changes for Samba time are at the end.

| | |
|---|---|
| Branch | `lane/09-futvolley` |
| You own | `app/src/games/futvolley/` only |
| Read first | AGENTS.md, docs/CONTRACTS.md sections 3, 6, 9 and 13, docs/MINI_GAMES.md (shared rules and Futvolley), `app/src/data/README.md` |
| Attach (chat tools only) | Those files, plus `app/src/design/index.ts` and `app/src/registry/index.ts` |
| Needs | Every "must" in the build plan done. The public HTTPS link, because the camera does not work without one |

## Prompt

Read AGENTS.md, docs/CONTRACTS.md section 13 and docs/MINI_GAMES.md before doing anything. You are creating a game in `app/src/games/futvolley/`. The registry picks up the folder's `meta.ts` automatically, routes it at `/games/futvolley`, and the `GameLinks` component on the Physical activity screen shows it. You change nothing outside your folder and add no dependencies; the camera body-tracking library named in CONTRACTS section 1 is already installed.

This is a small camera game inside an astronaut health console. It makes one point in a fun way: exercise is how astronauts protect their bodies, and gravity differs on every world. The player keeps a ball in the air with their head and shoulders, footvolley style, while the ball falls under Moon, Mars or Earth gravity. Judges will try it standing at a laptop in a noisy room, so it must start fast, explain itself in one sentence, and never leave anyone stuck.

Build the smallest version first, get it working end to end, then add.

**Smallest version:**

1. **`meta.ts`:** id `futvolley`, label "Futvolley", a one-sentence description, `screens` set to `physical-activity`, `countsAsExercise` yes.
2. **Start view:** the name; "Keep the ball up with your head and shoulders. No hands."; one line from Ophi, "Up here, exercise is medicine. And the ball falls differently on every world."; a `ChipGroup` for gravity with Moon (1.62 m/s²), Mars (3.71 m/s²), Earth (9.81 m/s²), Moon selected; "Your video stays on this device and is never saved or sent."; a Start button; and "Play without camera". Ask for the camera only after Start is pressed.
3. **Play view:** the mirrored camera image with a ball drawn over it on a canvas. Load the body-tracking model only now, with a loading indicator. Contact points: the nose (as the head) and both shoulders, each a circle sized relative to shoulder width. The ball bounces off them with a speed boost when the point is moving upward. Gravity is the chosen value scaled so that on Earth an unassisted fall from the top of the view to the bottom takes about one second; Mars and Moon then scale by physics (fall time grows with the square root of the gravity ratio). A round lasts 60 seconds with a visible countdown.
4. **Scoring:** one point per touch, times a multiplier that rises by one every five touches without a drop, up to five. A drop resets the multiplier and serves a new ball from the top after one second.
5. **Score view:** the score, best rally, the line "On the Moon the ball takes about two and a half times as long to fall as on Earth.", "Play again", and "Back to console", which returns to the screen the game was opened from.
6. **Exercise credit:** when a round ends, call `logGameMinutes('futvolley', minutes)` with the time actually played, rounded up to a whole minute, once per round.
7. **No-camera mode:** offered on the start view, and entered automatically if the camera is denied or missing. A small figure moves with the arrow keys or by dragging; Space or a tap makes it head the ball. Same physics, same scoring.
8. **Cleanup:** stop the camera and the tracking when the game closes, when the tab is hidden, and on the score view.

**Then, if time allows, in this order:** knees and feet as contact points; a fault when a hand touches the ball; best score remembered under the `ophiuchus:v1:` storage prefix; simple generated sounds with a mute button.

**Requirements:**

- Nothing from this folder is loaded until the route opens.
- A steady frame rate on an ordinary laptop. If tracking is slow, run tracking less often and keep drawing every frame.
- Works when only the upper body is visible.
- Everything outside the play area uses the shared components.

**Do not build:** multiplayer, leaderboards, accounts, recording, or anything that sends video anywhere.

**Checks you must run and pass before reporting:**

- `npm run build`, `npm run lint`, `npm run typecheck`, `npm run test`, all clean.
- The console's first load is not larger than before this change. Say how you confirmed it.
- A link to the game appears at the bottom of Physical activity with no change to that screen.
- All three gravity settings feel clearly different.
- Denying the camera leads straight to a playable no-camera mode.
- After a round, Physical activity shows the added minutes.
- Tests for the gravity scaling, the scoring and multiplier, and the minutes credit.

**Report:** what works, the frame rate you measured and on what machine, what you cut, and what you could not test without a camera.

## For Samba time instead

Use the same prompt with these changes:

- Branch `lane/09-samba-time`, folder `app/src/games/samba-time/`, id `samba-time`, label "Samba time", `screens` set to `mood` and `physical-activity`. Read the Samba time section of the games document.
- Play: a silhouette shows the next pose two beats ahead. On the beat, compare the player's tracked upper body (angles at shoulders and elbows, and whether the stance is wide or narrow) with the target and score it Perfect, Good or Miss. Four poses to start, playable seated. A streak counter.
- The beat is a drum loop generated in the browser at about 100 beats per minute. No recorded music.
- No-camera mode: arrow keys or on-screen buttons pressed on the beat, one per pose.
- If Futvolley already exists, do not import from its folder. Copy the small camera and tracking setup into yours and note the duplication in `NOTES.md` for a later cleanup.
- Score view line: "Moving together is one of the best things a crew can do for mood on a long mission."

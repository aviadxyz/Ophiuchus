# Mini games

Optional. Build one only after every "must" in the build plan is done. Aviad already has a counting-sheep game linked from the bottom of the Sleep screen; these follow the same pattern: a small card at the bottom of a screen that opens the game.

Both games below were suggested in the briefing, use the camera, and lean Brazilian because the challenge is led by the Brazilian Space Agency.

## Shared rules

- Each game lives in its own folder and loads only when opened, so it cannot slow down or break the console.
- Camera use needs a secure (HTTPS) page and a clear permission prompt. Video is processed in the browser and never leaves the device. Say so on the start screen.
- Body tracking uses an in-browser pose model. One library, chosen once, used by both games.
- Every game has a no-camera mode (keyboard on PC, touch on phone) so a judge with a blocked camera can still play.
- A round lasts 60 to 90 seconds. Start screen, play, score screen with "play again" and "back to console".
- Finishing a round logs aerobic minutes to the shared store, so the Physical activity screen moves. This is the point of the games: they are exercise countermeasures in disguise.
- Ophi appears on the start screen with one line about why the game matters.

## Futvolley

Footvolley is a Brazilian beach sport: volleyball rules, no hands.

**Idea:** keep a ball in the air using your head, shoulders, knees and feet, tracked by the camera, under the gravity of different worlds.

**Play:**

- The player sees themselves mirrored with a ball drawn on top.
- The ball bounces off tracked body points except the hands. A hand touch is a fault.
- Gravity selector before the round: Moon (1.62 m/s²), Mars (3.71 m/s²), Earth (9.81 m/s²). The ball falls slowly on the Moon and fast on Earth.
- Score is the number of touches, with a multiplier for long rallies. Dropping the ball resets the multiplier.

**What it teaches:** how different gravity feels, shown through something familiar. One line on the score screen compares the worlds: "On the Moon the ball took about two and a half times longer to fall than on Earth."

**No-camera mode:** move a small player left and right and tap to head the ball.

**Placement:** bottom of Physical activity.

**Smallest version worth shipping:** one ball, head and shoulders only, three gravity settings, a score.

## Samba time

**Idea:** match dance poses in time with a beat. The camera scores how close you are.

**Play:**

- A silhouette shows the next pose a couple of beats ahead.
- On the beat, the player's tracked pose is compared with the target and scored: perfect, good, miss.
- Six to eight simple poses, arms and stance only, so it works in a small space and in a chair.
- A streak counter and a final score.

**What it teaches:** exercise in a confined space can be social and enjoyable, which matters for both fitness and mood on long missions.

**Music:** use a rhythm generated in the browser or a track with a license that allows it. Do not use commercial songs.

**No-camera mode:** arrow keys or on-screen buttons in time with the beat.

**Placement:** bottom of Mood, and also linked from Physical activity.

**Smallest version worth shipping:** four poses, one drum loop, a score.

## Spare ideas

Short enough to build in under an hour each, no camera needed.

| Game | Screen | Idea |
|---|---|---|
| Pack the tray | Nutrition | Drag space-menu items onto a tray to hit the day's energy, sodium and vitamin D targets at once |
| Breathing orbit | Mood | Follow a small spacecraft around an orbit with your breath: in on the way up, out on the way down. Sixty seconds |
| Reaction check | Performance | Tap when the light changes. A playful take on the reaction-time tests crews do to check alertness |

## Risks

- Venue lighting and busy backgrounds hurt body tracking. Test on the demo laptop, in the room, Sunday morning.
- Pose models are heavy. Load on demand and show a loading state.
- Camera permission prompts confuse people. Explain before the prompt appears.

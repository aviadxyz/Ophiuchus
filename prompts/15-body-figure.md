# 15 · The anatomical body figure

**Phase 4. Runs alone in its folder, after 14 is merged. Can run beside 08 part B, 09 and 12.**

This replaces the plain working figure on Overview with a high-quality anatomical one: a well-proportioned human body with real organ shapes, a skeleton, muscle groups, the main blood vessels and the lymph nodes, drawn as layers that light up when a body system is chosen. It is the challenge's own example of a good interface ([docs/CHALLENGE.md](../docs/CHALLENGE.md)), so it is worth doing properly.

**Give this to the strongest model you have, in a tool that can open the app and look at screenshots.** It is a drawing job judged by eye. An inexpensive model will produce something that passes every check and still looks wrong. If the tool cannot look at images, a human has to do the looking after every round.

| | |
|---|---|
| Branch | `lane/15-body-figure` |
| You own | `app/src/screens/overview/figure/` only. Nothing else in the Overview folder |
| Read first | AGENTS.md, docs/CHALLENGE.md, "Body systems" and "The figure" in the Overview section of docs/SCREENS.md, docs/DESIGN_SYSTEM.md, `app/src/design/tokens.css`, the existing files in `app/src/screens/overview/figure/`, and `app/src/screens/overview/systems.ts` (read only) |
| Needs | 14 merged into `main`. Optional: an openly licensed anatomical drawing supplied by Rami at `[path, or "none"]` |
| Time box | 2 hours. If the result is not clearly better than the working figure by then, stop and keep the working figure |

## Prompt

Read AGENTS.md and the Overview section of docs/SCREENS.md before doing anything. You are replacing the contents of `app/src/screens/overview/figure/` and nothing else. The screen around it is finished and must not change: `BodyFigure` keeps exactly the inputs it has now (`systems`, `selectedId`, `onSelect`, `heartRate`), `figure/index.ts` still exports only `BodyFigure`, and you add no dependency. Everything is hand-written inline SVG in React components. No image files, no external assets, no fonts, no text labels inside the drawing.

The aim: a judge who opens the app sees a human body that looks like it came from a good anatomy atlas redrawn for a spacecraft console, understands at a glance that every part can be clicked, and finds the right organ without reading a label. Accuracy and elegance both matter. A crude or lopsided figure is worse than the plain one it replaces.

**Before drawing, write your plan in `figure/NOTES.md`:** the files you will create, the layer order, and how you will check the result by eye. Then build in the order below. Each step leaves a figure that works.

### 1. The body

- One SVG, `viewBox="0 0 400 880"`, scaled to its container, at most 360 px wide on PC and 300 px on a phone.
- Front view, standing in the anatomical position: feet a little apart, arms slightly away from the sides, palms forward, head level. An adult of neutral build. No face, no hair, no clothing, no genital detail.
- Proportions, with the body centered on x = 200. Treat these as targets and adjust by eye:

  | Landmark | y | Width at that height |
  |---|---|---|
  | Top of head | 22 | |
  | Widest part of head | 70 | 78 |
  | Chin | 132 | |
  | Base of neck | 158 | 44 |
  | Shoulders | 176 | 186 |
  | Chest, at the armpits | 232 | 150 (torso only) |
  | Waist | 352 | 124 |
  | Hips, widest | 432 | 160 |
  | Crotch | 462 | |
  | Knees | 650 | 46 each leg |
  | Ankles | 814 | 28 each leg |
  | Soles | 850 | |

  Elbows sit at waist height, wrists at crotch height, fingertips reach mid-thigh (about y = 540). The body is about seven and a half heads tall.
- Draw one half with smooth curves and mirror it, so the figure is exactly symmetric. Use curves, not straight segments, for every contour: the slope from neck to shoulder, the taper of the forearm, the swell of the calf, the arch of the foot. Hands have a thumb and a simple mitten of fingers with two or three finger lines; feet point slightly outward.
- The skin is the outermost layer: a soft fill a step lighter than the card surface and a thin outline in the border token.

### 2. The layers

Each body system is one SVG group. Order from back to front: skin, muscles, bones and spine, blood vessels, lymph, organs, head detail. Draw each shape with care for where it really sits. Left and right below mean the figure's own left and right, so the figure's left is on the viewer's right.

| System id | What to draw | Where it sits |
|---|---|---|
| `skin` | The body outline itself | Whole body |
| `muscles` | The large groups as separate soft shapes: shoulders, chest, upper arms front, forearms, the abdominal wall with its segments, front of thighs, calves | Follow the limb contours, inset a little from the skin |
| `bones` | Skull outline, collarbones, a simplified ribcage of seven or eight visible rib pairs joined to a breastbone, upper and lower arm bones, the pelvis as two flared wings with the sacrum between, thigh bones angled inward to the knees, kneecaps, shin and calf bones, simple hands and feet | Inside the limbs, centered |
| `spine` | A column of stacked vertebra marks from the base of the skull to the pelvis, larger toward the bottom | Midline, behind the organs |
| `heart` | The heart as a rounded cone with its point down and to the figure's left, with the arch of the main artery rising from it. Also the main vessels as thin lines: up both sides of the neck, across to and down each arm, down the midline, splitting at the pelvis and running down each leg | Heart between the lungs, two thirds of it left of the midline, around y = 215 to 265 |
| `lungs` | Two lungs with the windpipe dividing above them. The right lung slightly larger, the left with a notch for the heart | Filling the ribcage from about y = 185 to 300 |
| `digestive` | The liver as a large wedge, the stomach as a curved pouch, the coiled small intestine framed by the large intestine | Liver upper right of the abdomen under the ribs; stomach upper left; intestines from about y = 320 to 440 |
| `kidneys` | Two bean shapes with thin tubes running down to a small rounded bladder | Either side of the spine around y = 300 to 340, the right one a little lower; bladder low in the pelvis around y = 440 |
| `reproductive` | A soft neutral glow in the lower pelvis, with no anatomical detail | Around y = 430 to 460 |
| `hormones` | Small glands: the thyroid as a butterfly shape, an adrenal cap on top of each kidney, the pancreas as a slim leaf behind the stomach, a small dot at the base of the brain | Thyroid at the front of the neck around y = 148 |
| `immune` | Clusters of small nodes joined by fine lines, and the spleen as a small oval | Nodes at the sides of the neck, the armpits, the groin; spleen upper left of the abdomen, behind the stomach |
| `blood` | No shape of its own. Choosing it lights the vessel lines of the `heart` layer and adds a slow flow along them | |
| `brain` | The brain seen from the front with its two halves and a few folds, and the brainstem leading down | Upper two thirds of the head |
| `eyes` | Two eyes with their nerves running back | About y = 84 |
| `ears` | The inner ear on each side as a small spiral with loops | Either side of the head at about y = 92 |
| `face` | The nose passage and the sinus spaces beside and above it | Center of the face, y = 80 to 118 |

The four head systems are too small to click on the body. Draw a **head detail**: a circle about 150 across beside the head, joined to it by a thin leader line, showing the head enlarged about two and a half times with the brain, eyes, inner ears and sinuses each as a separate clickable shape. Under 480 px wide, place it above the figure instead of beside it.

### 3. How it looks and behaves

- **Resting state:** the skin and outline are clear; every other layer is faint, at about 15 to 25% opacity, so the body reads as a translucent figure with its insides just visible.
- **Hover or keyboard focus on a system:** that system's layer brightens. Others stay as they are.
- **Chosen system:** its layer is at full strength in the tone of its status; every other layer drops to about 8%. The change takes 150 to 200 ms.
- **Status at rest:** a system whose status is `watch` or `act` keeps a thin outline in its tone even when nothing is chosen, so problem areas are visible from across the room. A system with status `untracked` uses the neutral tone and a dashed outline when chosen.
- **Colors:** only the design tokens, at whatever opacity you need. No new colors, no typed color values, no drop shadows. Build depth from layered strokes and fills at different opacities.
- **Lines:** stroke widths between 1 and 1.75 at this size. Round line joins and caps.
- **Every system is a real control.** Each organ system's group has `role="button"`, `tabIndex` 0, opens on click, Enter and Space, shows a focus ring, and has an accessible name made of the label and status label, for example "Kidneys and bladder, WATCH". Tab order follows the order of the `systems` input. Add an invisible larger hit area behind any shape smaller than 44 px on screen. Where shapes overlap, the smaller one is on top so it can be chosen.
- **Whole-body systems** keep their row of chips under the figure, as in the working figure. Choosing one lights its layer.
- **Motion,** all of it off when the system asks for reduced motion:
  - The heart beats at `heartRate` beats per minute when one is given, by a scale of about 5%, and does not beat when none is given. This is the user's real pulse on a real profile, so keep it exact.
  - The lungs expand and relax slowly, about twelve times a minute, by about 2%.
  - With `blood` chosen, a slow dash moves along the vessel lines.
  - A system with status `act` pulses gently.

### 4. Files

Split the drawing so no file is unmanageable: one file for the outline, one per layer or small group of layers, one for the head detail, one for the shared styles and motion, and `BodyFigure.tsx` to assemble them. Keep path data tidy: round coordinates to one decimal. The whole figure should stay under about 60 KB of source.

### 5. Looking at it

Do this after the body, after the organs, and at the end. Open `/overview`, take a screenshot of the figure at 360 px wide and at 1440 px wide, and look at it critically against this list. Fix what fails and look again. Do at least three rounds.

- Does it read as a natural human body at a glance? Check the shoulder slope, the waist, the length of arms against legs, the size of the head, hands and feet.
- Is it exactly symmetric where it should be, and are the organs asymmetric where they should be (heart to the left, liver to the right, stomach to the left)?
- Is every organ inside the body outline and inside the right cavity: lungs and heart inside the ribcage, intestines below it, kidneys either side of the spine?
- Could someone name the brain, heart, lungs, liver, stomach, intestines, kidneys and bladder with no labels?
- At rest, does it look calm and readable, or cluttered? If cluttered, lower the resting opacity of the busiest layers.
- With each of the sixteen systems chosen in turn: is the chosen one obvious and are the others quiet?
- Does it look like part of this app: same colors, same line weight as the icons, no cartoon outlines, no glossy effects?
- At 360 px, is the head detail usable and is nothing clipped?

### If Rami supplied a drawing

If a path was given above, read that file and its license first. You may use it as the base for the outline and organ shapes, redrawn in this app's style and split into the layers above. Record the source, author and license in `figure/NOTES.md` and say so in your report, so it can be credited. If no license is stated, do not use it.

**Do not build:** a back or side view, rotation, zoom, 3D, text labels inside the drawing, a face, any change outside `figure/`, any change to the inputs of `BodyFigure`, any new system or status.

**Checks you must run and pass before reporting:**

- `npm run build`, `npm run lint`, `npm run typecheck`, `npm run test`, all clean. The existing Overview tests still pass unchanged.
- A test in `figure/` that renders `BodyFigure` with all sixteen systems and finds a control for each one by its accessible name, and that choosing each calls `onSelect` with the right id.
- Each of the sixteen systems can be chosen by mouse, by touch and by keyboard alone, and the drawer still opens and returns focus.
- With a heart rate given, the heart beats at that rate; with none, it is still. With "reduce motion" on, nothing moves.
- 360 px and 1440 px: no sideways scroll, nothing clipped, Ophi not covering the figure's controls.
- The three rounds of looking described above, with what you changed after each written in `figure/NOTES.md`.

**Report:** what you drew, the result of each check, what you saw in each round of looking and what you changed, the parts you are least happy with, and whether you could actually view the rendered figure. If you could not, say so in the first line, so a human knows to look before merging.

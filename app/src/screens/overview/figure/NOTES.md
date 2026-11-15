# Plan

1. `palette.ts`: the anatomical colors, defined once at the top, plus status words and tones. `styles.tsx`: the figure's CSS, motion and shared gradients.
2. `geometry.ts`: turns hand-placed points into smooth curves and mirrors them, so the body is exactly symmetric. `shapes.ts`: the silhouettes shared by the drawing and the controls.
3. `outline.tsx`: body silhouette, rim shading and the calm face (the `skin` layer).
4. `muscles.tsx`, `skeleton.tsx` (bones and spine), `vessels.tsx` (arteries red, veins blue, flow), `glands.tsx` (lymph, spleen, hormone glands).
5. `organs.tsx`: lungs and windpipe, heart, liver, stomach, intestines, kidneys and bladder, reproductive glow.
6. `head.tsx`: brain, eyes, inner ears, sinuses, and the enlarged head detail (beside the head; above the figure under 480 px).
7. `controls.tsx`: one `role="button"` group per organ system in `systems` order (focus ring), plus a pointer click layer ordered small-on-top.
8. `BodyFigure.tsx` assembles the layers back to front: skin, muscles, bones and spine, vessels, lymph, organs, head, detail, controls. `BodyFigure.test.tsx` covers all sixteen controls and the heart beat.
9. Checking by eye: after each drawing round open `/overview`, screenshot at 1440 px and 360 px, look at an enlarged copy, list what is still wrong, fix, repeat. Logged below.

# The anatomical body figure

Prompt 15, with the changes Rami gave in the task message: anatomical colors are allowed inside this figure only, a simple calm face is allowed, and the look to aim for is a translucent body with the organs in place and arteries in red and veins in blue down the limbs.

## What is built

- One inline SVG, `viewBox="0 0 400 880"`, hand-placed points only. No image files, no dependency, no text inside the drawing. `BodyFigure` keeps its four inputs and `index.ts` is unchanged.
- **Body:** translucent skin with a soft rim of light, mirrored from one half so it is exactly symmetric. Closed eyes, nose and mouth as a calm face.
- **Layers, back to front:** skin, muscles, bones and spine, arteries and veins, lymph and spleen, lungs and windpipe, heart with the aortic arch and pulmonary trunk, kidneys, hormone glands, stomach, liver, gallbladder, large and small intestine, reproductive glow, a second faint drawing of the kidneys on top (they lie behind the liver and stomach, so they show through instead of sitting in front), brain.
- **Anatomy taken from real positions**, at about 4.8 units to the centimeter: heart two thirds left of the midline with the apex down and to the figure's left; right lung with three lobes, left with two; liver on the right under the diaphragm with the gallbladder at its lower edge; stomach on the left; large intestine framing the small; right kidney lower than the left; bladder low in the pelvis; aorta left of the vena cava, splitting at the pelvis; femoral, tibial, brachial, radial and ulnar arteries; cephalic, basilic and great saphenous veins.
- **Head detail:** a round window with the head enlarged, showing the brain, eyes with their crossing nerves, inner ears (cochlea and balance loops) and sinuses, each clickable. Beside the head from 480 px up, above the figure below that.
- **States:** rest, hover or keyboard focus (light outline), chosen (full strength with an outline in the status tone, everything else at 12%), dashed outline for NOT TRACKED. A WATCH or ACT system keeps a thin outline in its tone at rest; a faint layer in that state is lifted to 40% so the outline can be seen. Status is never color alone: every control's name ends in the status words, `aria-pressed` marks the chosen one, and dashes mark NOT TRACKED.
- **Controls:** every organ system is a `role="button"` group with `tabIndex` 0, in the order of the `systems` input, opening on click, Enter and Space, with a focus ring in the organ's shape. Pointer and touch use a separate layer of invisible click areas stacked small-on-top (kidneys over liver, heart over lungs). Whole-body systems keep their chips.
- **Motion:** heart beats at exactly `60 / heartRate` seconds per beat and is still with no heart rate; lungs breathe twelve times a minute; Blood sends dashes along the vessels; ACT pulses. All off under `prefers-reduced-motion`.
- **Focus:** the shared drawer returns focus only to HTML elements and these controls are SVG, so the figure itself puts focus back on the control when a system opened here is closed.

## Colors

All typed color values are in `palette.ts` and nowhere else. Lymph uses the accent token, status tones and focus use the design tokens.

## Rounds of looking

The reference picture named in the task did not reach me. Each round was judged against Rami's written description of it and the checklist in the prompt, not against the picture itself.

1. **Round 1 (1440 and 360).** Vessels far too heavy, like cables, and branching coarse. Vessel lines crossing the face. Kidneys pasted on top of the liver. Hips too flared and neck too long. Heart too big for the lungs. Hands were mittens. Shading flat. *Changed:* trunks drawn 28% finer with a second level of side branches; head vessels cut back; kidneys drawn behind and ghosted on top; waist, hips, neck and shoulders reshaped; heart scaled to 88%; finger and toe lines; stronger shading.
2. **Round 2 (1440 and a 4x enlarged copy; 360 not re-shot this round).** Dark specks between the gut loops. Pancreas showed as a stain over the stomach. Pelvis looked like two ears with eyes. Long bones too thick. Status halo on the vessels too wide. Face lines sat on top of the skull when bones were chosen. *Changed:* a sheet of tissue behind the loops; glands moved behind the stomach; pelvis redrawn with the sacrum; bones slimmed; halo thinned; face quiet while a system is chosen.
3. **Round 3 (1440 and 360).** Figure read as adolescent: head too wide, shoulders too narrow. Lungs flat. A stray blue stub beside the heart. Enlarged eyes stared. Side muscles were blocks. The ACT outline on the faint skeleton could not be seen. *Changed:* head narrowed, neck and shoulders widened; lobes shaded and the diaphragm added; contact shadows under heart, liver and stomach; stub removed; relaxed upper lids; tapered side muscles; flagged faint layers lifted.
4. **Round 4 (1440 and 360).** Left lung had too deep a notch once the heart was dimmed. Hover made every vessel white. Windpipe brighter than everything else. *Changed:* notch softened, hover halo halved, windpipe toned down.
5. **Final look (1440 and 360).** All sixteen systems were chosen in turn and looked at. Nothing clipped and no sideways scroll at either width.

## Least happy with

- Muscles are a schematic set of soft shapes, not atlas quality.
- Hands and feet are simple; fingers are lines on a mitten.
- The small intestine is a stylized pattern of loops.
- The spine can only be clicked at the neck, because the organs cover the rest. It is always reachable by keyboard and from the list.
- Source is about 72 KB without the test and these notes, over the prompt's guide of about 60 KB. The finer vessel branching is most of the difference.

## What is faked or stubbed

Nothing. The figure shows no values, only the statuses it is given.

## What I could not verify

- Reduced motion in a real browser: the tool cannot switch the system setting. The stylesheet rule is covered by a test.
- A real touch screen. Touch uses the same click handler as the mouse, checked at 360 px with pointer clicks.
- Ophi's speech bubble floats over the lower legs at 360 px until it is dismissed. It is outside this folder.

## How to see it working

1. `npm --prefix app run dev`, open `/overview`.
2. Click the heart, a lung, the gut, a kidney, the thigh (muscles), the shin (bones), the neck (spine), and each part of the enlarged head. The drawer opens for each.
3. Tab through the figure: focus follows the list order and shows a ring in the organ's shape. Enter or Space opens it; Escape closes it and focus returns.
4. Choose Blood from the chips to see the flow, and Bones to see the skeleton.

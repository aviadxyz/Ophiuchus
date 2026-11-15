# 07 · A screen from an intake sheet

**Phase 3. Run once for Medical status and once for Emergency. The two runs can go in parallel with each other and with 08 part A.**

| | |
|---|---|
| Branch | `lane/07-medical-status` or `lane/07-emergency` |
| You own | `app/src/screens/medical-status/` or `app/src/screens/emergency/`, only |
| Read first | AGENTS.md, docs/CONTRACTS.md sections 6 to 10 and 12, `app/src/data/README.md`, and for Medical status, rule 8 of docs/REAL_DATA.md |
| Attach (chat tools only) | Those files, `app/src/design/index.ts`, the completed intake sheet, any sketch photo |
| Needs | 01, 02 and 03 merged. The intake sheet from docs/SCREENS.md filled in with the designer |
| Fill in first | `[screen name]`, `[folder]`, `[designer]`, the pasted sheet, the sketch path |

## Prompt

Read AGENTS.md and docs/CONTRACTS.md before doing anything. You are replacing the placeholder in `app/src/screens/[folder]/`. Other agents are working in other folders at the same moment, so stay strictly inside yours: no changes to shared folders, no new dependencies.

You are implementing the **[screen name]** screen. It was designed by [designer], a teammate who knows the subject and does not write code. Their design is below as answers to ten questions, with a sketch at `[path, or "none"]`. Build what they designed, faithfully, out of this app's shared components. Where the design is silent, make the smallest sensible choice and record it. Do not add features they did not ask for and do not drop ones they did.

**The design:**

[paste the completed intake sheet here]

**How to work:**

1. Write the screen outline at the top of your `NOTES.md`: sections from top to bottom; for each, what it shows, which shared component from CONTRACTS section 6 it uses, which hook or function from section 9 it needs, and what each action does. Mark every guess with "GUESS:".
2. **Stop and show me that outline.** I will check it with the designer. This is the one prompt where waiting is required, because the designer cannot read code.
3. After my OK, build it. `ScreenHeader` first, eyebrow `DOMAIN · [NAME]`.
4. If the screen needs data that `@/data` does not provide, keep sample data in one file inside your folder, clearly marked as fictional, and say so in `NOTES.md`. Do not add to the shared store.
5. Write `guide.ts` from the designer's answer to question 9, filling all four fields of CONTRACTS section 5. Set `status` to `ready` in `meta.ts`.

**If this is the Emergency screen, also:**

- It must be the most dependable screen in the app. Everything the person sees first works with no network and no loading state.
- The trigger is protected against accidental use the way the designer specified. If they did not say, use press and hold for two seconds with a `ProgressRing` that fills, and releasing early cancels.
- Triggering calls `raiseAlert('emergency', 'console', message, 'emergency')`. Do not build your own alert state.
- List the alerts of kind `emergency` from `useAlerts()`, newest first (alerts of kind `health` belong to other screens), each showing its time, origin (This console, or Watch), message and status. Open alerts have an "Acknowledge" button calling `acknowledgeAlert`, and the person who raised one can cancel it with `cancelAlert` for ten seconds.
- When the mission's `commDelaySeconds` from `useMission()` is above zero, show the one-way delay to Earth in plain words near the top, since it is the reason the crew acts first.
- Large touch targets, high contrast, one instruction at a time.
- Small, clear text: "Demonstration. No real alert is sent to anyone. In a real emergency, call your local emergency number."
- The shell's banner, Ophi's alert state and the watch react to the store on their own. Do not wire them yourself.

**If this is the Medical status screen, also:**

- Conditions, allergies and medications are fictional sample data kept in your folder, for the demo profile and for member profiles alike, unless the designer's sheet explicitly asks for the person to enter their own. If it does, entries are made by that person, stored through a small store of your own inside your folder under the `ophiuchus:v1:` prefix, keyed by profile id, and removed when the profile is deleted. Flag this in your report so the shared delete function can be extended.
- Show a line: "Sample medical record for demonstration."
- A fictional prescribed regimen may be shown as a record. No dosing advice.
- Nothing from this screen appears on any other screen.

**Checks you must run and pass before reporting:**

- `npm run build`, `npm run lint`, `npm run typecheck`, `npm run test`, all clean.
- 360 px and 1440 px: no sideways scroll, nothing clipped, Ophi not covering a button.
- Every button does something. Nothing a user can see is filler.
- Emergency only: hold-to-send works with mouse, touch and keyboard; releasing early sends nothing; a raised alert shows in the banner on another screen; acknowledging clears the banner.

**Report:** what you built, the result of each check, every "GUESS:" you made, and a short list of questions for the designer.

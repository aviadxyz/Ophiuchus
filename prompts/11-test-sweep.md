# 11 · Test sweep

**Produces:** a prioritized bug list first, then fixes for the ones you approve.
**Attach (chat tools only):** AGENTS.md, docs/TEST_PLAN.md, docs/DESIGN_SYSTEM.md. A chat tool cannot click through the app, so with one of those use only the "Read-through" part below and do the clicking yourself.
**Needs:** feature freeze. The public link.

## Prompt

Read AGENTS.md, docs/TEST_PLAN.md and docs/DESIGN_SYSTEM.md. The Ophiuchus app is frozen and will be handed to hackathon judges in a few hours. They will use it themselves, with nobody guiding them. Your job is to find what would embarrass us, and then fix only what I approve.

Work in two passes. **Do not change any file in the first pass.**

**Pass 1: find.**

1. Open the app at `[public link]` in a browser you can drive. Go through the "Every screen" checklist in the test plan for every route in the registry, once at 1440 px wide and once at 360 px wide.
2. Run the "Whole app" checklist.
3. Walk the "Cross-screen story" from step 1 to step 11 without stopping. Note any point where two screens disagree about the same fact.
4. Run every item in "Trying to break it" that you are able to perform.
5. Read-through: read every piece of text a user can see, in the screens, the guide texts, the watch view and the About screen. List typos, grammar errors, inconsistent terms for the same thing, inconsistent units or date formats, leftover filler, and any sentence that diagnoses, prescribes, or states a fact with no source line.
6. Real data: create a member profile and repeat the cross-screen story on it. List any value shown without its source badge, any gap shown as zero, any simulated value on the member profile, and anything left behind after "Delete my data". Use made-up entries for this; do not use anyone's real readings.
7. Consistency: list every place a screen departs from the design system, such as a color outside the tokens, a home-made version of a shared component, a missing standard header, or a different pill style.
8. Check the browser console for errors and warnings during the whole run.

Give me the result as one table sorted by severity, using the bug log fields from the test plan: screen, viewport, steps, what happened against what should happen, severity (blocker, major, minor), and the screen's owner from the registry. Add your suggested fix in one line and whether the fix is contained in one screen folder or touches a shared area. End with a short list of what you could not test and why.

Then stop and wait.

**Pass 2: fix.**

I will reply with the rows to fix. For each:

- Make the smallest change that fixes it. No refactoring, no restyling, no dependency changes.
- Stay inside the owner's screen folder unless the row is marked as a shared-area fix that I approved.
- Text fixes: change only the wrong words.
- After each fix, re-check that row and the cross-screen story step nearest to it.

When done, give me the table again with a status column: fixed and re-checked, not fixed with the reason, or needs a human. Finish by walking the full cross-screen story one more time and telling me plainly whether it passed.

**Rules for this late in the day:**

- If a fix is risky or large, say so and propose hiding or disabling the broken part instead.
- Do not fix anything I did not approve, even if it is quick.
- Never mark a row fixed without re-checking it in the browser.

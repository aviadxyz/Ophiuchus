# Intake sheet: Medical status

The design for the Medical status screen, as answers to the ten questions in [SCREENS.md](../SCREENS.md). Paste everything below the line into [prompt 07](../../prompts/07-screen-from-intake-sheet.md) where it says "paste the completed intake sheet here".

- Screen name: `Medical status`. Folder: `medical-status`. Sketch: none.
- Designer: a teammate's "Orbital Health" mockup, its Condition page, adapted by Rami to this app's rules. The list of what was changed is at the end, so the designer can check it.

---

## 1. Who opens this screen, and at what moment?

A crew member who lives with a long-term condition that was diagnosed before the mission. They open it after a new test result comes in, and before a call with the flight surgeon. They are not a doctor.

## 2. What is the one question it answers?

"Is my condition staying quiet, and what do I do this week to keep it that way?"

## 3. Sketch: top, middle, bottom

Top to bottom, one column on a phone:

1. Header. Title "Medical status". Description: "Your known condition, the markers that track it, and the plan agreed with your flight surgeon." Pills: `1 ACT`, `4 WATCH`, `2 ON TARGET`.
2. A plain line under the header: "Sample medical record for demonstration."
3. Card "Your condition in plain words".
4. Four stat tiles (two across on a phone).
5. Table "Markers to watch". A row opens a drawer.
6. Table "Where it is active". A row opens a drawer.
7. Card "What makes a flare-up more likely for you".
8. Card "Plan agreed with the flight surgeon".
9. Card "What to do", with three buttons.
10. Card "Key reading".

## 4. What information is shown?

All of it is one fictional sample record, kept in one file in the screen's folder. It is the same for the demo profile and for member profiles. Every value shows the `SIMULATED` source badge. The record never shows a person's name.

**Card "Your condition in plain words"** (title of the condition: "Inflammatory bowel disease"; small text under it: "Diagnosed before the mission. Four areas of the bowel are active."):

> Inflammatory bowel disease is a long-term condition in which parts of the gut lining become inflamed. It comes and goes: quiet for months, then a flare-up.
>
> Spaceflight may make a flare-up more likely. Studies of crews suggest the gut's bacteria change in flight, and the packaged diet is low in fibre. So the condition is watched with regular tests instead of waiting for symptoms.
>
> Nothing here is an emergency today. The aim is to keep it that way.

Under it, a source line with `verified` off, so it reads "Source: to be confirmed".

**Stat tiles:**

| Label | Value | Unit | Target line | Level | Trend |
|---|---|---|---|---|---|
| Gut inflammation marker | 312 | µg/g | Stay under 250 | act | 150, 180, 312 |
| Inflammation in the blood | 1.1 | mg/L | Stay under 1.0 | watch | 0.8, 0.9, 1.1 |
| Haemoglobin | 13.4 | g/dL | 13.5 to 17.5 | watch | 13.9, 13.6, 13.4 |
| Next sample | 8 | days | Every 14 days | none shown | none |

**Table "Markers to watch".** Columns: Marker, Now, Target, plus the status pill. The Marker cell shows the plain name, with the technical name in small text under it.

| Plain name | Technical name | Now | Target | Level | What it is (shown in the drawer) |
|---|---|---|---|---|---|
| Gut inflammation marker | Faecal calprotectin | 312 µg/g | under 250 | act | A protein from white blood cells, measured in a stool sample. It rises when the gut lining is inflamed, often before any symptom. |
| Inflammation in the blood | hs-CRP | 1.1 mg/L | under 1.0 | watch | A blood protein that rises when there is inflammation anywhere in the body. |
| Blood settling rate | ESR | 17 mm/h | under 15 | watch | How fast red blood cells settle in a tube. They settle faster when there is inflammation. |
| Haemoglobin | Haemoglobin | 13.4 g/dL | 13.5 to 17.5 | watch | The protein in red blood cells that carries oxygen. It can fall when an inflamed bowel loses small amounts of blood. |
| Blood protein | Albumin | 4.1 g/dL | 3.5 to 5.0 | ok | The main protein in blood. It can fall with poor nutrition or long-lasting inflammation. |
| Immune signal | IL-6 | 5.8 pg/mL | under 5.0 | watch | A signal the immune system releases during inflammation. |
| Hidden blood in stool | Faecal occult blood | Not found | Not found | ok | A stool test for blood too small to see. |

The levels above are fixed in the sample file. They were chosen to match the level rules in CONTRACTS section 7, so do not recompute them. Level labels and colors come from `levelLabel` and `levelTone`.

The drawer for a row shows: the plain name as its title, the "what it is" sentence, the value with unit and source badge, the target, a `Sparkline` of the last three samples where the table above gives a trend (for the others, no chart), and the line "Target: personal baseline in this sample record."

**Table "Where it is active".** Columns: Area, Finding, plus the status pill. Bar tone and pill tone: `warn` for moderate, `info` for mild.

| Area (plain name, technical name small) | Pill | Finding (drawer text) |
|---|---|---|
| Upper small bowel · jejunum | ACTIVE · MODERATE | Patches of redness with two shallow ulcers. No narrowing. |
| Near the appendix · caecal pole | ACTIVE · MILD | A small area of inflammation. The appendix itself is not swollen. |
| Lower large bowel · sigmoid colon | ACTIVE · MODERATE | A continuous inflamed stretch that bleeds easily when touched. |
| Rectum | ACTIVE · MILD | Mild inflammation at the very end of the bowel. |

Under the table, small text: "From the last camera-capsule exam, [N] days ago." N is 7.

**Card "What makes a flare-up more likely for you".** A short list. Each item: one plain sentence, a tag, and the technical term in small text.

| Plain sentence | Tag | Technical term |
|---|---|---|
| Two inherited traits make your gut lining more sensitive to its own bacteria. | HIGHER | NOD2 and ATG16L1 variants |
| A protective kind of gut bacteria is low in your last sample. | HIGHER | Faecalibacterium prausnitzii 4.1%, reference 10% |
| You are eating about half the fibre in your plan. | WATCH | 12 g a day against a plan of 25 g |

Tags are `StatusPill`s: HIGHER is `danger`, WATCH is `warn`.

**Card "Plan agreed with the flight surgeon".** Four labelled lines. No amounts of any medicine anywhere.

| Label | Text |
|---|---|
| Daily medicine | Mesalamine, as prescribed |
| Reserve medicine on board | Budesonide. Only on the flight surgeon's instruction |
| Next review | In 8 days: stool sample and ultrasound |
| Limits on board | No surgery is possible in flight, so problems are caught early |

**Card "What to do".** Five numbered items, each with a small tag.

| # | Text | Tag |
|---|---|---|
| 1 | Take your daily medicine as prescribed. Busy days are when doses get missed. | DAILY |
| 2 | Give a stool sample every 14 days. The next one is due in 8 days. | EVERY 14 DAYS |
| 3 | Build fibre up slowly with the foods in your plan. | DAILY |
| 4 | Your gut inflammation marker is above its limit. Tell the flight surgeon at your next contact. | THIS WEEK |
| 5 | New belly pain after meals, a fever, or blood you can see: do not wait for the next sample. | RIGHT AWAY |

**Card "Key reading".** Three references, each with `verified` off until prompt 16 checks them, so each shows its title and "Source: to be confirmed", with no link.

1. Intestinal barrier function and microbiome change during spaceflight (review literature)
2. Voorhies AA et al., Study of the impact of long-duration space missions at the International Space Station on the human gut microbiome, Scientific Reports, 2019
3. Risk of altered nutrition and microbiome during spaceflight, NASA Human Research Program

**Dates.** "8 days" and "7 days ago" are fixed numbers in the sample file. Do not turn them into calendar dates or mission-day numbers.

## 5. What can the person do here?

| Action | What happens |
|---|---|
| Tap a row in "Markers to watch" | Opens the drawer described above |
| Tap a row in "Where it is active" | Opens a drawer with the finding |
| Button "Ask the Med bot about this" (primary, in "What to do" under item 4) | Calls `askMedbot('medical-status')` |
| Button "Open Nutrition" (quiet, under item 3) | Goes to `/nutrition` |
| Button "Open Emergency" (quiet, under item 5) | Goes to `/emergency` |

Nothing on this screen can be edited.

## 6. What should stand out first?

The one marker that is above its limit: the first stat tile, with its ACT pill, and the `1 ACT` pill in the header.

## 7. When everything is fine, and when something is wrong

- **Fine:** every marker shows ON TARGET, the header pills are all `ok`, and "What to do" shows only the routine items (1 to 3).
- **Something is wrong:** the marker's tile and row show WATCH or ACT, and "What to do" gains the matching item (4 or 5).
- **This sample record** is fixed in the "something is wrong" state, because that is the state worth demonstrating. Do not build a switch between the two.

## 8. Which other screens does it connect to?

- Med bot, through `askMedbot('medical-status')`.
- Nutrition and Emergency, through the two buttons.
- Nothing from this screen appears on any other screen.

## 9. What should Ophi say?

- **Shows:** "This is the record of a condition you already live with: the test results that track it, where it is active, and the plan agreed with your flight surgeon."
- **Why it matters in space:** "A condition that is quiet on Earth can wake up in flight, and there is no hospital here. Regular tests catch a change before you feel it."
- **How to read it:** "Each marker has a value, a target and a word: on target, watch or act." / "Tap a marker to see what it measures in plain words." / "'What to do' lists your next steps in order."
- **When to act:** "Follow the plan as agreed. If a marker says ACT, tell the flight surgeon at your next contact. For new pain, a fever or visible blood, use Emergency."

Ophi is never funny on this screen.

## 10. What is definitely not on this screen?

- Any amount, dose or schedule of a medicine, and any instruction to start, stop or change one.
- A diagnosis of anything new. The condition shown is one the person already has.
- A real person's name or real medical data, on any profile.
- A drawing of the digestive tract. The table of areas replaces it.
- Editing, adding or deleting entries.
- Calendar dates or mission-day numbers.
- Any new color, chart type or component.

---

## What was changed from the mockup, for the designer to check

| In the mockup | Here | Why |
|---|---|---|
| Medicine amounts ("2.4 g/day", "9 mg daily for 8 weeks", glutamine, zinc, omega-3 amounts) | Medicine names only, "as prescribed" | This app never shows a dose or tells anyone to start a medicine |
| "Step up if calprotectin crosses 400: start budesonide" | "Tell the flight surgeon at your next contact" | Same rule: decisions belong to the flight surgeon |
| The record under the signed-in person's name | A sample record with no name, marked SIMULATED | No invented diagnosis is shown as a real person's |
| Technical names as headings | Plain name first, technical name in small text | The challenge says not to assume a medical expert |
| hs-CRP 2.1, ESR 18, IL-6 6.8, shown as WATCH | 1.1, 17 and 5.8 | So the status words follow the same level rules as every other screen |
| Firmicutes / Bacteroidetes ratio row | Left out | No plain-language way to explain it in one sentence |
| Body-tract picture with hover points | A table of the four areas | A drawing is too slow to build well today |
| "Flight day 121", "day 135" | "7 days ago", "in 8 days" | This app's mission is on day 15, and fixed day numbers go stale |
| Brief with strong claims (mucus layer, DNA damage) | Softer wording, marked "Source: to be confirmed" | The references have not been checked yet |

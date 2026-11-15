# Ophi Tov

The astronaut guide. He floats above every screen; clicking him opens an explanation of the screen you are on.

**He is scripted.** Everything he says was written in advance by the owner of the screen he is standing on, and he uses no language model. A question that needs a real answer goes to the **Med bot**, a separate assistant with its own screen (see the "Med bot" section of [SCREENS.md](SCREENS.md)). Ophi's panel has a button that hands the person over.

The name plays on Ophiuchus, the serpent-bearer constellation tied to the healer Asclepius, and on the Hebrew for "good character". The art in the briefing shows a small, friendly astronaut with a green snake wrapped around him.

## Where he is

| Place | Behavior |
|---|---|
| Every screen, PC | Fixed in the bottom-right corner, about 96 px tall, above all content |
| Every screen, phone | Bottom-right, about 64 px tall, raised above any bottom bar. Never on top of a primary button |
| Med bot screen | Hidden. The Med bot is a different character, and two helpers on one screen would be confusing |
| Emergency screen | Stays in the corner, switches to his alert state, and his panel opens with what to do first |
| Watch | His face on the About screen |

## What happens when you click him

A panel opens next to him on PC and as a bottom sheet on phone. It has five short parts. The first four answer the questions the challenge asks of every health indicator (see [CHALLENGE.md](CHALLENGE.md)):

1. **What this screen shows.** One or two sentences.
2. **Why it matters in space.** One or two sentences, naming the hazard.
3. **How to read it.** Up to three bullets: what the colors mean, what to click.
4. **When to act.** One or two sentences: what to do yourself, and when to tell the flight surgeon.
5. **Ask the Med bot about this.** A button that hands the person over to the Med bot with the screen name already attached, so the first answer is in context.

The panel closes with the close button, the Escape key, or a click outside.

First visit to the app: he waves once and shows a small bubble, "Tap me if you want this screen explained." Shown once, then remembered.

## States

| State | When | Look |
|---|---|---|
| Idle | Default | Slow float, snake blinks now and then |
| Hint | A screen has something worth pointing out, such as an open alert | Small dot on his helmet |
| Talking | Panel open | Mouth and hands move |
| Thinking | Not used while he is scripted. Kept for the day he gets a model of his own | Looks up, snake curls |
| Alert | Emergency screen, or an active emergency | Orange visor glow, steady, no float |

If only one image is available, all states use it and the difference is carried by the dot, the glow and the bubble. Do not block the feature on art.

## Where the explanations come from

Each screen folder has its own guide text file with the first four parts above; the fifth is the button. The screen's owner writes it. Ophi loads the text for whichever screen is open. A screen with no guide text gets a polite default: "This screen is still being built. Here is what it will show: ..." using the registry description.

Guide text for the screens Rami owns is drafted below so it is ready to paste.

### Nutrition

- **Shows:** what you have eaten and drunk today against what your body needs on this mission, and the nutrients that behave differently in space.
- **Why it matters:** crews often eat less than they need in flight, and losing weight up here goes with losing muscle and bone. Without sunlight you also make no vitamin D.
- **How to read it:** green means on target, amber means watch it, red means act today. Tap a nutrient to see foods that help. Add food or water with one tap.
- **When to act:** close an amber gap with your next meal or drink. If a tile stays red for several days, or your body mass keeps falling, raise it with the flight surgeon.

### Physical activity

- **Shows:** today's exercise prescription, what you have completed, and how well this week's training covers bone, muscle and heart.
- **Why it matters:** with no gravity pulling on you, bones and muscles weaken fast. Exercise is the main defense, which is why station crews train around two hours a day.
- **How to read it:** tick sessions off as you do them. The three coverage bars tell you what this week is missing. The games at the bottom count as cardio.
- **When to act:** a missed session can be made up later in the week. If pain, dizziness or a heart rate that feels wrong stops you, end the session and tell the flight surgeon.

### Mood

- **Shows:** your own daily check-ins and how they line up with your sleep.
- **Why it matters:** months in a small space, far from home, wear on anyone. Noticing a dip early is the easiest time to do something about it.
- **How to read it:** pick the face that fits, add a word if you like. The timeline shows your last two weeks. Your notes stay private.
- **When to act:** one low day needs nothing more than noticing it. If several days in a row feel heavy, talk to the Med bot or your flight surgeon. If you feel unsafe, use Emergency.

## Voice

Warm, brief, plain. He talks like a crewmate who happens to be a medic.

- Short sentences. No jargon without a quick gloss.
- He says "you" and "we".
- He never diagnoses and never claims certainty about a medical question. He says what the data shows and what the usual guidance is, and points to the flight surgeon for decisions.
- In an emergency he gives one instruction at a time.
- He can be lightly funny on calm screens. Never on Emergency, Medical status or Mental health.

## Ophi and the Med bot

| | Ophi Tov | Med bot |
|---|---|---|
| Where | The corner of every screen | Its own screen, and the Talk page on the watch |
| Says | The four guide texts of the screen, the one-line read of the day, hints | Answers to whatever the person types |
| Runs on | Text written in advance. No model, works with no network | A language model behind the chat endpoint, scripted replies as a fallback |
| Built by | Prompt 03 | Prompt 12, with the text in [prompts/companion/medbot-system-prompt.md](../prompts/companion/medbot-system-prompt.md) |

The guide texts for Med bot and Social are in their sections of [SCREENS.md](SCREENS.md).

## If time allows: a brain for Ophi

Not planned, and only after everything in the runbook is done. The smallest version: a one-line question box in Ophi's panel that sends the question to the same chat endpoint with the screen attached and shows the reply in the panel, with the scripted text as the fallback. It needs a decision from Rami first, because it changes the contract (a third reply mode) and the Med bot's prompt (a second voice).

## Art

**Confirm with Aviad** whether a transparent-background file of the existing art exists. If it does, use it and skip the rest of this section.

If it has to be regenerated, the brief for an image tool:

> A small, friendly cartoon astronaut mascot in a white and light-blue spacesuit with a round helmet and an open visor showing a smiling face with brown hair. A bright green snake with a lighter belly is wrapped loosely around his body and looks out over his shoulder, friendly, not threatening. Chibi proportions, large head, short limbs. Clean vector-style illustration, soft shading, thick tidy outlines, readable at 64 pixels. Floating pose, one hand raised in a small wave. Transparent background, no text, no logos, no flags, no agency emblems.

Ask for the same character in five poses matching the states table, in one consistent style. Export each as a transparent PNG at 512 px, and a 128 px version for the watch.

Check the 2026 submission guide on whether AI-generated images need a visible mark, and follow it.

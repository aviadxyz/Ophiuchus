# Design system

Taken from the two console screenshots in the briefing PDF (the sidebar mockup and the Risks screen). Hex values are starting points read off low-resolution images. If Aviad has the original source, his values win.

The goal is that a judge cannot tell which teammate built which screen.

## Feel

A mission console: dark, calm, dense but readable. Color is reserved for status. Nothing glows, nothing bounces, except Ophi.

## Color tokens

| Token | Starting value | Used for |
|---|---|---|
| Background | `#07090F` | Page |
| Surface | `#0D111A` | Sidebar, cards, table container |
| Surface raised | `#141A26` | Active sidebar item, hover rows, popovers |
| Border | `#1E2533` | Card and row dividers, 1 px |
| Text primary | `#E6EAF2` | Titles, row names |
| Text secondary | `#8A93A6` | Descriptions, table cells |
| Text muted | `#566074` | Column headers, section labels |
| Accent | `#34D399` | Active sidebar marker, primary action, "on target" |
| Status high | `#F26D6D` | High severity, off target |
| Status moderate-high | `#E0A93B` | Moderate-high severity, warning |
| Status moderate | `#5B8DEF` | Moderate severity, information |
| Emergency | `#F59E0B` | The Emergency item and nothing else |

Status pills use the status color for text and a dot, the same color at about 12% opacity for the fill, and the same color at about 35% opacity for the border.

Rules:

- No new colors. If a screen needs a chart series color, use the accent, then the three status colors, then text secondary.
- Status color always comes with a word or an icon. Never color alone.
- Text contrast against its background must pass WCAG AA.

## Type

| Role | Style |
|---|---|
| Screen title | Sans, about 28 px, semibold |
| Eyebrow above the title | Monospace, about 11 px, uppercase, wide letter spacing, text muted. Format: `DOMAIN · NAME OF VIEW` |
| Screen description | Sans, 14 px, text secondary, max two lines, max about 90 characters per line |
| Table column header | Monospace, 10–11 px, uppercase, wide letter spacing, text muted |
| Row name | Sans, 14 px, semibold, text primary |
| Body and cells | Sans, 13–14 px, text secondary |
| Numbers in tiles | Sans, 28–32 px, semibold, tabular figures |
| Pill text | Monospace, 10 px, uppercase |

One sans family (Inter) and one monospace family (JetBrains Mono) for the whole app, bundled with it so the app works offline.

## Layout

| Thing | PC (1024 px and up) | Phone (under 640 px) |
|---|---|---|
| Sidebar | Fixed left, about 260 px | Drawer, opened from the top bar |
| Content | Max width about 1200 px, 32 px padding | Full width, 16 px padding |
| Top bar | None | Menu button, screen title, Emergency button |
| Tables | Rows | Stacked cards |
| Stat tiles | Four across | Two across |

Between 640 and 1024 px the sidebar shows icons only.

## Screen anatomy

Every screen has the same top, in this order:

1. Eyebrow.
2. Title.
3. One or two sentence description of what the screen shows.
4. On the right of the title row, up to three summary pills.

Then the body, built from the shared components below.

## Shared components

This table describes how each one looks. Their exact names and inputs are fixed in [CONTRACTS.md](CONTRACTS.md) section 6, which also lists a few form and progress components not described here.

| Component | Description |
|---|---|
| Source badge | Tiny monospace uppercase tag next to a value: LIVE (accent, with a small pulsing dot), ENTERED, IMPORTED, SIMULATED (all three muted). Shown wherever a measurement is displayed |
| Sidebar item | Icon, label. Active state has a raised background and a 2 px accent bar on the left |
| Section label | Monospace uppercase muted, used for "CONSOLE" style group headings |
| Stat tile | Label, big number, unit, target line, small status pill. Optional sparkline |
| Status pill | Dot plus uppercase word. Four kinds: high, moderate-high, moderate, on target |
| Data table | Container with rounded corners and a border. Each row has a 3 px colored bar on the left, a name, cells, a pill, and a chevron if it opens a detail |
| Card | Surface background, border, 12 px radius, 20 px padding |
| Detail drawer | Slides in from the right on PC, from the bottom on phone. Used for row drill-down |
| Primary button | Accent fill, dark text |
| Quiet button | Border only |
| Empty state | One sentence and one action |
| Source line | Small muted line under any target or fact: "Source: ..." |
| Game link | A small card at the bottom of a screen that opens a mini game |
| Chat bubble | Used by Med bot and Social. Theirs: surface raised fill, border, text primary, on the left. Mine: accent at about 12% opacity for the fill and about 35% for the border, text primary, on the right. Time and notes in text muted underneath. No other colors |
| Switch | A small track and knob: accent when on, border color when off, always with the word ON or OFF beside it |

A screen may compose these. It may not restyle them or add a look-alike.

## Sidebar specifics

- The profile switcher sits at the very top: the active person's display name and a small tag, DEMO or CREW.
- Group headings in monospace uppercase muted.
- Thin divider between groups.
- Emergency is pinned at the bottom, larger and bold, in the emergency color. It is the only item that breaks the pattern, on purpose.
- Unfinished screens show in the sidebar with a small "soon" marker rather than being hidden, so the structure of the product is visible to judges.

## Motion

- Transitions of 150–200 ms on hover, drawer and popover.
- Ophi has a slow idle float.
- Everything respects the system "reduce motion" setting.

## Accessibility floor

- Keyboard reachable, visible focus ring.
- Every icon button has a text label for screen readers.
- Charts have a text summary.
- Text does not go below 12 px on phone.

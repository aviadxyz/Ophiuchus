# Lane 01 · shell, design system, registry

Owner: lane 01 ([prompt 01](../../../prompts/01-shell-and-design-system.md)). Covers `src/shell`, `src/design`, `src/registry`, the project files in `app/`, and the fifteen placeholder screens.

## Plan

1. `app/` project: Vite, React, TypeScript strict, Tailwind 4, the six scripts, `@/` alias, every package from CONTRACTS section 1.
2. `design/tokens.css`: every token from DESIGN_SYSTEM as a CSS variable and Tailwind theme value; default palette switched off.
3. `design/components/*`, `design/charts/*`, `design/index.ts`: the 22 components of CONTRACTS section 6 and the section 7 vocabulary.
4. `registry/`: collects `screens/*` and `games/*` at build time; `build/registryCheck.ts` fails the build on a bad id.
5. `screens/<id>/` × 15: placeholders. `data/` and `ophi/`: stubs for lanes 02 and 03.
6. `shell/`: AppShell, Sidebar, TopBar, MobileDrawer, ProfileSwitcher, AlertBanner, ScreenBoundary, router, `/dev/components`.
7. PWA (manifest, icons, auto-updating offline cache). Tests. README.

## What is built

- Everything in the plan. All fifteen screens open as placeholders at 360 px, 800 px (icon rail) and 1440 px with the right sidebar item highlighted.
- `/`, `/<screen-id>`, `/games/<game-id>` (full window, Back), `/w` (bare, loads `watch/WatchApp.tsx` once lane 08 adds it), `/dev/components`, and a not-found page inside the shell.
- Each screen is loaded on demand and wrapped in `ScreenBoundary`; a crash shows an error card with Reload and the sidebar keeps working.
- Offline: `vite-plugin-pwa` precaches the built app; `registerType: 'autoUpdate'` with `skipWaiting` and `clientsClaim`, so a new deploy takes over and reloads open tabs without anyone clearing anything.

## What is stubbed

- `data/index.ts`: fixed demo profile, no alerts, nothing stored. Lane 02 replaces it.
- `ophi/`: the three functions work; `Ophi` renders nothing. Lane 03 replaces it.

## Choices the contract did not make

- **`@/registry` exports more than section 4 lists:** `loadGuide(id)` (for Ophi; returns the screen's `guide.ts` or a default), `defaultGuide(meta)`, `groupHeadings`, and `loadScreen(id)` / `loadGame(id)` (used by the router only). Types: `ScreenMeta`, `GameMeta`, `Guide`, `ScreenGroup`, `ScreenStatus`, `ScreenIconName`.
- **`@/design` vocabulary names:** `levelTone`, `levelLabel`, `sourceLabel`, and the lists `tones`, `levels`, `sources`.
- **Input shapes the contract left open:** `DataTable.columns` is a list of heading texts and `cells` one node per column, the first cell being the row name; `ChipGroup.selected` is always a list (zero or one item for a single choice) and `onChange` receives the new list; `NumberField.value` is a number or `null` for empty; `TextField.onChange` and `ChatInput.onSend` receive text; `ChatThread`'s message type is exported as `ChatMessageView` so it does not clash with the data record `ChatMessage`.
- **Optional extras, never required:** `emptyText` on DataTable, `cancelLabel` on ConfirmDialog, `label` on ChipGroup, ProgressRing and ChatInput, `summary` on Sparkline, `height` on TrendChart, `type`/`aria-label` on Button, `placeholder`/`type`/`maxLength`/`disabled` on TextField, `step`/`disabled` on NumberField.
- **`meta.icon`** is a lucide name in kebab case. A small Vite plugin bundles only the icons named in meta files, so the sidebar does not ship all 1,700 icons.
- **Muted text color** is `#78829A`, not the design system's starting value `#566074`, which measured 3.2:1 on the page and failed WCAG AA. Every other color is exactly as listed.
- **Small text on phones:** pill, label and eyebrow sizes go from 10–11 px to 12 px under 640 px, to meet the 12 px floor.
- **Owner text** for Medical status and Emergency is `Elia / Rami`, copied from the contract table.
- **TrendChart** loads Recharts on first use, so the charting library is not in the first download.
- **Breakpoints:** only `sm` (640 px) and `lg` (1024 px) exist, matching the layout table.

## What I could not verify

- Install-to-home-screen and offline reload on a real phone. The manifest and service worker build; I did not install it on a device.
- The update-on-deploy behaviour against a real host (needs lane 10's public link).
- Behaviour with more than one profile or with an open alert: the data stub has one profile and no alerts.

## How to see it working

`npm run dev`, then open `/overview` and click through the sidebar; narrow the window under 640 px for the drawer and top bar; open `/dev/components` for every component.

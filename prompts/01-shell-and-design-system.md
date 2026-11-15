# 01 · Shell and design system

**Phase 0. Runs alone. Nothing else starts until this is merged.**

| | |
|---|---|
| Branch | `lane/01-shell` |
| You own | Everything in `app/` that exists after this prompt, except the contents of screens you only create as placeholders |
| Read first | AGENTS.md, docs/CONTRACTS.md (all), docs/DESIGN_SYSTEM.md (all) |
| Attach (chat tools only) | Those three files |
| Use | The most capable model you have. Every later lane builds on this |

## Prompt

The build has started; you may now write code. Read AGENTS.md, docs/CONTRACTS.md and docs/DESIGN_SYSTEM.md in full before doing anything.

You are creating the skeleton of Ophiuchus, an astronaut health console. Right after you finish, several other agents on different AI tools will build the screens in parallel. They cannot see each other's work. The only thing they share is docs/CONTRACTS.md and what you build here. So your job is to make the contract real, exactly: same file paths, same component names, same inputs. If you rename or reshape anything, their work will not fit. Where the contract is silent on an internal detail, choose the simplest option. Where it seems wrong, stop and ask me.

**Build, in this order:**

1. **Project.** Create the app in `app/` with the stack in CONTRACTS section 1. Install every package in that table now, including the games library, so no later lane needs to add one. Set up the `@/` alias and the six scripts named there. TypeScript strict mode on. Lint and format rules on, kept simple.
2. **Folders.** Create the tree in CONTRACTS section 2. For folders owned by later lanes (`data`, `ophi`, `watch`, `games`), create the folder with a `NOTES.md` saying which lane owns it, and nothing else, with the two exceptions in steps 8 and 9.
3. **Tokens.** `design/tokens.css` holds every color, type size, spacing step and radius from the design system as CSS variables, mapped into the Tailwind theme. Load Inter and JetBrains Mono from the bundled font packages.
4. **Shared components.** Build every component in CONTRACTS section 6 with exactly the names and inputs listed, one file each in `design/components` (charts in `design/charts`), all exported from `design/index.ts`. Each handles its empty and long-text cases. `DataTable` switches to stacked cards under 640 px. `Sparkline` and `TrendChart` accept missing values and draw gaps.
5. **Vocabulary types.** Export `Tone`, `Level` and `Source` from `@/design` with the values in CONTRACTS section 7, and the level-to-tone mapping and level labels.
6. **Registry.** `registry/types.ts` defines the screen meta and game meta shapes from CONTRACTS sections 4 and 13. `registry/index.ts` collects every `screens/*/meta.ts` and `games/*/meta.ts` automatically at build time, pairs each with its folder's `index.tsx` loaded on demand, and exposes the functions listed in section 4. It must fail the build with a clear message if a meta `id` does not match its folder name or two ids collide.
7. **Placeholder screens.** For all fifteen ids in CONTRACTS section 3, create the folder with the four files. `meta.ts` uses the label, group, order and owner from that table, status `placeholder`, a fitting lucide icon, an eyebrow, and a one-sentence description. `index.tsx` renders `ScreenHeader` from its own meta and an `EmptyState` reading "[Label] is being built by [owner]." `guide.ts` uses the default wording built from the description, with all four fields of CONTRACTS section 5 present and `whenToAct` set to "This screen is still being built. For anything urgent, use Emergency." No filler text anywhere.
8. **Data stub.** In `data/index.ts`, export only what the shell needs to compile: `useActiveProfile`, `useProfiles`, `setActiveProfile`, `useAlerts`, each returning a fixed demo value. Mark the file clearly as a stub that lane 02 replaces. Do not build anything else in `data`.
9. **Ophi stub.** In `ophi/index.ts`, export `setOphiState`, `useOphiState` and `askMedbot` with the behavior in CONTRACTS section 12 (`askMedbot` really navigates), and a component named `Ophi` that renders nothing. Mark it as a stub that lane 03 replaces.
10. **Shell.** `AppShell` lays out the sidebar and content. `Sidebar` is generated from the registry: group headings as in section 3, items ordered by `order`, a "soon" marker on placeholders, the active item styled per the design system, and the pinned Emergency item at the bottom in the emergency color. At 640 to 1024 px the sidebar shows icons only. Under 640 px it becomes `MobileDrawer`, opened from `TopBar`, which also shows the screen title and an Emergency button. `ProfileSwitcher` sits at the top of the sidebar and lists profiles from `useProfiles`. `AlertBanner` shows the newest open emergency alert above the content on every screen with a link to `/emergency`. The shell renders `Ophi` once, above everything.
11. **Routing.** The routes in CONTRACTS section 3, exactly. `ScreenBoundary` wraps each screen so a crash shows an error card with a reload button and leaves the shell working. A loading state while a screen loads. A not-found page.
12. **Installable.** Web app manifest, icons, and offline caching of the built app. A new deploy must replace the cached version without the user clearing anything.
13. **Component demo page** at `/dev/components`: every shared component in every tone, level, source and state, at a width toggle of 360 and 1440. Other agents will look at this page to learn what exists.
14. **`app/README.md`:** how to run, the exact installed versions, the four rules for adding or building a screen (work only in your folder; import only from the four shared paths; change status in your own `meta.ts`; add no dependencies), and where the demo page is.
15. **Tests:** registry collection and its two failure cases; `DataTable` card mode; level-to-tone mapping.

**Do not build:** real screen content, the data store, the Ophi character, the watch view, games, server code, sign-in.

**Checks you must run and pass before reporting:**

- `npm run build`, `npm run lint`, `npm run typecheck`, `npm run test`, all clean.
- Every sidebar item opens its placeholder at 1440 px and at 360 px, with the right item highlighted.
- Reloading on any route stays on that route.
- Create a throwaway folder `screens/zz-test` with the four files, confirm it appears in the sidebar and routes with no other file changed, then delete it.
- Compare your exported names and inputs against CONTRACTS sections 4, 6, 7 and 12 line by line, and list any difference in your report. There should be none.

**Stop and wait for my OK once,** before writing code: tell me the exact package versions you will install and anything in the contract you find unclear or impossible.

**Report:** what you built, the result of each check, and every place you had to make a choice the contract did not cover.

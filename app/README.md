# Ophiuchus app

The web app: an astronaut health console. Rules for everyone working here are in [../AGENTS.md](../AGENTS.md); every shared name is fixed in [../docs/CONTRACTS.md](../docs/CONTRACTS.md).

## Run it

Needs Node 24 or newer (built with Node 26 LTS) and npm.

```bash
npm install
```

```bash
npm run dev
```

Then open the address it prints (normally http://localhost:5173).

| Script | Does |
|---|---|
| `npm run dev` | Development server with hot reload |
| `npm run build` | Type-checks, then builds to `dist/` with the offline service worker |
| `npm run preview` | Serves the built `dist/` |
| `npm run lint` | ESLint, no warnings allowed |
| `npm run typecheck` | TypeScript, strict |
| `npm run test` | Vitest once |
| `npm run format` | Prettier over the project |

Before you say you are done: `build`, `lint`, `typecheck` and `test` must all pass.

Settings go in `.env.local` (copy `.env.example`). All three may be empty; each feature then uses its offline fallback.

## Four rules for adding or building a screen

1. **Work only in your folder**, `src/screens/<screen-id>/` (or `src/games/<game-id>/`). Adding a screen is adding a folder with `index.tsx`, `meta.ts`, `guide.ts` and `NOTES.md`. Nobody edits a central list. The build fails with a clear message if `meta.id` does not equal the folder name or two ids collide.
2. **Import only from the four shared paths:** `@/design`, `@/data`, `@/ophi`, `@/registry`, plus files in your own folder. Lint enforces this for screens and games.
3. **Change your status in your own `meta.ts`:** `placeholder` (shows "soon" in the sidebar), `building`, or `ready`.
4. **Add no dependencies.** Everything allowed is installed below. If you think you need another, stop and ask.

`meta.icon` is a lucide icon name in kebab case, exactly as on lucide.dev (for example `'heart-pulse'`), written as plain text. Typecheck rejects a name lucide does not have.

## See every shared component

Open **`/dev/components`** in the running app. It shows every component from `@/design` in every tone, level, source and state, with a width toggle for 360 px and 1440 px. It is not in the sidebar.

## Installed versions (exact)

| Package | Version | Package | Version |
|---|---|---|---|
| react, react-dom | 19.3.1 | vite | 8.3.8 |
| react-router | 8.5.1 | @vitejs/plugin-react | 6.3.0 |
| zustand | 5.1.0 | typescript | 6.0.3 |
| recharts | 3.10.1 | tailwindcss, @tailwindcss/vite | 4.3.5 |
| lucide-react | 1.73.0 | vite-plugin-pwa | 2.0.0 |
| @fontsource-variable/inter | 5.3.0 | vitest | 5.1.0 |
| @fontsource-variable/jetbrains-mono | 5.3.0 | jsdom | 31.0.1 |
| @mediapipe/tasks-vision | 1.2.3 | @testing-library/react | 16.3.3 |
| eslint | 10.15.0 | @testing-library/dom | 10.4.2 |
| @eslint/js | 10.0.1 | @testing-library/jest-dom | 7.0.1 |
| typescript-eslint | 8.72.2 | @testing-library/user-event | 14.6.10 |
| eslint-plugin-react-hooks | 7.1.1 | @types/react, @types/react-dom | 19.3.0 |
| eslint-plugin-react-refresh | 0.5.7 | @types/node | 26.6.6 |
| globals | 17.14.0 | prettier | 3.10.1 |

TypeScript is 6.0.3, not 7, because typescript-eslint supports TypeScript only below 6.1.

## Where things are

| Path | What | Owner |
|---|---|---|
| `src/design/` | Tokens (`tokens.css`), shared components, charts, vocabulary. Import from `@/design` | lane 01 |
| `src/registry/` | Collects screen and game folders. Import from `@/registry` | lane 01 |
| `src/shell/` | Sidebar, top bar, drawer, routes, error boundary, `/dev/components` | lane 01 |
| `src/data/` | The store. A stub until lane 02 | lane 02 |
| `src/ophi/` | Ophi the guide. A stub until lane 03 | lane 03 |
| `src/screens/<id>/` | One folder per screen | that screen's owner |
| `src/games/<id>/`, `src/watch/` | Games, watch view | lanes 09 and 08 |
| `build/` | Two small Vite plugins: the registry id check and the sidebar icon list | lane 01 |

Colors exist only in `src/design/tokens.css`. Tailwind's own palette, shadows and radii are switched off, so `bg-red-500` and the like do not exist. Use the token names: `bg-surface`, `text-text-secondary`, `border-border`, `text-accent`, `text-warn`, `text-danger`, `text-info`, `text-emergency`.

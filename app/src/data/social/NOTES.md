# data/social

**Owner: lane 17** ([prompt 17](../../../../prompts/17-social.md), part A). Built in prompt 19, task 3, up to the server part.

## Plan

- `types.ts`: the four records of CONTRACTS section 8 and the small result types.
- `simulatedCrew.ts`: the demo profile's six invented crew members, their moods, seed chats and fixed replies.
- `state.ts`: the crew network's own store per profile under `ophiuchus:v1:social` (account with token, people, messages, shared mood), sanitized on load; plus unsaved runtime state.
- `api.ts`: the client for the CONTRACTS section 11 endpoints, used only when `VITE_SOCIAL_URL` is set.
- `background.ts`: mood sharing from the main store, leaving on profile deletion, demo reset, live polling.
- `actions.ts`, `hooks.ts`: the section 9 functions and hooks. `index.ts`: the public names.

## What is built

Every Social hook and function of CONTRACTS section 9, exported from `@/data` in one marked block at the end of `data/index.ts`. The demo profile runs fully on the simulated crew. A member profile gets `off` while `VITE_SOCIAL_URL` is empty: reads are empty, writes return `offline`. Usage for the screen agent is in `data/README.md`, section "Social".

## Not built, on purpose

- The endpoints in `api/social/` (prompt 19 said stop before the server part). Nothing here has talked to a real server, so `live` mode is untested.
- Decisions the server must match: the token goes in `Authorization: Bearer <token>`; `VITE_SOCIAL_URL` may be the site root or end in `/api/social`; `sync` friends carry their `mood`; `unread` is counted on this device.

## How to see it working

`npm run test -- src/data/social`, or after task 4 open `/social` on the demo profile.

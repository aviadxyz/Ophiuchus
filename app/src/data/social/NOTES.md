# data/social

**Owner: lane 17** ([prompt 17](../../../../prompts/17-social.md), part A). Built in prompt 19, task 3, up to the server part.

## Crew challenges (prompt 26)

Plan:
- `../../../worker/social/rules.ts`, `crewDo.ts`: table `challenge_scores`, `POST /challenge`, `GET /challenges`, 8-day expiry. Tests in `challenges.test.ts` beside them.
- `challengeScores.ts`: the two scores from the store (pure).
- `api.ts`: `apiChallenge`, `apiChallenges` added at the end.
- `challenges.ts`: per-profile joins (`ophiuchus:v1:challenges`), sending, 15 s board polling, demo boards, `useChallenges`, `setChallengeJoined`.
- `challenges.test.tsx`: scores, demo boards, request bodies, rate limit.

What is built: everything in parts 1 and 2. Scores: `exercise` = done minutes (done or changed sessions, game rounds included) over planned minutes of this week's non-game sessions, capped at 100; no plan gives no score. `nutrition` = days Monday to today with energy, water and protein all `ok` by `summarizeDay`; nothing eaten or drunk this week gives no score. A score is sent when it changes, at most once a minute, and again after a day unchanged so the server's 8-day expiry never hides an active player. Leaving sends `leave` at once; if the network is down the leave is retried until it lands (`onServer` flag). A joined challenge whose score turns to none also sends `leave`, so last week's number is never shown as this week's. Joins are forgotten when the profile's social account goes or changes.

What the server stores: per person per challenge, `social_id`, `challenge`, `score` (whole number), `updated_at`. Deleted after 8 days without an update (on every write), on `leave`, and when the account is removed (leave the network, or 7 days idle). Visibility is worked out on every read from current friendships, so removing a friend hides both scores at once.

Faked: the demo profile's crew scores are fixed (`SIMULATED_CHALLENGE_SCORES`); quiet_comet takes part in food only, redshift in exercise only.

Not verified: two real devices on the live network. A person with no score yet is not on the server, so they cannot see friends' boards until they have one. A team handle used on two devices posts from both; the last write wins.

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

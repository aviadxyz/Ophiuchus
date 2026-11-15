# games

**Owner: each game's lane** ([prompt 09](../../../prompts/09-mini-game.md)). Fixed ids: `futvolley`, `samba-time`. The Sleep mini game ([prompt 27](../../../prompts/27-sleep-minigame.md)) chooses its own.

A game is a folder `games/<game-id>/` with `index.tsx` (default export), `meta.ts` (named export `meta`, CONTRACTS section 13) and `NOTES.md`. The registry picks it up automatically, routes it at `/games/<game-id>` full window with a back control, and `GameLinks` shows it on every screen listed in `meta.screens`. Nothing else needs to change.

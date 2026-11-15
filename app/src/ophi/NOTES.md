# ophi

**Owner: lane 03** ([prompt 03](../../../prompts/03-ophi-guide.md)).

Right now this folder holds a stub written by lane 01: `setOphiState`, `useOphiState` and `askMedbot` work as docs/CONTRACTS.md section 12 says, and `Ophi` renders nothing. The shell already renders `<Ophi />` once, above everything, in `shell/AppShell.tsx`.

A screen's guide text is loaded with `loadGuide(id)` from `@/registry`. It returns the screen's `guide.ts`, or a default built from the screen's description when that file is missing or empty.

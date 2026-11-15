# About

**Owner:** Rami. Screen id `about`, route `/about`.

## Plan

- `index.tsx` the screen: what it is, the honest statement, profiles (list, switch, add), delete and reset behind `ConfirmDialog`, build time.
- `AddProfileForm.tsx` the "Add my profile" form with the two consent switches and the "This is my own data" tick.
- `guide.ts` the explanation for Ophi. `meta.ts` status `ready`.

## What is built

Status `ready`. Project name and paragraph, the honest statement, "AI tools were used to build this project.", the profile list with switching, "Add my profile" (display name required; role, sex, birth year, height, body mass and last night's sleep optional; both sharing switches off by default with the wording from docs/REAL_DATA.md rule 3; "This is my own data" must be ticked), "Delete my data" for a member profile and "Reset demo data" for the demo profile, each behind `ConfirmDialog`, and the build time.

## What is faked or stubbed

Nothing is faked. Build time is the weak spot: there is no build-time constant in `vite.config.ts` (lane 01's file), so the screen reads `VITE_BUILD_TIME` if it is set at build and otherwise the page's last-modified time. For a real stamp, set `VITE_BUILD_TIME` in the deploy build or add a `define` to `vite.config.ts`.

## What could not be verified

Checked in the browser at 1024 px and 360 px wide (no sideways scroll). The form has no automated test.

## How to see it working

Open `/about`. Try "Add my profile" without ticking "This is my own data" to see the error, then with it. Reload: the profile and its entries stay. "Delete my data" removes it.

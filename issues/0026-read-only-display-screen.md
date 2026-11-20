---
id: 26
title: Read-only display screen for players (second tab)
status: open
labels: [ready-for-agent]
created: 2026-11-20
---

# 0026: Read-only display screen for players (second tab)

## Parent

#0001

## Problem Statement

During a tournament, players keep coming to the operator's desk to ask which table they play at, who's next, and how their group or bracket stands. The operator's play screen has the answers, but it's a working tool full of panels, popovers and controls, and turning the laptop round to show it gets in the way of running the event. The laptop can drive a second monitor or projector, but the app has no screen made for players. ADR 0001 already settled that a projector or TV view has to be a second window on the same machine.

## Solution

A read-only display screen, opened from the play screen in a second window and shown full screen on the second monitor. It shows what's playing on each table, the matches waiting to be called, and one competition's groups and brackets at a time. With several competitions it cycles through them automatically. The operator can take a competition out of the cycle (for example one that has finished or hasn't started yet). It follows every change made in the operator's window within about a second, without a server and without reloading, and it never changes anything itself.

## User Stories

1. As an operator, I want to open a display screen from the play screen with one button, so that I can put it on the second monitor without typing a URL.
2. As an operator, I want the display to open in its own window, so that I can drag it to the second monitor while keeping the play screen on the laptop.
3. As an operator, I want a full-screen button on the display, so that the browser's address bar and tabs don't show on the projector.
4. As an operator, I want the display to update by itself when I call a match, record a result or correct one, so that I never have to touch the second window during play.
5. As an operator, I want the display to be unable to change the tournament, so that a click on the second screen can never alter a result or the draw.
6. As an operator, I want the display to never write to the tournament's storage, so that two open windows can't overwrite each other's data.
7. As an operator, I want the display to keep working offline, so that it runs in a hall without Wi-Fi, like the rest of the app.
8. As an operator, I want the display to show the tournament named in its URL, so that a display left open from another tournament never shows the wrong event.
9. As an operator, I want the display to cycle through the competitions, showing one at a time, so that every competition gets screen time on one monitor.
10. As an operator, I want to take a competition out of the cycle, so that a finished or not-yet-started competition doesn't waste screen time.
11. As an operator, I want to put a competition back into the cycle, so that I can show it again once it starts or for the final places.
12. As an operator, I want the cycle settings to be hidden until I move the mouse over the display, so that players see a clean screen.
13. As an operator, I want my choice of competitions in the cycle to survive reloading the display, so that I don't redo it after a browser restart.
14. As an operator, I want the cycle choice to stay out of the tournament file and the change log, so that a display preference doesn't end up in exports or disputes.
15. As an operator, I want a competition whose draw isn't confirmed yet to be left out of the cycle automatically, so that players never see a draw I'm still editing.
16. As an operator, I want the display to show only the tables when no competition is left in the cycle, so that the screen stays useful.
17. As an operator, I want the display to stay on the one competition, without flicker, when only one is in the cycle, so that a single-competition tournament looks calm.
18. As an operator, I want the cycle to pick up a competition whose draw I confirm while the display is open, so that I don't have to reopen the display.
19. As an operator, I want a competition I delete or that disappears from the tournament to drop out of the cycle without errors, so that the display keeps running.
20. As a player, I want to see which match is on each table, so that I know where to go when I'm called.
21. As a player, I want to see how long each match has been playing, so that I can guess when a table will be free.
22. As a player, I want to see the next few matches waiting to be called, so that I can get ready before I'm called.
23. As a player, I want to see each player's full name and club where the play screen shows them, so that I can recognise my match.
24. As a player, I want to see my group with its standings, so that I know where I stand and whether I'm an advancer.
25. As a player, I want to see the bracket with the results so far, so that I know my next opponent.
26. As a player, I want to see origin labels such as "1A" in the bracket before the groups finish, so that I know where I'd go if I win my group.
27. As a player, I want to see results, walkovers and retirements marked the same way as on the play screen, so that I understand them.
28. As a player, I want the competition's name shown clearly, so that I know which competition is on screen.
29. As a player, I want to see how long until the display moves to the next competition, so that I know when mine will come back.
30. As a player, I want text large enough to read from a few metres away, so that I don't have to crowd round the screen.
31. As a player, I want the competition content fitted to the screen, so that I don't need anyone to scroll or zoom.
32. As a player, I want the display in the same language as the app, so that I can read it.
33. As an operator, I want the display to work at 1920×1080 and 1280×800, so that it fits a typical TV, projector or spare laptop screen.
34. As an operator, I want the display to keep its match clocks ticking between saves, so that the timings stay current even when nothing is recorded.

## Implementation Decisions

- **New screen and route.** A display route per tournament (`/tournaments/:id/display`), outside the operator layout (no header, tabs or panels). The play screen gets a "Second screen" button that opens it in a new window. The display has its own full-screen toggle.
- **Read-only loading, separate from the operator store.** The display doesn't use the operator store's `dispatch` or autosave. It loads the tournament through the storage interface (the same path as opening a tournament, so stored files are validated and migrated), and holds it in its own read-only state. It calls engine queries only.
- **Sync through the storage interface.** `TournamentStorage` gets a subscription method, e.g. `subscribe(id, onChange): unsubscribe`, so the display doesn't reach for `window` events itself (ADR 0001 keeps storage behind a small interface so a sync adapter can replace it later). The localStorage adapter implements it with the browser's `storage` event on that tournament's key; the event fires only in other windows of the same origin, which is exactly the display. On each change the display reloads the tournament. If the tournament is deleted, the display shows a "tournament not found" message.
- **Engine query for the cycle (the one new engine piece).** A pure query, e.g. `getDisplayCycle(state, { excluded })`, returns the competitions to show in order (the same order as the play screen's competition tabs), leaving out excluded competitions and those whose first stage isn't confirmed. An empty list means "tables only". Excluded ids that no longer exist are ignored. Like `getBackupReminder`, the display preference comes in as an argument; it isn't tournament state.
- **Cycle timing lives in the UI.** The display advances to the next competition every 20 s (a constant), using `useNow()`. When the cycle list changes (a competition confirmed, excluded or included), it keeps showing the current competition if it's still in the list, otherwise it moves to the next one.
- **Cycle preference storage.** The excluded competition ids are kept per tournament in localStorage under their own key (e.g. `tm:display:<id>`), outside the tournament file, the change log and the `tm:tournament:*` keys. Reads and writes are wrapped so a missing or corrupt value means "nothing excluded".
- **Content reused from the play screen.** The tables strip reads `getTableOverview(state, now)` and the first few entries of `getWaitingList(state, now)`. The competition view reuses the canvas components (group boxes with standings, bracket board with the play-off layout the operator chose) in a non-interactive mode: no popovers, no click handlers, no draw editing, no pan or zoom controls. It's fitted to the space once per competition and on resize.
- **Domain language.** UI text uses the glossary: competition, table, match, waiting list, standings, bracket, origin label, call. New keys in both EN and PL, including the "Second screen" button, the cycle settings and the empty states.
- **No schema change.** The tournament file and state shape don't change, so no migration.

## Testing Decisions

- A good test checks external behaviour through the engine's public interface (ADR 0004): set up a tournament with commands, then assert on what a query returns. No testing of components, hooks, storage events or internals.
- **Tested:** the new cycle query, in a new engine test file, through `execute` + the query:
  - competitions come back in tab order;
  - a competition with an unconfirmed draw (or no stages) is left out, and appears once its first stage is confirmed;
  - excluded competitions are left out; unknown excluded ids are ignored;
  - all excluded, or none confirmed, gives an empty list.
- **Prior art:** `backupReminder.test.ts` (a query that takes app-held settings as arguments), `multipleCompetitions.test.ts` (setup with several competitions), and the scenario helpers in `__tests__/scenarios.ts`.
- **Not unit-tested (per ADR 0004):** the storage subscription, the display route, cycle timing and layout. These are checked in the browser with the operator window and the display side by side: record a result, call a match, correct a result and confirm a draw in the operator window, and see each one on the display within about a second; exclude a competition and reload the display; check at 1920×1080 and 1280×800; check the PWA build offline. Screenshots in the report.
- `npm test`, `npm run build` and `npm run lint` stay green.

## Out of Scope

- Showing the display on another device (phones, a TV with its own browser). That needs a server or sync, which ADR 0001 rejected for v1.
- A guard against opening the operator screen in two windows at once (worth its own ticket).
- A configurable cycle interval, per-competition durations or manual "next" controls on the display.
- Final places, the change log or stats on the display.
- Announcements, sponsor slides or custom messages.

## Further Notes

- The `storage` event never fires in the window that made the change, so the operator window is unaffected. It fires once per save, and the operator store saves after every successful command, so the display updates once per operator action.
- The operator store also writes the tournament index on each save. The display listens only to its own tournament's key.
- Blocked by: none (can start immediately).

---
id: 24
title: Place play-offs split one level at a time
status: done
labels: [ready-for-agent]
created: 2026-10-24
---

# 0024: Place play-offs split one level at a time

## Parent

#0012

## What to build

Today a place play-off always splits its range down to single places (9–16 → 12 matches). The operator wants to decide how far each part is split. For example: decide 9–12 down to single places, but leave the round-1 losers sharing 13–16.

- **One split per play-off.** A play-off for a range of n entries is one round of n/2 matches, pairing neighbours (as today). Its winners share the top half of the range and its losers the bottom half (9–16: winners 9–12, losers 13–16). With two entries it is one match for two single places.
- **Each half is a range with its own switch.** The halves a play-off creates are shared place ranges like any other, so they can have a play-off of their own. Their switch appears once the play-off that creates them is on.
- **Switching a parent off** also disables everything below it. Their own switches and finished results are kept, so switching the parent on again brings them back as they were. A parent can't be switched off while a match below it is on a table (`playOffInProgress`).
- **Places:** a switched-on play-off decides its range's places: its halves, or single places at the last level. A switched-off one leaves its range shared.
- **Short codes** name the range, since several play-offs now start at the same place: `B9–12·1` (PL) / `PO9–12·1` (EN), and `B9–10` for a single match.
- **Migration:** play-offs in existing files were built down to single places. They are rewritten as the same matches split into one play-off per level, all switched on, so results and the places they decide don't change.

## Acceptance criteria

- [x] 9–16 in a 16-entry single elimination: switching on 9–16 makes 4 matches and offers 9–12 and 13–16. Switching on 9–12 makes 2 matches and offers 9–10 and 11–12.
- [x] 9–12 and 9–10 played, 13–16 left off: the places are 9, 10, 11–12 shared, 13–16 shared.
- [x] Switching 9–16 off disables every level below it. Switching it on again brings them back with their results.
- [x] A schema-v<n> fixture with a full-depth play-off imports with the same matches, results and final places.
- [x] Glossary: "Place play-off" splits a range into two halves (or single places).

## Blocked by

None

## Resolution

Done in 4bc4e88. Every play-off is now one round, and its halves are offered as play-offs of their own while it is on. `isPlayOffOn` (on, and so is every play-off above it) decides whether matches count and places split. Switching a play-off off is refused while a match at any level below it is on a table. Short codes name the range (`B9–12·1`, `B9–10`). Schema v12: migration 11 regroups old full-depth play-offs into one play-off per level, all switched on. Fixture `schema-v11.json` checks the matches, results and final places. The glossary entry is updated.

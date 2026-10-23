---
id: 21
title: Classification panel
status: in-progress
labels: [ready-for-agent]
created: 2026-10-23
---

# 0021: Classification panel

## Parent

#0001

## What to build

A collapsible side panel on the play screen that shows the **classification** (final places) of the selected competition, alongside the existing panels: tables on the left, waiting list on the right, and the bottom drawer. It must be possible to collapse it out of the way, and its state should be remembered for the session like the other panels.

- **Individual places and shared place ranges:** individual places appear as "1", "2", "3". A **place range** shared by several entries appears as one row such as "5–8" or "3–16", listing every entry in it (full names, club).
- **Live during play:** entries appear as soon as their place or range is known. For example, losers of the round of 16 show under "9–16" while the tournament is still running. Places not yet decided are shown as open.
- **Play-offs:** when a place play-off is played (#0012), the range splits into the individual places it decided. When it isn't played, the shared range stays.
- **Groups-only competitions:** with one group, the final standings give individual places. With several groups, entries finishing in the same group position share a range. For example, with 4 groups, all group winners share 1–4 and all runners-up share 5–8.
- **Engine:** build on `getFinalPlaces` (#0007), extending it to groups-only competitions and to provisional, in-progress places. Keep the query generic over stage types, so that double elimination (#0010) and play-offs (#0012) only add place metadata and the panel needs no changes.

## Acceptance criteria

- [ ] The classification query is tested through the engine interface:
  - [ ] a finished 8-entry single elimination with a 3rd-place match: places 1, 2, 3, 4, then 5–8
  - [ ] the same bracket mid-play: only the knocked-out entries are placed, and their ranges are correct
  - [ ] a single group: individual places from the standings
  - [ ] 4 groups, groups only: shared ranges by group position
- [ ] The panel is collapsible, shows individual places and ranges such as "3–16" with all their entries, and updates live as results come in.
- [ ] Panel text is in EN and PL.

## Blocked by

None (can start immediately). #0010 and #0012 will feed more place metadata into the same query.

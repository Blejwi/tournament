---
id: 11
title: Groups → double elimination
status: done
labels: [ready-for-agent]
created: 2026-10-22
---

# 0011: Groups → double elimination

## Parent

#0001

## What to build

A competition with groups followed by a double elimination stage. Group advancers are placed into the winners bracket with the same placement algorithm as #0009: origin labels, separation, BYE priority, and confirming once all groups are complete.

## Acceptance criteria

- [ ] With 4 groups into an 8-entry double elimination, the placement rules from #0009 hold.
- [ ] Placeholders resolve as each group completes; confirming is gated on all groups.
- [ ] Losers-bracket structure and places match #0010.
- [ ] The canvas lays out the groups, then the double elimination sections.

## Blocked by

- #0009
- #0010

## Resolution

Done on `integration/v1`. `FOLLOWERS.groups` now includes `doubleElimination`. The double elimination draw places origin-carrying advancers with `placeGroupAdvancers` into round 1 of the winners bracket, and needs at least 8 advancers (`notEnoughAdvancers`). The format picker has "Groups, then double elimination". Confirming waits for the groups. BYE priority with a non-power-of-two count is covered by the shared single-elimination tests. Not checked in the browser.

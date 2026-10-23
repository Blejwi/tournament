---
id: 11
title: Groups → double elimination
status: in-progress
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

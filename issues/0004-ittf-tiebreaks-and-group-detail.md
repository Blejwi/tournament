---
id: 4
title: ITTF tiebreaks and group detail
status: in-progress
labels: [ready-for-agent]
created: 2026-10-22
---

# 0004: ITTF tiebreaks and group detail

## Parent

#0001

## What to build

**Standings** break ties by ITTF rules, using only the matches between the tied entries:

1. points in those matches
2. game ratio in those matches
3. point ratio in those matches

This repeats for any subset still tied. If the rules can't break a tie, the **operator** settles it by manual decision or lot. Clicking a group header opens a detail view with full standings, a cross table and the tiebreak trace.

## Acceptance criteria

- [ ] A tie between 2 entries is decided by their head-to-head match.
- [ ] A 3-way tie is decided by game ratio among the tied entries; then point ratio.
- [ ] A partially broken tie (one entry separated) re-compares the rest among themselves only.
- [ ] An unresolvable tie is flagged, and an operator `resolveTie` command fixes the order.
- [ ] The standings query exposes the tiebreak trace, i.e. which rule decided each pair of positions.
- [ ] A group detail view opens from the canvas and shows the standings, the cross table and the trace.

## Blocked by

- #0003

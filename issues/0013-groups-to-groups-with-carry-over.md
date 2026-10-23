---
id: 13
title: Groups → groups with carry-over
status: done
labels: [ready-for-agent]
created: 2026-10-22
---

# 0013: Groups → groups with carry-over

## Parent

#0001

## What to build

A second groups stage fed by the first:

- **Filling phase-2 groups:** snake by place (all 1st places in group order, then all 2nd places). Entries from the same phase-1 group are kept apart where possible, and the operator can still move them by hand (#0008).
- **Carry-over**, on by default: if two entries already played each other in phase 1, that result is reused instead of being played again.
- **A final group** of all advancers is a special case.
- **Optional bracket:** another stage can follow phase 2.

## Acceptance criteria

- [ ] Snake by place with same-group separation is tested, e.g. 8 groups → 4 phase-2 groups.
- [ ] Carry-over: the repeated pairing is not playable in phase 2, and its phase-1 result counts in the phase-2 standings. With carry-over turned off, the pairing is played again.
- [ ] A final group (all advancers in one group) works.
- [ ] Groups → groups → bracket chains correctly.
- [ ] The canvas shows phase-1 groups, phase-2 groups and any bracket, left to right.

## Blocked by

- #0004
- #0008

## Resolution

Done on `integration/v1` (up to 9accc57). Groups → groups uses the #0009 chain (`FOLLOWERS.groups` includes `groups`). Phase-2 groups are filled snake-style by place with same-group separation, and stay editable before confirmation. Carry-over (`GroupsStage.carryOver`, on by default; schema v11) reuses the phase-1 result instead of a rematch, and corrections flow through. A final group works, and groups → groups → single elimination chains (engine only, as the format picker doesn't offer it yet). The cross table doesn't show carried-over results. Not checked in the browser.

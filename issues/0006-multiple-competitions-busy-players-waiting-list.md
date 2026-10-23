---
id: 6
title: Multiple competitions — busy players and waiting-list order
status: done
labels: [ready-for-agent]
created: 2026-10-22
---

# 0006: Multiple competitions — busy players and waiting-list order

## Parent

#0001

## What to build

A tournament runs several **competitions** on the same tables:

- **Competition tabs** switch the canvas. Each tab shows its ready, live and late counts.
- **One player, several competitions:** the same player can be entered in several competitions.
- **Busy matches:** a match whose player is currently playing elsewhere is **busy**. The card shows where that player is playing, and busy matches sort to the bottom of the waiting list.
- **Waiting list:** the full priority order is: busy last, then earlier stage, then earlier round, then the match that has been ready longest. A toggle switches between all competitions merged and the current competition only.
- **Jump to match:** clicking a waiting-list item switches to its competition, pans the canvas to the match and opens its popover.

## Acceptance criteria

- [ ] A player entered in two competitions who is in progress in one makes their match in the other busy, not ready.
- [ ] Waiting-list order is tested across two competitions, including busy matches and the ready-since tiebreak.
- [ ] The merged/per-competition toggle works.
- [ ] Clicking a waiting-list item pans to the match and opens its popover.
- [ ] Busy cards are styled differently from ready ones (dimmed, with an icon).

## Blocked by

- #0003

## Resolution

Done on `integration/v1` in e297c64 (engine: busy players across competitions, waiting list ordered by ready-since, per-competition filter, `getMatchCounts`) and c1520e8 (UI: tab counts, merged/per-competition toggle, busy cards say where the player is; per-language i18n plural types). Ready-since is derived rather than stored. Play-off ordering is left to #0012.

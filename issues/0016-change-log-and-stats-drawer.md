---
id: 16
title: Change log and stats drawer
status: in-progress
labels: [ready-for-agent]
created: 2026-10-22
---

# 0016: Change log and stats drawer

## Parent

#0001

## What to build

A collapsible bottom drawer with two parts:

- **Stats:**
  - progress (done/total per competition)
  - average match duration per competition, stage and table
  - the longest matches, which link to the match on the canvas
  - a rough time-left estimate
- **Change log:** a read-only, timestamped record of every score entry, correction, table assignment, manual swap and play-off toggle.

## Acceptance criteria

- [ ] The stats query is tested: walkovers count toward progress but not toward durations; averages are correct per competition, stage and table.
- [ ] Every action listed above writes one change-log entry with a timestamp and enough detail to settle a dispute, e.g. the old and new score.
- [ ] The drawer shows the stats and the log, and clicking a longest match jumps to it.

## Blocked by

- #0005

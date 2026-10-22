---
id: 5
title: Tables panel, overdue and idle
status: open
labels: [ready-for-agent]
created: 2026-10-22
---

# 0005: Tables panel, overdue and idle

## Parent

#0001

## What to build

A collapsible left panel lists every **table**:

- its status (free, playing, overdue, inactive)
- the current match with a live timer
- for free tables, how long the table has been **idle**

The panel can expand to a full-screen tile view. When it's collapsed, badges show the number of overdue and idle tables.

**Expected duration** is set per games-to-win value (defaults 2 → 15, 3 → 25, 4 → 35 min). A running match is **overdue**: amber past 100% of the expected duration, red past 150%. A header alarm jumps through the overdue matches.

Clicking a free table lists the ready matches, so the operator can call one from the table side.

## Acceptance criteria

- [ ] The table overview query (taking `now` as input) returns, per table: status, current match, elapsed time and idle time.
- [ ] Overdue thresholds are tested exactly at and just past 100% and 150%.
- [ ] Expected durations can be configured per competition format.
- [ ] Match cards and table entries show amber and red overdue states; red is visually stronger.
- [ ] Idle time counts from the moment the last match on that table finished.
- [ ] Badges on the collapsed panel and the header overdue alarm work.
- [ ] Calling a match from a free table works.

## Blocked by

- #0003

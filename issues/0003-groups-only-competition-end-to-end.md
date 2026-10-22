---
id: 3
title: Groups-only competition, end to end
status: in-progress
labels: [ready-for-agent]
created: 2026-10-22
---

# 0003: Groups-only competition, end to end

## Parent

#0001

## What to build

The full operator loop for a **Competition** with a single groups **Stage**:

- add a competition with its **games to win** (2/3/4, default 3) and enter players
- give some players **seeds**
- generate the **draw**, with the number of groups or the group size chosen, uneven groups allowed: seeded entries are placed **snake**-style and the rest at random (the random seed is injected), and matches are ordered by Berger round robin
- **confirm** the stage
- ready matches appear in a basic **waiting list**
- **call** a match to a free **table**, which starts its clock
- type the game scores (`11-7 9-11 11-5`, Enter) with live validation
- the match finishes, the table frees, and the **standings** update by **group points** (1 for a win, 0 for a loss)

The main screen is a basic pan/zoom canvas for the competition, showing group boxes (standings plus the group's matches). Clicking a match card opens a popover to assign a table and enter the score. Match cards are styled by state: pending, ready, in progress, finished.

## Acceptance criteria

- [ ] Snake group filling and Berger order are tested through the engine interface, including uneven groups.
- [ ] The same random seed gives the same draw.
- [ ] Score validation is tested:
  - [ ] a game goes to 11 with a 2-point lead, and past 10–10 the lead must be exactly 2
  - [ ] no games after the match is decided
  - [ ] the winner has exactly the games to win
- [ ] Game-by-game points are mandatory for group matches.
- [ ] Calling a match records the time it was assigned; recording the result records the finish time. Both are passed in, not read from the clock.
- [ ] Standings order by group points; finished matches count.
- [ ] On the canvas you can pan (drag) and zoom (wheel and buttons); group boxes and match cards render.
- [ ] The match popover can assign a free table, and score entry works with Enter and Esc and shows validation errors inline.
- [ ] A basic waiting list shows the ready matches.

## Blocked by

- #0002

---
id: 23
title: Mirrored play-off layout on the canvas
status: done
labels: [ready-for-agent]
created: 2026-10-24
---

# 0023: Mirrored play-off layout on the canvas

## Parent

#0012

## What to build

In a play-off block, the winners match and the losers match were stacked in one column and shared one connector line, so the block looked broken. With #0024 every play-off is one round, and its halves are play-offs of their own. Lay them out as a tree that grows both ways:

- **Mirrored:** the losers' half sits to the left of the play-off that feeds it, with connectors from the feeders' left edges. The winners' half sits to the right, as before. Deeper halves keep to their parent's side, winners above losers (9–16: 9–10 and 11–12 both to the right of 9–12, 13–14 and 15–16 both to the left of 13–16).
- **Switch above each half:** each play-off keeps its title, hint and on/off switch above its own column.
- **The double elimination losers bracket mirrors too:** LR1 sits just left of winners round 1, each LR1 match level with its two feeders and linked to them by dashed lines. The rounds run leftwards, with the 2nd final one column further left, level with the losers final.
- **A board-wide "losers: left / below" switch** in the canvas toolbar keeps the old stacked layout available. It's a display preference saved per device (localStorage), not tournament data.

## Acceptance criteria

- [x] 9–12 with 9–10 and 11–12 on: 11–12 is to the left of 9–12 and 9–10 to the right, and no connector shares a line with another.
- [x] The switch moves the halves below the play-off instead, and the choice survives a reload.
- [x] Checked in the browser with a screenshot.

## Blocked by

#0024

## Resolution

Not committed yet. Play-off sections carry `tree` (key, relative column, parent), and `layoutTree` in `bracketLayout.ts` places each tree as one block. Cards are centred on their feeders, and each column's blocks are pushed down past each other. Connectors run between the blocks of a tree, leftward for a losers' half. A loser's line leaves 8px below the winner's line and turns on its own vertical, so the two never share a stroke. Play-off labels are compact (hint on a second line, within the column). `usePlayOffLayout` stores `left` / `below` in localStorage (`tm:view:playOffLayout`). The canvas toolbar button shows when a stage has play-offs. Double elimination: `LayoutSection.flow: 'left'` (rounds run leftwards from `column`), `beside` (start level with another section) and `level` (first card level with a match), `linkFrom` (centre on and draw lines from feeders of another section in the next column). After placement the board is shifted so it starts at x 0. Checked in the browser on an 8-entry double elimination as well. Checked in the browser: a migrated v11 tournament (16-entry SE, 9–16 split to single places) in both layouts, switching levels on and off, and the choice surviving a reload.

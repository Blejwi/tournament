---
id: 8
title: Draw editing before confirm
status: open
labels: [ready-for-agent]
created: 2026-10-22
---

# 0008: Draw editing before confirm

## Parent

#0001

## What to build

Until a stage is **confirmed**, the **operator** can fix its **draw** by hand on the canvas:

- drag a player onto another group or bracket position to move or swap them
- re-draw with a fresh random draw

Confirming locks the draw.

## Acceptance criteria

- [ ] `swapSlots` and `movePlayer` work on unconfirmed groups and brackets, and are rejected after confirmation.
- [ ] Re-draw gives a new draw with a different random seed; seeded entries stay on their positions.
- [ ] The canvas has a draw-editing mode with drag-and-drop, and a clear Confirm action.
- [ ] Group standings and the match list update to reflect the moves.

## Blocked by

- #0003
- #0007

---
id: 29
title: Narrower cards, bigger display text, manual competition controls
status: in-progress
labels: [ready-for-agent]
created: 2026-11-23
---

# 0029: Narrower cards, bigger display text, manual competition controls

## Parent

#0028

## Problem Statement

After #0028 the display's big competitions are still small on screen, and the operator's play screen has the same wasted space next to names (cards 292 px wide). The display's text is also small for a hall, and the operator has no way to put a particular competition on the display without waiting for the cycle.

## Solution

1. The play screen's bracket cards and group boxes get narrower (full names kept; long names are cut with an ellipsis and the full name in a tooltip). The printout keeps its own widths.
2. The display's cards and group boxes get narrower still, sized for the short names, with larger text in the content and in the sidebar.
3. The display's controls (shown on mouse move) get previous/next buttons and a chip per competition, plus the ←/→ keys. Choosing one shows that competition at once and restarts the 20 s countdown from there, so the automatic cycle carries on from the chosen competition.

## User Stories

1. As an operator, I want narrower match cards and group boxes on the play screen, so that more of a big bracket fits without scrolling or zooming.
2. As an operator, I want long names cut with an ellipsis and the full name in a tooltip, so that a narrow card never breaks the layout.
3. As an operator, I want the printout unchanged, so that the record keeps its layout.
4. As a player, I want the display's cards narrower and its text larger, so that the content reads from a distance.
5. As an operator, I want previous/next buttons and the competition names on the display's controls, so that I can show a competition on request.
6. As an operator, I want ←/→ to step through the competitions on the display, so that I can drive it from the keyboard.
7. As an operator, I want a manual choice to restart the 20 s countdown and the cycle to carry on from there, so that the display goes back to cycling by itself.

## Implementation Decisions

- Widths: `CARD_W` (292) stays as the printout's width; the play screen uses `PLAY_CARD_W` (220) and the display `DISPLAY_CARD_W`. `MatchCard` fills the width its parent gives it; `BracketBoard`/`GroupBox` pick the width. Group boxes shrink to two narrow card columns.
- Display text: larger font sizes in `MatchCard`, `GroupBox` and the sidebar when the display mode is set.
- Cycle: `useCycle` gets `goTo(index)` / `step(±1)`: it sets the shown competition and `since = now`. The controls and the keys call it. The controls only show with two or more competitions in the cycle.
- No engine change, no schema change. The cycle logic lives in the UI hook; ADR 0004 keeps UI out of unit tests, so it is checked in the browser.

## Acceptance Criteria

- [ ] Play screen cards are narrower, names stay full, long ones truncate with a `title`; the printout is unchanged.
- [ ] Display cards are narrower than before and text is larger; effective text size (scale × font) is reported before/after at 1920×1080.
- [ ] Display controls: previous, next, one chip per competition, ←/→; a choice restarts the 20 s countdown and the cycle continues from it.
- [ ] EN and PL keys for the labels and aria-labels.
- [ ] Checked at 1920×1080 and 1280×800; tests, build and lint green.

## Out of Scope

- Short names on the play screen.
- Paging a big competition's content.

---
id: 29
title: Narrower cards, bigger display text, manual competition controls
status: done
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

- [x] Play screen cards are narrower, names stay full, long ones truncate with a `title`; the printout is unchanged.
- [x] Display cards are narrower than before and text is larger; effective text size (scale × font) is reported before/after at 1920×1080.
- [x] Display controls: previous, next, one chip per competition, ←/→; a choice restarts the 20 s countdown and the cycle continues from it.
- [x] EN and PL keys for the labels and aria-labels.
- [x] Checked at 1920×1080 and 1280×800; tests, build and lint green.

## Out of Scope

- Short names on the play screen.
- Paging a big competition's content.

## Resolution

Done in 77f3500.

**Built**
- Play screen: bracket cards 220 px (were 292) and group boxes 474 px (were 628). Full names stay; long ones are cut with an ellipsis and carry the full name in a `title`. The printout keeps `CARD_W` = 292. `MatchCard` now fills the width its parent gives it.
- Display: cards 170 px (were 200), group boxes 388 px (were 440); card text 13 px (was 11), group text one size up, sidebar names 24 px (were 18–20), smaller on screens under 1400 px so nothing is cut at 1280. Groups that feed a bracket now sit beside it instead of above it, which is what actually raises the scale.
- Display controls (shown on mouse move): previous/next, a chip per competition, ←/→ keys. A choice shows that competition at once and restarts the 20 s countdown (`goTo` in `useCycle`); the cycle continues from it. EN and PL keys `display.previousCompetition`, `nextCompetition`, `competitions`.

**Measured** (1920×1080, the 36-player seed, "Open": 8 groups → 16-entry bracket). Content scale 0.32 (before #0028) → 0.52 (after #0028) → **0.60**. Card text on screen (font × scale): 3.6 px → 5.7 px → **7.8 px**. Sidebar names: 18–20 px → **24 px**. At 1280×800 "Open" is at scale 0.42 and the sidebar fits all 8 tables. Play screen at 1366×768: all cards 220 px, full names, nothing truncated for the seed's names.

**Deferred**
- No unit test for the cycle: ADR 0004 keeps tests to the engine, and the logic is a state update in the UI hook; checked in the browser (keys, chip click, countdown reset).
- A very long name on the play screen was not tried (the truncation is plain CSS).
- With many more tables than 8 the sidebar list is cut off (it doesn't scroll).

---
id: 30
title: Display pages and bigger bracket text
status: in-progress
labels: [ready-for-agent]
created: 2026-11-23
---

# 0030: Display pages and bigger bracket text

## Parent

#0028

## Problem Statement

Even after #0028 and #0029 a big competition is shown at a content scale of about 0.6, so bracket card text (13 px) is about 8 px on screen: too small to read from a few metres. Fitting a whole competition on one screen can't give readable text, and a display that keeps showing finished groups and early rounds wastes its time on what no longer matters.

## Solution

The display's bracket text gets bigger (15 px), and the content is split into **pages** instead of being shrunk: a page is never shown below a minimum scale (`DISPLAY_MIN_SCALE`), chosen so card text is about 20 px on screen at 1920×1080. The display cycles through the pages (`PAGE_SECONDS` = 12) instead of the competitions. Only what is current is shown.

- Bracket of up to 16 entries: one page. 32 entries: top half, bottom half, then the semi-finals + final (+ 3rd place). Double elimination: the winners bracket, the losers bracket (in groups of rounds when it is wide), the 2nd final; each place play-off tree is its own block. Small blocks share a page when they fit.
- Groups: as many boxes per page as fit at the minimum scale (about 4, a 2×2 grid). A box shows the standings plus the match in play and the next one.
- Current only: once the stage after a groups stage has started, groups that are finished drop out. A bracket page starts at the earliest round column that still has an unfinished match. A finished competition still shows its final page(s).
- The header says where we are: "Open · Drabinka 2/3". ←/→ and the previous/next buttons step through pages; a competition chip jumps to its first page; any manual step restarts the 12 s countdown. The sidebar (tables ↔ next matches, 8 s) is unchanged.

## User Stories

1. As a player, I want bracket text of about 20 px on screen, so that I can read it from a few metres.
2. As a player, I want big competitions split into pages, so that nothing is shrunk below a readable size.
3. As a player, I want finished groups and finished early rounds left out once play has moved on, so that the screen shows what is current.
4. As a player, I want a group's box to show the match in play and the next one, so that I know who plays next in my group.
5. As a player, I want a finished competition to still show its final page, so that I can see the result.
6. As a player, I want the header to say which page I'm on ("Open · Drabinka 2/3"), so that I know what's coming.
7. As an operator, I want ←/→, previous/next and the competition chips to move between pages and restart the countdown, so that I can show a page on request and the cycle carries on from it.
8. As an operator, I want the printout and the play screen unchanged.

## Implementation Decisions

- **Engine:** `getDisplayFocus(state, competition, now)` returns, per stage, `started`, `finished` and (groups stages) the groups to show with the ids of their current matches (the one in play, then the next one). A groups stage shows all its groups, or only the unfinished ones once a later stage has started. "Started" = some match that isn't decided by a BYE is ready, in play or done.
- **Which rounds are current** is decided in the UI from the laid-out bracket (a column is finished when none of its cards is open); it follows the layout's geometry, which only the UI has.
- **Page planner:** `planBracketPages` in `ui/print/printPlan.ts` gets options (page size, minimum scale, card width, maximum scale, the region to plan); its defaults are the printout's, so the printout is unchanged. The display's planner (`ui/display/pagePlan.ts`, pure, no DOM) splits a stage into blocks, drops what's finished, plans each block and packs small blocks onto one page, using the measured size of the content area. It uses the `below` play-off layout (everything flows right), whatever the operator chose for the canvas.
- **Rendering:** `BracketBoard`'s `crop`; `GroupBox` gets a `shownMatches` prop for the display.
- **Cycle:** `useCycle` runs over pages (keyed by competition, stage and page number); the current page stays while it still exists.

## Testing Decisions

- Engine: `displayFocus.test.ts` first, through `execute` + the query.
- The planner and rendering are UI and are checked in the browser with seeds at different points of progress (ADR 0004).

## Acceptance Criteria

- [ ] Display bracket text is larger; on-screen size (font × scale) is reported before and after.
- [ ] Pages per competition as described; page counts reported before and after.
- [ ] Finished groups / early rounds drop out as the competition progresses; a finished competition still shows its final page(s).
- [ ] Header "Name · Drabinka n/m" (EN and PL); controls step pages and restart the countdown; chips jump to a competition's first page.
- [ ] Printout and play screen unchanged; tests, build and lint green.
- [ ] Checked at 1920×1080 and 1280×800.

## Out of Scope

- Short names on the play screen; configurable page time or minimum scale.

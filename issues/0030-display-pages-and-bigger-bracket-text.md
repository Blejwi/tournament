---
id: 30
title: Display pages and bigger bracket text
status: done
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

- [x] Display bracket text is larger; on-screen size (font × scale) is reported before and after.
- [x] Pages per competition as described; page counts reported before and after.
- [x] Finished groups / early rounds drop out as the competition progresses; a finished competition still shows its final page(s).
- [x] Header "Name · Drabinka n/m" (EN and PL); controls step pages and restart the countdown; chips jump to a competition's first page.
- [x] Printout and play screen unchanged; tests, build and lint green.
- [x] Checked at 1920×1080 and 1280×800.

## Out of Scope

- Short names on the play screen; configurable page time or minimum scale.

## Resolution

Done in 23eb769.

**Built**
- Engine: `getDisplayFocus(state, competition, now)` (`displayFocus.test.ts`, 6 tests): per stage `started` / `finished`, and for groups stages the groups still current (all, or only the unfinished ones once the next stage has started) with their current matches (in play, then next).
- `planBracketPages` takes options (page size, minimum scale, card width, maximum scale, region); the defaults are the printout's. The display planner `ui/display/pagePlan.ts` (pure) splits a bracket into blocks (play-off trees, double-elimination parts), drops leading rounds that are finished (and lays the rest out again so it stacks compactly), keeps a finished bracket's last two rounds, plans each block and stacks parts that fit one page. Groups: boxes per page from the space at the minimum scale, evenly spread.
- Display: card text 15 px, card width 200, `DISPLAY_MIN_SCALE` = 1.3 (eased to as low as 1.1 on screens narrower than 1920), `PAGE_SECONDS` = 12 replaces the 20 s per competition. Header "Open · Drabinka 2/3" (EN and PL), previous/next page, ←/→, competition chips jump to a competition's first page; every manual step restarts the countdown. Group boxes show standings plus the match in play and the next one.

**Measured** (seed: 36 players → 8 groups → 16 bracket "Open", 32-entry single elimination "Cup32", 16-entry double elimination "DE16"; the display at 1920×1080; text on screen = font × scale)
- Before (#0029), "Open" on one screen: scale 0.60, card text 13 px → 7.8 px; 1 page per competition.
- After, groups in play: Open 2 group pages (4 groups each, 26 px) + 1 bracket page (21 px); Cup32 3 pages (19.5–22 px); DE16 4 pages (21–30 px).
- After, groups done and bracket in play: Open 1 page (QF onward, 29 px); Cup32 1 page (QF onward + 3rd place, 29 px); DE16 2 pages (19–29 px).
- At 1280×800 (minimum scale 1.1): Open 4 group pages + 3 bracket pages (18–24 px), DE16 up to 5 pages (19–24 px), Cup32 1 page (18 px) once the early rounds are done.

**Deferred**
- At 1280×800 the first two pages of a fresh 32-entry bracket are at scale 0.93 (14 px): the top/bottom split doesn't split a half again.
- The "Cup32 first-round" page counts above were measured only at 1920×1080 and 1280×800; no 64-entry bracket was tried.
- A stray connector stub shows at the right edge of a cropped losers-bracket block.
- The "before" figures are for Open only (measured earlier); Cup32 and DE16 weren't measured at #0029.
- The planner and the paging are UI, so they're checked in the browser, not unit-tested (ADR 0004).

## Follow-up: tabs and optional splitting

- Navigation is now a persistent tab bar under the header: a tab per competition and, under it, a tab per page of the competition on screen (e.g. "Grupy 1/2", "Drabinka"). The current tab is marked; a click goes there at once and restarts the 12 s countdown. ←/→ still step through the pages. The previous/next buttons and the chips in the hover controls are gone.
- Page splitting is a per-competition setting (screen settings, "Split into pages"), kept per tournament in this browser under `tm:display-unsplit:<id>`. With it off the competition is one page: all its groups with all their matches beside its whole bracket, fitted to the screen as before #0030 (Open: scale 0.59 at 1920×1080).
- Splitting is now **off by default** (opt-in per competition, key `tm:display-split:<id>`; the earlier `tm:display-unsplit` key is no longer read). A competition shown whole no longer stacks its main bracket and play-offs in one tall strip: the groups, the main bracket and each play-off tree are placed in 1–4 columns (each piece under the shortest column), keeping the number of columns that lets the whole be drawn largest, so the screen's sides are used. A 32-entry bracket with three play-offs went from a tall narrow strip to scale 0.69 across the full width at 1920×1080. Play-offs that were never switched on (just a title) are left out.
- Leaving out what is finished is now an option, **off by default**: with page splitting on, everything shows (all groups, every bracket round, finished play-offs). Per competition, "Leave out what is finished" (key `tm:display-hide-finished:<id>`) restores the current-only behaviour: finished groups once the next stage has started, early finished rounds, finished blocks. Group boxes on split pages still show only the match in play and the next one.
- Pages stay on screen longer: `PAGE_SECONDS` 12 → 20.
- Every competition ends with a **final places** page (tab "Miejsca końcowe" / "Final places"), once at least one place is decided, in split and unsplit mode. One card per place or shared range (1, 2, 3 in gold, silver, bronze), the short names in it (club too for small cards), and a single line for how many places are still undecided; it grows as the competition goes on. It uses the engine's existing `getFinalPlaces`.
- The final places page is a **table of every entry** so people can see whether they are still playing: first those still in (green "Gra" / "Playing"), then the places decided so far, best first, with the place or shared range and "Koniec" / "Finished" (or "Wycofał się" / "Withdrew"). It is laid out in 1–3 table columns by size (36 entries: 3). It replaces the card layout; the "places still to be decided" line is gone since the "playing" rows say it.
- The tab bar takes a little height, so the group box estimate was tightened (`GROUP_BOX_H` 290) to keep 4 groups per page.

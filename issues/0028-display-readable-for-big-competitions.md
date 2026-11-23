---
id: 28
title: Display screen readable for big competitions
status: done
labels: [ready-for-agent]
created: 2026-11-23
---

# 0028: Display screen readable for big competitions

## Parent

#0026

## Problem Statement

For a big competition (30–40 players, groups → a 16-entry bracket) the display screen (#0026) fits all groups and the bracket onto one screen, so everything ends up at about a third of its real size and can't be read from across a hall. Space is wasted: the tables strip across the top takes height from the competition, and bracket cards are wide enough for full names that mostly don't need that much room.

## Solution

Three changes to the display only. (1) The tables strip leaves the top; tables join the right sidebar, which alternates between tables and the next matches on a faster cycle than the competitions. (2) Bracket cards (and, where cheap, group boxes) are narrower on the display, so the fit step can scale the content up. (3) The display shows short player names, "Kowalski J.", with the full first name for players whose short names would clash.

## User Stories

1. As a player, I want the competition to get the full height of the screen, so that it can be drawn larger.
2. As a player, I want the sidebar to alternate between the tables and the next matches, so that I see both without a strip eating the competition's space.
3. As a player, I want to see which sidebar view is up and when it changes, so that I know when to look again.
4. As a player, I want bracket cards sized for short names, so that the bracket is readable from a distance.
5. As a player, I want names as surname and first initial ("Kowalski J."), so that they stay short and readable.
6. As a player, I want two players who would share a short name to show their full first names ("Kowalski Jan", "Kowalski Jakub"), so that I never confuse them.
7. As an operator, I want the play screen and the printout unchanged, so that the operator's tools and the record keep full names and their layout.

## Implementation Decisions

- **Engine:** a pure query `getDisplayNames(state)` returns a record from player id to display name, built from `state.players`. Short name = last name + first initial + ".". If two or more players share a short name (case-insensitive), those players get last name + full first name instead. Missing first or last name: the other part alone. Same result everywhere on the display. Exported from `@/engine`.
- **Sidebar:** `SIDEBAR_CYCLE_SECONDS = 8` (named constant next to `CYCLE_SECONDS`). The sidebar shows a tables view (every active table: number, free/busy, the match and its timer) and the next-matches view in turn, with a title, a small two-dot/label indicator of which view is up and a progress bar. The top tables strip is removed.
- **Compact mode:** a display mode next to the existing print mode. `layoutBracket` takes the card width as a parameter (default unchanged, so the play screen and print layout are untouched); `BracketBoard`, `MatchCard` and `GroupBox` get a `compact` mode used only by the display. The mode and the name map reach the components through a small React context, so the play screen needs no new props.
- No schema change, no migration.

## Testing Decisions

- Engine query tested first in `src/engine/__tests__/displayNames.test.ts` through `execute` + the query: short form, clash (both get full first names, others stay short), clash is case-insensitive, three-way clash, same surname different initials stay short, empty parts.
- UI checked in the browser at 1920×1080 before and after with a seeded big tournament, reporting the effective content scale.
- `npm test`, `npm run build`, `npm run lint` stay green.

## Acceptance Criteria

- [x] No tables strip across the top; the competition gets the full height.
- [x] The right sidebar alternates tables ↔ next matches every `SIDEBAR_CYCLE_SECONDS` (8 s), shows which view is up and a progress bar.
- [x] Display bracket cards are narrower; groups tightened where cheap; the content is scaled up compared to before.
- [x] Names on the display (brackets, groups, tables view, next matches) are "Surname I."; clashing players show "Surname Firstname".
- [x] `getDisplayNames` is pure, tested, exported via `@/engine`.
- [x] The play screen and the printout look and behave as before.
- [x] EN and PL keys for new text.
- [x] Tests, build and lint green.

## Out of Scope

- Paging a big competition's content over several screens.
- Changing the competition cycle or its settings.

## Resolution

Done in 1fb872b.

**Built**
- Engine query `getDisplayNames(state)` (player id → "Kowalski J."; full first name for players whose short names clash), tested in `displayNames.test.ts`, exported from `@/engine`.
- The top tables strip is gone. The right sidebar alternates a tables view and the next-matches view every `SIDEBAR_CYCLE_SECONDS` = 8 s, with both headings (the one up is marked) and a progress bar. New key `display.tablesEmpty` in EN and PL.
- Display mode (`play/displayMode.ts`, a context next to `print`): bracket cards `COMPACT_CARD_W` = 200 instead of 292 (`layoutBracket` takes the width, default unchanged), group boxes 440 instead of 628 px with a wider grid, short names in brackets, groups, tables and next matches. The play screen and printout don't set it, so they are unchanged.

**Checked in the browser** at 1920×1080 with a seeded tournament (36 players: 8 groups → 16-entry bracket, plus a 12-player bracket "Juniors"; Jan and Jakub Kowalski clash). Effective content scale of the "Open" competition: **0.32 before, 0.52 after** (about 60% larger); the clash shows as "Kowalski Jan" / "Kowalski Jakub". The sidebar switched views every 8 s. The play screen still shows full names. Tests, build and lint (src) green.

**Deferred**
- The content is still height-bound (groups stacked over the bracket). Putting the groups and the bracket side by side on wide screens would raise the scale further.
- 1280×800 not re-checked.

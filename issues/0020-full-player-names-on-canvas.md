---
id: 20
title: Full player names on the canvas
status: done
labels: [ready-for-agent]
created: 2026-10-23
---

# 0020: Full player names on the canvas

## Parent

#0001

## What to build

Names on the play canvas must not be shortened. Today match cards, group boxes and bracket slots show abbreviated names such as "J. Kowalski". Show the full first and last name ("Jan Kowalski") everywhere on the canvas, keeping the origin label next to it ("Jan Kowalski · 1A").

- Cards, group standings rows and bracket slots grow or wrap to fit the full name rather than truncating it with an ellipsis or initials. Layout code that assumes a fixed card width (bracket connector positions) must still line up.
- The same applies to the canvas popovers and the waiting list, and to the tables panel where there is room. Where a panel is genuinely too narrow, it wraps the name onto two lines instead of abbreviating it.
- Remove the name-shortening helper from canvas use. Keep it only if another surface still needs it, and name that surface in the report.

## Acceptance criteria

- [ ] No canvas surface (match cards, group boxes, bracket slots, popovers) shows an abbreviated name.
- [ ] Long names (e.g. "Aleksander Wieczorek-Jabłoński") don't break the bracket connector lines or overlap neighbouring cards. Check this in the browser for a groups stage and a 16-entry bracket.
- [ ] The waiting list and the tables panel show full names, wrapping instead of truncating.

## Blocked by

None (can start immediately)

## Resolution

Done on `integration/v1` in 404855e and b9eafd4. Names are never abbreviated (the `short` option is gone from `playerName`, `entryName` and `slotText`). Match cards are wider (`CARD_W` 292) and wrap long names; group boxes, popovers, the waiting list and the tables panel wrap instead of truncating. Checked in the browser with long names on groups and a 16-entry bracket.

---
id: 7
title: Direct single elimination
status: in-progress
labels: [ready-for-agent]
created: 2026-10-22
---

# 0007: Direct single elimination

## Parent

#0001

## What to build

A competition whose stage is a single elimination **bracket** of 8, 16, 32 or 64 entries, with at least 8 entries.

- **Seed positions:** seeded entries go to the standard seed positions; for 16, top to bottom: 1, 16, 9, 8, 5, 12, 13, 4, 3, 14, 11, 6, 7, 10, 15, 2. Unseeded entries get random numbers.
- **BYEs:** BYEs take the highest numbers, and a match against a BYE resolves on its own.
- **Slots point to their source:** each slot refers to "winner of match X" rather than copying the player (ADR 0003).
- **3rd place:** an optional 3rd-place match.
- **Quick results:** bracket matches accept a games-only result, e.g. 3:1.
- **Canvas:** the bracket is drawn with connector lines, and pending slots show their source, e.g. "W QF1".

## Acceptance criteria

- [ ] The seed position order is tested for 8, 16, 32 and 64.
- [ ] BYE placement is tested, e.g. 13 entries in 16 → 14, 15 and 16 are BYEs, and seeds 1–3 advance automatically.
- [ ] Recording a result advances the winner into the next match. With a 3rd-place match, the semi-final losers go into it.
- [ ] Final places are derived: 1st, 2nd, 3rd/4th (or a shared 3–4 without the 3rd-place match), then shared ranges.
- [ ] A games-only result is accepted for bracket matches and rejected for group matches.
- [ ] The canvas renders the bracket with connectors, and the match popovers work.

## Blocked by

- #0003

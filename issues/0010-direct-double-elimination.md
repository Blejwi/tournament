---
id: 10
title: Direct double elimination
status: done
labels: [ready-for-agent]
created: 2026-10-22
---

# 0010: Direct double elimination

## Parent

#0001

## What to build

A double elimination bracket for 8, 16, 32 or 64 entries, built like the user's 16-player paper sheet (ADR 0002):

- **Winners bracket:** M1–M8 → A–D → E, F → G (the **WB final**).
- **Losers bracket (LR = losers round):**

  | Round | Matches | Losers' place range |
  |---|---|---|
  | LR1 | Round-1 losers play in pairs | 13–16 |
  | LR2 | LR1 winners vs **drop-ins** from D, C, B, A (crossed) | 9–12 |
  | LR3 | LR2 winners play each other | 7–8 |
  | LR4 | LR3 winners vs drop-ins from F and E (crossed) | 5–6 |
  | LR5 | The two LR4 winners | 4th |

- **Places:**
  - The WB final winner is champion.
  - The WB final loser plays the LR5 winner in the **2nd final**: its winner is 2nd and its loser 3rd.
  - There is no grand final.

Other sizes follow the same rules. On the canvas, the winners bracket, losers bracket and 2nd final are drawn as labelled sections.

## Acceptance criteria

- [ ] Golden test for 16: every match's two slot sources and place range match the sheet exactly (the table above, plus the seed positions).
- [ ] Structure tests for 8, 32 and 64: match counts, crossed drop-ins in every losers round, and shared place ranges.
- [ ] Playing through a full 16-entry event gives the correct 1st, 2nd and 3rd, plus the 4th place and shared ranges.
- [ ] BYEs in the winners bracket send a pass into the losers bracket correctly: the opponent of a missing drop-in advances.
- [ ] The canvas shows the labelled sections with connectors.

## Blocked by

- #0007

## Resolution

Done on `integration/v1` in f0c6fdf, 8631587, 6c0f945 and d6bbd58, plus the coordinator test fix 46dc025. Double elimination for 8/16/32/64 per ADR 0002: golden test against the 16-player sheet, crossed drop-ins, losers-round place ranges, and the WB final winner as champion with the 2nd final deciding 2nd and 3rd. Schema v8. On the canvas the winners bracket, losers bracket and 2nd final are labelled sections, and drop-ins between sections show as slot labels rather than lines. For #0012: `bracketRound(stage, 'losers', k)` and `sharedPlaceRanges(stage)`. Not checked in the browser.

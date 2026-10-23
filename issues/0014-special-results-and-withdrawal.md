---
id: 14
title: Walkover, retirement, disqualification and withdrawal
status: in-progress
labels: [ready-for-agent]
created: 2026-10-22
---

# 0014: Walkover, retirement, disqualification and withdrawal

## Parent

#0001

## What to build

Special results:

- **Walkover**
- **Retirement**, which keeps the games played so far
- **Disqualification**

All three advance the winner correctly. In standings a walkover loss is worth 0 group points.

**Withdrawal:** the player's remaining matches in that competition become walkovers, and the results already played are kept.

## Acceptance criteria

- [ ] Each special result can be recorded from the match popover and shows as a badge.
- [ ] Standings: a walkover counts as a win for the winner and 0 points for the loser; a retirement's games count in the ratios.
- [ ] In brackets, all three advance the winner; in double elimination the loser drops into the losers bracket.
- [ ] Withdrawal turns all remaining matches of that player in that competition into walkovers, including matches still pending.

## Blocked by

- #0007

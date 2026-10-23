---
id: 14
title: Walkover, retirement, disqualification and withdrawal
status: done
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

## Resolution

Done on `integration/v1` in c89eaa8, 0ff9433, 41f7aa2, d67c5e4 and 0e82b0a, merged in 5268571. Adds walkover, retirement (with the games played) and disqualification results, and `withdrawPlayer` (the remaining matches become walkovers). These are correct in standings, single elimination and double elimination, where the loser drops into the losers bracket. The popover has special-result entry and badges, and the competition screen has a Withdraw button. The change log records `specialResultRecorded` and `playerWithdrew`. Walkovers count toward progress but not toward durations. Schema v9. Not checked in the browser.

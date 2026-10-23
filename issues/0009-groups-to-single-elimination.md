---
id: 9
title: Groups → single elimination
status: open
labels: [ready-for-agent]
created: 2026-10-22
---

# 0009: Groups → single elimination

## Parent

#0001

## What to build

A competition with groups followed by a single elimination bracket. The top 2 of each group are the **advancers**.

**Before the groups finish:**
- The bracket is shown from the start, with **origin label** placeholders ("1A", "2C", "BYE").
- Each placeholder fills with a name as soon as its group is complete.
- The origin label stays next to the name ("Kowalski · 1A").

**Placement algorithm:**
- Bracket size = the number of advancers rounded up to a power of 2.
- 1A goes to the top position and 1B to the bottom; the other group winners follow the seed table in group order.
- In round 1, 1st places play 2nd places.
- 2X never goes in the same half as 1X.
- BYEs go to group winners first, then to runners-up.
- Runners-up are drawn at random among the valid slots.

**Confirming:** the bracket can be confirmed only when every group is complete. Before that, it can be edited using #0008.

**Small fields:** a 4-entry knockout (semi-finals, final, optional 3rd place) is allowed only as the stage after groups.

## Acceptance criteria

- [ ] With 4 groups: 1A is at position 1 and 1B at position 8, and every 2X is in the opposite half to 1X. This is tested across several random seeds.
- [ ] With 5 groups (10 advancers → 16, 6 BYEs), BYEs go to 1A–1E first, then to 2A; separation still holds.
- [ ] Placeholders resolve per group as each completes; tiebreak-correct standings are used (#0004).
- [ ] Confirming is rejected until all groups are complete.
- [ ] The 4-entry knockout after 2 groups works; a direct bracket under 8 entries is rejected.
- [ ] The canvas lays out the groups stage, then the bracket, and shows origin labels.
- [ ] Final places (`getFinalPlaces` and the places panel from #0021) cover the whole competition. Bracket places come first, then entries that did not advance from the groups share ranges by group position below the bracket. For example, with 4 groups of 4 into an 8-entry bracket, the 3rd places share 9–12 and the 4th places 13–16. *(Added 2026-10-23: #0021 only classifies the last stage.)*

## Blocked by

- #0004
- #0007
- #0008

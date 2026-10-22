# Match slots point to where their player comes from

A match slot doesn't store a copy of the player. It stores the player's source: a fixed player, a group origin label ("1A"), a BYE, or "winner/loser of match X". Who actually plays is worked out from the results every time it's needed.

We chose this because corrections are a core workflow: operators mistype scores. If players were copied forward, every correction would have to find and rewrite all affected matches by hand. With sources, a correction just changes one result and the draw re-resolves. Placeholder brackets also come for free: a slot with no resolved player yet shows its source, e.g. "1A" or "W QF1".

## Consequences

- A forced correction still has to find matches that already started or finished with a now-wrong player, and reset them. The engine provides a preview of these, so the operator can confirm.
- Brackets fed by groups can be built at the start, before the groups finish, and fill in as each group completes.

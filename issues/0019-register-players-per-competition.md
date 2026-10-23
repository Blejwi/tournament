---
id: 19
title: Register players per competition
status: in-progress
labels: [ready-for-agent]
created: 2026-10-23
---

# 0019: Register players per competition

## Parent

#0001

## What to build

Change the setup flow: the **operator** registers **players** inside the **competition** they play in, not on a separate tournament-wide Players screen first. Usually a person plays in only one competition, so registering and entering them should be a single step.

- **Competition setup:** the competition's entry list gets an "Add player" form (first name, last name, club, optional rating and birth year). Submitting it creates the tournament-level player record and the **entry** in one action.
- **Same person, second competition:** there is also an "Add existing player" picker that searches players already registered in other competitions of this tournament. It creates an entry for the existing player, so the app still knows they're the same person. Busy detection across competitions (#0006) depends on this.
- **Editing:** a player's details can be edited from any competition they're entered in. The change shows everywhere.
- **Removing:** removing an entry whose player has no other entry also removes the player record. Removal is not allowed once the stage is confirmed (the existing rule).
- **The tournament-wide Players screen** goes away as a setup step. If an overview of all players is kept, it is read-only and lists each player's competitions.
- **Engine:** keep one player record per person (ADR 0003 slots and busy detection rely on player ids). Add a command that registers a new player and enters them into a competition in one step, or compose the existing commands so that the change is atomic and logged once. No change to the tournament file format should be needed. If one is needed, follow the schema rules in CLAUDE.md.

The spec (user stories 7–8, Domain model) and GLOSSARY.md (Player) were updated on 2026-10-23 to match.

## Acceptance criteria

- [ ] A player can be registered and entered into a competition in one action. Tested through the engine interface: one command, the entry exists, and the player exists.
- [ ] An existing player from another competition can be entered without re-registration. Busy detection still works across both competitions (existing #0006 tests stay green, plus one test for this path).
- [ ] Removing the last entry of a player removes the player; removing one of two entries keeps the player.
- [ ] The competition setup screen has "Add player" and "Add existing player", with EN and PL strings. Setup no longer requires visiting a tournament-wide Players screen.
- [ ] Navigation and onboarding text no longer send the operator to register players at tournament level first.

## Blocked by

None (can start immediately)

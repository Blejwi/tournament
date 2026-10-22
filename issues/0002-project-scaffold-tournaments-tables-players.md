---
id: 2
title: Project scaffold — tournaments, tables and players
status: done
labels: [ready-for-agent]
created: 2026-10-22
---

# 0002: Project scaffold — tournaments, tables and players

## Parent

#0001

## What to build

The first tracer bullet through every layer:

- **Project:** Vite, React, TypeScript, Tailwind with shadcn/ui, Vitest, Zustand and React Router.
- **Tournament engine:** its command/query skeleton, as a pure module with no React, storage or clock (ADR 0004).
- **Persistence:** a storage adapter over localStorage, with autosave after every command.
- **Translations:** set up from the start, with an EN/PL switch.

The operator can create, open and delete tournaments (name, date, venue). In a tournament they can manage **Tables** (number, optional name, active/inactive) and register **Players** (first name, last name, club, optional rating, optional birth year). Everything survives a page reload.

## Acceptance criteria

- [ ] `npm install` and `npm run dev` start the app, and `npm test` runs Vitest.
- [ ] Engine commands exist and are tested through the engine's public interface: create a tournament, add/update/activate/deactivate/remove a table, add/update a player.
- [ ] Engine queries return the tournament, its tables and its players.
- [ ] There is a tournament list screen: create, open, and delete (with a confirmation).
- [ ] There are tables and players screens inside a tournament.
- [ ] State is saved automatically after each change and restored on reload.
- [ ] Every UI string goes through the translation layer. EN is the default, PL is complete for this ticket's strings, and a language switch is visible.
- [ ] Vocabulary follows GLOSSARY.md, e.g. Table, not "field".

## Blocked by

None (can start immediately)

## Resolution

Done on `integration/v1` in 58e0dfa (project and pure engine) and fb6f34b (store, autosave, i18n and setup screens). Engine interface: `execute(state, command)` → `Result`, with queries `getTournament`/`getTables`/`getPlayers`. Conventions are in CLAUDE.md, under "Code conventions". The shadcn/ui components were written by hand, and `components.json` is ready for `npx shadcn add`.

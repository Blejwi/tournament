# Tournament manager

Frontend-only tournament management app (table tennis first). Spec: `issues/0001-tournament-manager-v1.md`.

Use the domain vocabulary in `GLOSSARY.md` (in code, UI and docs) and respect the decisions in `docs/adr/`.

## Issue tracker

Issues are Markdown files in `issues/` (conventions in `issues/README.md`). Track progress on `issues/BOARD.md`: pick work only from Ready, and update the board when a ticket starts or finishes. Triage labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`.

## Prototypes

Throwaway UI prototypes live on the branch `prototype/ui-variants`, not on `main`.

## Commands

`npm run dev` (Vite), `npm test` (Vitest), `npm run build` (typecheck + build), `npm run lint` (ESLint). Keep all four green. The service worker (offline PWA) exists only in the build: try it with `npm run build && npm run preview`. Deployment, offline behaviour and the SPA fallback: `docs/deployment.md`.

## Code conventions

Folder layout (`@/` = `src/`):

- `src/engine/`: the pure tournament engine (ADR 0004). No React, storage, clock or `Math.random` (ESLint enforces this). Everything else imports it only via `@/engine` (`index.ts` is the public interface).
  - `types.ts` state shape (plain JSON), `errors.ts` the typed `EngineError` union, `result.ts` `Result<T>`.
  - `commands/<area>.ts` command types + handlers; `commands/index.ts` the `Command` union, the handler map and `execute(state, command)`.
  - `queries.ts` (split into `queries/` when it grows): pure `(state, now?)` functions returning fresh view objects.
  - `tournamentFile/`: the tournament file format, used for export/import AND for each stored tournament. `schema.ts` (Zod schema of the current version), `migrations.ts` (one step per old version), `index.ts` (`exportTournament(state)` → JSON text, `importTournament({ id, file })` → `Result<TournamentState>`).
  - `log.ts`: change-log helpers for command handlers (`appendLog`, `loggedMatch`, `loggedTable`); see "How to add a change-log entry".
  - `backupReminder.ts`: `getBackupReminder(state, { now, unsavedSince, postponedUntil? })` (epoch ms); the app tracks those times. "Live" (a match in progress, or a result in the last 30 minutes) is read from `state`.
  - Every time in the engine is epoch milliseconds (`Timestamp`), both command fields (`at`) and query arguments (`now`). The UI gets `now` from `useNow()` (`src/ui/useNow.ts`).
  - `__tests__/`: the only tests. They import `@/engine` alone: set up with commands, assert on queries.
- `src/app/`: thin Zustand store (`store.ts`). Holds the open tournament, calls `execute`, autosaves through `TournamentStorage` after each successful command. Hooks `useApp(selector)` and `useQuery(query, deps)` in `useApp.ts`. No rules here.
- `src/storage/`: `TournamentStorage` interface + localStorage adapter (index key `tm:tournaments`, one document per tournament at `tm:tournament:<id>`). Each document is a tournament file: written with `exportTournament`, read with `importTournament`, so stored tournaments migrate like imported files.
- `src/i18n/`: i18next setup, `en.ts` (source of keys), `pl.ts`.
- `src/ui/`: React. `router.tsx`, `AppShell.tsx`, `screens/`, `components/` (app components), `components/ui/` (shadcn/ui source; `components.json` is set up for `npx shadcn add`).

How to add an engine command:

1. Add a variant `{ type: 'doThing'; ... }` to the area's union in `commands/<area>.ts`. A new area gets a new file whose union is added to `Command` in `commands/index.ts`.
2. Write `doThing(state, cmd): Result<TournamentState>` next to it. Never mutate `state`; return `fail({ code, ...data })` for rule violations. New error codes go in `errors.ts` (data only, no display text).
3. Register it in the `handlers` map in `commands/index.ts` (TypeScript fails until you do).
4. Time and randomness are command fields (`at`, `randomSeed`). Ids the engine makes come from `allocateId` (`ids.ts`); the tournament id is passed in.
5. Test first in `__tests__/` through `execute` + queries. Re-export new queries and types from `index.ts`.

How to change the tournament state shape (new section such as `competitions`, new or renamed field):

1. Change `types.ts`, then the Zod schema in `tournamentFile/schema.ts`. Its `satisfies z.ZodType<...>` makes TypeScript fail until the schema covers the new type. Put cross-item rules (unique ids, unique numbers) on the schema too.
2. Add a migration in `tournamentFile/migrations.ts`: `migrations[n]` turns version n into n+1, e.g. `2: (file) => ({ ...file, schemaVersion: 3, tournament: { ...(file.tournament as object), competitions: [] } })`. `CURRENT_SCHEMA_VERSION` is derived from it. Update the version list in that file's comment. Never edit a released migration.
3. Add a fixture `__tests__/fixtures/schema-v<n>.json` (a file as the previous version wrote it) and a test in `exportImport.test.ts` that imports it. Extend the round-trip test's setup so it covers the new section.
4. Stored tournaments go through the same migrations on load, so nothing else is needed for localStorage.

The change log (#0016) is `state.log` (`LogEntry[]`, oldest first). The file keeps it in its own top-level `log` section, not inside `tournament`. Commands write the entries themselves, so the log is tested through `execute` + `getChangeLog`. Logged today: `matchAssigned`, `matchUnassigned`, `resultRecorded`, `resultCorrected`, `specialResultRecorded`, `playerWithdrew`, `drawSlotsSwapped`, `drawPlayerMoved`.

How to add a change-log entry (one per operator action such as a correction, a walkover, a manual swap or a play-off toggle):

1. Add a variant `{ type: 'thingDone'; at: Timestamp; ... }` to `LogEntry` in `types.ts`. Store a snapshot of everything needed to settle a dispute, as it was at that moment: e.g. `before` and `after` results for a correction, `LoggedMatch` (`match` with the players in each slot) and `LoggedTable` (table number) rather than bare ids, since slots re-resolve and tables get renumbered. Data only, no display text.
2. Add the variant's Zod object to `logEntrySchema` in `tournamentFile/schema.ts` (its `satisfies` fails until you do). A new entry type needs no migration or version bump: older files stay valid.
3. In the command handler, build the new state, then `return ok(appendLog(next, { type: 'thingDone', at: cmd.at, match: loggedMatch(state, cmd.match), ... }))` (helpers in `log.ts`). Take snapshots from the state before the change. The command must have an `at`; add one if it lacks it. Log only on success.
4. Add its view to `ChangeLogEntryView` and the `entryView` switch in `queries/changeLog.ts` (TypeScript fails until you do; resolve names there, e.g. with `resultView`).
5. Show it: add a case to `entryText` in `src/ui/changeLogText.ts` and the `changeLog.thingDone` key in `en.ts` and `pl.ts`.
6. Test first in `__tests__/changeLog.test.ts`: run the command, assert on `getChangeLog(state)[0]`.

The UI runs commands with `useApp((s) => s.dispatch)(command)`, which returns the `EngineError` or `null`; show it with `errorMessage(t, error)`. Read data with `useQuery(getThing)`, never by calling queries inside a `useApp` selector (new objects each call make Zustand loop).

How to add a translation:

1. Add the key to `src/i18n/en.ts`, then to `src/i18n/pl.ts`. TypeScript fails if PL lacks a key or `t('...')` names an unknown one.
2. Every `EngineError` code needs an `errors.<code>` message in both files (enforced). The error's data fields are interpolation values (`{{number}}`).
3. Use `useTranslation()` and `t('area.key')`. Never hard-code UI text, `aria-label`s or titles. Plurals need i18next suffixes (`_one`/`_other` in EN; `_one`/`_few`/`_many` in PL).

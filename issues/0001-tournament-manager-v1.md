---
id: 1
title: Tournament manager v1 (table tennis)
status: open
labels: [ready-for-agent]
created: 2026-10-22
---

# Tournament manager v1 (table tennis)

## Problem Statement

I run table tennis tournaments: one day, one hall, several competitions at once (e.g. Men's Open and U15 Boys) sharing the same set of tables. Today the draws live on paper sheets, which causes problems:

- I keep the waiting matches in my head.
- I walk the hall to see which tables are free.
- When players forget to bring back the score, a table sits blocked without anyone noticing.

The paper rules aren't trivial: seeding positions, groups feeding brackets with group separation, double elimination with drop-ins and place play-offs. Working them out by hand is slow and error-prone.

I need one tool on my laptop that does all of this:

- knows the draws
- tells me which matches can be played now
- shows which tables are free, playing, overdue or idle
- takes scores quickly
- works out the rest by itself

## Solution

A browser app for a single operator. It runs entirely in the browser with no server and keeps all data in local storage. A tournament can be exported to and imported from one JSON file.

**Tournament setup.** The operator creates a tournament with tables and players, then adds competitions. Each competition is a chain of stages:

- groups
- single elimination (optionally with a 3rd-place match)
- double elimination
- optional place play-offs

The operator seeds players and generates draws following standard table tennis rules, then rearranges by hand before confirming.

**The main screen** is a pan/zoom canvas per competition, chosen from the UI prototype (variant A, "Infinite canvas").

- Every stage is drawn left to right: group boxes, then the bracket with connector lines.
- Around the canvas are collapsible panels: tables on the left, the waiting list on the right, and a bottom drawer with stats and the change log.

**Running a match** works like this:

1. The operator picks a ready match and assigns it to a free table; the clock starts.
2. The operator types the score, e.g. `11-7 9-11 11-5 11-8`, and presses Enter.
3. The system advances the players, frees the table and updates the waiting list.

Overdue matches and long-idle tables are highlighted. The UI ships in English (default) and Polish.

## User Stories

### Tournament & setup

1. As an operator, I want to create a tournament with a name, date and venue, so that I can keep several events apart.
2. As an operator, I want a list of all my tournaments stored in the browser, so that I can reopen past or upcoming events.
3. As an operator, I want to delete a tournament after confirming, so that old test data doesn't clutter the list.
4. As an operator, I want to define tables with a number (ID) and an optional name, so that I can match them to the physical tables in the hall.
5. As an operator, I want to add or remove tables during the tournament, so that I can react when tables are added or taken away.
6. As an operator, I want to mark a table inactive (broken, reserved) and active again, so that no match is suggested for it while it's unavailable.
7. As an operator, I want to register players inside the competition they play in (first name, last name, club, optional rating and optional birth year/category), so that setting up a competition is one list and most players, who play only one competition, are entered in a single step. *(Changed 2026-10-23, see #0019.)*
8. As an operator, I want to add someone already registered in another competition by picking them from the tournament's players, so that juniors can play both U15 and Open without being retyped, and the app still knows they're the same person (busy detection).
9. As an operator, I want to add several competitions to one tournament, so that they share the tables and can run at the same time or one after another.
10. As an operator, I want to set the games-to-win per competition (2, 3 or 4, default 3), so that the match format fits the category.
11. As an operator, I want to configure a competition as a chain of stages, so that I can build: direct single elimination, direct double elimination, groups only, groups → single elimination, groups → double elimination, or groups → groups (→ bracket).
12. As an operator, I want to choose a 3rd-place match for single elimination, so that 3rd and 4th are decided on the table.
13. As an operator, I want to set the expected match duration for each games-to-win format (defaults: 2 → 15 min, 3 → 25 min, 4 → 35 min), so that overdue detection fits my event.
14. As an operator, I want to switch the UI language between English and Polish, so that I and my helpers can use the language we're comfortable with.

### Seeding and draws

15. As an operator, I want to give explicit seed numbers to players with a known ranking, so that the strongest players are separated in the draw.
16. As an operator, I want unseeded players to be assigned randomly, so that the draw is fair.
17. As an operator, I want to move or swap players by drag-and-drop after the random draw and before confirming, so that I can fix the draw by hand.
18. As an operator, I want to re-draw a stage before confirming it, so that I can get a fresh random draw.
19. As an operator, I want to confirm a stage's draw, so that its matches become playable and the draw is locked.
20. As an operator, I want groups filled snake-style by seed (1 → A, 2 → B, … back again) with the rest random, so that seeded players are spread across groups.
21. As an operator, I want to choose the number of groups or the group size, with uneven groups allowed, so that any number of entries fits.
22. As an operator, I want the matches in a group to follow the standard round-robin (Berger) order, so that nobody plays twice in a row where avoidable.
23. As an operator, I want brackets of 8, 16, 32 or 64 using the standard seed positions (for 16, top to bottom: 1, 16, 9, 8, 5, 12, 13, 4, 3, 14, 11, 6, 7, 10, 15, 2), so that seeds 1 and 2 can only meet in the final.
24. As an operator, I want BYEs to take the highest seed numbers when the field is smaller than the bracket (13 players in a 16 bracket → slots 14, 15, 16 are BYEs), so that the top seeds get the free passes.
25. As an operator, I want a BYE match to resolve automatically, so that the player advances without me entering anything.
26. As an operator, I want a direct bracket to need at least 8 entries, so that small fields use groups instead.

### Groups → bracket

27. As an operator, I want only the top 2 of each group to advance, so that the bracket is built from group winners and runners-up.
28. As an operator, I want group → bracket placement to follow my rules, so that the bracket is fair and same-group players meet as late as possible:
    - bracket size = the number of advancers rounded up to a power of 2, with missing players as BYEs
    - 1A goes to the top position and 1B to the bottom
    - the other group winners take the next seed numbers in group order (1C = seed 3, 1D = seed 4, …)
    - in round 1, 1st places play 2nd places
    - 2X is never in the same half as 1X
    - BYEs go to group winners first (in group order), then to runners-up
29. As an operator, I want runners-up drawn randomly among the slots allowed by the separation rule, so that the draw is not predictable.
30. As an operator, I want a 4-player single-elimination knockout (semis, final, optional 3rd place) allowed only as the stage after groups, so that 2 groups × top 2 works.
31. As an operator, I want the bracket to show placeholders ("1A", "2C", "BYE") from the start, so that I can see the whole structure before the groups finish.
32. As an operator, I want each placeholder to fill with a name as soon as its group is complete, so that I can see who is through.
33. As an operator, I want the bracket confirmable (and runners-up drawable) only once every feeding group is complete, so that separation can be applied correctly.
34. As an operator, I want every slot fed from a group to keep its origin label next to the name ("Kowalski · 1A"), so that I always know where a player came from.

### Groups → groups

35. As an operator, I want to fill phase-2 groups snake-style by place (all 1st places in group order, then all 2nd places), separating players from the same phase-1 group where possible, so that phase 2 is balanced.
36. As an operator, I want to move players between phase-2 groups by hand before confirming, so that I can fix the placement.
37. As an operator, I want an option (on by default) to carry over the phase-1 result when the same pair meets again in a phase-2 group, so that they don't play twice.
38. As an operator, I want a final group made of all advancers to work as a special case of groups → groups, so that I can run a final round robin.

### Group standings

39. As an operator, I want group points of 1 for a win and 0 for a loss or walkover, so that standings follow our rules.
40. As an operator, I want ties broken by ITTF rules among the tied players only, so that standings are correct without manual calculation:
    - their matches against each other: points, then game ratio, then point ratio
    - repeated for any players still tied
41. As an operator, I want to resolve a tie the rules can't break, by manual decision or drawing lots, so that the group can still finish.
42. As an operator, I want to open a group and see full standings with the tiebreak details, so that I can explain the order to players.
43. As an operator, I want game-by-game point scores to be mandatory for group matches, so that point-ratio tiebreaks are always possible.

### Double elimination

44. As an operator, I want double elimination built like my 16-player paper sheet, so that it runs the way we always run it. For 16 players:
    - The winners bracket goes M1–M8 → A–D → E, F → G.
    - The losers bracket: LR1 pairs the round-1 losers.
    - LR2 takes the losers of D, C, B, A (crossed).
    - LR3 plays the LR2 winners against each other.
    - LR4 takes the losers of F and E (crossed).
    - LR5 plays the two LR4 winners.
45. As an operator, I want the winner of the winners-bracket final (G) to be champion, and G's loser to play the losers-bracket winner in a "2nd final" (winner 2nd, loser 3rd), so that our format's places are produced.
46. As an operator, I want each losers-bracket round to assign its losers a shared place range (13–16, 9–12, 7–8, 5–6, 4th), so that final standings exist even without play-offs.
47. As an operator, I want double elimination generated for 8, 16, 32 and 64 by the same rules (standard seeding, drop-ins crossed each round), so that larger and smaller fields work.

### Place play-offs

48. As an operator, I want optional play-offs for shared place ranges (5–6, 7–8, 9–12, 13–16, and further ranges in bigger draws), so that every place can be decided.
49. As an operator, I want to switch each play-off on or off at any point during the tournament, so that I can decide based on time left.
50. As an operator, I want a play-off match playable as soon as both its players are known, so that it doesn't wait for the whole range.
51. As an operator, I want play-offs paired by neighbouring matches, with winners playing for the upper places and losers for the lower, so that every place is decided. In 9–12: loser of the 1st LR2 match vs loser of the 2nd, and 3rd vs 4th; the winners play for 9/10 and the losers for 11/12.
52. As an operator, I want the same play-off feature for single elimination (e.g. quarter-final losers play for 5–8), so that both formats can decide all places.
53. As an operator, I want unplayed play-offs to leave the places shared ("5–8"), so that results stay correct.

### Running matches

54. As an operator, I want a waiting list of every match that can be played now (both players known), so that I know what to call next.
55. As an operator, I want the waiting list sorted so that tournament flow is right:
    - earlier stage first
    - then earlier round
    - then the match that has been ready longest
    - play-off matches after main-draw matches
56. As an operator, I want to switch the waiting list between all competitions merged and a single competition, so that I can focus or see everything.
57. As an operator, I want matches where a player is already playing elsewhere flagged as "busy" (with where) and sorted to the bottom, so that I don't call a player who is on another table.
58. As an operator, I want to assign a ready match to a free table in one or two clicks, so that calling matches is fast.
59. As an operator, I want the match clock to start when the match is assigned to a table, so that timing needs no extra click.
60. As an operator, I want to edit a match's start time ("started N min ago"), so that late-arriving players don't distort the stats.
61. As an operator, I want to take a match off its table, so that I can undo a wrong assignment.
62. As an operator, I want to enter a score by typing game scores (`11-7 9-11 11-5 11-8`) and pressing Enter, so that entering results is keyboard-fast.
63. As an operator, I want scores validated as I type, so that typos don't become results:
    - a game is to 11 with a 2-point lead
    - there are no games after the match was decided
    - the winner has exactly the required games
64. As an operator, I want to enter just the game result (e.g. 3:1) for bracket matches, so that I can go faster where point ratios don't matter.
65. As an operator, I want to record a walkover, retirement (with the games played so far) or disqualification, so that special results are handled.
66. As an operator, I want a finished match to free its table and send its winner and loser into their next matches automatically, so that the draw updates itself.

### Corrections & withdrawals

67. As an operator, I want to correct a result whose following match hasn't started, with the advancing player swapped automatically, so that a typo is easy to fix.
68. As an operator, I want to force a correction even after later matches started or finished, after a confirmation listing which matches will be reset, so that I can repair real mistakes knowingly.
69. As an operator, I want correcting a score to keep the match's original timing, so that stats stay correct.
70. As an operator, I want to withdraw a player mid-competition, with their remaining matches becoming walkovers and their played results kept, so that injuries and departures are handled.

### Table overview

71. As an operator, I want a panel listing all tables with their status (free, playing, overdue, inactive), so that I can see the hall at a glance.
72. As an operator, I want each playing table to show its current match and a live timer, so that I know how long it's been going.
73. As an operator, I want each free table to show how long it's been idle, so that unused tables stand out.
74. As an operator, I want to click a free table and pick a ready match for it, so that I can fill tables from the table side too.
75. As an operator, I want to expand the table panel to full screen, so that I can see big tiles when needed.
76. As an operator, I want badges with the number of overdue and idle tables even when the panel is collapsed, so that I never miss them.

### Overdue detection & stats

77. As an operator, I want a running match flagged amber past 100% of its expected duration and red past 150%, so that I notice when someone probably forgot to bring the score.
78. As an operator, I want an alarm in the header that jumps through overdue matches, so that I can deal with them one by one.
79. As an operator, I want each match's assigned and finished timestamps recorded, so that durations are known.
80. As an operator, I want stats for progress (done/total), so that I can judge how the day is going:
    - average duration per competition, stage and table
    - the longest matches
    - a rough estimate of the time left
81. As an operator, I want a read-only change log of every score entry, correction, assignment, manual swap and play-off toggle, with timestamps, so that I can settle disputes.

### Canvas UI

82. As an operator, I want a pan/zoom canvas per competition with competition tabs, so that I can see the whole draw of one competition.
83. As an operator, I want all stages of a competition laid out left to right (groups → bracket → play-offs), so that the flow of the competition is visible.
84. As an operator, I want brackets drawn with connector lines, and for double elimination winners bracket, losers bracket, 2nd final and play-off mini-brackets labelled, so that the structure reads like the paper sheet.
85. As an operator, I want group boxes on the canvas showing standings and the group's matches, so that groups and brackets live side by side.
86. As an operator, I want every match card styled by state, so that I can read the state of the draw instantly:
    - pending: neutral, showing placeholders
    - ready: accent highlight
    - busy: dimmed accent with an icon
    - in progress: table and live timer
    - overdue: amber/red with the timer
    - finished: greyed with the score
    - walkover: greyed with a badge
    - disabled play-off: faint, with an enable toggle
87. As an operator, I want clicking a match card to open a popover, so that every action is one click from the draw. It offers: assign table, score entry, walkover, edit start time, take off table, enable play-off.
88. As an operator, I want clicking a waiting-list item to switch to its competition, pan the canvas to the match and open its popover, so that I can act on it immediately.
89. As an operator, I want "fit to screen", zoom buttons and keyboard shortcuts on the canvas, so that I can navigate big draws quickly.
90. As an operator, I want every side panel collapsible, so that I can give the canvas more room.

### Data safety

91. As an operator, I want all changes saved automatically in the browser, so that a page refresh loses nothing.
92. As an operator, I want to export a tournament to a single JSON file, so that I can back it up or move it to another laptop.
93. As an operator, I want to import a tournament JSON file as a new tournament or to replace an existing one after confirming, so that I can restore a backup.
94. As an operator, I want imported files validated (including a schema version), so that a broken or old file can't corrupt my data.
95. As an operator, I want a non-blocking reminder to download a backup periodically (e.g. every 30 minutes) while a tournament is live, so that losing browser data doesn't lose the event.
96. As an operator, I want the app to work offline once loaded, so that bad hall Wi-Fi doesn't matter.

## Implementation Decisions

### Platform & stack

- Purely frontend, single-page app. One operator on one device is the source of truth. No backend and no sync.
- The stack:
  - React + TypeScript + Vite
  - Zustand for state, persisted via middleware to localStorage behind a small storage interface
  - Tailwind + shadcn/ui
  - React Router
  - Vitest
  - Zod for import validation
- Deployed as a static site. Offline support via PWA.
- i18n: every UI string goes through a translation layer (e.g. react-i18next). English is the default and Polish is complete. Engine output contains no display strings, only codes and data such as placeholder `{ group: 'A', place: 1 }`, which the UI formats.

### Modules

1. **Tournament engine** (pure TypeScript, no React, no storage, no clock).
   - It is the only place where tournament rules live.
   - It is built as a deep module: a small command/query interface hides the draw generation, standings, advancement, scheduling and correction logic.
   - Internally it is split into stage-type handlers (groups, single elimination, double elimination, play-offs) behind a common stage interface. New formats (Swiss, consolation) can then be added later without changing the engine's public interface.
2. **Persistence adapter.** Save/load of the tournament list and each tournament's state to localStorage. JSON export/import with Zod validation and schema-version migrations.
3. **App state.** A thin Zustand store that holds engine state, dispatches commands to the engine and runs queries with the current time. It also triggers persistence and backup reminders.
4. **UI.** The canvas view (per competition), the side panels (tables, waiting list), the bottom drawer (stats, log), setup screens (tournament, tables, players, competitions/stages, seeding and draw editing), and import/export.

### Engine interface (shape, not final names)

**Commands:** each one takes state and a command and returns new state, or a typed error.

- Tournament:
  - `createTournament`
  - `addTable` / `updateTable` / `setTableActive` / `removeTable`
  - `addPlayer` / `updatePlayer`
- Competition and stages:
  - `addCompetition` (games-to-win, expected durations)
  - `configureStages` (the stage chain with per-stage options)
  - `enterPlayer` / `withdrawPlayer`
  - `setSeed`
- Draws:
  - `generateDraw(stage, randomSeed)`
  - `swapSlots` / `movePlayer`
  - `confirmStage`
- Matches:
  - `assignMatch(match, table, at)` / `unassignMatch`
  - `setMatchStart`
  - `recordResult(match, games | gamesOnly | walkover | retirement | disqualification, at)`
  - `correctResult(match, result, { force })`
  - `resolveTie(group, order)`
  - `setPlayoffEnabled`

**Queries:** pure functions of `(state, now)`.

- match views with derived status and resolved slots
- waiting list
- group standings with tiebreak trace
- bracket layout data (sections, rounds, order, feeders)
- final places per competition
- table overview (status, current match, elapsed, idle)
- stats
- change log
- the downstream-reset preview for a correction

**Randomness** is injected through a seed passed to draw commands, so draws are reproducible in tests. **Time** is always passed in (`at`, `now`). The engine never reads the clock.

### Domain model

- **Tournament** owns Tables, Players and Competitions. Players are still one record per person at tournament level (so busy detection works across competitions), but they are registered through a competition: the operator adds them on the competition's entry list, and a tournament-level player record is created or reused (#0019). **Competition** has an ordered list of Stages. **Stage** is one of groups, single elimination, double elimination or play-off, and contains Matches.
- **Entry vs player.** A competition's entries are singles players for v1. The entry shape should allow 1..n players later, but nothing in v1 depends on that.
- **Slots.** Each match has two slots. A slot's source is one of: a fixed player, a group placeholder (group + place), the winner of another match, the loser of another match, or a BYE. Advancement is resolved through these references, not copied. Correction then only re-resolves the draw and resets downstream matches that had already used a now-wrong player.
- **Places.** A match can carry `places` metadata, e.g. G winner → 1, 2nd final winner → 2 and loser → 3, LR1 losers → 13–16. Final standings are derived from this metadata plus play-off results.

The derived state shape from the UI prototype encodes the match-status rules more precisely than prose, so it is included here (trimmed):

```ts
// From the UI prototype: slot sources and derived match status
type SlotSource =
  | { player: PlayerId }
  | { placeholder: { group: string; place: number } }   // "1A"
  | { from: { match: MatchId; take: 'winner' | 'loser' } }
  | { bye: true };

type MatchStatus =
  | 'pending'      // a slot not yet resolved to a player
  | 'ready'        // both players known, neither playing elsewhere
  | 'busy'         // both known, but one is in an in-progress match elsewhere
  | 'in_progress'  // assigned to a table, elapsed <= expected
  | 'overdue'      // elapsed > expected (level 1) or > 1.5 × expected (level 2)
  | 'finished'
  | 'walkover'
  | 'disabled';    // play-off not switched on
```

### Rules decided

**Scoring**
- Table tennis only.
- A game goes to 11 with a 2-point lead (deuce continues until someone leads by 2).
- A match is won at 2, 3 or 4 games, as set per competition.
- Group matches need per-game points. Bracket matches also accept a games-only result.

**Group standings**
- 1 point for a win, 0 for a loss or walkover.
- Ties are broken by ITTF rules among the tied players only: points in their matches against each other, then game ratio in those matches, then point ratio in those matches, repeated for any subset still tied.
- After that, the operator decides (manual decision or lot).

**Groups → bracket**
- Uses the algorithm from user story 28.
- Placeholders show early. The bracket becomes confirmable when all groups are complete.

**Seeding**
- Only players with an explicit seed number are placed by the seed table. Everyone else gets a random number.
- BYEs take the highest numbers.
- Manual swaps are allowed until the stage is confirmed.
- There is no club separation.

**Double elimination**
- Built as user stories 44–47 describe.
- There is no grand final: the WB final winner is champion (see ADR 0002).

**Play-offs**
- Turned on per range, at any time.
- A match becomes playable as soon as both its players are known.
- Every match decides places: winners take the upper places, losers the lower.

**Waiting list**
- Sort order: busy last, then play-off after main draw, then stage order, then round, then ready-since.

**Overdue**
- Amber when elapsed > expected; red when elapsed > 1.5 × expected.
- Expected duration is set per games-to-win format.

**Corrections**
- Automatic swap if the downstream match hasn't started.
- Otherwise a forced correction, which resets the affected downstream matches after a confirmation that lists them.
- A correction keeps the original timestamps.

**Withdrawal**
- The player's remaining matches become walkovers. Played results are kept.

**Phase-2 groups**
- Snake by place.
- Carry-over of a repeated pairing's result is on by default.

### UI layout (from the prototype, variant A)

- The header shows the tournament name and the competition tabs (with ready/live/late counts per tab), plus an overdue alarm, an idle-tables chip and a clock.
- The canvas pans by dragging and zooms with the wheel or pinch; there are also zoom buttons and a fit button. It shows one competition at a time.
- Panels:
  - Left: tables, collapsible, with a full-screen tile view.
  - Right: waiting list, with a merged/per-competition toggle.
  - Bottom drawer: stats and change log.
- Ideas worth borrowing from the rejected variants: B's keyboard command bar (e.g. typing `5 11-7 11-9 11-4` scores table 5) and C's per-table timeline for spotting idle gaps. Both are optional additions, not required in v1.

### Persistence

- There is a tournament index plus one stored document per tournament. Every engine command is followed by an autosave.
- The export file is a single JSON document containing `schemaVersion`, the tournament state and the change log.
- Import validates the file with Zod and runs migrations for older schema versions. It then creates a new tournament or replaces an existing one after confirmation.

## Testing Decisions

- **One test seam: the tournament engine's public command/query interface.** Each test sets up state through commands, then checks query results. No test reaches into stage handlers, the generator's internals or private helpers. Refactoring internals must never break a test.
- **Determinism:** draws take an injected random seed, and all time-dependent behaviour takes `at`/`now` as an argument. Tests never mock the clock or `Math.random`.
- **What makes a good test:** it describes tournament behaviour in domain terms, for example:
  - "16 players, double elimination: after these results, G's winner is 1st and the 2nd final decides 2nd/3rd"
  - "4 groups → 1A at position 1, 1B at position 8, 2A in the opposite half to 1A"
  - "correcting a result after the next match started requires force and resets these matches"
  - "a 3-way tie is resolved by head-to-head game ratio"

  It asserts on observable output: match statuses, resolved players, standings order, places, waiting-list order and table status.
- **Covered through the seam:**
  - seed positions for 8/16/32/64
  - BYE placement and auto-advance
  - snake group filling and Berger order
  - standings and every tiebreak step, including partial ties
  - the groups → bracket algorithm, including BYE priority and separation
  - groups → groups with carry-over
  - single elimination with a 3rd-place match
  - double elimination drop-ins and places; the 16-player paper sheet is a golden test, checking every match's feeders and place ranges
  - play-off generation, enabling and pairing
  - waiting-list order, including busy players across competitions
  - score validation
  - walkover, retirement and withdrawal
  - correction with automatic swap vs forced reset
  - overdue thresholds and table idle time
  - stats
  - change log entries
  - export → import round trip, including rejection of invalid files and migration of an older schema version (export/import is a query/command pair at the same seam)
- **Not unit-tested:** React components, the canvas and the Zustand wiring. These stay thin over the engine and are checked by hand in the browser. The storage adapter is too simple to need its own tests.
- **Prior art:** none in this repo yet (greenfield). The UI prototype's in-memory store is a reference for the derived query shapes, not for tests.

## Out of Scope

- doubles, teams and team ties
- Swiss, consolation/B-draws for group non-advancers, and other formats (the stage interface should allow them later)
- sports other than table tennis (scoring is table-tennis only)
- several operators or devices, sync, a backend, and player/public views on their own phones
- a read-only display screen for a projector or TV (deferred)
- printing (match cards, draw sheets, results)
- club separation in draws
- a grand final or grand final reset in double elimination (see ADR 0002)
- brackets smaller than 8, except the 4-player knockout after groups
- a general undo beyond the correction flow
- automatic table assignment (the operator always chooses)

## Further Notes

- **Reference material:** the user's paper sheet "Tabela rozgrywek 16 zawodników" (16-player double elimination) is the source of the seed order, drop-in crossing and place ranges. LR4 crossing was decided explicitly: F's loser drops into the top half and E's loser into the bottom. The play-off pairings (neighbouring matches) were decided where the sheet is ambiguous.
- **UI prototype:** branch `prototype/ui-variants`, folder `prototype-ui/`. Run `powershell -ExecutionPolicy Bypass -File prototype-ui/serve.ps1` and open `http://localhost:5174/?variant=A`. Variant A was chosen on 2026-10-22. The prototype's store and mock data show the derived query shapes and a realistic mid-tournament snapshot. Don't promote prototype code; rewrite it properly.
- **Suggested build order:**
  1. engine: scoring and validation
  2. engine: groups
  3. engine: single elimination
  4. engine: double elimination
  5. engine: play-offs
  6. engine: scheduling
  7. engine: corrections
  8. persistence and import/export
  9. canvas UI
  10. panels
  11. setup screens
  12. i18n polish and PWA

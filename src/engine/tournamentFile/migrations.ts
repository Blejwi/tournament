/**
 * Schema migrations for tournament files (and stored tournaments, which use the same format).
 *
 * `migrations[n]` turns a version-n document into a version-(n+1) document. Migrations work on raw
 * JSON (`RawFile`) and must not validate: the migrated result is checked once against the current
 * schema afterwards. Never edit a migration once released; add a new one instead.
 *
 * Versions:
 * - 1: `{ schemaVersion, tournament }`, the first saved format (tournament, tables, players).
 * - 2: adds the change log section `log` (empty until #0016).
 * - 3: adds `tournament.competitions` (entries, stage chain, draws and matches; #0003).
 * - 4: adds `tieResolutions` (the operator's orders for unbreakable ties) to every group (#0004).
 * - 5: adds `tournament.expectedDurations` (minutes per games-to-win value, the defaults; #0005).
 * - 6: adds single elimination stages, bracket match locations and a match's optional `places`
 *   (#0007). Older files need no change; the bump lets older apps refuse files with brackets.
 * - 7: the change log `log` gets its entries (#0016). Older files only ever had `[]`; anything
 *   else found there is dropped, as it was never written by the app.
 * - 8: adds double elimination stages and the `winners`, `losers` and `secondFinal` bracket
 *   sections (#0010). Older files need no change; the bump lets older apps refuse them.
 * - 9: adds an entry's `withdrawnAt` (null: not withdrawn) and the special results walkover,
 *   retirement and disqualification (#0014).
 * - 10: every single and double elimination stage gets `playOffs` (the place play-offs switched on,
 *   none so far) and bracket matches may be in section `playOff` (#0012).
 * - 11: adds a groups stage's `carryOver` (groups → groups, #0013); true for every older groups stage.
 * - 12: a place play-off is one round, and its halves are play-offs of their own (#0024). Older
 *   play-offs went down to single places in one block: each later round's matches move to the
 *   play-off of the half they split (switched on), so results and places stay the same.
 */

/** A document parsed from JSON whose shape isn't trusted yet. */
export type RawFile = { schemaVersion: number } & Record<string, unknown>;

type Migration = (file: RawFile) => RawFile;

export const migrations: Record<number, Migration> = {
  1: (file) => ({ ...file, schemaVersion: 2, log: [] }),
  2: (file) => ({ ...file, schemaVersion: 3, tournament: { ...(file.tournament as object), competitions: [] } }),
  3: (file) => {
    const tournament = file.tournament as { competitions?: unknown };
    const competitions = Array.isArray(tournament?.competitions)
      ? tournament.competitions.map((competition: { stages?: unknown }) => ({
          ...competition,
          stages: Array.isArray(competition?.stages)
            ? competition.stages.map((stage: { type?: unknown; groups?: unknown }) =>
                stage?.type === 'groups' && Array.isArray(stage.groups)
                  ? { ...stage, groups: stage.groups.map((group: object) => ({ ...group, tieResolutions: [] })) }
                  : stage,
              )
            : competition?.stages,
        }))
      : tournament?.competitions;
    return { ...file, schemaVersion: 4, tournament: { ...tournament, competitions } };
  },
  4: (file) => ({
    ...file,
    schemaVersion: 5,
    tournament: { ...(file.tournament as object), expectedDurations: { 2: 15, 3: 25, 4: 35 } },
  }),
  5: (file) => ({ ...file, schemaVersion: 6 }),
  6: (file) => ({ ...file, schemaVersion: 7, log: [] }),
  7: (file) => ({ ...file, schemaVersion: 8 }),
  8: (file) => {
    const tournament = file.tournament as { competitions?: unknown };
    const competitions = Array.isArray(tournament?.competitions)
      ? tournament.competitions.map((competition: { entries?: unknown }) => ({
          ...competition,
          entries: Array.isArray(competition?.entries)
            ? competition.entries.map((entry: object) => ({ ...entry, withdrawnAt: null }))
            : competition?.entries,
        }))
      : tournament?.competitions;
    return { ...file, schemaVersion: 9, tournament: { ...tournament, competitions } };
  },
  9: (file) => {
    const tournament = file.tournament as { competitions?: unknown };
    const competitions = Array.isArray(tournament?.competitions)
      ? tournament.competitions.map((competition: { stages?: unknown }) => ({
          ...competition,
          stages: Array.isArray(competition?.stages)
            ? competition.stages.map((stage: { type?: unknown }) =>
                stage?.type === 'singleElimination' || stage?.type === 'doubleElimination' ? { ...stage, playOffs: [] } : stage,
              )
            : competition?.stages,
        }))
      : tournament?.competitions;
    return { ...file, schemaVersion: 10, tournament: { ...tournament, competitions } };
  },
  10: (file) => {
    const tournament = file.tournament as { competitions?: unknown };
    const competitions = Array.isArray(tournament?.competitions)
      ? tournament.competitions.map((competition: { stages?: unknown }) => ({
          ...competition,
          stages: Array.isArray(competition?.stages)
            ? competition.stages.map((stage: { type?: unknown }) => (stage?.type === 'groups' ? { ...stage, carryOver: true } : stage))
            : competition?.stages,
        }))
      : tournament?.competitions;
    return { ...file, schemaVersion: 11, tournament: { ...tournament, competitions } };
  },
  11: (file) => {
    type Range = { from: number; to: number };
    type RawMatch = { round: number; order: number; playOff?: Range; places?: unknown };
    type RawStage = { type?: unknown; matches?: RawMatch[]; playOffs?: { range: Range; enabled: boolean }[] };
    // In the old block for a range of n entries, round r held 2^(r-1) groups of n / 2^r matches,
    // best half first; group g split the g-th part of the range (n / 2^(r-1) entries).
    const split = (stage: RawStage): RawStage => {
      if (!Array.isArray(stage.matches) || !Array.isArray(stage.playOffs)) return stage;
      const playOffs = [...stage.playOffs];
      const matches = stage.matches.map((match) => {
        if (!match?.playOff) return match;
        const { from, to } = match.playOff;
        const perGroup = (to - from + 1) / 2 ** match.round;
        const entries = perGroup * 2;
        const group = Math.floor((match.order - 1) / perGroup);
        const range = { from: from + group * entries, to: from + group * entries + entries - 1 };
        if (!playOffs.some((p) => p.range.from === range.from && p.range.to === range.to)) playOffs.push({ range, enabled: true });
        const half = entries / 2;
        const places =
          entries === 2
            ? { winner: { from: range.from, to: range.from }, loser: { from: range.to, to: range.to } }
            : { winner: { from: range.from, to: range.from + half - 1 }, loser: { from: range.from + half, to: range.to } };
        return { ...match, round: 1, order: match.order - group * perGroup, playOff: range, places };
      });
      return { ...stage, matches, playOffs };
    };
    const tournament = file.tournament as { competitions?: unknown };
    const competitions = Array.isArray(tournament?.competitions)
      ? tournament.competitions.map((competition: { stages?: unknown }) => ({
          ...competition,
          stages: Array.isArray(competition?.stages)
            ? competition.stages.map((stage: RawStage) =>
                stage?.type === 'singleElimination' || stage?.type === 'doubleElimination' ? split(stage) : stage,
              )
            : competition?.stages,
        }))
      : tournament?.competitions;
    return { ...file, schemaVersion: 12, tournament: { ...tournament, competitions } };
  },
};

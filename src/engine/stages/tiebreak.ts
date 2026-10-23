import type { EntryId, TieResolution } from '../types';

/**
 * What separated two neighbouring places in the standings:
 * - groupPoints: group points over all the group's matches
 * - tiedGroupPoints / tiedGameRatio / tiedPointRatio: group points, game ratio or point ratio in the
 *   matches between the tied entries only (ITTF), in that order
 * - decision / lot: the operator settled a tie the rules couldn't break (`resolveTie`)
 * - null: nothing separates them yet (an unresolved tie; they keep their draw order for now)
 */
export type TiebreakRule = 'groupPoints' | 'tiedGroupPoints' | 'tiedGameRatio' | 'tiedPointRatio' | 'decision' | 'lot';

/** One entry's record in the matches between the entries of a tied set. */
export interface TiedRecord {
  entry: EntryId;
  groupPoints: number;
  gamesWon: number;
  gamesLost: number;
  pointsWon: number;
  pointsLost: number;
}

/** Between place `place` and `place + 1`: which rule separated them, comparing which entries. */
export interface TiebreakStep {
  /** The upper of the two places (1-based). */
  place: number;
  rule: TiebreakRule | null;
  /** The entries compared when the rule applied (the whole group for `groupPoints`). */
  among: EntryId[];
  /** Their records in the matches between them; empty for `groupPoints`. */
  records: TiedRecord[];
}

/** A tie the rules can't break, with the operator's resolution if there is one. */
export interface Tie {
  /** In the current standings order. */
  entries: EntryId[];
  resolution: TieResolution['method'] | null;
}

/** A finished match between two entries, slot A first, with its game scores. */
export interface TiebreakMatch {
  entries: [EntryId, EntryId];
  winner: 0 | 1;
  games: [number, number][];
}

/** A standings row as the tiebreak sees it. `entry` is null while the draw position isn't decided. */
export interface TiebreakRow {
  entry: EntryId | null;
  groupPoints: number;
}

export interface TiebreakOutcome<R> {
  rows: R[];
  /** `steps[i]` is between `rows[i]` and `rows[i + 1]`. */
  steps: TiebreakStep[];
  ties: Tie[];
}

type Criterion = (record: TiedRecord) => number;

const ratio = (won: number, lost: number) => (lost === 0 ? (won === 0 ? 0 : Infinity) : won / lost);

/** The ITTF criteria among tied entries, in order. Equal rationals give identical doubles, so `===` is exact. */
const CRITERIA: [Exclude<TiebreakRule, 'groupPoints' | 'decision' | 'lot'>, Criterion][] = [
  ['tiedGroupPoints', (r) => r.groupPoints],
  ['tiedGameRatio', (r) => ratio(r.gamesWon, r.gamesLost)],
  ['tiedPointRatio', (r) => ratio(r.pointsWon, r.pointsLost)],
];

/**
 * Orders rows (given in draw position order) by group points, then breaks ties by ITTF rules: among
 * the tied entries only, by group points, game ratio and point ratio in their matches against each
 * other. Whenever a rule splits a tied set, each part still tied is compared again from the first
 * rule, using only the matches inside that part. A set no rule splits is ordered by the operator's
 * resolution for exactly that set, or else flagged as a tie (kept in draw order).
 */
export function breakTies<R extends TiebreakRow>(rows: R[], matches: TiebreakMatch[], resolutions: TieResolution[]): TiebreakOutcome<R> {
  const ties: Tie[] = [];
  const all = rows.map((r) => r.entry).filter((e): e is EntryId => e !== null);

  const top = splitBy(rows, (r) => r.groupPoints);
  const parts = top.map((part) => (part.length === 1 ? { rows: part, steps: [] } : tied(part)));
  const outcome = join(parts, { rule: 'groupPoints', among: all, records: [] });
  return { ...outcome, ties };

  /** Orders a set of rows level on the criterion before. */
  function tied(set: R[]): { rows: R[]; steps: Omit<TiebreakStep, 'place'>[] } {
    const entries = set.map((r) => r.entry).filter((e): e is EntryId => e !== null);
    const records = recordsAmong(entries, matches);
    const recordOf = (row: R) => records.find((r) => r.entry === row.entry) ?? emptyRecord(row.entry ?? '');
    for (const [rule, criterion] of CRITERIA) {
      const split = splitBy(set, (row) => criterion(recordOf(row)));
      if (split.length > 1) {
        const parts = split.map((part) => (part.length === 1 ? { rows: part, steps: [] } : tied(part)));
        return join(parts, { rule, among: entries, records });
      }
    }
    const resolution = entries.length === set.length ? resolutions.find((r) => sameSet(r.entries, entries)) : undefined;
    if (resolution) {
      const ordered = [...set].sort((a, b) => resolution.entries.indexOf(a.entry!) - resolution.entries.indexOf(b.entry!));
      ties.push({ entries: ordered.map((r) => r.entry!), resolution: resolution.method });
      return { rows: ordered, steps: ordered.slice(1).map(() => ({ rule: resolution.method, among: entries, records })) };
    }
    ties.push({ entries, resolution: null });
    return { rows: set, steps: set.slice(1).map(() => ({ rule: null, among: entries, records })) };
  }
}

/** Concatenates ordered parts, with `between` as the step at each boundary; numbers the places. */
function join<R>(parts: { rows: R[]; steps: Omit<TiebreakStep, 'place'>[] }[], between: Omit<TiebreakStep, 'place'>) {
  const rows: R[] = [];
  const steps: Omit<TiebreakStep, 'place'>[] = [];
  parts.forEach((part, i) => {
    if (i > 0) steps.push(between);
    rows.push(...part.rows);
    steps.push(...part.steps);
  });
  return { rows, steps: steps.map((step, i) => ({ ...step, place: i + 1 })) };
}

/** Sorts by `key` (highest first, stable) and cuts into runs of equal keys. */
function splitBy<R>(rows: R[], key: (row: R) => number): R[][] {
  const sorted = [...rows].sort((a, b) => key(b) - key(a) || 0);
  const runs: R[][] = [];
  for (const row of sorted) {
    const last = runs.at(-1);
    if (last && key(last[0]) === key(row)) last.push(row);
    else runs.push([row]);
  }
  return runs;
}

function recordsAmong(entries: EntryId[], matches: TiebreakMatch[]): TiedRecord[] {
  const records = entries.map(emptyRecord);
  const recordOf = (entry: EntryId) => records.find((r) => r.entry === entry);
  for (const match of matches) {
    const sides = match.entries.map(recordOf);
    if (!sides[0] || !sides[1]) continue;
    sides.forEach((record, side) => {
      if (side === match.winner) record!.groupPoints++;
      for (const game of match.games) {
        const [mine, theirs] = side === 0 ? game : [game[1], game[0]];
        record!.pointsWon += mine;
        record!.pointsLost += theirs;
        if (mine > theirs) record!.gamesWon++;
        else record!.gamesLost++;
      }
    });
  }
  return records;
}

function emptyRecord(entry: EntryId): TiedRecord {
  return { entry, groupPoints: 0, gamesWon: 0, gamesLost: 0, pointsWon: 0, pointsLost: 0 };
}

const sameSet = (a: EntryId[], b: EntryId[]) => a.length === b.length && a.every((e) => b.includes(e));

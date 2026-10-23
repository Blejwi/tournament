import { shuffle } from '../random';
import { fail, ok, type Result } from '../result';
import { gameScoresOf } from '../score';
import type { Entry, Group, GroupsStage, Match, MatchResult, SlotSource, TieResolution } from '../types';
import type { DrawContext, StageHandler } from './handler';
import { breakTies, type Tie, type TiebreakMatch, type TiebreakStep } from './tiebreak';

/** Fewer than 2 entries in a group means no matches. */
const MIN_GROUP_SIZE = 2;

export const groupsHandler: StageHandler<GroupsStage> = {
  allowsGamesOnly: false, // point ratios are a tiebreak, so group matches need the points of every game

  validateConfig({ grouping }) {
    const valid =
      grouping.by === 'count'
        ? Number.isInteger(grouping.groups) && grouping.groups >= 1
        : Number.isInteger(grouping.size) && grouping.size >= MIN_GROUP_SIZE;
    return valid ? ok(undefined) : fail({ code: 'invalidGrouping' });
  },

  create: (id, { grouping }) => ({ id, type: 'groups', grouping, drawState: 'notDrawn', groups: [], matches: [] }),

  config: (stage) => ({ type: 'groups', grouping: stage.grouping }),

  draw(stage, ctx) {
    const sizes = groupSizes(ctx.entrants.length, stage);
    if (!sizes.ok) return sizes;
    const members = snakeFill(ctx, sizes.value);
    const groups: Group[] = members.map((entries, i) => ({
      id: ctx.ids.next('group'),
      name: groupName(i),
      entries,
      tieResolutions: [],
    }));
    const matches = groups.flatMap((group) => roundRobin(group, ctx));
    return ok({ ...stage, drawState: 'drawn', groups, matches });
  },

  clearDraw: (stage) => ({ ...stage, drawState: 'notDrawn', groups: [], matches: [] }),
};

/** Group sizes for `count` entrants: as even as possible, the first groups one larger. */
function groupSizes(count: number, stage: GroupsStage): Result<number[]> {
  const { grouping } = stage;
  const groups = grouping.by === 'count' ? grouping.groups : Math.max(1, Math.ceil(count / grouping.size));
  if (count < groups * MIN_GROUP_SIZE) return fail({ code: 'notEnoughEntries', needed: groups * MIN_GROUP_SIZE });
  const base = Math.floor(count / groups);
  return ok(Array.from({ length: groups }, (_, i) => base + (i < count % groups ? 1 : 0)));
}

/**
 * Seeded entrants by seed, then the unseeded ones in random order, dealt out snake-style:
 * A, B, C, then C, B, A, and so on, skipping groups that are already full.
 */
function snakeFill(ctx: DrawContext, sizes: number[]): SlotSource[][] {
  const seeded = ctx.entrants.filter((e) => e.seed !== null).sort((a, b) => a.seed! - b.seed!);
  const unseeded = shuffle(
    ctx.entrants.filter((e) => e.seed === null),
    ctx.random,
  );
  const groups: SlotSource[][] = sizes.map(() => []);
  let step = 0;
  for (const entrant of [...seeded, ...unseeded]) {
    let group: number;
    do {
      const row = Math.floor(step / sizes.length);
      const column = step % sizes.length;
      group = row % 2 === 0 ? column : sizes.length - 1 - column;
      step++;
    } while (groups[group].length >= sizes[group]);
    groups[group].push(entrant.source);
  }
  return groups;
}

/**
 * The group's matches in Berger order. Positions are 1-based draw positions; an odd group gets a
 * dummy last position, and whoever meets the dummy rests that round.
 */
function roundRobin(group: Group, ctx: DrawContext): Match[] {
  const size = group.entries.length;
  const n = size % 2 === 0 ? size : size + 1;
  const matches: Match[] = [];
  for (let round = 0; round < n - 1; round++) {
    const seat = (i: number) => ((i + (round * n) / 2) % (n - 1)) + 1;
    const pairs: [number, number][] = [round % 2 === 0 ? [seat(0), n] : [n, seat(0)]];
    for (let k = 1; k < n / 2; k++) pairs.push([seat(k), seat(n - 1 - k)]);
    const played = pairs.filter(([a, b]) => a <= size && b <= size);
    played.forEach(([a, b], i) =>
      matches.push({
        id: ctx.ids.next('match'),
        location: { kind: 'group', group: group.id },
        round: round + 1,
        order: i + 1,
        slots: [group.entries[a - 1], group.entries[b - 1]],
        table: null,
        assignedAt: null,
        result: null,
        finishedAt: null,
      }),
    );
  }
  return matches;
}

export interface StandingsRow {
  /** 1-based draw position in the group. */
  position: number;
  entry: Entry | null;
  played: number;
  won: number;
  lost: number;
  gamesWon: number;
  gamesLost: number;
  pointsWon: number;
  pointsLost: number;
  groupPoints: number;
  /** 1-based place in the standings. */
  place: number;
  /** In a tie the rules can't break and the operator hasn't resolved: the place isn't decided. */
  tied: boolean;
}

export interface Standings {
  /** In standings order. */
  rows: StandingsRow[];
  /** Every match of the group has a result. */
  complete: boolean;
  /** The tiebreak trace: `steps[i]` says what separates `rows[i]` from `rows[i + 1]`. */
  steps: TiebreakStep[];
  /** Ties the rules can't break, resolved by the operator or not. */
  ties: Tie[];
}

/** A group match with its resolved entries and outcome, as the standings need it. */
export interface PlayedMatch {
  entries: [Entry | null, Entry | null];
  winner: 0 | 1 | null;
  /** The recorded result, or the walkover a withdrawal gives. */
  result: MatchResult | null;
  /** Nothing is left to play: it has a result, or both players withdrew. */
  decided: boolean;
}

/** Group points: 1 for a win, 0 for a loss or a walkover. */
const POINTS_FOR_WIN = 1;

/** Standings by group points, then the ITTF tiebreak among tied entries (see `breakTies`). */
export function groupStandings(members: (Entry | null)[], matches: PlayedMatch[], resolutions: TieResolution[]): Standings {
  const rows: StandingsRow[] = members.map((entry, i) => ({
    position: i + 1,
    entry,
    played: 0,
    won: 0,
    lost: 0,
    gamesWon: 0,
    gamesLost: 0,
    pointsWon: 0,
    pointsLost: 0,
    groupPoints: 0,
    place: 0,
    tied: false,
  }));
  const rowOf = (entry: Entry | null) => (entry ? rows.find((r) => r.entry?.id === entry.id) : undefined);

  // A walkover or disqualification is a win and a loss without games; a retirement's games count.
  for (const { result, entries, winner } of matches) {
    if (winner === null || !result) continue;
    const sides = [rowOf(entries[0]), rowOf(entries[1])];
    sides.forEach((row, side) => {
      if (!row) return;
      row.played++;
      if (side === winner) {
        row.won++;
        row.groupPoints += POINTS_FOR_WIN;
      } else row.lost++;
      for (const game of gameScoresOf(result) ?? []) {
        const [mine, theirs] = side === 0 ? game : [game[1], game[0]];
        row.pointsWon += mine;
        row.pointsLost += theirs;
        if (mine > theirs) row.gamesWon++;
        else row.gamesLost++;
      }
    });
  }

  const finished: TiebreakMatch[] = [];
  for (const { result, entries, winner } of matches) {
    if (winner === null || !result || !entries[0] || !entries[1]) continue;
    finished.push({ entries: [entries[0].id, entries[1].id], winner, games: gameScoresOf(result) ?? [] });
  }
  const tiebreak = breakTies(
    rows.map((row) => ({ row, entry: row.entry?.id ?? null, groupPoints: row.groupPoints })),
    finished,
    resolutions,
  );
  const ordered = tiebreak.rows.map(({ row }) => row);
  ordered.forEach((row, i) => (row.place = i + 1));
  const unresolved = new Set(tiebreak.ties.filter((t) => t.resolution === null).flatMap((t) => t.entries));
  for (const row of ordered) row.tied = row.entry !== null && unresolved.has(row.entry.id);
  return { rows: ordered, complete: matches.every((m) => m.decided), steps: tiebreak.steps, ties: tiebreak.ties };
}

/** "A".."Z", then "AA", "AB", ... */
function groupName(index: number): string {
  const letter = String.fromCharCode(65 + (index % 26));
  return index < 26 ? letter : groupName(Math.floor(index / 26) - 1) + letter;
}

import type { IdSource } from '../ids';
import { shuffle } from '../random';
import { fail, ok, type Result } from '../result';
import type { Entry, Group, GroupsStage, Match, SlotSource, TieResolution } from '../types';
import type { DrawContext, DrawPosition, StageHandler } from './handler';
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
    const matches = groups.flatMap((group) => roundRobin(group, () => ctx.ids.next('match')));
    return ok({ ...stage, drawState: 'drawn', groups, matches });
  },

  clearDraw: (stage) => ({ ...stage, drawState: 'notDrawn', groups: [], matches: [] }),

  swapPositions: (stage, a, b) => swapGroupPositions(stage, a, b),
  movePosition: (stage, from, to, ids) => moveGroupPosition(stage, from, to, ids),
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
function roundRobin(group: Group, nextId: () => string): Match[] {
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
        id: nextId(),
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

/** A group match with its resolved entries, as the standings need it. */
export interface PlayedMatch {
  match: Match;
  entries: [Entry | null, Entry | null];
  winner: 0 | 1 | null;
}

/** Group points: 1 for a win, 0 for a loss. */
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

  for (const { match, entries, winner } of matches) {
    if (winner === null || !match.result) continue;
    const sides = [rowOf(entries[0]), rowOf(entries[1])];
    sides.forEach((row, side) => {
      if (!row) return;
      row.played++;
      if (side === winner) {
        row.won++;
        row.groupPoints += POINTS_FOR_WIN;
      } else row.lost++;
      const result = match.result!;
      const games = result.kind === 'games' ? result.games : [];
      for (const game of games) {
        const [mine, theirs] = side === 0 ? game : [game[1], game[0]];
        row.pointsWon += mine;
        row.pointsLost += theirs;
        if (mine > theirs) row.gamesWon++;
        else row.gamesLost++;
      }
    });
  }

  const finished: TiebreakMatch[] = [];
  for (const { match, entries, winner } of matches) {
    if (winner === null || !match.result || !entries[0] || !entries[1]) continue;
    finished.push({ entries: [entries[0].id, entries[1].id], winner, games: match.result.kind === 'games' ? match.result.games : [] });
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
  return { rows: ordered, complete: matches.every((m) => m.match.result !== null), steps: tiebreak.steps, ties: tiebreak.ties };
}

/** "A".."Z", then "AA", "AB", ... */
function groupName(index: number): string {
  const letter = String.fromCharCode(65 + (index % 26));
  return index < 26 ? letter : groupName(Math.floor(index / 26) - 1) + letter;
}

/**
 * Draw editing (before confirm): a group position's occupant, its group's index and the
 * 0-based index in the group; null when the position doesn't exist.
 */
function findGroupPosition(stage: GroupsStage, at: DrawPosition, allowEnd = false): { group: number; index: number } | null {
  if (at.kind !== 'group') return null;
  const group = stage.groups.findIndex((g) => g.id === at.group);
  if (group === -1) return null;
  const size = stage.groups[group].entries.length + (allowEnd ? 1 : 0);
  if (!Number.isInteger(at.position) || at.position < 1 || at.position > size) return null;
  return { group, index: at.position - 1 };
}

function swapGroupPositions(stage: GroupsStage, a: DrawPosition, b: DrawPosition): Result<GroupsStage> {
  const from = findGroupPosition(stage, a);
  const to = findGroupPosition(stage, b);
  if (!from || !to) return fail({ code: 'drawPositionNotFound' });
  const entries = stage.groups.map((g) => [...g.entries]);
  [entries[from.group][from.index], entries[to.group][to.index]] = [entries[to.group][to.index], entries[from.group][from.index]];
  return ok(withGroupEntries(stage, entries));
}

function moveGroupPosition(stage: GroupsStage, fromAt: DrawPosition, toAt: DrawPosition, ids: IdSource): Result<GroupsStage> {
  const from = findGroupPosition(stage, fromAt);
  if (!from) return fail({ code: 'drawPositionNotFound' });
  const sameGroup = toAt.kind === 'group' && toAt.group === stage.groups[from.group].id;
  const to = findGroupPosition(stage, toAt, !sameGroup);
  if (!to) return fail({ code: 'drawPositionNotFound' });
  if (!sameGroup && stage.groups[from.group].entries.length <= MIN_GROUP_SIZE) return fail({ code: 'groupTooSmall', min: MIN_GROUP_SIZE });
  const entries = stage.groups.map((g) => [...g.entries]);
  const [moved] = entries[from.group].splice(from.index, 1);
  entries[to.group].splice(to.index, 0, moved);
  return ok(withGroupEntries(stage, entries, ids));
}

/**
 * The stage with new group entries; the matches of each changed group are made again in Berger
 * order. A group that keeps its size keeps its match ids, so a swap leaves every match in place.
 */
function withGroupEntries(stage: GroupsStage, entries: SlotSource[][], ids?: IdSource): GroupsStage {
  const groups = stage.groups.map((group, i): Group => {
    const same = group.entries.length === entries[i].length && group.entries.every((source, k) => source === entries[i][k]);
    return same ? group : { ...group, entries: entries[i], tieResolutions: [] };
  });
  const matches = groups.flatMap((group, i) => {
    const old = stage.matches.filter((m) => m.location.kind === 'group' && m.location.group === group.id);
    if (group === stage.groups[i]) return old;
    const size = group.entries.length;
    const reuse = old.length === (size * (size - 1)) / 2 ? old.map((m) => m.id) : null;
    let k = 0;
    return roundRobin(group, () => (reuse ? reuse[k++] : ids!.next('match')));
  });
  return { ...stage, groups, matches };
}

import { checkResult } from '../commands/matches';
import { derive, gamesWon, type Derived, type DerivedMatch, type MatchStatus } from '../derive';
import type { EngineError } from '../errors';
import type {
  CompetitionId,
  GameScore,
  GamesToWin,
  GroupId,
  MatchId,
  MatchResult,
  SlotSource,
  StageId,
  TableId,
  Timestamp,
  TournamentState,
} from '../types';
import { entryView, type EntryView } from './competitions';
import { expectedMs, overdueLevel, type OverdueLevel } from '../overdue';

export interface SlotView {
  source: SlotSource;
  /** Who plays in this slot, resolved from the source; null while it isn't decided (or a BYE). */
  entry: EntryView | null;
}

export type MatchLocationView = { kind: 'group'; group: GroupId; groupName: string };

export interface ResultView {
  /** Slot index of the winner. */
  winner: 0 | 1;
  /** Games won by slot A and slot B. */
  gamesWon: [number, number];
  /** Points of each game, slot A first; null for a games-only result. */
  games: GameScore[] | null;
}

export interface MatchView {
  id: MatchId;
  competition: CompetitionId;
  stage: StageId;
  /** Position of the stage in its competition's chain (0 = first). */
  stageIndex: number;
  location: MatchLocationView;
  round: number;
  order: number;
  gamesToWin: GamesToWin;
  slots: [SlotView, SlotView];
  status: MatchStatus;
  /** The table it was called to (kept after it finishes); null if never called. */
  table: { id: TableId; number: number } | null;
  assignedAt: Timestamp | null;
  finishedAt: Timestamp | null;
  /** How long it has been on its table, for a match in progress; otherwise null. */
  elapsedMs: number | null;
  /** How long a match of this format is expected to take (the tournament's setting for its games to win). */
  expectedMs: number;
  /** Amber past 100% of the expected duration, red past 150%; null unless the match is overdue. */
  overdue: OverdueLevel | null;
  result: ResultView | null;
}

export function matchView(state: TournamentState, derived: DerivedMatch, now: Timestamp): MatchView {
  const { match, competition, stage, stageIndex, entries, winner } = derived;
  const expected = expectedMs(state, competition.gamesToWin);
  const elapsedMs = derived.status === 'in_progress' && match.assignedAt !== null ? now - match.assignedAt : null;
  const overdue = elapsedMs === null ? null : overdueLevel(elapsedMs, expected);
  // Overdue needs `now`, so it is decided here rather than in `derive`.
  const status: MatchStatus = overdue ? 'overdue' : derived.status;
  const table = match.table === null ? null : state.tables.find((t) => t.id === match.table);
  let location: MatchLocationView;
  switch (match.location.kind) {
    case 'group': {
      const groupId = match.location.group;
      const group = stage.groups.find((g) => g.id === groupId);
      location = { kind: 'group', group: groupId, groupName: group?.name ?? '' };
      break;
    }
  }
  const { result } = match;
  return {
    id: match.id,
    competition: competition.id,
    stage: stage.id,
    stageIndex,
    location,
    round: match.round,
    order: match.order,
    gamesToWin: competition.gamesToWin,
    slots: [0, 1].map((i) => ({
      source: structuredClone(match.slots[i]),
      entry: entries[i] ? entryView(state, entries[i]) : null,
    })) as [SlotView, SlotView],
    status,
    table: table ? { id: table.id, number: table.number } : null,
    assignedAt: match.assignedAt,
    finishedAt: match.finishedAt,
    elapsedMs,
    expectedMs: expected,
    overdue,
    result:
      result && winner !== null
        ? {
            winner,
            gamesWon: result.kind === 'games' ? gamesWon(result.games) : [...result.games],
            games: result.kind === 'games' ? result.games.map(([a, b]) => [a, b]) : null,
          }
        : null,
  };
}

/** One match, or null when it doesn't exist. */
export function getMatch(state: TournamentState, id: MatchId, now: Timestamp): MatchView | null {
  const derived = derive(state).match(id);
  return derived ? matchView(state, derived, now) : null;
}

export type { Derived, MatchStatus };

/**
 * The matches that could be called now: ready ones first, busy ones (a player is on another
 * table) last; within each, earlier stage, then earlier round, then competition and draw order.
 * The ready-since tiebreak and play-off ordering come with #0006 and #0012.
 */
export function getWaitingList(state: TournamentState, now: Timestamp): MatchView[] {
  const competitionOrder = new Map(state.competitions.map((c, i) => [c.id, i]));
  return derive(state)
    .matches.map((m, drawOrder) => ({ m, drawOrder }))
    .filter(({ m }) => m.status === 'ready' || m.status === 'busy')
    .sort(
      (x, y) =>
        Number(x.m.status === 'busy') - Number(y.m.status === 'busy') ||
        x.m.stageIndex - y.m.stageIndex ||
        x.m.match.round - y.m.match.round ||
        competitionOrder.get(x.m.competition.id)! - competitionOrder.get(y.m.competition.id)! ||
        x.drawOrder - y.drawOrder,
    )
    .map(({ m }) => matchView(state, m, now));
}

export interface FreeTableView {
  id: TableId;
  number: number;
  name: string;
}

/** Active tables with no match on them, by number. */
export function getFreeTables(state: TournamentState): FreeTableView[] {
  const inUse = new Set(derive(state).matches.filter((m) => m.match.table !== null && !m.match.result).map((m) => m.match.table));
  return state.tables
    .filter((t) => t.active && !inUse.has(t.id))
    .sort((a, b) => a.number - b.number)
    .map((t) => ({ id: t.id, number: t.number, name: t.name }));
}

/**
 * Live validation for score entry: the error `recordResult` would give for this result now, or null.
 * Typed text goes through `parseGames` first.
 */
export function validateResult(state: TournamentState, match: MatchId, result: MatchResult): EngineError | null {
  const checked = checkResult(state, match, result);
  return checked.ok ? null : checked.error;
}

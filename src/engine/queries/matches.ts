import { derive, gamesWon, type Derived, type DerivedMatch, type MatchStatus } from '../derive';
import type {
  CompetitionId,
  GameScore,
  GamesToWin,
  GroupId,
  MatchId,
  SlotSource,
  StageId,
  TableId,
  Timestamp,
  TournamentState,
} from '../types';
import { entryView, type EntryView } from './competitions';

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
  result: ResultView | null;
}

export function matchView(state: TournamentState, derived: DerivedMatch, now: Timestamp): MatchView {
  const { match, competition, stage, stageIndex, entries, winner, status } = derived;
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
    elapsedMs: (status === 'in_progress' || status === 'overdue') && match.assignedAt !== null ? now - match.assignedAt : null,
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

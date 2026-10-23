import { checkResult } from '../commands/matches';
import { derive, gamesWon, type Derived, type DerivedMatch, type MatchStatus } from '../derive';
import type { EngineError } from '../errors';
import { handlerFor } from '../stages';
import type {
  BracketSection,
  Competition,
  CompetitionId,
  GameScore,
  GamesToWin,
  GroupId,
  Match,
  MatchId,
  MatchPlaces,
  MatchResult,
  PlayerId,
  SlotSource,
  Stage,
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
  /** The slot resolves to a BYE: nobody will play here. */
  bye: boolean;
  /**
   * For a "winner/loser of match X" source: where match X sits, so a pending slot can show its
   * source (e.g. "W QF1"); null for other sources.
   */
  feeder: FeederView | null;
}

export interface FeederView {
  match: MatchId;
  take: 'winner' | 'loser';
  location: MatchLocationView;
  round: number;
  order: number;
}

export type MatchLocationView =
  | { kind: 'group'; group: GroupId; groupName: string }
  /**
   * A bracket match. `roundMatches` is how many matches its round of the section has (1 = final,
   * 2 = semi-finals, 4 = quarter-finals, ...) and `rounds` how many rounds the section has.
   */
  | { kind: 'bracket'; section: BracketSection; roundMatches: number; rounds: number };

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
  /** For a ready match: since when it could have been called (see the waiting list); null if always. */
  readySince: Timestamp | null;
  /** For a busy match: where its players are playing right now. Empty otherwise. */
  busyWith: BusyView[];
  /** A BYE decided the match: nobody plays it and the other slot goes through. */
  decidedByBye: boolean;
  /** Whether a games-only result (e.g. 3:1) is accepted; group matches need every game's points. */
  gamesOnlyAllowed: boolean;
  /** The final places the match decides (bracket matches), e.g. a quarter-final's loser: 5–8. */
  places: MatchPlaces | null;
}

/** A recorded result as shown: winner, games won and (unless games-only) each game's points. */
export function resultView(result: MatchResult): ResultView {
  const won: [number, number] = result.kind === 'games' ? gamesWon(result.games) : [...result.games];
  return {
    winner: won[0] > won[1] ? 0 : 1,
    gamesWon: won,
    games: result.kind === 'games' ? result.games.map(([a, b]) => [a, b]) : null,
  };
}

export function locationView(match: Match, stage: Stage): MatchLocationView {
  const { location } = match;
  switch (location.kind) {
    case 'group': {
      const group = stage.type === 'groups' ? stage.groups.find((g) => g.id === location.group) : undefined;
      return { kind: 'group', group: location.group, groupName: group?.name ?? '' };
    }
    case 'bracket': {
      const section = stage.matches.filter((m) => m.location.kind === 'bracket' && m.location.section === location.section);
      return {
        kind: 'bracket',
        section: location.section,
        roundMatches: section.filter((m) => m.round === match.round).length,
        rounds: new Set(section.map((m) => m.round)).size,
      };
    }
  }
}

function feederView(competition: Competition, source: SlotSource): FeederView | null {
  if (source.kind !== 'matchResult') return null;
  for (const stage of competition.stages) {
    const feeder = stage.matches.find((m) => m.id === source.match);
    if (feeder) return { match: feeder.id, take: source.take, location: locationView(feeder, stage), round: feeder.round, order: feeder.order };
  }
  return null;
}

/** A player of a busy match who is on a table elsewhere (possibly in another competition). */
export interface BusyView {
  player: PlayerId;
  match: MatchId;
  competition: CompetitionId;
  /** The table number that match is on. */
  table: number | null;
}

export function matchView(state: TournamentState, derived: DerivedMatch, now: Timestamp): MatchView {
  const { match, competition, stage, stageIndex, entries, byes, winner } = derived;
  const expected = expectedMs(state, competition.gamesToWin);
  const elapsedMs = derived.status === 'in_progress' && match.assignedAt !== null ? now - match.assignedAt : null;
  const overdue = elapsedMs === null ? null : overdueLevel(elapsedMs, expected);
  // Overdue needs `now`, so it is decided here rather than in `derive`.
  const status: MatchStatus = overdue ? 'overdue' : derived.status;
  const tableNumber = (id: TableId | null) => (id === null ? null : (state.tables.find((t) => t.id === id)?.number ?? null));
  const table = match.table === null ? null : state.tables.find((t) => t.id === match.table);
  const { result } = match;
  return {
    id: match.id,
    competition: competition.id,
    stage: stage.id,
    stageIndex,
    location: locationView(match, stage),
    round: match.round,
    order: match.order,
    gamesToWin: competition.gamesToWin,
    slots: [0, 1].map((i) => ({
      source: structuredClone(match.slots[i]),
      entry: entries[i] ? entryView(state, entries[i]) : null,
      bye: byes[i],
      feeder: feederView(competition, match.slots[i]),
    })) as [SlotView, SlotView],
    status,
    table: table ? { id: table.id, number: table.number } : null,
    assignedAt: match.assignedAt,
    finishedAt: match.finishedAt,
    elapsedMs,
    expectedMs: expected,
    overdue,
    result: result && winner !== null ? resultView(result) : null,
    readySince: status === 'ready' ? derived.waitingSince : null,
    busyWith: derived.busyWith.map((b) => ({ player: b.player, match: b.match.id, competition: b.competition.id, table: tableNumber(b.match.table) })),
    decidedByBye: derived.decidedByBye,
    gamesOnlyAllowed: handlerFor(stage).allowsGamesOnly,
    places: match.places ? structuredClone(match.places) : null,
  };
}

/** One match, or null when it doesn't exist. */
export function getMatch(state: TournamentState, id: MatchId, now: Timestamp): MatchView | null {
  const derived = derive(state).match(id);
  return derived ? matchView(state, derived, now) : null;
}

export type { Derived, MatchStatus };

export interface WaitingListOptions {
  /** Only this competition's matches; all competitions merged when left out. */
  competition?: CompetitionId;
}

/**
 * The matches that could be called now, in priority order: busy ones (a player is on another
 * table) last; then earlier stage, then earlier round, then the match that has been ready
 * longest (never-played players count as ready from the start); then competition and draw order.
 * Play-off ordering comes with #0012.
 */
export function getWaitingList(state: TournamentState, now: Timestamp, options: WaitingListOptions = {}): MatchView[] {
  const competitionOrder = new Map(state.competitions.map((c, i) => [c.id, i]));
  return derive(state)
    .matches.map((m, drawOrder) => ({ m, drawOrder }))
    .filter(({ m }) => m.status === 'ready' || m.status === 'busy')
    .filter(({ m }) => options.competition === undefined || m.competition.id === options.competition)
    .sort(
      (x, y) =>
        Number(x.m.status === 'busy') - Number(y.m.status === 'busy') ||
        x.m.stageIndex - y.m.stageIndex ||
        x.m.match.round - y.m.match.round ||
        (x.m.waitingSince ?? -Infinity) - (y.m.waitingSince ?? -Infinity) ||
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

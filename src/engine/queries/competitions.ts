import { handlerFor } from '../stages';
import type { Competition, CompetitionId, DrawState, Entry, EntryId, GamesToWin, PlayerId, StageConfig, StageId, TournamentState } from '../types';

export interface CompetitionSummaryView {
  id: CompetitionId;
  name: string;
  gamesToWin: GamesToWin;
  entryCount: number;
}

/** All competitions, in the order they were added. */
export function getCompetitions(state: TournamentState): CompetitionSummaryView[] {
  return state.competitions.map((c) => ({ id: c.id, name: c.name, gamesToWin: c.gamesToWin, entryCount: c.entries.length }));
}

/** A player as shown inside an entry. */
export interface EntryPlayerView {
  id: PlayerId;
  firstName: string;
  lastName: string;
  club: string;
}

export interface EntryView {
  id: EntryId;
  seed: number | null;
  players: EntryPlayerView[];
}

export interface CompetitionView {
  id: CompetitionId;
  name: string;
  gamesToWin: GamesToWin;
  /** Seeded entries first (by seed), then the rest by last name and first name. */
  entries: EntryView[];
  /** The stage chain in order, with each stage's options. */
  stages: StageSummaryView[];
}

export type StageSummaryView = { id: StageId; drawState: DrawState } & StageConfig;

/** One competition with its entries and stage chain, or null when it doesn't exist. */
export function getCompetition(state: TournamentState, id: CompetitionId): CompetitionView | null {
  const competition = state.competitions.find((c) => c.id === id);
  if (!competition) return null;
  const entries = competition.entries.map((e) => entryView(state, e)).sort(entryOrder);
  return { id: competition.id, name: competition.name, gamesToWin: competition.gamesToWin, entries, stages: competition.stages.map((s) => ({ id: s.id, drawState: s.drawState, ...structuredClone(handlerFor(s).config(s)) })) };
}

export function entryView(state: TournamentState, entry: Entry): EntryView {
  const players = entry.players.map((id) => {
    const p = state.players.find((x) => x.id === id);
    return { id, firstName: p?.firstName ?? '', lastName: p?.lastName ?? '', club: p?.club ?? '' };
  });
  return { id: entry.id, seed: entry.seed, players };
}

export function findEntry(competition: Competition, id: EntryId): Entry | undefined {
  return competition.entries.find((e) => e.id === id);
}

const nameOrder = new Intl.Collator('pl', { sensitivity: 'base' });

function entryOrder(a: EntryView, b: EntryView): number {
  if (a.seed !== null || b.seed !== null) return (a.seed ?? Infinity) - (b.seed ?? Infinity);
  const [pa, pb] = [a.players[0], b.players[0]];
  return nameOrder.compare(pa.lastName, pb.lastName) || nameOrder.compare(pa.firstName, pb.firstName);
}

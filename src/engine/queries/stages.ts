import { derive } from '../derive';
import { findStage } from '../locate';
import type { TiebreakRule } from '../stages/tiebreak';
import type { CompetitionId, DrawState, EntryId, Grouping, GroupId, StageId, Timestamp, TournamentState } from '../types';
import { entryView, type EntryView } from './competitions';
import { doubleEliminationView, singleEliminationView, type DoubleEliminationStageView, type SingleEliminationStageView } from './bracket';
import { matchView, originView, type MatchView, type SlotView } from './matches';

export interface StandingsRowView {
  /** 1-based draw position in the group. */
  position: number;
  /** null while the position's source (e.g. "1A") isn't decided. */
  entry: EntryView | null;
  played: number;
  won: number;
  lost: number;
  gamesWon: number;
  gamesLost: number;
  pointsWon: number;
  pointsLost: number;
  groupPoints: number;
  place: number;
  /** In a tie the rules can't break that the operator hasn't resolved yet: the place isn't decided. */
  tied: boolean;
}

/** One entry's record in the matches between the entries of a tied set. */
export interface TiedRecordView {
  entry: EntryView;
  groupPoints: number;
  gamesWon: number;
  gamesLost: number;
  pointsWon: number;
  pointsLost: number;
}

/** The tiebreak trace between place `place` and `place + 1`. */
export interface TiebreakStepView {
  /** The upper of the two places. */
  place: number;
  /** null: nothing separates them (an unresolved tie). */
  rule: TiebreakRule | null;
  /** The entries compared when the rule applied (the whole group for `groupPoints`). */
  among: EntryView[];
  /** Their records in the matches between them; empty for `groupPoints`. */
  records: TiedRecordView[];
}

/** A tie the tiebreak rules can't break. */
export interface TieView {
  /** In the current standings order. */
  entries: EntryView[];
  /** How the operator settled it; null = still to be settled with `resolveTie`. */
  resolution: 'decision' | 'lot' | null;
}

export interface GroupView {
  id: GroupId;
  name: string;
  /** In draw position order. */
  entries: SlotView[];
  /** In standings order. */
  standings: StandingsRowView[];
  /** `tiebreak[i]` says what separates `standings[i]` from `standings[i + 1]`. */
  tiebreak: TiebreakStepView[];
  /** Ties the rules can't break, settled by the operator or not. */
  ties: TieView[];
  /** In play order: round, then order within the round. */
  matches: MatchView[];
  /** Every match has a result. */
  complete: boolean;
}

export interface GroupsStageView {
  type: 'groups';
  id: StageId;
  competition: CompetitionId;
  index: number;
  drawState: DrawState;
  grouping: Grouping;
  groups: GroupView[];
}

/** A stage with its draw and matches: groups with standings, or a bracket with its sections. */
export type StageView = GroupsStageView | SingleEliminationStageView | DoubleEliminationStageView;

export function getStage(state: TournamentState, id: StageId, now: Timestamp): StageView | null {
  const located = findStage(state, id);
  if (!located.ok) return null;
  const { competition, stage, index } = located.value;
  const derived = derive(state);
  const view = (matchId: string) => matchView(state, derived.match(matchId)!, now);
  if (stage.type === 'singleElimination') return singleEliminationView(stage, competition.id, index, view);
  if (stage.type === 'doubleElimination') return doubleEliminationView(stage, competition.id, index, view);
  const entry = (id: EntryId) => entryView(state, competition.entries.find((e) => e.id === id)!);

  const groups = stage.groups.map((group): GroupView => {
    const standings = derived.standings(stage, group);
    const matches = stage.matches
      .filter((m) => m.location.kind === 'group' && m.location.group === group.id)
      .sort((a, b) => a.round - b.round || a.order - b.order)
      .map((m) => view(m.id));
    return {
      id: group.id,
      name: group.name,
      entries: group.entries.map((source) => {
        const entry = derived.resolve(competition, source);
        return { source: structuredClone(source), entry: entry ? entryView(state, entry) : null, bye: source.kind === 'bye', feeder: null, origin: originView(competition, source) };
      }),
      standings: standings.rows.map((row) => ({ ...row, entry: row.entry ? entryView(state, row.entry) : null })),
      tiebreak: standings.steps.map((step) => ({
        place: step.place,
        rule: step.rule,
        among: step.among.map(entry),
        records: step.records.map((record) => ({ ...record, entry: entry(record.entry) })),
      })),
      ties: standings.ties.map((tie) => ({ entries: tie.entries.map(entry), resolution: tie.resolution })),
      matches,
      complete: standings.complete,
    };
  });

  return {
    type: 'groups',
    id: stage.id,
    competition: competition.id,
    index,
    drawState: stage.drawState,
    grouping: { ...stage.grouping },
    groups,
  };
}

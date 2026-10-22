import { derive } from '../derive';
import { findStage } from '../locate';
import type { CompetitionId, DrawState, Grouping, GroupId, StageId, Timestamp, TournamentState } from '../types';
import { entryView, type EntryView } from './competitions';
import { matchView, type MatchView, type SlotView } from './matches';

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
}

export interface GroupView {
  id: GroupId;
  name: string;
  /** In draw position order. */
  entries: SlotView[];
  /** In standings order. */
  standings: StandingsRowView[];
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

/** A stage with its draw, standings and matches. Bracket stage views join this union. */
export type StageView = GroupsStageView;

export function getStage(state: TournamentState, id: StageId, now: Timestamp): StageView | null {
  const located = findStage(state, id);
  if (!located.ok) return null;
  const { competition, stage, index } = located.value;
  const derived = derive(state);
  const view = (matchId: string) => matchView(state, derived.match(matchId)!, now);

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
        return { source: structuredClone(source), entry: entry ? entryView(state, entry) : null };
      }),
      standings: standings.rows.map((row) => ({ ...row, entry: row.entry ? entryView(state, row.entry) : null })),
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

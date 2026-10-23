import { fail, ok, type Result } from './result';
import type { Competition, Group, GroupId, Match, MatchId, Stage, StageId, TournamentState } from './types';

/** Where a stage lives. */
export interface StageLocation {
  competition: Competition;
  stage: Stage;
  /** Position in the competition's stage chain (0 = first). */
  index: number;
}

export function findStage(state: TournamentState, id: StageId): Result<StageLocation> {
  for (const competition of state.competitions) {
    const index = competition.stages.findIndex((s) => s.id === id);
    if (index !== -1) return ok({ competition, stage: competition.stages[index], index });
  }
  return fail({ code: 'stageNotFound', stage: id });
}

/** A group of a stage by id; undefined when the stage has no such group (or is no groups stage). */
export function findGroup(stage: Stage, id: GroupId): Group | undefined {
  return stage.type === 'groups' ? stage.groups.find((g) => g.id === id) : undefined;
}

export interface MatchLocated extends StageLocation {
  match: Match;
}

export function findMatch(state: TournamentState, id: MatchId): Result<MatchLocated> {
  for (const competition of state.competitions) {
    for (const [index, stage] of competition.stages.entries()) {
      const match = stage.matches.find((m) => m.id === id);
      if (match) return ok({ competition, stage, index, match });
    }
  }
  return fail({ code: 'matchNotFound', match: id });
}

export function replaceCompetition(state: TournamentState, competition: Competition): TournamentState {
  return { ...state, competitions: state.competitions.map((c) => (c.id === competition.id ? competition : c)) };
}

/** Replaces a stage in its competition. */
export function replaceStage(state: TournamentState, competition: Competition, stage: Stage): TournamentState {
  return replaceCompetition(state, { ...competition, stages: competition.stages.map((s) => (s.id === stage.id ? stage : s)) });
}

/** Replaces one match, wherever it is. */
export function replaceMatch(state: TournamentState, located: MatchLocated, match: Match): TournamentState {
  const stage = { ...located.stage, matches: located.stage.matches.map((m) => (m.id === match.id ? match : m)) };
  return replaceStage(state, located.competition, stage);
}

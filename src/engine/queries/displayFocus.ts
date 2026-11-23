import type { CompetitionId, GroupId, MatchId, StageId, StageType, Timestamp, TournamentState } from '../types';
import { getStage, type StageView } from './stages';
import type { MatchView } from './matches';

/** One group the display shows, with the matches worth showing in it: the one in play, then the next one. */
export interface DisplayGroupFocus {
  group: GroupId;
  matches: MatchId[];
}

/** What the display needs to know about one stage of a competition (#0030). */
export interface DisplayStageFocus {
  stage: StageId;
  type: StageType;
  /** Some match that is not decided by a BYE is ready, in play or done. */
  started: boolean;
  /** Every match that is played has its result. */
  finished: boolean;
  /**
   * Groups stages only: the groups to show. All of them while the next stage hasn't started; once it
   * has, only the groups that are not finished yet. Empty for a bracket stage.
   */
  groups: DisplayGroupFocus[];
}

const inPlay = (m: MatchView) => m.status === 'in_progress' || m.status === 'overdue';
const isDone = (m: MatchView) => m.status === 'finished' || m.status === 'walkover';

/** The matches a stage plays: BYE-decided and switched-off ones aren't played. */
function playedMatches(stage: StageView): MatchView[] {
  const all = stage.type === 'groups' ? stage.groups.flatMap((g) => g.matches) : stage.sections.flatMap((s) => s.rounds.flatMap((r) => r.matches));
  return all.filter((m) => !m.decidedByBye && m.status !== 'disabled');
}

/**
 * What to show of a competition on the second screen right now: per stage, whether it has started and
 * finished, and for groups stages which groups are still current and which of their matches to show.
 * Empty when the competition doesn't exist. Pure, like every query; `now` only feeds the match views.
 */
export function getDisplayFocus(state: TournamentState, competition: CompetitionId, now: Timestamp): DisplayStageFocus[] {
  const found = state.competitions.find((c) => c.id === competition);
  if (!found) return [];
  const views = found.stages.map((s) => getStage(state, s.id, now));
  const progress = views.map((view) => {
    const matches = view ? playedMatches(view) : [];
    return { started: matches.some((m) => m.status !== 'pending'), finished: matches.length > 0 && matches.every(isDone) };
  });
  return found.stages.map((stage, i) => {
    const view = views[i];
    const laterStarted = progress.slice(i + 1).some((p) => p.started);
    const groups =
      view?.type === 'groups'
        ? view.groups
            .filter((g) => !laterStarted || !g.complete)
            .map((g): DisplayGroupFocus => {
              const open = g.matches.filter((m) => !isDone(m) && m.status !== 'disabled');
              const next = open.find((m) => !inPlay(m));
              return { group: g.id, matches: [...open.filter(inPlay), ...(next ? [next] : [])].slice(0, 2).map((m) => m.id) };
            })
        : [];
    return { stage: stage.id, type: stage.type, ...progress[i], groups };
  });
}

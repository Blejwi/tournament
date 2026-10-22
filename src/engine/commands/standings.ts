import { derive } from '../derive';
import { findStage, replaceStage } from '../locate';
import { fail, ok, type Result } from '../result';
import type { EntryId, GroupId, StageId, TieResolution, TournamentState } from '../types';

export type StandingsCommand =
  /**
   * Settles a tie the tiebreak rules can't break, once the group is complete: `order` (best first)
   * must hold exactly the tied entries. It replaces any earlier order for the same entries.
   */
  { type: 'resolveTie'; stage: StageId; group: GroupId; order: EntryId[]; method: TieResolution['method'] };

type Cmd<T extends StandingsCommand['type']> = Extract<StandingsCommand, { type: T }>;

export function resolveTie(state: TournamentState, cmd: Cmd<'resolveTie'>): Result<TournamentState> {
  const located = findStage(state, cmd.stage);
  if (!located.ok) return located;
  const { competition, stage } = located.value;
  const group = stage.type === 'groups' ? stage.groups.find((g) => g.id === cmd.group) : undefined;
  if (stage.type !== 'groups' || !group) return fail({ code: 'groupNotFound', group: cmd.group });
  const standings = derive(state).standings(stage, group);
  if (!standings.complete) return fail({ code: 'groupNotComplete' });
  const sameSet = (entries: EntryId[]) => entries.length === cmd.order.length && entries.every((e) => cmd.order.includes(e));
  if (new Set(cmd.order).size !== cmd.order.length || !standings.ties.some((tie) => sameSet(tie.entries))) {
    return fail({ code: 'tieNotFound' });
  }
  const resolution: TieResolution = { entries: [...cmd.order], method: cmd.method };
  const tieResolutions = [...group.tieResolutions.filter((r) => !sameSet(r.entries)), resolution];
  const groups = stage.groups.map((g) => (g.id === group.id ? { ...g, tieResolutions } : g));
  return ok(replaceStage(state, competition, { ...stage, groups }));
}

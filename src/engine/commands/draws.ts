import { idSource } from '../ids';
import { appendLog } from '../log';
import { findGroup, findStage, replaceStage } from '../locate';
import { firstRoundSource } from '../stages/bracket';
import { fail, ok, type Result } from '../result';
import { handlerFor, type DrawPosition, type StageHandler } from '../stages';
import type { Competition, LoggedDrawPlace, Stage, StageId, Timestamp, TournamentState } from '../types';

/**
 * Fixing a draw by hand before the stage is confirmed (spec user stories 17 and 36). Re-drawing
 * is `generateDraw` with a new random seed; confirming (`confirmStage`) locks the draw.
 */
export type DrawCommand =
  /** Swaps whoever sits on two draw positions (an entrant or, in a bracket, a BYE). */
  | { type: 'swapSlots'; at: Timestamp; stage: StageId; a: DrawPosition; b: DrawPosition }
  /**
   * Moves the entrant on `from` to `to`: in groups, into another group (or another place in the
   * same group) at `to.position`, which may be one past the group's last position; in a bracket,
   * onto a BYE, which takes the entrant's old position.
   */
  | { type: 'movePlayer'; at: Timestamp; stage: StageId; from: DrawPosition; to: DrawPosition };

type Cmd<T extends DrawCommand['type']> = Extract<DrawCommand, { type: T }>;

export function swapSlots(state: TournamentState, cmd: Cmd<'swapSlots'>): Result<TournamentState> {
  const located = findStage(state, cmd.stage);
  if (!located.ok) return located;
  const ids = idSource(state);
  const edited = editDraw(state, cmd.stage, (stage, handler) =>
    handler.swapPositions ? handler.swapPositions(stage, cmd.a, cmd.b, ids) : fail({ code: 'drawEditNotSupported' }),
  );
  if (!edited.ok) return edited;
  const { competition, stage } = located.value;
  return ok(
    appendLog(ids.commit(edited.value), {
      type: 'drawSlotsSwapped',
      at: cmd.at,
      competition: competition.id,
      stage: stage.id,
      a: loggedPlace(competition, stage, cmd.a),
      b: loggedPlace(competition, stage, cmd.b),
    }),
  );
}

export function movePlayer(state: TournamentState, cmd: Cmd<'movePlayer'>): Result<TournamentState> {
  const located = findStage(state, cmd.stage);
  if (!located.ok) return located;
  const ids = idSource(state);
  const edited = editDraw(state, cmd.stage, (stage, handler) =>
    handler.movePosition ? handler.movePosition(stage, cmd.from, cmd.to, ids) : fail({ code: 'drawEditNotSupported' }),
  );
  if (!edited.ok) return edited;
  const { competition, stage } = located.value;
  return ok(
    appendLog(ids.commit(edited.value), {
      type: 'drawPlayerMoved',
      at: cmd.at,
      competition: competition.id,
      stage: stage.id,
      from: loggedPlace(competition, stage, cmd.from),
      to: loggedPlace(competition, stage, cmd.to),
    }),
  );
}

/** A draw position as it is in `stage` (take it before the edit): its group's name and who sits there. */
function loggedPlace(competition: Competition, stage: Stage, at: DrawPosition): LoggedDrawPlace {
  const group = at.kind === 'group' ? findGroup(stage, at.group) : undefined;
  const source = group ? group.entries[at.position - 1] : at.kind === 'bracket' ? firstRoundSource(stage.matches, stage.type === 'doubleElimination' ? 'winners' : 'main', at) : null;
  const players = source?.kind === 'entry' ? (competition.entries.find((e) => e.id === source.entry)?.players ?? []) : [];
  return { group: group?.name ?? null, position: at.position, players: [...players] };
}

/** Runs a draw edit on a drawn, not yet confirmed stage. */
function editDraw(
  state: TournamentState,
  id: StageId,
  edit: (stage: Stage, handler: StageHandler) => Result<Stage>,
): Result<TournamentState> {
  const located = findStage(state, id);
  if (!located.ok) return located;
  const { competition, stage } = located.value;
  if (stage.drawState === 'confirmed') return fail({ code: 'stageConfirmed' });
  if (stage.drawState === 'notDrawn') return fail({ code: 'stageNotDrawn' });
  const edited = edit(stage, handlerFor(stage));
  if (!edited.ok) return edited;
  return ok(replaceStage(state, competition, edited.value));
}

import { idSource } from '../ids';
import { findStage, replaceStage } from '../locate';
import { fail, ok, type Result } from '../result';
import { handlerFor, type DrawPosition, type StageHandler } from '../stages';
import type { Stage, StageId, TournamentState } from '../types';

/**
 * Fixing a draw by hand before the stage is confirmed (spec user stories 17 and 36). Re-drawing
 * is `generateDraw` with a new random seed; confirming (`confirmStage`) locks the draw.
 */
export type DrawCommand =
  /** Swaps whoever sits on two draw positions (an entrant or, in a bracket, a BYE). */
  | { type: 'swapSlots'; stage: StageId; a: DrawPosition; b: DrawPosition }
  /**
   * Moves the entrant on `from` to `to`: in groups, into another group (or another place in the
   * same group) at `to.position`, which may be one past the group's last position; in a bracket,
   * onto a BYE, which takes the entrant's old position.
   */
  | { type: 'movePlayer'; stage: StageId; from: DrawPosition; to: DrawPosition };

type Cmd<T extends DrawCommand['type']> = Extract<DrawCommand, { type: T }>;

export function swapSlots(state: TournamentState, cmd: Cmd<'swapSlots'>): Result<TournamentState> {
  return editDraw(state, cmd.stage, (stage, handler) =>
    handler.swapPositions ? handler.swapPositions(stage, cmd.a, cmd.b) : fail({ code: 'drawEditNotSupported' }),
  );
}

export function movePlayer(state: TournamentState, cmd: Cmd<'movePlayer'>): Result<TournamentState> {
  const ids = idSource(state);
  const next = editDraw(state, cmd.stage, (stage, handler) =>
    handler.movePosition ? handler.movePosition(stage, cmd.from, cmd.to, ids) : fail({ code: 'drawEditNotSupported' }),
  );
  return next.ok ? ok(ids.commit(next.value)) : next;
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

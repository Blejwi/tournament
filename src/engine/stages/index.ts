import type { Stage, StageConfig, StageType } from '../types';
import { groupsHandler } from './groups';
import { singleEliminationHandler } from './singleElimination';
import type { StageHandler } from './handler';

export type { DrawContext, DrawEntrant, StageHandler } from './handler';

/** One handler per stage type; TypeScript rejects a missing entry when a stage type is added. */
const handlers: { [T in StageType]: StageHandler<Extract<Stage, { type: T }>> } = {
  groups: groupsHandler,
  singleElimination: singleEliminationHandler,
};

/** The handler for a stage (or stage config) of any type. */
export function handlerFor(stage: Stage | StageConfig): StageHandler {
  return handlers[stage.type] as StageHandler;
}

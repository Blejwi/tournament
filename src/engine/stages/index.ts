import type { Stage, StageConfig, StageType } from '../types';
import { groupsHandler } from './groups';
import { singleEliminationHandler } from './singleElimination';
import { doubleEliminationHandler } from './doubleElimination';
import type { StageHandler } from './handler';

export { ADVANCERS_PER_GROUP, advancersOf, isComplete as isStageComplete, isSupportedChain } from './chain';
export type { DrawContext, DrawEntrant, DrawPosition, StageHandler } from './handler';

/** One handler per stage type; TypeScript rejects a missing entry when a stage type is added. */
const handlers: { [T in StageType]: StageHandler<Extract<Stage, { type: T }>> } = {
  groups: groupsHandler,
  singleElimination: singleEliminationHandler,
  doubleElimination: doubleEliminationHandler,
};

/** The handler for a stage (or stage config) of any type. */
export function handlerFor(stage: Stage | StageConfig): StageHandler {
  return handlers[stage.type] as StageHandler;
}

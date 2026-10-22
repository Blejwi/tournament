import type { Result } from '../result';
import type { TournamentState } from '../types';
import * as competitions from './competitions';
import * as players from './players';
import * as stages from './stages';
import * as tables from './tables';

/** Every command the engine accepts, as a discriminated union on `type`. */
export type Command = tables.TableCommand | players.PlayerCommand | competitions.CompetitionCommand
  | stages.StageCommand;

export type CommandType = Command['type'];

type Handler<C extends Command> = (state: TournamentState, cmd: C) => Result<TournamentState>;

/** One handler per command type; TypeScript rejects a missing or extra entry. */
const handlers: { [K in CommandType]: Handler<Extract<Command, { type: K }>> } = {
  addTable: tables.addTable,
  updateTable: tables.updateTable,
  setTableActive: tables.setTableActive,
  removeTable: tables.removeTable,
  addPlayer: players.addPlayer,
  updatePlayer: players.updatePlayer,
  addCompetition: competitions.addCompetition,
  enterPlayer: competitions.enterPlayer,
  removeEntry: competitions.removeEntry,
  setSeed: competitions.setSeed,
  configureStages: stages.configureStages,
  generateDraw: stages.generateDraw,
  confirmStage: stages.confirmStage,
};

/** Applies a command to the state: returns the new state, or a typed error. Never mutates `state`. */
export function execute(state: TournamentState, cmd: Command): Result<TournamentState> {
  const handler = handlers[cmd.type] as Handler<Command>;
  return handler(state, cmd);
}

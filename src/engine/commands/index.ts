import type { Result } from '../result';
import type { TournamentState } from '../types';
import * as competitions from './competitions';
import * as corrections from './corrections';
import * as matches from './matches';
import * as players from './players';
import * as settings from './settings';
import * as stages from './stages';
import * as standings from './standings';
import * as tables from './tables';

/** Every command the engine accepts, as a discriminated union on `type`. */
export type Command =
  | tables.TableCommand
  | players.PlayerCommand
  | competitions.CompetitionCommand
  | stages.StageCommand
  | matches.MatchCommand
  | corrections.CorrectionCommand
  | settings.SettingsCommand
  | standings.StandingsCommand;

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
  assignMatch: matches.assignMatch,
  unassignMatch: matches.unassignMatch,
  setMatchStart: matches.setMatchStart,
  recordResult: matches.recordResult,
  correctResult: corrections.correctResult,
  setExpectedDuration: settings.setExpectedDuration,
  resolveTie: standings.resolveTie,
};

/** Applies a command to the state: returns the new state, or a typed error. Never mutates `state`. */
export function execute(state: TournamentState, cmd: Command): Result<TournamentState> {
  const handler = handlers[cmd.type] as Handler<Command>;
  return handler(state, cmd);
}

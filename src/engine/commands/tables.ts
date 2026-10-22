import { allocateId } from '../ids';
import { tableInUse } from './matches';
import { fail, ok, type Result } from '../result';
import type { Table, TableId, TournamentState } from '../types';

export type TableCommand =
  | { type: 'addTable'; number: number; name?: string }
  | { type: 'updateTable'; table: TableId; number: number; name: string }
  | { type: 'setTableActive'; table: TableId; active: boolean }
  | { type: 'removeTable'; table: TableId };

type Cmd<T extends TableCommand['type']> = Extract<TableCommand, { type: T }>;

function checkNumber(state: TournamentState, number: number, except?: TableId): Result<void> {
  if (!Number.isInteger(number) || number < 1) return fail({ code: 'invalidTableNumber' });
  if (state.tables.some((t) => t.number === number && t.id !== except)) {
    return fail({ code: 'tableNumberTaken', number });
  }
  return ok(undefined);
}

function updateExisting(
  state: TournamentState,
  id: TableId,
  change: (table: Table) => Table,
): Result<TournamentState> {
  if (!state.tables.some((t) => t.id === id)) return fail({ code: 'tableNotFound', table: id });
  return ok({ ...state, tables: state.tables.map((t) => (t.id === id ? change(t) : t)) });
}

export function addTable(state: TournamentState, cmd: Cmd<'addTable'>): Result<TournamentState> {
  const valid = checkNumber(state, cmd.number);
  if (!valid.ok) return valid;
  const [id, next] = allocateId(state, 'table');
  const table: Table = { id, number: cmd.number, name: (cmd.name ?? '').trim(), active: true };
  return ok({ ...next, tables: [...next.tables, table] });
}

export function updateTable(state: TournamentState, cmd: Cmd<'updateTable'>): Result<TournamentState> {
  if (!exists(state, cmd.table)) return fail({ code: 'tableNotFound', table: cmd.table });
  const valid = checkNumber(state, cmd.number, cmd.table);
  if (!valid.ok) return valid;
  return updateExisting(state, cmd.table, (t) => ({ ...t, number: cmd.number, name: cmd.name.trim() }));
}

export function setTableActive(state: TournamentState, cmd: Cmd<'setTableActive'>): Result<TournamentState> {
  return updateExisting(state, cmd.table, (t) => ({ ...t, active: cmd.active }));
}

export function removeTable(state: TournamentState, cmd: Cmd<'removeTable'>): Result<TournamentState> {
  const table = state.tables.find((t) => t.id === cmd.table);
  if (!table) return fail({ code: 'tableNotFound', table: cmd.table });
  if (tableInUse(state, table.id)) return fail({ code: 'tableInUse', number: table.number });
  return ok({ ...state, tables: state.tables.filter((t) => t.id !== cmd.table) });
}

function exists(state: TournamentState, id: TableId): boolean {
  return state.tables.some((t) => t.id === id);
}

import { describe, expect, it } from 'vitest';
import { execute, getTables, type TournamentState } from '@/engine';
import { errorOf, newTournament, unwrap } from './helpers';

function withTables(...numbers: number[]): TournamentState {
  let state = newTournament();
  for (const number of numbers) state = unwrap(execute(state, { type: 'addTable', number }));
  return state;
}

const tableId = (state: TournamentState, number: number) => getTables(state).find((t) => t.number === number)!.id;

describe('tables', () => {
  it('adds a table with a number and an optional name, active by default', () => {
    let state = newTournament();
    state = unwrap(execute(state, { type: 'addTable', number: 1, name: 'By the window' }));
    state = unwrap(execute(state, { type: 'addTable', number: 2 }));

    expect(getTables(state)).toEqual([
      { id: expect.any(String), number: 1, name: 'By the window', active: true },
      { id: expect.any(String), number: 2, name: '', active: true },
    ]);
  });

  it('lists tables by number, whatever order they were added in', () => {
    const state = withTables(3, 1, 2);
    expect(getTables(state).map((t) => t.number)).toEqual([1, 2, 3]);
  });

  it('rejects a table number that is already taken', () => {
    const state = withTables(1);
    expect(errorOf(execute(state, { type: 'addTable', number: 1 }))).toEqual({
      code: 'tableNumberTaken',
      number: 1,
    });
  });

  it('rejects a table number that is not a positive whole number', () => {
    const state = newTournament();
    for (const number of [0, -1, 1.5, Number.NaN]) {
      expect(errorOf(execute(state, { type: 'addTable', number }))).toEqual({
        code: 'invalidTableNumber',
      });
    }
  });

  it('updates a table number and name', () => {
    let state = withTables(1, 2);
    state = unwrap(execute(state, { type: 'updateTable', table: tableId(state, 2), number: 5, name: 'Back' }));

    expect(getTables(state).map((t) => [t.number, t.name])).toEqual([
      [1, ''],
      [5, 'Back'],
    ]);
  });

  it('keeps a table number when an update leaves it unchanged', () => {
    let state = withTables(1);
    state = unwrap(execute(state, { type: 'updateTable', table: tableId(state, 1), number: 1, name: 'Front' }));
    expect(getTables(state)[0]).toMatchObject({ number: 1, name: 'Front' });
  });

  it('rejects updating a table to a number another table has', () => {
    const state = withTables(1, 2);
    const result = execute(state, { type: 'updateTable', table: tableId(state, 2), number: 1, name: '' });
    expect(errorOf(result)).toEqual({ code: 'tableNumberTaken', number: 1 });
  });

  it('marks a table inactive and active again', () => {
    let state = withTables(1);
    const id = tableId(state, 1);

    state = unwrap(execute(state, { type: 'setTableActive', table: id, active: false }));
    expect(getTables(state)[0].active).toBe(false);

    state = unwrap(execute(state, { type: 'setTableActive', table: id, active: true }));
    expect(getTables(state)[0].active).toBe(true);
  });

  it('removes a table', () => {
    let state = withTables(1, 2);
    state = unwrap(execute(state, { type: 'removeTable', table: tableId(state, 1) }));
    expect(getTables(state).map((t) => t.number)).toEqual([2]);
  });

  it('frees the number of a removed table for a new table', () => {
    let state = withTables(1);
    const removedId = tableId(state, 1);
    state = unwrap(execute(state, { type: 'removeTable', table: removedId }));
    state = unwrap(execute(state, { type: 'addTable', number: 1 }));

    expect(getTables(state)).toHaveLength(1);
    expect(tableId(state, 1)).not.toBe(removedId);
  });

  it('reports an unknown table', () => {
    const state = withTables(1);
    const commands = [
      { type: 'updateTable', table: 'nope', number: 3, name: '' },
      { type: 'setTableActive', table: 'nope', active: false },
      { type: 'removeTable', table: 'nope' },
    ] as const;
    for (const cmd of commands) {
      expect(errorOf(execute(state, cmd))).toEqual({ code: 'tableNotFound', table: 'nope' });
    }
  });

  it('does not change the state it was given', () => {
    const state = withTables(1);
    const before = structuredClone(state);
    execute(state, { type: 'addTable', number: 2 });
    execute(state, { type: 'setTableActive', table: tableId(state, 1), active: false });
    expect(state).toEqual(before);
  });
});

import { describe, expect, it } from 'vitest';
import {
  CURRENT_SCHEMA_VERSION,
  execute,
  exportTournament,
  getPlayers,
  getTables,
  getTournament,
  importTournament,
  type TournamentState,
} from '@/engine';
import { errorOf, newTournament, unwrap } from './helpers';
import schemaV1 from './fixtures/schema-v1.json?raw';

function setUpTournament(): TournamentState {
  let state = newTournament();
  state = unwrap(execute(state, { type: 'addTable', number: 1 }));
  state = unwrap(execute(state, { type: 'addTable', number: 2, name: 'Centre court' }));
  state = unwrap(execute(state, { type: 'setTableActive', table: 'table-2', active: false }));
  state = unwrap(execute(state, { type: 'addPlayer', firstName: 'Anna', lastName: 'Nowak', club: 'KS Orzeł', rating: 1520 }));
  state = unwrap(execute(state, { type: 'addPlayer', firstName: 'Jan', lastName: 'Kowalski', club: '', birthYear: 2011 }));
  return state;
}

describe('exporting and importing a tournament', () => {
  it('gives back an identical tournament', () => {
    const original = setUpTournament();

    const file = exportTournament(original);
    const imported = unwrap(importTournament({ id: original.id, file }));

    expect(imported).toEqual(original);
    expect(getTournament(imported)).toEqual(getTournament(original));
    expect(getTables(imported)).toEqual(getTables(original));
    expect(getPlayers(imported)).toEqual(getPlayers(original));
  });

  it('gives the imported tournament the id chosen by the caller', () => {
    const file = exportTournament(setUpTournament());
    const imported = unwrap(importTournament({ id: 'copy', file }));
    expect(getTournament(imported)).toMatchObject({ id: 'copy', name: 'Spring Open' });
  });

  it('writes the schema version, the tournament and an empty change log', () => {
    const file = JSON.parse(exportTournament(newTournament()));
    expect(file).toEqual({
      schemaVersion: 2,
      tournament: expect.objectContaining({ name: 'Spring Open' }),
      log: [],
    });
  });
});

describe('importing a file with an older schema version', () => {
  it('migrates a version 1 file (the first saved format, without a change log)', () => {
    const imported = unwrap(importTournament({ id: 'restored', file: schemaV1 }));

    expect(getTournament(imported)).toEqual({ id: 'restored', name: 'Autumn Cup', date: '2026-10-03', venue: 'Sports Hall' });
    expect(getTables(imported)).toEqual([
      { id: 'table-1', number: 1, name: '', active: true },
      { id: 'table-2', number: 2, name: 'Show court', active: false },
    ]);
    expect(getPlayers(imported)).toEqual([
      { id: 'player-3', firstName: 'Ewa', lastName: 'Zielińska', club: 'AZS', rating: 1610, birthYear: null },
    ]);
  });

  it('keeps allocating fresh ids after the migration', () => {
    const imported = unwrap(importTournament({ id: 'restored', file: schemaV1 }));
    const next = unwrap(execute(imported, { type: 'addTable', number: 3 }));
    expect(getTables(next).map((t) => t.id)).toEqual(['table-1', 'table-2', 'table-4']);
  });

  it('exports a migrated tournament in the current version', () => {
    const imported = unwrap(importTournament({ id: 'restored', file: schemaV1 }));
    expect(JSON.parse(exportTournament(imported)).schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });
});

describe('importing an invalid file', () => {
  const validFile = () => JSON.parse(exportTournament(setUpTournament()));

  it('rejects text that is not JSON', () => {
    expect(errorOf(importTournament({ id: 'x', file: '{ not json' }))).toEqual({ code: 'importNotJson' });
  });

  it('rejects JSON that is not a tournament file', () => {
    for (const file of ['[]', '42', 'null', '{"name":"Spring Open"}', '{"schemaVersion":"2"}']) {
      expect(errorOf(importTournament({ id: 'x', file }))).toEqual({ code: 'importNotTournamentFile' });
    }
  });

  it('rejects a file from a newer version of the app', () => {
    const file = JSON.stringify({ ...validFile(), schemaVersion: 99 });
    expect(errorOf(importTournament({ id: 'x', file }))).toEqual({ code: 'importNewerVersion', version: 99 });
  });

  it('names the first invalid field', () => {
    const data = validFile();
    data.tournament.players[1].lastName = '';
    expect(errorOf(importTournament({ id: 'x', file: JSON.stringify(data) }))).toEqual({
      code: 'importInvalidData',
      path: 'tournament.players.1.lastName',
    });
  });

  it('rejects a missing section', () => {
    const data = validFile();
    delete data.tournament.tables;
    expect(errorOf(importTournament({ id: 'x', file: JSON.stringify(data) }))).toEqual({
      code: 'importInvalidData',
      path: 'tournament.tables',
    });
  });

  it('rejects two tables with the same number', () => {
    const data = validFile();
    data.tournament.tables[1].number = 1;
    expect(errorOf(importTournament({ id: 'x', file: JSON.stringify(data) }))).toEqual({
      code: 'importInvalidData',
      path: 'tournament.tables.1.number',
    });
  });

  it('rejects two players with the same id', () => {
    const data = validFile();
    data.tournament.players[1].id = data.tournament.players[0].id;
    expect(errorOf(importTournament({ id: 'x', file: JSON.stringify(data) }))).toEqual({
      code: 'importInvalidData',
      path: 'tournament.players.1.id',
    });
  });

  it('rejects an impossible tournament date', () => {
    const data = validFile();
    data.tournament.date = '2026-02-30';
    expect(errorOf(importTournament({ id: 'x', file: JSON.stringify(data) }))).toEqual({
      code: 'importInvalidData',
      path: 'tournament.date',
    });
  });
});

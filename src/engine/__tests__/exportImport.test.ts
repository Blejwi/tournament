import { describe, expect, it } from 'vitest';
import {
  CURRENT_SCHEMA_VERSION,
  execute,
  exportTournament,
  getCompetition,
  getCompetitions,
  getExpectedDurations,
  getChangeLog,
  getFinalPlaces,
  getPlayers,
  getWaitingList,
  getStage,
  getTables,
  getTournament,
  importTournament,
  type TournamentState,
} from '@/engine';
import { errorOf, newTournament, unwrap } from './helpers';
import { drawnBracket, drawnDoubleElimination, drawnGroups, groupsOf, run, tableId } from './scenarios';
import schemaV1 from './fixtures/schema-v1.json?raw';
import schemaV2 from './fixtures/schema-v2.json?raw';
import schemaV3 from './fixtures/schema-v3.json?raw';
import schemaV4 from './fixtures/schema-v4.json?raw';
import schemaV5 from './fixtures/schema-v5.json?raw';
import schemaV6 from './fixtures/schema-v6.json?raw';
import schemaV7 from './fixtures/schema-v7.json?raw';
import schemaV8 from './fixtures/schema-v8.json?raw';
import schemaV9 from './fixtures/schema-v9.json?raw';
import schemaV10 from './fixtures/schema-v10.json?raw';

function setUpTournament(): TournamentState {
  let state = newTournament();
  state = unwrap(execute(state, { type: 'addTable', number: 1 }));
  state = unwrap(execute(state, { type: 'addTable', number: 2, name: 'Centre court' }));
  state = unwrap(execute(state, { type: 'setTableActive', table: 'table-2', active: false }));
  state = unwrap(execute(state, { type: 'setExpectedDuration', gamesToWin: 4, minutes: 40 }));
  state = unwrap(execute(state, { type: 'addPlayer', firstName: 'Anna', lastName: 'Nowak', club: 'KS Orzeł', rating: 1520 }));
  state = unwrap(execute(state, { type: 'addPlayer', firstName: 'Jan', lastName: 'Kowalski', club: '', birthYear: 2011 }));
  return state;
}

/** A groups competition mid-play: a seeded, confirmed draw, one match finished and one on a table. */
function setUpCompetition() {
  const { state, competition, stage } = drawnGroups(5, { by: 'count', groups: 2 }, { seeds: { 1: 1 }, tables: 2 });
  const [first, second] = groupsOf(state, stage)[0].matches;
  const next = run(
    state,
    { type: 'recordResult', match: first.id, result: { kind: 'games', games: [[11, 7], [9, 11], [11, 5], [11, 8]] }, at: 1000 },
    { type: 'assignMatch', match: second.id, table: tableId(state, 2), at: 2000 },
  );
  return { state: next, competition, stage };
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
    expect(getExpectedDurations(imported)).toEqual({ 2: 15, 3: 25, 4: 40 });
  });

  it('gives back a competition with its entries, draw, results and matches in play', () => {
    const { state: original, competition, stage } = setUpCompetition();

    const imported = unwrap(importTournament({ id: original.id, file: exportTournament(original) }));

    expect(imported).toEqual(original);
    expect(getCompetition(imported, competition)).toEqual(getCompetition(original, competition));
    expect(getStage(imported, stage, 5000)).toEqual(getStage(original, stage, 5000));
  });

  it('gives back a single elimination bracket with its BYEs, places, 3rd-place match, quick and special results and withdrawals', () => {
    const { state, competition, stage } = drawnBracket(13, { thirdPlace: true, tables: 1 });
    const ready = getWaitingList(state, 0);
    const original = run(
      state,
      { type: 'recordResult', match: ready[0].id, result: { kind: 'gamesOnly', games: [3, 1] }, at: 1000 },
      { type: 'assignMatch', match: ready[1].id, table: tableId(state, 1), at: 2000 },
      { type: 'recordResult', match: ready[2].id, result: { kind: 'retirement', winner: 1, games: [[11, 4]] }, at: 2500 },
      { type: 'recordResult', match: ready[3].id, result: { kind: 'disqualification', winner: 0 }, at: 2600 },
      { type: 'withdrawPlayer', competition, entry: ready[4].slots[0].entry!.id, at: 2700 },
    );

    const imported = unwrap(importTournament({ id: original.id, file: exportTournament(original) }));

    expect(imported).toEqual(original);
    expect(getStage(imported, stage, 5000)).toEqual(getStage(original, stage, 5000));
    expect(getFinalPlaces(imported, competition)).toEqual(getFinalPlaces(original, competition));
  });

  it('gives back a double elimination bracket with its sections, drop-ins, BYEs and places', () => {
    const { state, competition, stage } = drawnDoubleElimination(13, { tables: 1 });
    const ready = getWaitingList(state, 0);
    const original = run(
      state,
      { type: 'recordResult', match: ready[0].id, result: { kind: 'gamesOnly', games: [3, 1] }, at: 1000 },
      { type: 'assignMatch', match: ready[1].id, table: tableId(state, 1), at: 2000 },
    );

    const imported = unwrap(importTournament({ id: original.id, file: exportTournament(original) }));

    expect(imported).toEqual(original);
    expect(getStage(imported, stage, 5000)).toEqual(getStage(original, stage, 5000));
    expect(getFinalPlaces(imported, competition)).toEqual(getFinalPlaces(original, competition));
  });

  it('keeps the operator’s order for a tie the rules cannot break', () => {
    const { state, stage } = drawnGroups(3, { by: 'count', groups: 1 }, { seeds: { 1: 1, 2: 2, 3: 3 } });
    // Everyone 1–1 with identical scores: a deadlock the operator settles.
    const [group] = groupsOf(state, stage);
    const threeNil = { kind: 'games' as const, games: [[11, 5], [11, 5], [11, 5]] as [number, number][] };
    let played = state;
    for (const match of group.matches) played = run(played, { type: 'recordResult', match: match.id, result: threeNil, at: 1000 });
    const order = groupsOf(played, stage)[0].ties[0].entries.map((e) => e.id).reverse();
    const original = run(played, { type: 'resolveTie', stage, group: group.id, order, method: 'lot' });

    const imported = unwrap(importTournament({ id: original.id, file: exportTournament(original) }));

    expect(imported).toEqual(original);
    expect(getStage(imported, stage, 5000)).toEqual(getStage(original, stage, 5000));
    expect(groupsOf(imported, stage)[0].ties[0].resolution).toBe('lot');
  });

  it('gives the imported tournament the id chosen by the caller', () => {
    const file = exportTournament(setUpTournament());
    const imported = unwrap(importTournament({ id: 'copy', file }));
    expect(getTournament(imported)).toMatchObject({ id: 'copy', name: 'Spring Open' });
  });

  it('writes the schema version, the tournament and an empty change log', () => {
    const file = JSON.parse(exportTournament(newTournament()));
    expect(file).toEqual({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      tournament: expect.objectContaining({ name: 'Spring Open' }),
      log: [],
    });
    expect(file.tournament).not.toHaveProperty('log');
  });

  it('gives back the change log, in its own section of the file', () => {
    const { state: original } = setUpCompetition();

    const file = exportTournament(original);
    const imported = unwrap(importTournament({ id: original.id, file }));

    expect(JSON.parse(file).log).toHaveLength(2);
    expect(getChangeLog(imported)).toEqual(getChangeLog(original));
    expect(getChangeLog(imported).map((e) => e.type)).toEqual(['matchAssigned', 'resultRecorded']);
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

  it('migrates a version 2 file (before competitions) to a tournament with no competitions', () => {
    const imported = unwrap(importTournament({ id: 'restored', file: schemaV2 }));

    expect(getTournament(imported)).toEqual({ id: 'restored', name: 'Winter Open', date: '2026-12-05', venue: '' });
    expect(getPlayers(imported).map((p) => p.lastName)).toEqual(['Wiśniewski']);
    expect(getCompetitions(imported)).toEqual([]);
    const next = unwrap(execute(imported, { type: 'addCompetition', name: 'Open' }));
    expect(getCompetitions(next).map((c) => c.id)).toEqual(['competition-3']);
  });

  it('migrates a version 7 file (before double elimination) unchanged', () => {
    const imported = unwrap(importTournament({ id: 'restored', file: schemaV7 }));

    expect(getCompetition(imported, 'competition-4')!.stages).toEqual([
      { id: 'stage-7', drawState: 'confirmed', type: 'groups', grouping: { by: 'count', groups: 1 }, carryOver: true },
    ]);
    expect(groupsOf(imported, 'stage-7')[0].matches.map((m) => [m.status, m.result?.winner])).toEqual([['finished', 0]]);
    expect(JSON.parse(exportTournament(imported)).schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('migrates a version 6 file (before the change log) to an empty log that records from now on', () => {
    const imported = unwrap(importTournament({ id: 'restored', file: schemaV6 }));

    expect(getChangeLog(imported)).toEqual([]);
    expect(groupsOf(imported, 'stage-7')[0].matches.map((m) => m.status)).toEqual(['finished']);
    const next = unwrap(execute(imported, { type: 'addTable', number: 2 }));
    expect(getChangeLog(next)).toEqual([]);
  });

  it('migrates a version 8 file (double elimination, before withdrawals) with every entry still in its competition', () => {
    const imported = unwrap(importTournament({ id: 'restored', file: schemaV8 }));

    expect(getCompetition(imported, 'competition-4')!.entries.map((e) => e.withdrawnAt)).toEqual([null, null]);
    expect(JSON.parse(exportTournament(imported)).schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('migrates a version 9 file (before place play-offs): the double elimination stage has none switched on, and any can be', () => {
    const imported = unwrap(importTournament({ id: 'restored', file: schemaV9 }));
    const stage = getCompetition(imported, 'competition-9')!.stages[0].id;
    const view = getStage(imported, stage, 0);
    if (view?.type !== 'doubleElimination') throw new Error('expected a double elimination stage');
    expect(view.playOffs.every((p) => !p.created && !p.enabled)).toBe(true);
    expect(JSON.parse(exportTournament(imported)).schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('migrates a version 10 file (before groups → groups) with carry-over on in its groups stage', () => {
    const imported = unwrap(importTournament({ id: 'restored', file: schemaV10 }));
    const file = JSON.parse(exportTournament(imported));

    expect(file.tournament.competitions[0].stages[0].carryOver).toBe(true);
    expect(file.schemaVersion).toBe(11);
  });

  it('migrates a version 7 file (before double elimination and withdrawals) with every entry still in its competition', () => {
    const imported = unwrap(importTournament({ id: 'restored', file: schemaV7 }));

    expect(getCompetition(imported, 'competition-4')!.entries.map((e) => e.withdrawnAt)).toEqual([null, null]);
    expect(groupsOf(imported, 'stage-7')[0].matches.map((m) => [m.status, m.result?.kind, m.withdrawal])).toEqual([['finished', 'games', false]]);
  });

  it('migrates a version 5 file (before brackets) unchanged', () => {
    const imported = unwrap(importTournament({ id: 'restored', file: schemaV5 }));

    expect(getCompetition(imported, 'competition-4')!.stages).toEqual([
      { id: 'stage-7', drawState: 'confirmed', type: 'groups', grouping: { by: 'count', groups: 1 }, carryOver: true },
    ]);
    expect(groupsOf(imported, 'stage-7')[0].matches.map((m) => [m.status, m.result?.winner, m.places])).toEqual([['finished', 0, null]]);
    expect(getExpectedDurations(imported)).toEqual({ 2: 15, 3: 30, 4: 35 });
  });

  it('migrates a version 4 file (before expected durations) to the default expected durations', () => {
    const imported = unwrap(importTournament({ id: 'restored', file: schemaV4 }));

    expect(getCompetitions(imported).map((c) => c.name)).toEqual(['Open']);
    expect(getExpectedDurations(imported)).toEqual({ 2: 15, 3: 25, 4: 35 });
  });

  it('migrates a version 3 file (before tie resolutions) to groups with no settled ties', () => {
    const imported = unwrap(importTournament({ id: 'restored', file: schemaV3 }));

    const [group] = groupsOf(imported, 'stage-9');
    expect(group.standings.map((r) => [r.entry!.players[0].lastName, r.groupPoints])).toEqual([
      ['Lis', 1],
      ['Kowal', 0],
      ['Sowa', 0],
    ]);
    expect(group.ties.map((t) => t.resolution)).toEqual([null]);
    expect(group.matches.map((m) => m.status)).toEqual(['finished', 'ready', 'ready']);
    expect(getExpectedDurations(imported)).toEqual({ 2: 15, 3: 25, 4: 35 });
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

  it('rejects a match slot with an unknown source', () => {
    const data = JSON.parse(exportTournament(setUpCompetition().state));
    data.tournament.competitions[0].stages[0].matches[0].slots[1] = { kind: 'somebody' };
    expect(errorOf(importTournament({ id: 'x', file: JSON.stringify(data) }))).toEqual({
      code: 'importInvalidData',
      path: 'tournament.competitions.0.stages.0.matches.0.slots.1.kind',
    });
  });

  it('rejects an impossible game score', () => {
    const data = JSON.parse(exportTournament(setUpCompetition().state));
    const finished = data.tournament.competitions[0].stages[0].matches[0];
    finished.result.games[0] = [11, -1];
    expect(errorOf(importTournament({ id: 'x', file: JSON.stringify(data) }))).toEqual({
      code: 'importInvalidData',
      path: 'tournament.competitions.0.stages.0.matches.0.result.games.0.1',
    });
  });

  it('rejects a change-log entry of an unknown type', () => {
    const data = JSON.parse(exportTournament(setUpCompetition().state));
    data.log[1].type = 'somethingHappened';
    expect(errorOf(importTournament({ id: 'x', file: JSON.stringify(data) }))).toEqual({
      code: 'importInvalidData',
      path: 'log.1.type',
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

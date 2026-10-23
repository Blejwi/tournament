import { describe, expect, it } from 'vitest';
import { execute, exportTournament, getCompetition, getFinalPlaces, getMatch, getWaitingList, importTournament, type TournamentState } from '@/engine';
import { errorOf, unwrap } from './helpers';
import { drawnBracket, drawnGroups, groupsOf, matchBetween, roundsOf, run, slotLabel, slotName, tableId } from './scenarios';

const win3: [number, number][] = [
  [11, 7],
  [11, 8],
  [11, 9],
];

/** Seeds 1..n given to P1..Pn. */
const allSeeded = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [i + 1, i + 1]));

function entryOf(state: TournamentState, competition: string, name: string): string {
  return getCompetition(state, competition)!.entries.find((e) => e.players[0].lastName === name)!.id;
}

/** P1..P4 in one group, P1 has beaten P2. */
function groupWithOneResult() {
  const { state, competition, stage } = drawnGroups(4, { by: 'count', groups: 1 }, { tables: 2 });
  const played = matchBetween(state, stage, 'P1', 'P2');
  const p1 = slotName(played, 0) === 'P1' ? 0 : 1;
  const games = win3.map(([a, b]): [number, number] => (p1 === 0 ? [a, b] : [b, a]));
  return { competition, stage, played, state: run(state, { type: 'recordResult', match: played.id, result: { kind: 'games', games }, at: 1000 }) };
}

describe('withdrawing a player from a groups stage', () => {
  it('turns the player’s remaining matches into walkovers for the opponents and keeps the results played', () => {
    const { state, competition, stage, played } = groupWithOneResult();
    const next = run(state, { type: 'withdrawPlayer', competition, entry: entryOf(state, competition, 'P1'), at: 5000 });

    for (const opponent of ['P3', 'P4']) {
      const match = matchBetween(next, stage, 'P1', opponent, 6000);
      expect(match.status).toBe('walkover');
      expect(match.withdrawal).toBe(true);
      expect(match.finishedAt).toBe(5000);
      expect(match.result).toEqual({ kind: 'walkover', winner: slotName(match, 0) === 'P1' ? 1 : 0, gamesWon: [0, 0], games: null });
    }
    expect(getMatch(next, played.id, 6000)).toMatchObject({ status: 'finished', withdrawal: false, result: { kind: 'games' }, finishedAt: 1000 });
    const p1 = groupsOf(next, stage)[0].standings.find((r) => r.entry?.players[0].lastName === 'P1')!;
    expect(p1).toMatchObject({ played: 3, won: 1, lost: 2, gamesWon: 3, gamesLost: 0, groupPoints: 1 });
    expect(getCompetition(next, competition)!.entries.find((e) => e.players[0].lastName === 'P1')!.withdrawnAt).toBe(5000);
  });

  it('takes the walkovers off the waiting list and completes the group when the others have played', () => {
    const { state, competition, stage } = groupWithOneResult();
    let next = run(state, { type: 'withdrawPlayer', competition, entry: entryOf(state, competition, 'P1'), at: 5000 });
    const waiting = getWaitingList(next, 6000).map((m) => [slotName(m, 0), slotName(m, 1)].sort().join('-'));
    expect(waiting.sort()).toEqual(['P2-P3', 'P2-P4', 'P3-P4']);

    for (const match of getWaitingList(next, 6000)) {
      next = run(next, { type: 'recordResult', match: match.id, result: { kind: 'games', games: win3 }, at: 7000 });
    }
    expect(groupsOf(next, stage)[0].complete).toBe(true);
  });

  it('makes a match between two withdrawn players a walkover nobody wins', () => {
    const { state, competition, stage } = groupWithOneResult();
    const next = run(
      state,
      { type: 'withdrawPlayer', competition, entry: entryOf(state, competition, 'P3'), at: 5000 },
      { type: 'withdrawPlayer', competition, entry: entryOf(state, competition, 'P4'), at: 6000 },
    );
    const match = matchBetween(next, stage, 'P3', 'P4', 7000);
    expect(match).toMatchObject({ status: 'walkover', withdrawal: true, result: null, finishedAt: 6000 });
    const p3 = groupsOf(next, stage)[0].standings.find((r) => r.entry?.players[0].lastName === 'P3')!;
    expect(p3).toMatchObject({ played: 2, won: 0, lost: 2 });
  });
});

describe('withdrawing a player from a bracket', () => {
  it('gives the opponent a walkover into the next round', () => {
    const { state, competition, stage } = drawnBracket(8, { seeds: allSeeded(8) });
    const next = run(state, { type: 'withdrawPlayer', competition, entry: entryOf(state, competition, 'P1'), at: 5000 });
    const first = roundsOf(next, stage)[0][0];
    expect(first).toMatchObject({ status: 'walkover', result: { kind: 'walkover', winner: 1 } });
    expect(slotLabel(roundsOf(next, stage)[1][0], 0)).toBe('P8');
  });

  it('also turns a match still pending into a walkover once the opponent is known', () => {
    const { state, competition, stage } = drawnBracket(8, { seeds: allSeeded(8) });
    const [first, second] = roundsOf(state, stage)[0]; // P1 v P8, P5 v P4
    let next = run(
      state,
      { type: 'recordResult', match: first.id, result: { kind: 'gamesOnly', games: [3, 0] }, at: 1000 },
      { type: 'withdrawPlayer', competition, entry: entryOf(state, competition, 'P1'), at: 2000 },
    );
    const semi = () => roundsOf(next, stage)[1][0];
    expect(semi().status).toBe('pending');

    next = run(next, { type: 'recordResult', match: second.id, result: { kind: 'gamesOnly', games: [0, 3] }, at: 3000 });
    expect(semi()).toMatchObject({ status: 'walkover', finishedAt: 3000, result: { kind: 'walkover', winner: 1 } });
    expect(slotLabel(roundsOf(next, stage)[2][0], 0)).toBe('P4');
    expect(getWaitingList(next, 4000).map((m) => m.id)).not.toContain(semi().id);
  });

  it('gives the withdrawn player the place of the round they lost in', () => {
    const { state, competition } = drawnBracket(8, { seeds: allSeeded(8) });
    const next = run(state, { type: 'withdrawPlayer', competition, entry: entryOf(state, competition, 'P1'), at: 5000 });
    const p1 = getFinalPlaces(next, competition)!.rows.find((r) => r.entry.players[0].lastName === 'P1');
    expect(p1?.place).toEqual({ from: 5, to: 8 });
  });
});

describe('withdrawal rules', () => {
  it('needs a confirmed draw (before that, the entry is removed instead)', () => {
    const { state, competition } = drawnGroups(4, { by: 'count', groups: 1 }, { confirm: false });
    expect(errorOf(execute(state, { type: 'withdrawPlayer', competition, entry: entryOf(state, competition, 'P1'), at: 0 }))).toEqual({
      code: 'competitionNotStarted',
    });
  });

  it('rejects an unknown entry and a second withdrawal', () => {
    const { state, competition } = groupWithOneResult();
    expect(errorOf(execute(state, { type: 'withdrawPlayer', competition, entry: 'nope', at: 0 }))).toEqual({ code: 'entryNotFound', entry: 'nope' });
    const entry = entryOf(state, competition, 'P1');
    const next = run(state, { type: 'withdrawPlayer', competition, entry, at: 0 });
    expect(errorOf(execute(next, { type: 'withdrawPlayer', competition, entry, at: 0 }))).toEqual({ code: 'alreadyWithdrawn' });
  });

  it('waits until the player’s match on a table has a result', () => {
    const { state, competition, stage } = groupWithOneResult();
    const match = matchBetween(state, stage, 'P1', 'P3');
    const playing = run(state, { type: 'assignMatch', match: match.id, table: tableId(state, 2), at: 2000 });
    expect(errorOf(execute(playing, { type: 'withdrawPlayer', competition, entry: entryOf(state, competition, 'P1'), at: 3000 }))).toEqual({
      code: 'withdrawalWhilePlaying',
      number: 2,
    });
  });

  it('is kept by export and import', () => {
    const { state, competition, stage } = groupWithOneResult();
    const next = run(state, { type: 'withdrawPlayer', competition, entry: entryOf(state, competition, 'P1'), at: 5000 });
    const imported = unwrap(importTournament({ id: next.id, file: exportTournament(next) }));
    expect(imported).toEqual(next);
    expect(matchBetween(imported, stage, 'P1', 'P3').status).toBe('walkover');
  });
});

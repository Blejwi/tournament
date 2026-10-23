import { describe, expect, it } from 'vitest';
import {
  getCompetition,
  getCompetitions,
  getMatch,
  getMatchCounts,
  getPlayers,
  getWaitingList,
  type Command,
  type GameScore,
  type MatchView,
  type TournamentState,
} from '@/engine';
import { newTournament } from './helpers';
import { groupsOf, matchBetween, run, slotName, tableId } from './scenarios';

const MIN = 60_000;
const T0 = Date.UTC(2026, 4, 1, 9, 0);

const win3: GameScore[] = [
  [11, 7],
  [11, 9],
  [11, 5],
];

/**
 * Two competitions on 3 shared tables. P1 is entered in both.
 * Open: one group of P1..P4 (positions 1..4). Rounds: P1-P4, P2-P3 | P4-P3, P1-P2 | P2-P4, P3-P1.
 * U15: one group of P5, P1, P6 (positions 1..3). Rounds: P1-P6 | P5-P1 | P6-P5.
 */
function openAndU15() {
  let state = newTournament();
  for (let i = 1; i <= 3; i++) state = run(state, { type: 'addTable', number: i });
  for (let i = 1; i <= 6; i++) state = run(state, { type: 'addPlayer', firstName: 'Player', lastName: `P${i}`, club: '' });
  const player = (name: string) => getPlayers(state).find((p) => p.lastName === name)!.id;
  const competition = (name: string, lastNames: string[]) => {
    state = run(state, { type: 'addCompetition', name });
    const id = getCompetitions(state).find((c) => c.name === name)!.id;
    lastNames.forEach((lastName) => (state = run(state, { type: 'enterPlayer', competition: id, player: player(lastName) })));
    state = run(state, { type: 'configureStages', competition: id, stages: [{ type: 'groups', grouping: { by: 'count', groups: 1 } }] });
    lastNames.forEach((_, i) => {
      const entry = groupsEntries(state, id).find((e) => e.lastName === lastNames[i])!.entry;
      state = run(state, { type: 'setSeed', competition: id, entry, seed: i + 1 });
    });
    const stage = stageOf(state, id);
    state = run(state, { type: 'generateDraw', stage, randomSeed: 1 }, { type: 'confirmStage', stage });
    return { id, stage };
  };
  const open = competition('Open', ['P1', 'P2', 'P3', 'P4']);
  const u15 = competition('U15', ['P5', 'P1', 'P6']);
  return { state, open, u15, player };
}

function groupsEntries(state: TournamentState, competition: string) {
  return getCompetition(state, competition)!.entries.map((e) => ({ entry: e.id, lastName: e.players[0].lastName }));
}

function stageOf(state: TournamentState, competition: string) {
  return getCompetition(state, competition)!.stages[0].id;
}

const call = (state: TournamentState, match: MatchView, table: number, at: number): Command => ({
  type: 'assignMatch',
  match: match.id,
  table: tableId(state, table),
  at,
});

/** Records a 3:0 win for the slot-A player. */
const finish = (match: MatchView, at: number): Command => ({ type: 'recordResult', match: match.id, result: { kind: 'games', games: win3 }, at });

const label = (m: MatchView, state: TournamentState) =>
  `${getCompetitions(state).find((c) => c.id === m.competition)!.name} ${slotName(m, 0)}-${slotName(m, 1)}:${m.status}`;

describe('a player in several competitions', () => {
  it('makes their match in the other competition busy, not ready, while they play', () => {
    const { state, open, u15, player } = openAndU15();
    const openMatch = matchBetween(state, open.stage, 'P1', 'P4');
    const playing = run(state, call(state, openMatch, 2, T0));

    const u15Match = matchBetween(playing, u15.stage, 'P1', 'P6');
    expect(u15Match.status).toBe('busy');
    expect(u15Match.busyWith).toEqual([{ player: player('P1'), match: openMatch.id, competition: open.id, table: 2 }]);
    expect(matchBetween(playing, u15.stage, 'P6', 'P5')).toMatchObject({ status: 'ready', busyWith: [] });
  });

  it('frees their other matches once the result is in', () => {
    const { state, open, u15 } = openAndU15();
    const openMatch = matchBetween(state, open.stage, 'P1', 'P4');
    const done = run(state, call(state, openMatch, 1, T0), finish(openMatch, T0 + 20 * MIN));
    expect(getMatch(done, matchBetween(done, u15.stage, 'P1', 'P6').id, T0 + 20 * MIN)).toMatchObject({ status: 'ready', busyWith: [] });
  });
});

describe('competition tab counts', () => {
  it('counts ready, busy and live matches per competition', () => {
    const { state, open, u15 } = openAndU15();
    const playing = run(state, call(state, matchBetween(state, open.stage, 'P1', 'P4'), 1, T0));
    // Open: P1-P4 live; P2-P3 ready; the other four have P1 or P4 in them, so busy.
    // U15: P1-P6 and P5-P1 busy; P6-P5 ready.
    expect(getMatchCounts(playing, T0 + 5 * MIN)).toEqual([
      { competition: open.id, ready: 1, busy: 4, live: 1, overdue: 0 },
      { competition: u15.id, ready: 1, busy: 2, live: 0, overdue: 0 },
    ]);
  });
});

describe('waiting list across competitions', () => {
  /**
   * At T0 U15 P1-P6 (table 2) and Open P2-P3 (table 1) are called. U15 finishes at +15, Open at +20.
   * Ready since: P1, P6 free from +15; P2, P3 from +20; P4, P5 never played.
   */
  function afterFirstMatches() {
    const setup = openAndU15();
    let { state } = setup;
    const u15First = matchBetween(state, setup.u15.stage, 'P1', 'P6');
    const openFirst = matchBetween(state, setup.open.stage, 'P2', 'P3');
    state = run(
      state,
      call(state, u15First, 2, T0),
      call(state, openFirst, 1, T0),
      finish(u15First, T0 + 15 * MIN),
      finish(openFirst, T0 + 20 * MIN),
    );
    return { ...setup, state };
  }

  it('orders by stage, then round, then the match that has been ready longest', () => {
    const { state } = afterFirstMatches();
    const list = getWaitingList(state, T0 + 30 * MIN);
    expect(list.map((m) => [label(m, state), m.readySince])).toEqual([
      ['Open P1-P4:ready', T0 + 15 * MIN],
      ['U15 P5-P1:ready', T0 + 15 * MIN],
      ['Open P4-P3:ready', T0 + 20 * MIN],
      ['Open P1-P2:ready', T0 + 20 * MIN],
      ['U15 P6-P5:ready', T0 + 15 * MIN],
      ['Open P2-P4:ready', T0 + 20 * MIN],
      ['Open P3-P1:ready', T0 + 20 * MIN],
    ]);
  });

  it('puts busy matches last, across competitions', () => {
    const { state: before, open } = afterFirstMatches();
    const state = run(before, call(before, matchBetween(before, open.stage, 'P4', 'P3'), 1, T0 + 21 * MIN));
    expect(getWaitingList(state, T0 + 30 * MIN).map((m) => label(m, state))).toEqual([
      'U15 P5-P1:ready',
      'Open P1-P2:ready',
      'U15 P6-P5:ready',
      'Open P1-P4:busy',
      'Open P2-P4:busy',
      'Open P3-P1:busy',
    ]);
  });

  it('can show one competition only', () => {
    const { state, u15 } = afterFirstMatches();
    expect(getWaitingList(state, T0 + 30 * MIN, { competition: u15.id }).map((m) => label(m, state))).toEqual([
      'U15 P5-P1:ready',
      'U15 P6-P5:ready',
    ]);
  });

  it('has no ready-since for matches whose players have not played yet', () => {
    const { state, u15 } = openAndU15();
    const [group] = groupsOf(state, u15.stage, T0);
    expect(getWaitingList(state, T0).find((m) => m.id === group.matches[0].id)).toMatchObject({ status: 'ready', readySince: null });
  });
});

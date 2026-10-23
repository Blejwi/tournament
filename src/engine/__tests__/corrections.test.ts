import { describe, expect, it } from 'vitest';
import {
  execute,
  exportTournament,
  getCorrectionPreview,
  getFreeTables,
  getMatch,
  getWaitingList,
  importTournament,
  type GameScore,
  type MatchResult,
  type SlotSource,
  type TournamentState,
} from '@/engine';
import { getChangeLog } from '@/engine';
import { errorOf, unwrap } from './helpers';
import { drawnBracket, drawnGroups, groupsOf, matchBetween, roundsOf, run, slotName, tableId } from './scenarios';

/** Slot A wins 3:1, or slot B when `winner` is 1. */
const quick = (winner: 0 | 1 = 0): MatchResult => ({ kind: 'gamesOnly', games: winner === 0 ? [3, 1] : [1, 3] });

/** Seeds 1..8 given to P1..P8, so round 1 is P1 v P8, P5 v P4, P3 v P6, P7 v P2. */
const seeded8 = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8 };

/** An 8-entry bracket with every quarter-final won by the better seed (P1, P4, P3, P2). */
function afterQuarterFinals(options: { thirdPlace?: boolean } = {}) {
  const { state, stage } = drawnBracket(8, { seeds: seeded8, tables: 4, ...options });
  const [quarterFinals] = roundsOf(state, stage);
  const winners = [0, 1, 0, 1] as const; // P1, P4, P3, P2
  const played = run(
    state,
    ...quarterFinals.map((m, i) => ({ type: 'recordResult' as const, match: m.id, result: quick(winners[i]), at: 1000 + i })),
  );
  return { state: played, stage };
}

const names = (state: TournamentState, id: string) => {
  const match = getMatch(state, id, 0)!;
  return [slotName(match, 0), slotName(match, 1)];
};

describe('corrections: nothing after the match has started', () => {
  it('swaps the advancing player in the next match without force', () => {
    const { state, stage } = afterQuarterFinals();
    const [[qf1], [sf1]] = roundsOf(state, stage);
    expect(names(state, sf1.id)).toEqual(['P1', 'P4']);

    const corrected = unwrap(execute(state, { type: 'correctResult', at: 9000, match: qf1.id, result: quick(1) }));

    expect(getMatch(corrected, qf1.id, 0)!.result).toEqual({ winner: 1, gamesWon: [1, 3], games: null });
    expect(names(corrected, sf1.id)).toEqual(['P8', 'P4']);
    expect(getCorrectionPreview(state, qf1.id, quick(1), 0)).toEqual({ error: null, resets: [] });
  });

  it('needs no force when the next match started but the winner stays the same', () => {
    const { state, stage } = afterQuarterFinals();
    const [[qf1], [sf1]] = roundsOf(state, stage);
    const started = run(state, { type: 'assignMatch', match: sf1.id, table: tableId(state, 1), at: 5000 });

    const corrected = unwrap(execute(started, { type: 'correctResult', at: 9000, match: qf1.id, result: { kind: 'gamesOnly', games: [3, 2] } }));

    expect(getMatch(corrected, sf1.id, 0)!.status).toBe('in_progress');
  });

  it('keeps the original table, start and finish times', () => {
    const { state, stage } = drawnBracket(8, { seeds: seeded8, tables: 1 });
    const [[qf1]] = roundsOf(state, stage);
    const played = run(
      state,
      { type: 'assignMatch', match: qf1.id, table: tableId(state, 1), at: 1000 },
      { type: 'recordResult', match: qf1.id, result: quick(0), at: 9000 },
    );

    const corrected = unwrap(execute(played, { type: 'correctResult', at: 9000, match: qf1.id, result: quick(1) }));

    const match = getMatch(corrected, qf1.id, 0)!;
    expect([match.table?.number, match.assignedAt, match.finishedAt]).toEqual([1, 1000, 9000]);
    expect(getFreeTables(corrected).map((t) => t.number)).toEqual([1]);
  });

  it('only corrects a match that has a result, and checks the new score', () => {
    const { state, stage } = afterQuarterFinals();
    const [[qf1], [sf1]] = roundsOf(state, stage);
    expect(errorOf(execute(state, { type: 'correctResult', at: 9000, match: sf1.id, result: quick(0) }))).toEqual({ code: 'matchNotFinished' });
    expect(errorOf(execute(state, { type: 'correctResult', at: 9000, match: qf1.id, result: { kind: 'gamesOnly', games: [3, 3] } }))).toEqual({
      code: 'matchNotDecided',
      gamesToWin: 3,
    });
    expect(getCorrectionPreview(state, qf1.id, { kind: 'gamesOnly', games: [2, 1] }, 0).error).toEqual({ code: 'matchNotDecided', gamesToWin: 3 });
  });

  it('cannot correct a match decided by a BYE', () => {
    const { state, stage } = drawnBracket(13);
    const bye = roundsOf(state, stage)[0].find((m) => m.decidedByBye)!;
    expect(errorOf(execute(state, { type: 'correctResult', at: 9000, match: bye.id, result: quick(0) }))).toEqual({ code: 'matchNotFinished' });
  });
});

describe('corrections: later matches already used the wrong player', () => {
  /** QF1 P1 beat P8, SF1 P1 beat P4, SF2 P3 beat P2 and the final P1 v P3 is on table 1. */
  function finalOnTable(options: { thirdPlace?: boolean } = {}) {
    const { state, stage } = afterQuarterFinals(options);
    const [, [sf1, sf2], [final]] = roundsOf(state, stage);
    const played = run(
      state,
      { type: 'recordResult', match: sf1.id, result: quick(0), at: 2000 },
      { type: 'recordResult', match: sf2.id, result: quick(0), at: 2001 },
      { type: 'assignMatch', match: final.id, table: tableId(state, 1), at: 3000 },
    );
    return { state: played, stage };
  }

  it('rejects the correction without force and lists exactly the matches to reset', () => {
    const { state, stage } = finalOnTable();
    const [[qf1], [sf1], [final]] = roundsOf(state, stage);

    expect(errorOf(execute(state, { type: 'correctResult', at: 9000, match: qf1.id, result: quick(1) }))).toEqual({
      code: 'correctionNeedsForce',
      matches: [sf1.id, final.id],
    });
    expect(getCorrectionPreview(state, qf1.id, quick(1), 0).resets.map((m) => m.id)).toEqual([sf1.id, final.id]);
  });

  it('logs a forced correction with the matches it reset', () => {
    const { state, stage } = finalOnTable();
    const [[qf1], [sf1], [final]] = roundsOf(state, stage);
    const corrected = unwrap(execute(state, { type: 'correctResult', at: 9000, match: qf1.id, result: quick(1), force: true }));
    const entry = getChangeLog(corrected)[0];
    expect(entry.type === 'resultCorrected' && entry.reset.map((m) => m.id)).toEqual([sf1.id, final.id]);
  });

  it('with force, resets those matches and frees their table; the corrected player is through', () => {
    const { state, stage } = finalOnTable();
    const [[qf1], [sf1, sf2], [final]] = roundsOf(state, stage);

    const corrected = unwrap(execute(state, { type: 'correctResult', at: 9000, match: qf1.id, result: quick(1), force: true }));

    const semiFinal = getMatch(corrected, sf1.id, 0)!;
    expect([semiFinal.status, semiFinal.result, semiFinal.table, semiFinal.assignedAt, semiFinal.finishedAt]).toEqual(['ready', null, null, null, null]);
    expect(names(corrected, sf1.id)).toEqual(['P8', 'P4']);
    expect(getMatch(corrected, final.id, 0)!).toMatchObject({ status: 'pending', table: null, assignedAt: null });
    expect(getMatch(corrected, sf2.id, 0)!.result).not.toBeNull();
    expect(getFreeTables(corrected).map((t) => t.number)).toContain(1);
    expect(getWaitingList(corrected, 0).map((m) => m.id)).toContain(sf1.id);
  });

  it('also resets the 3rd-place match fed by the loser of a reset semi-final', () => {
    const { state, stage } = finalOnTable({ thirdPlace: true });
    const [[qf1], [sf1], [final]] = roundsOf(state, stage);
    const [[thirdPlace]] = roundsOf(state, stage, 'thirdPlace');
    const started = run(state, { type: 'assignMatch', match: thirdPlace.id, table: tableId(state, 2), at: 3001 });

    expect(getCorrectionPreview(started, qf1.id, quick(1), 0).resets.map((m) => m.id)).toEqual([sf1.id, final.id, thirdPlace.id]);
  });

  it('does not reset a later match whose players stay the same', () => {
    const { state, stage } = finalOnTable();
    const [, [, sf2], [final]] = roundsOf(state, stage);
    // SF2: P2 instead of P3 wins. The final changes, SF1 (already finished) doesn't.
    expect(getCorrectionPreview(state, sf2.id, quick(1), 0).resets.map((m) => m.id)).toEqual([final.id]);
  });
});

describe('match start time and taking a match off its table', () => {
  function onTable() {
    const { state, stage } = drawnBracket(8, { seeds: seeded8, tables: 1 });
    const [[qf1]] = roundsOf(state, stage);
    return { state: run(state, { type: 'assignMatch', match: qf1.id, table: tableId(state, 1), at: 600_000 }), match: qf1.id };
  }

  it('edits the start time of a match on its table ("started 5 min ago")', () => {
    const { state, match } = onTable();
    const edited = unwrap(execute(state, { type: 'setMatchStart', match, at: 300_000 }));
    expect(getMatch(edited, match, 600_000)!).toMatchObject({ assignedAt: 300_000, elapsedMs: 300_000 });
  });

  it('only edits the start time while the match is on a table', () => {
    const { state, stage } = drawnBracket(8, { tables: 1 });
    const [[qf1]] = roundsOf(state, stage);
    expect(errorOf(execute(state, { type: 'setMatchStart', match: qf1.id, at: 0 }))).toEqual({ code: 'matchNotOnTable' });
  });

  it('takes a match off its table: the table frees and the match is ready again', () => {
    const { state, match } = onTable();
    const off = unwrap(execute(state, { type: 'unassignMatch', match, at: 0 }));
    expect(getMatch(off, match, 0)!).toMatchObject({ status: 'ready', table: null, assignedAt: null });
    expect(getFreeTables(off).map((t) => t.number)).toEqual([1]);
  });
});

describe('corrections: groups → bracket, where a correction can change the standings', () => {
  const number = (name: string) => Number(name.slice(1));
  const threeNil: GameScore[] = [
    [11, 5],
    [11, 5],
    [11, 5],
  ];
  const flip = (games: GameScore[]) => games.map(([a, b]) => [b, a] as GameScore);

  /**
   * Two confirmed groups of 4, every match won by the lower P number, feeding a 4-entry bracket
   * (1A v 2B, 1B v 2A, then the final). Groups → bracket chains arrive with #0009, so the
   * bracket stage is added to the tournament file here and imported.
   */
  function groupsThenBracket() {
    const groups = drawnGroups(8, { by: 'count', groups: 2 }, { tables: 4 });
    let state = groups.state;
    for (const group of groupsOf(state, groups.stage)) {
      for (const match of group.matches) {
        const slotAWins = number(slotName(match, 0)) < number(slotName(match, 1));
        state = run(state, { type: 'recordResult', match: match.id, result: { kind: 'games', games: slotAWins ? threeNil : flip(threeNil) }, at: 1000 });
      }
    }
    const [a, b] = groupsOf(state, groups.stage).map((g) => g.id);
    const place = (group: string, place: number): SlotSource => ({ kind: 'groupPlace', stage: groups.stage, group, place });
    const bracketMatch = (id: string, round: number, order: number, slots: [SlotSource, SlotSource]) => ({
      id,
      location: { kind: 'bracket', section: 'main' },
      round,
      order,
      slots,
      table: null,
      assignedAt: null,
      result: null,
      finishedAt: null,
    });
    const bracket = {
      id: 'knockout',
      type: 'singleElimination',
      drawState: 'confirmed',
      thirdPlace: false,
      matches: [
        bracketMatch('sf1', 1, 1, [place(a, 1), place(b, 2)]),
        bracketMatch('sf2', 1, 2, [place(b, 1), place(a, 2)]),
        bracketMatch('final', 2, 1, [
          { kind: 'matchResult', match: 'sf1', take: 'winner' },
          { kind: 'matchResult', match: 'sf2', take: 'winner' },
        ]),
      ],
    };
    const file = JSON.parse(exportTournament(state));
    file.tournament.competitions[0].stages.push(bracket);
    state = unwrap(importTournament({ id: state.id, file: JSON.stringify(file) }));
    return { state, groupStage: groups.stage };
  }

  /** The names in group A by place: [1A, 2A, 3A, 4A]. */
  const groupA = (state: TournamentState, stage: string) => groupsOf(state, stage)[0].standings.map((r) => r.entry!.players[0].lastName);

  it('lists the bracket matches the new group places change, and resets them with force', () => {
    const setup = groupsThenBracket();
    const [first, second] = groupA(setup.state, setup.groupStage);
    const state = run(
      setup.state,
      { type: 'recordResult', match: 'sf1', result: quick(0), at: 2000 },
      { type: 'assignMatch', match: 'sf2', table: tableId(setup.state, 1), at: 2001 },
    );
    expect(names(state, 'sf1')[0]).toBe(first);
    expect(names(state, 'sf2')[1]).toBe(second);

    // 2A beat 1A after all: they swap places, so both semi-finals had a now-wrong player.
    const match = matchBetween(state, setup.groupStage, first, second);
    const corrected: MatchResult = { kind: 'games', games: flip(match.result!.games!) };
    expect(getCorrectionPreview(state, match.id, corrected, 0).resets.map((m) => m.id)).toEqual(['sf1', 'sf2']);
    expect(errorOf(execute(state, { type: 'correctResult', at: 9000, match: match.id, result: corrected }))).toEqual({
      code: 'correctionNeedsForce',
      matches: ['sf1', 'sf2'],
    });

    const forced = unwrap(execute(state, { type: 'correctResult', at: 9000, match: match.id, result: corrected, force: true }));
    expect(groupA(forced, setup.groupStage).slice(0, 2)).toEqual([second, first]);
    expect(names(forced, 'sf1')[0]).toBe(second);
    expect(names(forced, 'sf2')[1]).toBe(first);
    expect(['sf1', 'sf2'].map((id) => getMatch(forced, id, 0)!.status)).toEqual(['ready', 'ready']);
  });

  it('needs no force when the corrected group keeps its places', () => {
    const setup = groupsThenBracket();
    const [, , third, fourth] = groupA(setup.state, setup.groupStage);
    const state = run(setup.state, { type: 'recordResult', match: 'sf1', result: quick(0), at: 2000 });
    const match = matchBetween(state, setup.groupStage, third, fourth);
    const closer: GameScore[] = match.result!.games!.map(([a, b]) => (a > b ? [11, 9] : [9, 11]));

    const corrected = unwrap(execute(state, { type: 'correctResult', at: 9000, match: match.id, result: { kind: 'games', games: closer } }));
    expect(getMatch(corrected, 'sf1', 0)!.status).toBe('finished');
  });
});

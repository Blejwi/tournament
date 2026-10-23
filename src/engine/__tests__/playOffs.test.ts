import { describe, expect, it } from 'vitest';
import { execute, getChangeLog, getFinalPlaces, getMatchCounts, getStats, getWaitingList, type MatchView, type PlaceRange, type TournamentState } from '@/engine';
import { errorOf } from './helpers';
import { bracketOf, drawnBracket, drawnDoubleElimination, run, slotLabel, tableId } from './scenarios';

/** Seeds 1..n given to P1..Pn. */
const allSeeded = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [i + 1, i + 1]));

const range = (r: PlaceRange) => (r.from === r.to ? String(r.from) : `${r.from}–${r.to}`);
const rng = (from: number, to: number): PlaceRange => ({ from, to });

/** Slot A wins 3:1, or slot B when `winner` is 1. */
const quick = (winner: 0 | 1) => ({ kind: 'gamesOnly' as const, games: (winner === 0 ? [3, 1] : [1, 3]) as [number, number] });

const allMatches = (state: TournamentState, stage: string, now = 0) =>
  bracketOf(state, stage, now).sections.flatMap((s) => s.rounds.flatMap((r) => r.matches));

const setPlayOff = (stage: string, from: number, to: number, enabled: boolean, at = 0) =>
  ({ type: 'setPlayOff', stage, range: rng(from, to), enabled, at }) as const;

/** The play-off block of a range: its matches round by round. */
function playOffRounds(state: TournamentState, stage: string, from: number, to: number): MatchView[][] {
  const section = bracketOf(state, stage).sections.find((s) => s.playOff?.from === from && s.playOff.to === to);
  return section?.rounds.map((r) => r.matches) ?? [];
}

/** Where a slot's player comes from: "L LR2.1" (loser of the 1st match of losers round 2), "W PO1.2", "QF" rounds in a main tree. */
function source(state: TournamentState, stage: string, match: MatchView, slot: 0 | 1): string {
  const s = match.slots[slot].source;
  if (s.kind !== 'matchResult') return slotLabel(match, slot);
  const feeder = allMatches(state, stage).find((m) => m.id === s.match)!;
  const where = feeder.location.kind === 'bracket' && feeder.location.section === 'playOff' ? 'PO' : feeder.location.kind === 'bracket' ? { main: 'R', winners: 'WR', losers: 'LR', thirdPlace: '3P', secondFinal: '2F' }[feeder.location.section] : '';
  return `${s.take === 'winner' ? 'W' : 'L'} ${where}${feeder.round}.${feeder.order}`;
}

/** "L LR2.1 v L LR2.2 → winner 9, loser 10" for every match of a play-off. */
function describe_(state: TournamentState, stage: string, from: number, to: number): string[][] {
  return playOffRounds(state, stage, from, to).map((round) =>
    round.map((m) => {
      const places = [m.places?.winner && `winner ${range(m.places.winner)}`, m.places?.loser && `loser ${range(m.places.loser)}`].filter(Boolean);
      return `${source(state, stage, m, 0)} v ${source(state, stage, m, 1)}${places.length ? ` → ${places.join(', ')}` : ''}`;
    }),
  );
}

/** Plays every playable match: the better seed (lower P number) wins, unless `upset(match)` says otherwise. */
function playOut(state: TournamentState, stage: string, upset: (m: MatchView) => boolean = () => false): TournamentState {
  for (;;) {
    const next = allMatches(state, stage).find((m) => m.status === 'ready');
    if (!next) return state;
    const [a, b] = [0, 1].map((slot) => Number(slotLabel(next, slot as 0 | 1).slice(1)));
    const better = a < b ? 0 : 1;
    state = run(state, { type: 'recordResult', match: next.id, result: quick(upset(next) ? ((1 - better) as 0 | 1) : better), at: 0 });
  }
}

const isPlayOff = (m: MatchView) => m.location.kind === 'bracket' && m.location.section === 'playOff';
const mainOnly = (m: MatchView) => !isPlayOff(m);

const places = (state: TournamentState, competition: string) =>
  getFinalPlaces(state, competition)!.rows.map((r) => `${range(r.place)} ${r.entry.players[0].lastName}`);

describe('place play-offs: which ranges can have one', () => {
  it('double elimination with 16 entries: 5–6, 7–8, 9–12 and 13–16', () => {
    const { state, stage } = drawnDoubleElimination(16, { seeds: allSeeded(16) });
    expect(bracketOf(state, stage).playOffs.map((p) => [range(p.range), p.enabled, p.created])).toEqual([
      ['5–6', false, false],
      ['7–8', false, false],
      ['9–12', false, false],
      ['13–16', false, false],
    ]);
  });

  it('single elimination with 8 entries: the quarter-final losers (5–8); 3–4 is the 3rd-place match’s', () => {
    const { state, stage } = drawnBracket(8, { seeds: allSeeded(8) });
    expect(bracketOf(state, stage).playOffs.map((p) => range(p.range))).toEqual(['5–8']);
  });

  it('single elimination with 16 entries: 5–8 and 9–16', () => {
    const { state, stage } = drawnBracket(16, { seeds: allSeeded(16) });
    expect(bracketOf(state, stage).playOffs.map((p) => range(p.range))).toEqual(['5–8', '9–16']);
  });

  it('offers nothing before the draw is made', () => {
    const { state, stage } = drawnBracket(8, { confirm: false });
    expect(bracketOf(state, stage).playOffs.length).toBeGreaterThan(0);
    const cleared = run(state, { type: 'configureStages', competition: state.competitions[0].id, stages: [{ type: 'singleElimination', thirdPlace: false }] });
    expect(bracketOf(cleared, cleared.competitions[0].stages[0].id).playOffs).toEqual([]);
  });
});

describe('place play-offs: structure and pairing in a 16-entry double elimination', () => {
  const setup = () => drawnDoubleElimination(16, { seeds: allSeeded(16) });

  it('5–6 and 7–8: one match between the two losers', () => {
    const { state, stage } = setup();
    const on = run(state, setPlayOff(stage, 5, 6, true), setPlayOff(stage, 7, 8, true));
    expect(describe_(on, stage, 5, 6)).toEqual([['L LR4.1 v L LR4.2 → winner 5, loser 6']]);
    expect(describe_(on, stage, 7, 8)).toEqual([['L LR3.1 v L LR3.2 → winner 7, loser 8']]);
  });

  it('9–12: the 1st LR2 loser v the 2nd, the 3rd v the 4th; winners play for 9/10, losers for 11/12', () => {
    const { state, stage } = setup();
    const on = run(state, setPlayOff(stage, 9, 12, true));
    expect(describe_(on, stage, 9, 12)).toEqual([
      ['L LR2.1 v L LR2.2', 'L LR2.3 v L LR2.4'],
      ['W PO1.1 v W PO1.2 → winner 9, loser 10', 'L PO1.1 v L PO1.2 → winner 11, loser 12'],
    ]);
  });

  it('13–16: the LR1 losers in the same way', () => {
    const { state, stage } = setup();
    const on = run(state, setPlayOff(stage, 13, 16, true));
    expect(describe_(on, stage, 13, 16)).toEqual([
      ['L LR1.1 v L LR1.2', 'L LR1.3 v L LR1.4'],
      ['W PO1.1 v W PO1.2 → winner 13, loser 14', 'L PO1.1 v L PO1.2 → winner 15, loser 16'],
    ]);
  });

  it('is a section of its own per range, after the main draw', () => {
    const { state, stage } = setup();
    const on = run(state, setPlayOff(stage, 13, 16, true), setPlayOff(stage, 5, 6, true));
    expect(bracketOf(on, stage).sections.map((s) => [s.section, s.playOff && range(s.playOff)])).toEqual([
      ['winners', null],
      ['losers', null],
      ['secondFinal', null],
      ['playOff', '13–16'],
      ['playOff', '5–6'],
    ]);
  });
});

describe('place play-offs: structure and pairing in an 8-entry single elimination', () => {
  it('5–8: the quarter-final losers by neighbouring matches, then 5/6 and 7/8', () => {
    const { state, stage } = drawnBracket(8, { seeds: allSeeded(8) });
    const on = run(state, setPlayOff(stage, 5, 8, true));
    expect(describe_(on, stage, 5, 8)).toEqual([
      ['L R1.1 v L R1.2', 'L R1.3 v L R1.4'],
      ['W PO1.1 v W PO1.2 → winner 5, loser 6', 'L PO1.1 v L PO1.2 → winner 7, loser 8'],
    ]);
  });

  it('9–16 in 16 entries is a bracket of its own: 12 matches, down to single places', () => {
    const { state, stage } = drawnBracket(16, { seeds: allSeeded(16) });
    const on = run(state, setPlayOff(stage, 9, 16, true));
    const rounds = playOffRounds(on, stage, 9, 16);
    expect(rounds.map((r) => r.length)).toEqual([4, 4, 4]);
    const decided = rounds.flat().flatMap((m) => [m.places?.winner, m.places?.loser]).filter((p): p is PlaceRange => !!p).map((p) => p.from);
    expect(decided.sort((a, b) => a - b)).toEqual([9, 10, 11, 12, 13, 14, 15, 16]);
  });
});

describe('place play-offs: switching on and off', () => {
  it('turning on makes the matches appear as pending, then ready as their players become known', () => {
    const { state, stage } = drawnBracket(8, { seeds: allSeeded(8) });
    const on = run(state, setPlayOff(stage, 5, 8, true));
    expect(playOffRounds(on, stage, 5, 8).flat().map((m) => m.status)).toEqual(['pending', 'pending', 'pending', 'pending']);

    const [qf1, qf2] = allMatches(on, stage).filter((m) => m.location.kind === 'bracket' && m.location.section === 'main' && m.round === 1);
    const played = run(on, { type: 'recordResult', match: qf1.id, result: quick(0), at: 0 }, { type: 'recordResult', match: qf2.id, result: quick(0), at: 0 });
    expect(playOffRounds(played, stage, 5, 8)[0].map((m) => m.status)).toEqual(['ready', 'pending']);
    expect(playOffRounds(played, stage, 5, 8)[0].map((m) => [m.slots[0].entry?.players[0].lastName, m.slots[1].entry?.players[0].lastName])).toEqual([
      ['P8', 'P5'],
      [undefined, undefined],
    ]);
  });

  it('the matches are not there before the first switch-on, and the play-off is reported as not created', () => {
    const { state, stage } = drawnBracket(8, { seeds: allSeeded(8) });
    expect(allMatches(state, stage).some(isPlayOff)).toBe(false);
    const on = run(state, setPlayOff(stage, 5, 8, true));
    expect(bracketOf(on, stage).playOffs).toEqual([{ range: rng(5, 8), enabled: true, created: true }]);
  });

  it('turning off shows the matches as disabled; turning on again brings them back with their finished results', () => {
    const { state, stage } = drawnBracket(8, { seeds: allSeeded(8) });
    const main = playOut(state, stage);
    const on = run(main, setPlayOff(stage, 5, 8, true));
    const played = playOut(on, stage);
    const results = (s: TournamentState) => playOffRounds(s, stage, 5, 8).flat().map((m) => m.result?.gamesWon);
    expect(results(played).every(Boolean)).toBe(true);

    const off = run(played, setPlayOff(stage, 5, 8, false));
    expect(playOffRounds(off, stage, 5, 8).flat().map((m) => m.status)).toEqual(['disabled', 'disabled', 'disabled', 'disabled']);
    expect(results(off)).toEqual(results(played));
    expect(bracketOf(off, stage).playOffs).toEqual([{ range: rng(5, 8), enabled: false, created: true }]);

    const again = run(off, setPlayOff(stage, 5, 8, true));
    expect(playOffRounds(again, stage, 5, 8).flat().map((m) => m.status)).toEqual(['finished', 'finished', 'finished', 'finished']);
    expect(results(again)).toEqual(results(played));
    expect(allMatches(again, stage).length).toBe(allMatches(played, stage).length); // no matches were made twice
  });

  it('switching off a play-off that was never on, or on one that is on, changes nothing', () => {
    const { state, stage } = drawnBracket(8, { seeds: allSeeded(8) });
    expect(run(state, setPlayOff(stage, 5, 8, false))).toEqual(state);
    const on = run(state, setPlayOff(stage, 5, 8, true));
    expect(run(on, setPlayOff(stage, 5, 8, true))).toEqual(on);
  });

  it('refuses a range that is not a shared place range of the stage', () => {
    const { state, stage } = drawnBracket(8, { seeds: allSeeded(8) });
    expect(errorOf(execute(state, setPlayOff(stage, 5, 6, true)))).toEqual({ code: 'playOffNotFound', from: 5, to: 6 });
    expect(errorOf(execute(state, setPlayOff(stage, 3, 4, true)))).toEqual({ code: 'playOffNotFound', from: 3, to: 4 });
  });

  it('cannot be switched off while one of its matches is on a table', () => {
    const { state, stage } = drawnBracket(8, { seeds: allSeeded(8), tables: 1 });
    const on = playOut(run(state, setPlayOff(stage, 5, 8, true)), stage, isPlayOff);
    const ready = allMatches(on, stage).find((m) => m.status === 'ready' && isPlayOff(m));
    // playOut stopped before the play-off finished only if it is not playable; start it by hand.
    const first = playOffRounds(on, stage, 5, 8)[0][0];
    const called = first.status === 'ready' ? run(on, { type: 'assignMatch', match: first.id, table: tableId(on, 1), at: 0 }) : null;
    if (ready || called) {
      const state2 = called ?? on;
      expect(errorOf(execute(state2, setPlayOff(stage, 5, 8, false)))).toEqual({ code: 'playOffInProgress' });
    }
  });

  it('is cleared when the stage is drawn again', () => {
    const { state, stage, competition } = drawnBracket(8, { seeds: allSeeded(8), confirm: false });
    const on = run(state, setPlayOff(stage, 5, 8, true));
    const redrawn = run(on, { type: 'generateDraw', stage, randomSeed: 7 });
    expect(allMatches(redrawn, stage).some(isPlayOff)).toBe(false);
    expect(bracketOf(redrawn, stage).playOffs).toEqual([{ range: rng(5, 8), enabled: false, created: false }]);
    expect(competition).toBeDefined();
  });
});

describe('place play-offs: final places', () => {
  it('a played play-off decides every place in its range; a range left alone stays shared', () => {
    const { state, competition, stage } = drawnDoubleElimination(16, { seeds: allSeeded(16) });
    const played = playOut(run(state, setPlayOff(stage, 9, 12, true)), stage);
    expect(places(played, competition)).toEqual([
      '1 P1',
      '2 P2',
      '3 P3',
      '4 P4',
      '5–6 P6',
      '5–6 P5',
      '7–8 P7',
      '7–8 P8',
      '9 P9',
      '10 P10',
      '11 P11',
      '12 P12',
      '13–16 P16',
      '13–16 P13',
      '13–16 P14',
      '13–16 P15',
    ]);
    expect(getFinalPlaces(played, competition)!.complete).toBe(true);
  });

  it('follows the results of the play-off, not the seeds', () => {
    const { state, competition, stage } = drawnBracket(8, { seeds: allSeeded(8) });
    const on = run(playOut(state, stage), setPlayOff(stage, 5, 8, true));
    // The QF losers are P5 P6 P7 P8 in draw order P8, P5, P6/P7...: let the worse seed win every play-off match.
    const played = playOut(on, stage, isPlayOff);
    const rows = places(played, competition);
    expect(rows.slice(4)).toEqual(['5 P8', '6 P7', '7 P6', '8 P5']);
  });

  it('while a switched-on play-off is unplayed, its places are open rather than shared', () => {
    const { state, competition, stage } = drawnBracket(8, { seeds: allSeeded(8) });
    const on = run(playOut(state, stage), setPlayOff(stage, 5, 8, true));
    const view = getFinalPlaces(on, competition)!;
    expect(view.rows.map((r) => range(r.place))).toEqual(['1', '2', '3–4', '3–4']);
    expect(view.open.map((o) => [range(o.place), o.count])).toEqual([
      ['5', 1],
      ['6', 1],
      ['7', 1],
      ['8', 1],
    ]);
    expect(view.complete).toBe(false);
  });

  it('switching it off again leaves the places shared', () => {
    const { state, competition, stage } = drawnBracket(8, { seeds: allSeeded(8) });
    const played = playOut(run(playOut(state, stage), setPlayOff(stage, 5, 8, true)), stage);
    const off = run(played, setPlayOff(stage, 5, 8, false));
    expect(places(off, competition).slice(4)).toEqual(['5–8 P8', '5–8 P5', '5–8 P6', '5–8 P7']);
  });

  it('with BYEs the play-off only places the entries that are there: 6 in 8 → 5th and 6th', () => {
    const { state, competition, stage } = drawnBracket(6, { seeds: allSeeded(6) });
    const played = playOut(run(state, setPlayOff(stage, 5, 8, true)), stage);
    expect(places(played, competition).slice(4)).toEqual(['5 P5', '6 P6']);
    expect(getFinalPlaces(played, competition)!.complete).toBe(true);
  });
});

describe('place play-offs: waiting list and counts', () => {
  it('play-off matches come after main-draw matches, even when they became ready first', () => {
    const { state, competition, stage } = drawnDoubleElimination(16, { seeds: allSeeded(16), tables: 2 });
    const on = run(state, setPlayOff(stage, 13, 16, true));
    // Play the winners round 1 (M1–M8) so that LR1 is playable, then LR1: the 13–16 play-off becomes ready.
    let s = on;
    for (const m of allMatches(s, stage).filter((m) => m.location.kind === 'bracket' && m.location.section === 'winners' && m.round === 1)) {
      s = run(s, { type: 'recordResult', match: m.id, result: quick(0), at: 1_000 });
    }
    for (const m of allMatches(s, stage).filter((m) => m.location.kind === 'bracket' && m.location.section === 'losers' && m.round === 1)) {
      s = run(s, { type: 'recordResult', match: m.id, result: quick(0), at: 2_000 });
    }
    const list = getWaitingList(s, 10_000, { competition });
    const kinds = list.map((m) => (isPlayOff(m) ? 'playOff' : 'main'));
    expect(kinds).toContain('playOff');
    expect(kinds).toContain('main');
    expect(kinds.indexOf('playOff')).toBeGreaterThan(kinds.lastIndexOf('main'));
  });

  it('a switched-off play-off adds nothing to the waiting list, the counts or the progress', () => {
    const { state, competition, stage } = drawnDoubleElimination(16, { seeds: allSeeded(16) });
    const progress = (s: TournamentState) => getStats(s, 0).progress.total;
    const before = [getWaitingList(state, 0).length, getMatchCounts(state, 0)[0].ready, progress(state)];
    const on = run(state, setPlayOff(stage, 13, 16, true));
    expect(progress(on)).toBe(before[2] + 6);
    const off = run(on, setPlayOff(stage, 13, 16, false));
    expect([getWaitingList(off, 0).length, getMatchCounts(off, 0)[0].ready, progress(off)]).toEqual(before);
    expect(competition).toBeDefined();
  });
});

describe('place play-offs: corrections and change log', () => {
  it('a correction that changes a play-off player resets the play-off match already played with the wrong one', () => {
    const { state, stage } = drawnBracket(8, { seeds: allSeeded(8) });
    const on = playOut(run(state, setPlayOff(stage, 5, 8, true)), stage);
    const qf1 = allMatches(on, stage).find((m) => m.location.kind === 'bracket' && m.location.section === 'main' && m.round === 1 && m.order === 1)!;
    const corrected = run(on, { type: 'correctResult', match: qf1.id, result: quick(1), force: true, at: 1 });
    const first = playOffRounds(corrected, stage, 5, 8)[0][0];
    expect(first.status).toBe('ready');
    expect(first.result).toBeNull();
  });

  it('logs every switch with its time, the competition, the stage and the range', () => {
    const { state, stage, competition } = drawnBracket(8, { seeds: allSeeded(8) });
    const next = run(state, setPlayOff(stage, 5, 8, true, 1_000), setPlayOff(stage, 5, 8, false, 2_000));
    expect(getChangeLog(next).map((e) => e)).toMatchObject([
      { type: 'playOffSet', at: 2_000, competition, competitionName: 'Open', stage, range: rng(5, 8), enabled: false },
      { type: 'playOffSet', at: 1_000, competition, stage, range: rng(5, 8), enabled: true },
    ]);
  });

  it('does not log a switch that changes nothing', () => {
    const { state, stage } = drawnBracket(8, { seeds: allSeeded(8) });
    expect(getChangeLog(run(state, setPlayOff(stage, 5, 8, false)))).toEqual([]);
  });
});

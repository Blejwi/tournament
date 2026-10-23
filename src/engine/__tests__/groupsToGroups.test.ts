import { describe, expect, it } from 'vitest';
import { execute, getCompetition, getFinalPlaces, getStage, type GameScore, type Grouping, type GroupsStageView, type MatchView, type TournamentState } from '@/engine';
import { errorOf } from './helpers';
import { competitionWith, groupNames, groupsOf, run, slotName } from './scenarios';

const T0 = Date.UTC(2026, 4, 1, 9, 0);
const allSeeded = (count: number) => Object.fromEntries(Array.from({ length: count }, (_, i) => [i + 1, i + 1]));
const threeNil: GameScore[] = [
  [11, 5],
  [11, 5],
  [11, 5],
];
const flipped = (games: GameScore[]) => games.map(([a, b]) => [b, a] as GameScore);

/** A competition of `count` seeded players in two chained groups stages; phase 1 is drawn and confirmed, phase 2 drawn. */
function chain(count: number, first: Grouping, second: Grouping, options: { carryOver?: boolean; confirmFirst?: boolean } = {}) {
  const setup = competitionWith(count, { seeds: allSeeded(count) });
  let state = run(setup.state, {
    type: 'configureStages',
    competition: setup.competition,
    stages: [
      { type: 'groups', grouping: first },
      { type: 'groups', grouping: second, ...(options.carryOver === undefined ? {} : { carryOver: options.carryOver }) },
    ],
  });
  const [one, two] = getCompetition(state, setup.competition)!.stages.map((s) => s.id);
  state = run(state, { type: 'generateDraw', stage: one, randomSeed: 1 });
  if (options.confirmFirst ?? true) state = run(state, { type: 'confirmStage', stage: one });
  return { state, competition: setup.competition, one, two };
}

/** Records that `winner` beat `loser` in a group of `stage`. */
function win(state: TournamentState, stage: string, winner: string, loser: string, games = threeNil): TournamentState {
  const view = getStage(state, stage, 0) as GroupsStageView;
  const match = view.groups.flatMap((g) => g.matches).find((m) => [slotName(m, 0), slotName(m, 1)].sort().join() === [winner, loser].sort().join());
  if (!match) throw new Error(`No match between ${winner} and ${loser}`);
  const oriented = slotName(match, 0) === winner ? games : flipped(games);
  return run(state, { type: 'recordResult', match: match.id, result: { kind: 'games', games: oriented }, at: T0 });
}

/** Everyone in a group beats everyone below them in the draw (lowest player number wins). */
function playOut(state: TournamentState, stage: string): TournamentState {
  const view = getStage(state, stage, 0) as GroupsStageView;
  let next = state;
  for (const match of view.groups.flatMap((g) => g.matches)) {
    const [a, b] = [slotName(match, 0), slotName(match, 1)];
    const number = (name: string) => Number(name.slice(1));
    next = win(next, stage, number(a) < number(b) ? a : b, number(a) < number(b) ? b : a);
  }
  return next;
}

/** Plays out the first stage, then confirms the second (which waits for its feeder). */
const playFirst = (state: TournamentState, one: string, two: string) => run(playOut(state, one), { type: 'confirmStage', stage: two });

const origins = (state: TournamentState, stage: string) =>
  groupsOf(state, stage).map((g) => g.entries.map((slot) => (slot.origin ? `${slot.origin.place}${slot.origin.groupName}` : '?')));
const pairs = (matches: MatchView[]) => matches.map((m) => [slotName(m, 0), slotName(m, 1)].sort().join('-'));

describe('configuring groups → groups', () => {
  it('accepts a second groups stage, with carry-over on by default', () => {
    const { state, competition } = competitionWith(8);
    const groups = { type: 'groups', grouping: { by: 'count', groups: 2 } } as const;
    const next = run(state, { type: 'configureStages', competition, stages: [groups, { type: 'groups', grouping: { by: 'count', groups: 1 } }] });

    expect(getCompetition(next, competition)!.stages.map((s) => s.type === 'groups' && s.carryOver)).toEqual([true, true]);
    const off = run(state, { type: 'configureStages', competition, stages: [groups, { ...groups, carryOver: false }] });
    expect(getCompetition(off, competition)!.stages.map((s) => s.type === 'groups' && s.carryOver)).toEqual([true, false]);
  });

  it('draws the second stage only once the first one is drawn', () => {
    const setup = competitionWith(8);
    const groups = { type: 'groups', grouping: { by: 'count', groups: 2 } } as const;
    const state = run(setup.state, { type: 'configureStages', competition: setup.competition, stages: [groups, groups] });
    const second = getCompetition(state, setup.competition)!.stages[1].id;

    expect(errorOf(execute(state, { type: 'generateDraw', stage: second, randomSeed: 1 }))).toEqual({ code: 'stageNotDrawn' });
  });
});

describe('filling the second groups stage', () => {
  it('deals the winners then the runners-up out snake-style, keeping entries of the same first-stage group apart: 8 groups → 4 groups', () => {
    const { state, two } = chain(16, { by: 'count', groups: 8 }, { by: 'count', groups: 4 });

    expect(origins(state, two)).toEqual([
      ['1A', '1H', '2D', '2G'],
      ['1B', '1G', '2A', '2F'],
      ['1C', '1F', '2B', '2E'],
      ['1D', '1E', '2C', '2H'],
    ]);
  });

  it('shows the origin labels until the first stage is decided, then the players', () => {
    const { state, one, two } = chain(16, { by: 'count', groups: 8 }, { by: 'count', groups: 4 });
    expect(groupNames(state, two)[0]).toEqual(['?', '?', '?', '?']);

    const played = playOut(state, one);
    // Groups of 2 by snake: A = P1 & P16, B = P2 & P15, ... H = P8 & P9; the lower number wins.
    expect(groupNames(played, two)).toEqual([
      ['P1', 'P8', 'P13', 'P10'],
      ['P2', 'P7', 'P16', 'P11'],
      ['P3', 'P6', 'P15', 'P12'],
      ['P4', 'P5', 'P14', 'P9'],
    ]);
  });

  it('keeps entries of the same first-stage group apart in every group where that is possible', () => {
    const { state, two } = chain(24, { by: 'count', groups: 6 }, { by: 'count', groups: 3 });
    const groups = origins(state, two);

    expect(groups.map((g) => g.length)).toEqual([4, 4, 4]);
    for (const group of groups) expect(new Set(group.map((o) => o.slice(1))).size).toBe(group.length);
  });

  it('draws the same way again, and lets the operator move entries by hand', () => {
    const { state, two } = chain(16, { by: 'count', groups: 8 }, { by: 'count', groups: 4 });
    const groups = groupsOf(state, two);

    const swapped = run(state, { type: 'swapSlots', at: T0, stage: two, a: { kind: 'group', group: groups[0].id, position: 3 }, b: { kind: 'group', group: groups[1].id, position: 3 } });
    expect(origins(swapped, two).slice(0, 2)).toEqual([
      ['1A', '1H', '2A', '2G'],
      ['1B', '1G', '2D', '2F'],
    ]);
    const moved = run(state, { type: 'movePlayer', at: T0, stage: two, from: { kind: 'group', group: groups[0].id, position: 4 }, to: { kind: 'group', group: groups[1].id, position: 1 } });
    expect(origins(moved, two).slice(0, 2)).toEqual([
      ['1A', '1H', '2D'],
      ['2G', '1B', '1G', '2A', '2F'],
    ]);
  });

  it('discards the second stage draw when the first stage is drawn again', () => {
    const { state, competition, one, two } = chain(16, { by: 'count', groups: 8 }, { by: 'count', groups: 4 }, { confirmFirst: false });
    expect(getStage(state, two, 0)).toMatchObject({ drawState: 'drawn' });

    const redrawn = run(state, { type: 'generateDraw', stage: one, randomSeed: 2 });
    expect(getCompetition(redrawn, competition)!.stages.map((s) => s.drawState)).toEqual(['drawn', 'drawn']);
  });
});

describe('carry-over', () => {
  /** 8 players in two groups of 4 (A: P1 P4 P5 P8, B: P2 P3 P6 P7), the top 2 of each into one final group. */
  const finalGroup = (carryOver?: boolean) => chain(8, { by: 'count', groups: 2 }, { by: 'count', groups: 1 }, { carryOver });

  it('does not make a match for two entries that already played each other', () => {
    const { state, one, two } = finalGroup();
    const played = playFirst(state, one, two);

    expect(groupNames(played, two)).toEqual([['P1', 'P2', 'P4', 'P3']]);
    expect(pairs(groupsOf(played, two)[0].matches).sort()).toEqual(['P1-P2', 'P1-P3', 'P2-P4', 'P3-P4']);
  });

  it('counts the first-stage result in the second-stage standings', () => {
    const { state, one, two } = finalGroup();
    const played = playFirst(state, one, two);

    const rows = groupsOf(played, two)[0].standings.map((r) => [r.entry!.players[0].lastName, r.played, r.won]);
    expect(rows.sort()).toEqual([
      ['P1', 1, 1],
      ['P2', 1, 1],
      ['P3', 1, 0],
      ['P4', 1, 0],
    ]);
    expect(groupsOf(played, two)[0].complete).toBe(false);
  });

  it('lists the carried results of a group with their winners, and none when carry-over is off', () => {
    const { state, one, two } = finalGroup();
    const played = playFirst(state, one, two);

    const carried = groupsOf(played, two)[0].carriedOver;
    expect(carried.map((c) => [c.entries[c.result.winner].players[0].lastName, c.result.gamesWon]).sort()).toEqual([
      ['P1', [3, 0]],
      ['P2', [3, 0]],
    ]);
    const off = finalGroup(false);
    expect(groupsOf(playFirst(off.state, off.one, off.two), off.two)[0].carriedOver).toEqual([]);
    expect(groupsOf(played, one).every((g) => g.carriedOver.length === 0)).toBe(true);
  });

  it('plays the stage out with the carried results in the final standings', () => {
    const { state, one, two } = finalGroup();
    let next = playFirst(state, one, two);
    next = playOut(next, two);

    const group = groupsOf(next, two)[0];
    expect(group.complete).toBe(true);
    expect(group.standings.map((r) => [r.entry!.players[0].lastName, r.played, r.won])).toEqual([
      ['P1', 3, 3],
      ['P2', 3, 2],
      ['P3', 3, 1],
      ['P4', 3, 0],
    ]);
  });

  it('lets the pairing be played again when carry-over is off', () => {
    const { state, one, two } = finalGroup(false);
    const played = playFirst(state, one, two);

    expect(pairs(groupsOf(played, two)[0].matches)).toHaveLength(6);
    expect(pairs(groupsOf(played, two)[0].matches)).toContain('P1-P4');
    const rows = groupsOf(played, two)[0].standings;
    expect(rows.every((r) => r.played === 0)).toBe(true);
  });

  it('keeps the carried pairs when the operator swaps entries in the draw', () => {
    const { state, two } = chain(16, { by: 'count', groups: 8 }, { by: 'count', groups: 4 });
    const groups = groupsOf(state, two);
    expect(groups.map((g) => g.matches.length)).toEqual([6, 6, 6, 6]);

    // 1A and 2A now share a group: their first-stage match is carried over.
    const swapped = run(state, { type: 'swapSlots', at: T0, stage: two, a: { kind: 'group', group: groups[0].id, position: 3 }, b: { kind: 'group', group: groups[1].id, position: 3 } });
    expect(groupsOf(swapped, two).map((g) => g.matches.length)).toEqual([5, 6, 6, 6]);
  });

  it('reuses a first-stage result corrected afterwards', () => {
    const { state, one, two } = finalGroup();
    const played = playFirst(state, one, two);
    const match = (getStage(played, one, 0) as GroupsStageView).groups[0].matches.find((m) => [slotName(m, 0), slotName(m, 1)].sort().join() === 'P1,P4')!;
    const corrected = run(played, { type: 'correctResult', match: match.id, result: { kind: 'games', games: slotName(match, 0) === 'P4' ? threeNil : flipped(threeNil) }, at: T0 + 1 });

    const row = groupsOf(corrected, two)[0].standings.find((r) => r.entry?.players[0].lastName === 'P4')!;
    expect([row.played, row.won]).toEqual([1, 1]);
  });
});

describe('a final group', () => {
  it('puts all advancers into one group that is played out to the final places', () => {
    const { state, competition, one, two } = chain(8, { by: 'count', groups: 2 }, { by: 'count', groups: 1 }, {});
    let next = playFirst(state, one, two);
    next = playOut(next, two);

    expect(groupsOf(next, two)).toHaveLength(1);
    const places = getFinalPlaces(next, competition)!;
    expect(places.rows.slice(0, 4).map((r) => [r.place.from, r.entry.players[0].lastName])).toEqual([
      [1, 'P1'],
      [2, 'P2'],
      [3, 'P3'],
      [4, 'P4'],
    ]);
  });

  it('does not let a second-stage match start before its entries are known', () => {
    const { state, two } = chain(8, { by: 'count', groups: 2 }, { by: 'count', groups: 1 }, {});

    expect(groupsOf(state, two)[0].matches.every((m) => m.status === 'pending')).toBe(true);
  });
});

describe('the stage chain', () => {
  it('does not confirm the second stage before the first stage has decided its advancers', () => {
    const { state, two } = chain(8, { by: 'count', groups: 2 }, { by: 'count', groups: 1 });

    expect(errorOf(execute(state, { type: 'confirmStage', stage: two }))).toEqual({ code: 'previousStageNotComplete' });
  });

  it('chains groups → groups → bracket: the second groups stage feeds a bracket', () => {
    const setup = competitionWith(16, { seeds: allSeeded(16) });
    let state = run(setup.state, {
      type: 'configureStages',
      competition: setup.competition,
      stages: [
        { type: 'groups', grouping: { by: 'count', groups: 4 } },
        { type: 'groups', grouping: { by: 'count', groups: 2 } },
        { type: 'singleElimination', thirdPlace: false },
      ],
    });
    const [one, two, bracket] = getCompetition(state, setup.competition)!.stages.map((s) => s.id);
    state = run(state, { type: 'generateDraw', stage: one, randomSeed: 3 }, { type: 'confirmStage', stage: one });
    expect(getCompetition(state, setup.competition)!.stages.map((s) => s.drawState)).toEqual(['confirmed', 'drawn', 'drawn']);

    state = run(playOut(state, one), { type: 'confirmStage', stage: two });
    state = run(playOut(state, two), { type: 'confirmStage', stage: bracket });

    const view = getStage(state, bracket, 0);
    if (view?.type !== 'singleElimination') throw new Error('expected a bracket');
    const names = view.sections[0].rounds[0].matches.flatMap((m) => [slotName(m, 0), slotName(m, 1)]);
    expect(names.filter((n) => n !== '?')).toHaveLength(4);
  });
});

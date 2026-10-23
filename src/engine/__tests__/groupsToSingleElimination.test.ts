import { describe, expect, it } from 'vitest';
import { execute, getCompetition, getFinalPlaces, getStage, type TournamentState } from '@/engine';
import { errorOf } from './helpers';
import { drawnGroupsToBracket, originLabel, playAllGroups, playBracket } from './groupsToBracketScenarios';
import { bracketOf, competitionWith, groupsOf, roundsOf, run, slotName } from './scenarios';

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/** The first-round positions of a bracket top to bottom: "1A", "2C" or "BYE". */
function firstRound(state: TournamentState, stage: string): string[] {
  return roundsOf(state, stage)[0].flatMap((m) => ([0, 1] as const).map((s) => (m.slots[s].source.kind === 'bye' ? 'BYE' : originLabel(m, s)!)));
}

const half = (labels: string[], label: string) => (labels.indexOf(label) < labels.length / 2 ? 'top' : 'bottom');
const groupName = (i: number) => String.fromCharCode(65 + i);

/** Makes a circle in group A (first beats second beats third beats first, all 3:0): a tie nobody can break. */
function circleInFirstGroup(state: TournamentState, groupsStage: string): { state: TournamentState; names: string[] } {
  const [a] = groupsOf(state, groupsStage);
  const names = a.entries.map((e) => e.entry!.players[0].lastName);
  const beat = (s: TournamentState, w: string, l: string) => {
    const m = a.matches.find((x) => [slotName(x, 0), slotName(x, 1)].includes(w) && [slotName(x, 0), slotName(x, 1)].includes(l))!;
    const games: [number, number][] = slotName(m, 0) === w ? [[11, 5], [11, 5], [11, 5]] : [[5, 11], [5, 11], [5, 11]];
    return run(s, { type: 'recordResult', match: m.id, result: { kind: 'games', games }, at: 0 });
  };
  let next = beat(state, names[0], names[1]);
  next = beat(next, names[1], names[2]);
  next = beat(next, names[2], names[0]);
  return { state: next, names };
}

describe('groups → single elimination: the draw', () => {
  it('draws the bracket along with the groups, with an origin label for every advancer', () => {
    const { state, bracket } = drawnGroupsToBracket(16, 4);
    const view = bracketOf(state, bracket);
    expect(view.drawState).toBe('drawn');
    expect(view.size).toBe(8);
    expect([...firstRound(state, bracket)].sort()).toEqual(['1A', '1B', '1C', '1D', '2A', '2B', '2C', '2D']);
  });

  it('with 4 groups: 1A is at the top, 1B at the bottom, every 2X is in the other half to 1X, and 1st places play 2nd places', () => {
    for (const randomSeed of SEEDS) {
      const { state, bracket } = drawnGroupsToBracket(16, 4, { randomSeed });
      const labels = firstRound(state, bracket);
      expect(labels[0]).toBe('1A');
      expect(labels[7]).toBe('1B');
      for (const g of 'ABCD') expect(half(labels, `2${g}`)).not.toBe(half(labels, `1${g}`));
      for (const match of roundsOf(state, bracket)[0]) {
        expect([originLabel(match, 0)![0], originLabel(match, 1)![0]].sort()).toEqual(['1', '2']);
      }
    }
  });

  it('draws the runners-up at random: other random seeds give other brackets, the same seed the same one', () => {
    const draws = SEEDS.map((randomSeed) => {
      const { state, bracket } = drawnGroupsToBracket(16, 4, { randomSeed });
      return firstRound(state, bracket).join();
    });
    expect(new Set(draws).size).toBeGreaterThan(1);
    const a = drawnGroupsToBracket(16, 4, { randomSeed: 5 });
    const b = drawnGroupsToBracket(16, 4, { randomSeed: 5 });
    expect(firstRound(a.state, a.bracket)).toEqual(firstRound(b.state, b.bracket));
  });

  it('with 5 groups (10 advancers → 16, 6 BYEs): BYEs go to 1A–1E first, then to 2A; separation still holds', () => {
    for (const randomSeed of SEEDS) {
      const { state, bracket } = drawnGroupsToBracket(20, 5, { randomSeed });
      const labels = firstRound(state, bracket);
      expect(labels).toHaveLength(16);
      expect(labels.filter((l) => l === 'BYE')).toHaveLength(6);
      expect(labels[0]).toBe('1A');
      expect(labels[15]).toBe('1B');
      const partner = (label: string) => labels[labels.indexOf(label) ^ 1];
      for (const g of 'ABCDE') expect(partner(`1${g}`)).toBe('BYE');
      expect(partner('2A')).toBe('BYE');
      for (const g of 'ABCDE') expect(half(labels, `2${g}`)).not.toBe(half(labels, `1${g}`));
    }
  });

  it('keeps the separation and BYE rules for every number of groups from 2 to 17', () => {
    for (let groups = 2; groups <= 17; groups++) {
      for (const randomSeed of [1, 2, 3]) {
        const { state, bracket } = drawnGroupsToBracket(groups * 2, groups, { randomSeed });
        const labels = firstRound(state, bracket);
        const byes = labels.length - groups * 2;
        expect(labels.filter((l) => l === 'BYE')).toHaveLength(byes);
        for (let i = 0; i < groups; i++) {
          const g = groupName(i);
          expect(half(labels, `2${g}`)).not.toBe(half(labels, `1${g}`));
          expect(labels[labels.indexOf(`1${g}`) ^ 1] === 'BYE').toBe(i < byes);
        }
        for (let k = 0; k < labels.length; k += 2) expect(labels[k] === 'BYE' && labels[k + 1] === 'BYE').toBe(false);
        // BYEs past the winners go to 2A, 2B, ... in group order
        for (let i = 0; i < byes - groups; i++) expect(labels[labels.indexOf(`2${groupName(i)}`) ^ 1]).toBe('BYE');
      }
    }
  });

  it('fails to draw the bracket when there are fewer than 4 advancers (1 group)', () => {
    const one = competitionWith(8);
    const state = run(one.state, {
      type: 'configureStages',
      competition: one.competition,
      stages: [
        { type: 'groups', grouping: { by: 'count', groups: 1 } },
        { type: 'singleElimination', thirdPlace: false },
      ],
    });
    const stage = getCompetition(state, one.competition)!.stages[0].id;
    expect(errorOf(execute(state, { type: 'generateDraw', stage, randomSeed: 1 }))).toEqual({ code: 'notEnoughAdvancers', needed: 4 });
  });

  it('allows a 4-entry knockout after 2 groups (semi-finals, final, optional 3rd place)', () => {
    const { state, bracket } = drawnGroupsToBracket(8, 2, { thirdPlace: true });
    const view = bracketOf(state, bracket);
    expect(view.size).toBe(4);
    const labels = firstRound(state, bracket);
    expect(labels[0]).toBe('1A');
    expect(labels[3]).toBe('1B');
    expect(view.sections.map((s) => s.section)).toEqual(['main', 'thirdPlace']);
    expect(view.sections[0].rounds.map((r) => r.matches.length)).toEqual([2, 1]);
  });

  it('still rejects a direct bracket under 8 entries', () => {
    const direct = competitionWith(6);
    const state = run(direct.state, { type: 'configureStages', competition: direct.competition, stages: [{ type: 'singleElimination', thirdPlace: false }] });
    const stage = getCompetition(state, direct.competition)!.stages[0].id;
    expect(errorOf(execute(state, { type: 'generateDraw', stage, randomSeed: 1 }))).toEqual({ code: 'notEnoughEntries', needed: 8 });
  });

  it('rejects a bracket followed by a stage', () => {
    const { state, competition } = competitionWith(8);
    const error = errorOf(
      execute(state, {
        type: 'configureStages',
        competition,
        stages: [
          { type: 'singleElimination', thirdPlace: false },
          { type: 'singleElimination', thirdPlace: false },
        ],
      }),
    );
    expect(error).toEqual({ code: 'unsupportedStageChain' });
  });
});

describe('groups → single elimination: placeholders fill as groups complete', () => {
  it('shows origin labels while the groups are open and fills a name once its group is complete', () => {
    const { state, bracket, groupsStage } = drawnGroupsToBracket(16, 4);
    const before = roundsOf(state, bracket)[0].flatMap((m) => [m.slots[0], m.slots[1]]);
    expect(before.every((s) => s.entry === null && s.origin !== null)).toBe(true);

    const next = playAllGroups(state, groupsStage, ['A']);
    const slots = roundsOf(next, bracket)[0].flatMap((m) => [m.slots[0], m.slots[1]]);
    const of = (label: string) => slots.find((s) => `${s.origin?.place}${s.origin?.groupName}` === label)!;
    const [a] = groupsOf(next, groupsStage);
    expect(of('1A').entry?.players[0].lastName).toBe(a.standings[0].entry!.players[0].lastName);
    expect(of('2A').entry?.players[0].lastName).toBe(a.standings[1].entry!.players[0].lastName);
    expect(of('1B').entry).toBeNull();
  });

  it('uses tiebreak-correct standings: a tie nobody can break leaves its places open until the operator settles it', () => {
    const { state, bracket, groupsStage } = drawnGroupsToBracket(6, 2);
    const circle = circleInFirstGroup(state, groupsStage);
    const slots = (s: TournamentState) => roundsOf(s, bracket)[0].flatMap((m) => [m.slots[0], m.slots[1]]).filter((x) => x.origin?.groupName === 'A');
    expect(slots(circle.state).every((s) => s.entry === null)).toBe(true);

    const group = groupsOf(circle.state, groupsStage)[0];
    const { names } = circle;
    const next = run(circle.state, { type: 'resolveTie', stage: groupsStage, group: group.id, order: [names[1], names[0], names[2]], method: 'decision' });
    expect(slots(next).find((s) => s.origin?.place === 1)!.entry?.players[0].lastName).toBe(names[1]);
    expect(slots(next).find((s) => s.origin?.place === 2)!.entry?.players[0].lastName).toBe(names[0]);
  });
});

describe('groups → single elimination: confirming and editing', () => {
  it('rejects confirming the bracket until every group is complete, then accepts it', () => {
    const { state, bracket, groupsStage } = drawnGroupsToBracket(16, 4);
    expect(errorOf(execute(state, { type: 'confirmStage', stage: bracket }))).toEqual({ code: 'previousStageNotComplete' });
    const partly = playAllGroups(state, groupsStage, ['A', 'B', 'C']);
    expect(errorOf(execute(partly, { type: 'confirmStage', stage: bracket }))).toEqual({ code: 'previousStageNotComplete' });
    const confirmed = run(playAllGroups(partly, groupsStage, ['D']), { type: 'confirmStage', stage: bracket });
    expect(getStage(confirmed, bracket, 0)?.drawState).toBe('confirmed');
  });

  it('rejects confirming while a tie among the advancers is unsettled', () => {
    const { state, bracket, groupsStage } = drawnGroupsToBracket(6, 2);
    const circle = circleInFirstGroup(state, groupsStage);
    const next = playAllGroups(circle.state, groupsStage, ['B']);
    expect(errorOf(execute(next, { type: 'confirmStage', stage: bracket }))).toEqual({ code: 'previousStageNotComplete' });
  });

  it('edits the bracket before it is confirmed: swaps two origin labels', () => {
    const { state, bracket } = drawnGroupsToBracket(12, 3);
    const labels = firstRound(state, bracket);
    expect(labels).toHaveLength(8);
    const [a, b] = [labels.indexOf('1C'), labels.indexOf('2A')];
    const swapped = run(state, { type: 'swapSlots', at: 0, stage: bracket, a: { kind: 'bracket', position: a + 1 }, b: { kind: 'bracket', position: b + 1 } });
    const after = firstRound(swapped, bracket);
    expect(after[a]).toBe('2A');
    expect(after[b]).toBe('1C');
  });

  it('moves a runner-up onto a BYE', () => {
    const { state, bracket } = drawnGroupsToBracket(12, 3);
    const labels = firstRound(state, bracket);
    const from = labels.indexOf('2C');
    const to = labels.indexOf('BYE');
    const moved = run(state, { type: 'movePlayer', at: 0, stage: bracket, from: { kind: 'bracket', position: from + 1 }, to: { kind: 'bracket', position: to + 1 } });
    expect(firstRound(moved, bracket)[to]).toBe('2C');
    expect(firstRound(moved, bracket)[from]).toBe('BYE');
  });

  it('re-drawing the groups draws the bracket again', () => {
    const { state, groupsStage, bracket } = drawnGroupsToBracket(16, 4, { confirmGroups: false });
    const again = run(state, { type: 'generateDraw', stage: groupsStage, randomSeed: 99 });
    expect(bracketOf(again, bracket).drawState).toBe('drawn');
  });

  it('changing the entries before the groups are confirmed clears the bracket draw too', () => {
    const { state, competition, bracket } = drawnGroupsToBracket(16, 4, { confirmGroups: false });
    const entry = getCompetition(state, competition)!.entries[0];
    const next = run(state, { type: 'removeEntry', competition, entry: entry.id });
    expect(getCompetition(next, competition)!.stages.every((s) => s.drawState === 'notDrawn')).toBe(true);
    expect(getStage(next, bracket, 0)?.drawState).toBe('notDrawn');
  });

  it('draws the bracket on its own once the groups are drawn, and refuses before that', () => {
    const setup = competitionWith(16);
    const state = run(setup.state, {
      type: 'configureStages',
      competition: setup.competition,
      stages: [
        { type: 'groups', grouping: { by: 'count', groups: 4 } },
        { type: 'singleElimination', thirdPlace: false },
      ],
    });
    const bracket = getCompetition(state, setup.competition)!.stages[1].id;
    expect(errorOf(execute(state, { type: 'generateDraw', stage: bracket, randomSeed: 1 }))).toEqual({ code: 'stageNotDrawn' });
  });
});

describe('groups → single elimination: playing through', () => {
  it('makes the first round ready once the bracket is confirmed', () => {
    const { state, groupsStage, bracket } = drawnGroupsToBracket(16, 4);
    const next = run(playAllGroups(state, groupsStage), { type: 'confirmStage', stage: bracket });
    expect(roundsOf(next, bracket)[0].every((m) => m.status === 'ready' && m.slots[0].entry && m.slots[1].entry)).toBe(true);
  });

  it('keeps the bracket matches pending while the groups are being played', () => {
    const { state, bracket, groupsStage } = drawnGroupsToBracket(16, 4);
    const next = playAllGroups(state, groupsStage, ['A']);
    expect(roundsOf(next, bracket)[0].every((m) => m.status === 'pending')).toBe(true);
  });
});

describe('groups → single elimination: final places', () => {
  const text = (state: TournamentState, competition: string) =>
    getFinalPlaces(state, competition)!.rows.map((r) => `${r.place.from}–${r.place.to}`);
  const openText = (state: TournamentState, competition: string) =>
    getFinalPlaces(state, competition)!.open.map((o) => `${o.place.from}–${o.place.to}×${o.count}`);

  it('puts the group non-advancers below the bracket: 4 groups of 4 into 8 → 3rd places share 9–12, 4th places 13–16', () => {
    const { state, competition, groupsStage } = drawnGroupsToBracket(16, 4);
    const places = getFinalPlaces(playAllGroups(state, groupsStage), competition)!;
    expect(text(playAllGroups(state, groupsStage), competition).sort()).toEqual([...Array(4).fill('9–12'), ...Array(4).fill('13–16')].sort());
    expect(openText(playAllGroups(state, groupsStage), competition).sort()).toEqual(['1–1×1', '2–2×1', '3–4×2', '5–8×4'].sort());
    expect(places.complete).toBe(false);
  });

  it('covers the whole competition once the bracket is played', () => {
    const { state, competition, groupsStage, bracket } = drawnGroupsToBracket(16, 4);
    const confirmed = run(playAllGroups(state, groupsStage), { type: 'confirmStage', stage: bracket });
    const places = getFinalPlaces(playBracket(confirmed, bracket), competition)!;
    expect(places.complete).toBe(true);
    expect(places.rows).toHaveLength(16);
    expect(places.open).toEqual([]);
    expect(places.rows[0].place).toEqual({ from: 1, to: 1 });
    expect(places.rows.map((r) => `${r.place.from}–${r.place.to}`).slice(-8)).toEqual([...Array(4).fill('9–12'), ...Array(4).fill('13–16')]);
  });

  it('shares only the places entries can land in: 5 groups of 3 into 16 → the third places share 11–15', () => {
    const { state, competition, groupsStage } = drawnGroupsToBracket(15, 5);
    expect(text(playAllGroups(state, groupsStage), competition)).toEqual(Array(5).fill('11–15'));
  });

  it('leaves the non-advancer places open while their group is unfinished', () => {
    const { state, competition } = drawnGroupsToBracket(16, 4);
    expect(getFinalPlaces(state, competition)!.rows).toHaveLength(0);
    expect(openText(state, competition)).toContain('9–12×4');
    expect(openText(state, competition)).toContain('13–16×4');
  });

  it('places a group of 3 without a 4th: groups of 4, 4, 4 and 3 give 3rd places 9–12 and the three 4th places 13–15', () => {
    const { state, competition, groupsStage } = drawnGroupsToBracket(15, 4);
    const rows = text(playAllGroups(state, groupsStage), competition);
    expect(rows.filter((r) => r === '9–12')).toHaveLength(4);
    expect(rows.filter((r) => r === '13–15')).toHaveLength(3);
  });
});

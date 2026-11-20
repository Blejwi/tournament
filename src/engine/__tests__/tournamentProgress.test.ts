import { describe, expect, it } from 'vitest';
import { execute, getCompetition, getCompetitions, getPlayers, getTournamentProgress, type MatchView, type TournamentState } from '@/engine';
import { newTournament, unwrap } from './helpers';
import { drawnGroupsToBracket, playAllGroups } from './groupsToBracketScenarios';
import { bracketOf, competitionWith, drawnBracket, drawnDoubleElimination, run, slotLabel } from './scenarios';

const quick = (winner: 0 | 1) => ({ kind: 'gamesOnly' as const, games: (winner === 0 ? [3, 1] : [1, 3]) as [number, number] });

const isPlayOff = (m: MatchView) => m.location.kind === 'bracket' && m.location.section === 'playOff';

/** Plays every playable match of a bracket stage (the lower-numbered player wins) that `only` accepts. */
function playOut(state: TournamentState, stage: string, only: (m: MatchView) => boolean = () => true): TournamentState {
  for (;;) {
    const next = bracketOf(state, stage)
      .sections.flatMap((s) => s.rounds.flatMap((r) => r.matches))
      .find((m) => m.status === 'ready' && only(m));
    if (!next) return state;
    const [a, b] = [0, 1].map((slot) => Number(slotLabel(next, slot as 0 | 1).slice(1)));
    state = run(state, { type: 'recordResult', match: next.id, result: quick(a < b ? 0 : 1), at: 0 });
  }
}

/** A tournament with one competition "Open" of 4 entries in a single group, drawn and confirmed. */
function drawnGroupsOnly() {
  const setup = competitionWith(4);
  let state = run(setup.state, { type: 'configureStages', competition: setup.competition, stages: [{ type: 'groups', grouping: { by: 'count', groups: 1 } }] });
  const stage = getCompetition(state, setup.competition)!.stages[0].id;
  state = run(state, { type: 'generateDraw', stage, randomSeed: 1 }, { type: 'confirmStage', stage });
  return { state, stage };
}

/** Adds a second competition with the first `count` players entered, one groups stage drawn and confirmed. */
function addGroupsCompetition(state: TournamentState, name: string, count: number): TournamentState {
  let next = run(state, { type: 'addCompetition', name });
  const competition = getCompetitions(next).find((c) => c.name === name)!.id;
  for (const player of getPlayers(next).slice(0, count)) next = run(next, { type: 'enterPlayer', competition, player: player.id });
  next = run(next, { type: 'configureStages', competition, stages: [{ type: 'groups', grouping: { by: 'count', groups: 1 } }] });
  const stage = getCompetition(next, competition)!.stages[0].id;
  return run(next, { type: 'generateDraw', stage, randomSeed: 1 }, { type: 'confirmStage', stage });
}

describe('tournament progress', () => {
  it('a tournament with no competitions is not finished', () => {
    expect(getTournamentProgress(newTournament())).toEqual({ finished: false, competitions: [] });
  });

  it('a competition that is not drawn yet, or whose draw is not confirmed, is not finished', () => {
    const { state } = competitionWith(4);
    expect(getTournamentProgress(state)).toMatchObject({ finished: false, competitions: [{ name: 'Open', finished: false }] });
    const { state: unconfirmed } = drawnBracket(4, { confirm: false });
    expect(getTournamentProgress(unconfirmed).finished).toBe(false);
  });

  it('single elimination is finished with its last result', () => {
    const { state, stage } = drawnBracket(8);
    expect(getTournamentProgress(state).finished).toBe(false);
    expect(getTournamentProgress(playOut(state, stage, (m) => m.round < 3))).toMatchObject({ finished: false });
    expect(getTournamentProgress(playOut(state, stage))).toMatchObject({ finished: true, competitions: [{ finished: true }] });
  });

  it('double elimination is finished only after the 2nd final', () => {
    const { state, stage } = drawnDoubleElimination(8);
    const isSecondFinal = (m: MatchView) => m.location.kind === 'bracket' && m.location.section === 'secondFinal';
    const beforeSecondFinal = playOut(state, stage, (m) => !isSecondFinal(m));
    expect(getTournamentProgress(beforeSecondFinal).finished).toBe(false);
    expect(getTournamentProgress(playOut(beforeSecondFinal, stage)).finished).toBe(true);
  });

  it('groups only is finished when every group is played', () => {
    const { state, stage } = drawnGroupsOnly();
    expect(getTournamentProgress(state).finished).toBe(false);
    expect(getTournamentProgress(playAllGroups(state, stage)).finished).toBe(true);
  });

  it('groups → bracket with a place play-off: finished only when the play-off is played too', () => {
    const { state, groupsStage, bracket } = drawnGroupsToBracket(16, 4);
    let played = playAllGroups(state, groupsStage);
    played = run(played, { type: 'confirmStage', stage: bracket }, { type: 'setPlayOff', stage: bracket, range: { from: 5, to: 8 }, enabled: true, at: 0 });
    expect(getTournamentProgress(playOut(played, bracket, (m) => !isPlayOff(m))).finished).toBe(false);
    expect(getTournamentProgress(playOut(played, bracket)).finished).toBe(true);
  });

  it('one competition still in play keeps the tournament unfinished and is listed as such', () => {
    const { state, stage, competition } = drawnBracket(4);
    const withSecond = addGroupsCompetition(playOut(state, stage), 'U15', 2);
    expect(getTournamentProgress(withSecond)).toEqual({
      finished: false,
      competitions: [
        { id: competition, name: 'Open', finished: true },
        { id: getCompetitions(withSecond)[1].id, name: 'U15', finished: false },
      ],
    });
  });

  it('a correction that resets later matches makes a finished competition unfinished again', () => {
    const { state, stage } = drawnBracket(4);
    const played = playOut(state, stage);
    const first = bracketOf(played, stage).sections[0].rounds[0].matches[0];
    const flipped = unwrap(execute(played, { type: 'correctResult', at: 1, force: true, match: first.id, result: quick(first.result!.winner === 0 ? 1 : 0) }));
    expect(getTournamentProgress(flipped).finished).toBe(false);
  });

  it('a competition with no entries does not block the tournament, nor is it listed', () => {
    const { state, stage } = drawnBracket(4);
    const withEmpty = run(playOut(state, stage), { type: 'addCompetition', name: 'Veterans' });
    expect(getTournamentProgress(withEmpty)).toMatchObject({ finished: true, competitions: [{ name: 'Open', finished: true }] });
    expect(getTournamentProgress(withEmpty).competitions).toHaveLength(1);
    expect(getTournamentProgress(run(newTournament(), { type: 'addCompetition', name: 'Veterans' })).finished).toBe(false);
  });
});

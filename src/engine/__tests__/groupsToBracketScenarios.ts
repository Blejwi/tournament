import { getCompetition, type MatchView, type TournamentState } from '@/engine';
import { competitionWith, groupsOf, roundsOf, run, slotName } from './scenarios';

/**
 * Configures groups → single elimination, draws the chain with `randomSeed` (the bracket is drawn
 * along with the groups) and confirms the groups stage by default; the bracket stays unconfirmed.
 */
export function drawnGroupsToBracket(
  count: number,
  groups: number,
  options: Parameters<typeof competitionWith>[1] & { randomSeed?: number; confirmGroups?: boolean; thirdPlace?: boolean } = {},
) {
  const setup = competitionWith(count, options);
  let state = run(setup.state, {
    type: 'configureStages',
    competition: setup.competition,
    stages: [
      { type: 'groups', grouping: { by: 'count', groups } },
      { type: 'singleElimination', thirdPlace: options.thirdPlace ?? false },
    ],
  });
  const [groupsStage, bracket] = getCompetition(state, setup.competition)!.stages.map((s) => s.id);
  state = run(state, { type: 'generateDraw', stage: groupsStage, randomSeed: options.randomSeed ?? 42 });
  if (options.confirmGroups ?? true) state = run(state, { type: 'confirmStage', stage: groupsStage });
  return { state, competition: setup.competition, groupsStage, bracket };
}

/** The origin label of a bracket slot ("1A", "2C"), or null. */
export function originLabel(match: MatchView, slot: 0 | 1): string | null {
  const origin = match.slots[slot].origin;
  return origin ? `${origin.place}${origin.groupName}` : null;
}

const playerNumber = (match: MatchView, slot: 0 | 1) => Number(slotName(match, slot).slice(1));

/**
 * Records every match of a groups stage (only the named groups, if given) with the
 * lower-numbered player (P1 < P2) winning 3:0, so the standings follow the player numbers.
 */
export function playAllGroups(state: TournamentState, stage: string, only?: string[]): TournamentState {
  for (const group of groupsOf(state, stage)) {
    if (only && !only.includes(group.name)) continue;
    for (const match of group.matches) {
      const better = playerNumber(match, 0) < playerNumber(match, 1) ? 0 : 1;
      const games: [number, number][] = [1, 2, 3].map(() => (better === 0 ? [11, 5] : [5, 11]));
      state = run(state, { type: 'recordResult', match: match.id, result: { kind: 'games', games }, at: 0 });
    }
  }
  return state;
}

/** Plays every match of the bracket round by round, the lower-numbered player winning 3:0. */
export function playBracket(state: TournamentState, stage: string): TournamentState {
  const rounds = roundsOf(state, stage).length;
  for (let round = 1; round <= rounds; round++) {
    for (const first of roundsOf(state, stage)[round - 1]) {
      const match = roundsOf(state, stage)[round - 1][first.order - 1];
      if (match.decidedByBye) continue;
      const better = playerNumber(match, 0) < playerNumber(match, 1) ? 0 : 1;
      state = run(state, { type: 'recordResult', match: match.id, result: { kind: 'gamesOnly', games: better === 0 ? [3, 0] : [0, 3] }, at: 0 });
    }
  }
  return state;
}

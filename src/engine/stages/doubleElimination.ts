import type { IdSource } from '../ids';
import { ok, type Result } from '../result';
import type { DoubleEliminationStage, Match, PlaceRange, SlotSource } from '../types';
import {
  directBracketSize,
  knockoutTree,
  moveFirstRoundPosition,
  newBracketMatch,
  numberEntrants,
  placeBySeedPositions,
  swapFirstRoundPositions,
} from './bracket';
import type { StageHandler } from './handler';

/**
 * Double elimination as on the user's 16-player paper sheet (ADR 0002), for 8, 16, 32 or 64:
 *
 * - Winners bracket (`winners`): a knockout tree on the seed positions. Its final (the WB final)
 *   makes the champion: winner place 1. Every other winners match drops its loser into the losers
 *   bracket.
 * - Losers bracket (`losers`), round r = LRr: LR1 pairs the round-1 losers. Then, for each winners
 *   round from 2 up to the round before the WB final, a drop-in round (the previous LR winners
 *   against that round's losers, crossed: the bottom match's loser meets the top LR winner) and a
 *   pairing round (the drop-in round's winners play each other). For 16: LR1 13–16, LR2 9–12 with
 *   drop-ins D, C, B, A, LR3 7–8, LR4 5–6 with drop-ins F, E, LR5 4th.
 * - 2nd final (`secondFinal`): the WB final loser against the losers-bracket winner, for 2nd and 3rd.
 *
 * Every losers match gives its loser a shared place range: the last losers round's loser is 4th
 * and each earlier round's losers take the range below. Slot A of a drop-in match is the losers-
 * bracket winner and slot B the drop-in; BYEs pass through the derived slots like anywhere else
 * (the opponent of a missing drop-in goes through).
 */
export const doubleEliminationHandler: StageHandler<DoubleEliminationStage> = {
  allowsGamesOnly: true, // nothing in a knockout depends on point ratios

  validateConfig: () => ok(undefined),

  create: (id) => ({ id, type: 'doubleElimination', drawState: 'notDrawn', matches: [] }),

  config: () => ({ type: 'doubleElimination' }),

  draw(stage, ctx) {
    const size = directBracketSize(ctx.entrants.length);
    if (!size.ok) return size;
    const positions = placeBySeedPositions(numberEntrants(ctx.entrants, size.value, ctx.random));
    return ok({ ...stage, drawState: 'drawn', matches: doubleEliminationMatches(positions, ctx.ids) });
  },

  clearDraw: (stage) => ({ ...stage, drawState: 'notDrawn', matches: [] }),

  // Draw editing moves the winners bracket's round-1 positions; the losers bracket follows through its slot sources.
  swapPositions: (stage, a, b) => withMatches(stage, swapFirstRoundPositions(stage.matches, 'winners', a, b)),
  movePosition: (stage, from, to) => withMatches(stage, moveFirstRoundPosition(stage.matches, 'winners', from, to)),
};

const withMatches = (stage: DoubleEliminationStage, matches: Result<Match[]>): Result<DoubleEliminationStage> =>
  matches.ok ? ok({ ...stage, matches: matches.value }) : matches;

const place = (from: number, to = from): PlaceRange => ({ from, to });
const winnerOf = (match: Match): SlotSource => ({ kind: 'matchResult', match: match.id, take: 'winner' });
const loserOf = (match: Match): SlotSource => ({ kind: 'matchResult', match: match.id, take: 'loser' });

/** All matches of a double elimination bracket on the given first-round positions. */
function doubleEliminationMatches(positions: SlotSource[], ids: IdSource): Match[] {
  const winners = knockoutTree({
    positions,
    section: 'winners',
    ids,
    places: (round, rounds) => (round === rounds ? { winner: place(1), loser: null } : undefined),
  });
  const wbFinal = winners[winners.length - 1][0];

  const losers: Match[][] = [];
  const addRound = (pairs: [SlotSource, SlotSource][]) => {
    const round = losers.length + 1;
    const matches = pairs.map((slots, k) => newBracketMatch(ids, 'losers', round, k + 1, slots));
    losers.push(matches);
    return matches;
  };
  const pairUp = (feeders: SlotSource[]) =>
    Array.from({ length: feeders.length / 2 }, (_, k): [SlotSource, SlotSource] => [feeders[2 * k], feeders[2 * k + 1]]);

  let previous = addRound(pairUp(winners[0].map(loserOf)));
  for (const dropping of winners.slice(1, -1)) {
    const crossed = [...dropping].reverse();
    const dropIn = addRound(previous.map((m, k): [SlotSource, SlotSource] => [winnerOf(m), loserOf(crossed[k])]));
    previous = addRound(pairUp(dropIn.map(winnerOf)));
  }

  // Places (the matches are new here, not state): the last losers round's loser is 4th, and each
  // earlier round's losers share the range below.
  let next = 4;
  for (const round of [...losers].reverse()) {
    for (const match of round) match.places = { winner: null, loser: place(next, next + round.length - 1) };
    next += round.length;
  }

  const lbWinner = previous[0];
  const secondFinal = newBracketMatch(ids, 'secondFinal', losers.length + 1, 1, [loserOf(wbFinal), winnerOf(lbWinner)], {
    winner: place(2),
    loser: place(3),
  });
  return [...winners.flat(), ...losers.flat(), secondFinal];
}

import { fail, ok, type Result } from '../result';
import type { Match, MatchPlaces, PlaceRange, SingleEliminationStage, SlotSource } from '../types';
import { placeGroupAdvancers } from './advancerPlacement';
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

const place = (from: number, to = from): PlaceRange => ({ from, to });

const withMatches = (stage: SingleEliminationStage, matches: Result<Match[]>): Result<SingleEliminationStage> =>
  matches.ok ? ok({ ...stage, matches: matches.value }) : matches;

export const singleEliminationHandler: StageHandler<SingleEliminationStage> = {
  allowsGamesOnly: true, // nothing in a knockout depends on point ratios

  validateConfig: ({ thirdPlace }) => (typeof thirdPlace === 'boolean' ? ok(undefined) : fail({ code: 'unsupportedStageChain' })),

  create: (id, { thirdPlace }) => ({ id, type: 'singleElimination', thirdPlace, drawState: 'notDrawn', matches: [] }),

  config: (stage) => ({ type: 'singleElimination', thirdPlace: stage.thirdPlace }),

  draw(stage, ctx) {
    // Fed by an earlier stage: the advancers are placed by origin; a direct bracket places entries by seed.
    const fed = ctx.entrants.length > 0 && ctx.entrants.every((e) => e.origin);
    let positions: SlotSource[];
    if (fed) {
      const placed = placeGroupAdvancers(ctx.entrants, ctx.random);
      if (!placed.ok) return placed;
      positions = placed.value;
    } else {
      const checked = directBracketSize(ctx.entrants.length);
      if (!checked.ok) return checked;
      positions = placeBySeedPositions(numberEntrants(ctx.entrants, checked.value, ctx.random));
    }
    const size = positions.length;
    const tree = knockoutTree({
      positions,
      section: 'main',
      ids: ctx.ids,
      places: (round, rounds) => singleEliminationPlaces(size, round, rounds, stage.thirdPlace),
    });
    const matches = tree.flat();
    if (stage.thirdPlace) {
      const semiFinals = tree[tree.length - 2];
      matches.push(
        newBracketMatch(
          ctx.ids,
          'thirdPlace',
          tree.length,
          1,
          [
            { kind: 'matchResult', match: semiFinals[0].id, take: 'loser' },
            { kind: 'matchResult', match: semiFinals[1].id, take: 'loser' },
          ],
          { winner: place(3), loser: place(4) },
        ),
      );
    }
    return ok({ ...stage, drawState: 'drawn', matches });
  },

  clearDraw: (stage) => ({ ...stage, drawState: 'notDrawn', matches: [] }),

  swapPositions: (stage, a, b) => withMatches(stage, swapFirstRoundPositions(stage.matches, 'main', a, b)),
  movePosition: (stage, from, to) => withMatches(stage, moveFirstRoundPosition(stage.matches, 'main', from, to)),
};

/**
 * Places in a bracket of `size`: the final decides 1 and 2; the losers of each earlier round share
 * the range below the round's survivors (quarter-finals 5–8, round of 16 9–16, ...). The
 * semi-final losers share 3–4, unless a 3rd-place match decides them.
 */
function singleEliminationPlaces(size: number, round: number, rounds: number, thirdPlace: boolean): MatchPlaces {
  if (round === rounds) return { winner: place(1), loser: place(2) };
  if (round === rounds - 1 && thirdPlace) return { winner: null, loser: null };
  const survivors = size / 2 ** round;
  return { winner: null, loser: place(survivors + 1, survivors * 2) };
}

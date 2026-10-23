import { fail, ok } from '../result';
import type { MatchPlaces, PlaceRange, SingleEliminationStage } from '../types';
import {
  bracketSize,
  knockoutTree,
  MAX_BRACKET_ENTRIES,
  MIN_DIRECT_BRACKET_ENTRIES,
  newBracketMatch,
  numberEntrants,
  placeBySeedPositions,
} from './bracket';
import type { StageHandler } from './handler';

const place = (from: number, to = from): PlaceRange => ({ from, to });

export const singleEliminationHandler: StageHandler<SingleEliminationStage> = {
  allowsGamesOnly: true, // nothing in a knockout depends on point ratios

  validateConfig: ({ thirdPlace }) => (typeof thirdPlace === 'boolean' ? ok(undefined) : fail({ code: 'unsupportedStageChain' })),

  create: (id, { thirdPlace }) => ({ id, type: 'singleElimination', thirdPlace, drawState: 'notDrawn', matches: [] }),

  config: (stage) => ({ type: 'singleElimination', thirdPlace: stage.thirdPlace }),

  draw(stage, ctx) {
    const count = ctx.entrants.length;
    if (count < MIN_DIRECT_BRACKET_ENTRIES) return fail({ code: 'notEnoughEntries', needed: MIN_DIRECT_BRACKET_ENTRIES });
    if (count > MAX_BRACKET_ENTRIES) return fail({ code: 'tooManyEntries', max: MAX_BRACKET_ENTRIES });
    const size = bracketSize(count);
    const positions = placeBySeedPositions(numberEntrants(ctx.entrants, size, ctx.random));
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

import { shuffle, type Random } from '../random';
import { fail, ok, type Result } from '../result';
import type { SlotSource } from '../types';
import { bracketSize, MAX_BRACKET_ENTRIES, seedPositions } from './bracket';
import type { DrawEntrant } from './handler';

/** A knockout fed by groups has at least semi-finals. */
export const MIN_ADVANCER_BRACKET_ENTRIES = 4;

/**
 * Places the advancers of a groups stage in the first round of a bracket (spec #0009):
 * - the bracket holds the advancers rounded up to a power of two;
 * - the group winners take seeds 1, 2, 3, ... in group order, so 1A is at the top, 1B at the
 *   bottom, and the others follow the seed positions;
 * - BYEs go to the group winners first (1A, 1B, ... in group order), then to the runners-up (2A, ...);
 * - a runner-up never sits in the same half as the winner of their group;
 * - the runners-up are drawn at random among the valid positions.
 * Returns the sources top to bottom. A winner always meets a runner-up or a BYE in round 1.
 */
export function placeGroupAdvancers(entrants: DrawEntrant[], random: Random): Result<SlotSource[]> {
  if (entrants.length < MIN_ADVANCER_BRACKET_ENTRIES) return fail({ code: 'notEnoughAdvancers', needed: MIN_ADVANCER_BRACKET_ENTRIES });
  if (entrants.length > MAX_BRACKET_ENTRIES) return fail({ code: 'tooManyEntries', max: MAX_BRACKET_ENTRIES });
  const byGroup = (place: number) => entrants.filter((e) => e.origin?.place === place).sort((a, b) => a.origin!.group - b.origin!.group);
  const winners = byGroup(1);
  const runnersUp = byGroup(2);
  if (winners.length !== runnersUp.length || winners.length * 2 !== entrants.length) return fail({ code: 'unsupportedStageChain' });

  const groups = winners.length;
  const size = bracketSize(entrants.length);
  const positionOfSeed = seedPositions(size).map((seed, index) => [seed, index] as const).sort((a, b) => a[0] - b[0]).map(([, index]) => index);
  const halfOf = (index: number) => (index < size / 2 ? 0 : 1);
  const slots: (SlotSource | null)[] = Array(size).fill(null);
  const bye: SlotSource = { kind: 'bye' };

  const winnerPositions = winners.map((w, i) => {
    slots[positionOfSeed[i]] = w.source;
    return positionOfSeed[i];
  });
  const byes = size - entrants.length;
  const winnerByes = Math.min(groups, byes);
  for (let i = 0; i < winnerByes; i++) slots[winnerPositions[i] ^ 1] = bye;
  const runnerUpByes = byes - winnerByes; // the first runners-up in group order get one each

  /** Puts runner-up `i` and the ones after it in place, trying the valid positions in random order. */
  const place = (i: number): boolean => {
    if (i === groups) return true;
    const otherHalf = 1 - halfOf(winnerPositions[i]);
    if (i < runnerUpByes) {
      // Needs a match of its own against a BYE.
      const matches = shuffle(
        Array.from({ length: size / 2 }, (_, k) => k).filter((k) => slots[2 * k] === null && slots[2 * k + 1] === null && halfOf(2 * k) === otherHalf),
        random,
      );
      for (const k of matches) {
        const side = random.next() < 0.5 ? 0 : 1;
        slots[2 * k + side] = runnersUp[i].source;
        slots[2 * k + 1 - side] = bye;
        if (place(i + 1)) return true;
        slots[2 * k] = slots[2 * k + 1] = null;
      }
      return false;
    }
    const free = shuffle(
      Array.from({ length: size }, (_, p) => p).filter((p) => slots[p] === null && halfOf(p) === otherHalf),
      random,
    );
    for (const p of free) {
      slots[p] = runnersUp[i].source;
      if (place(i + 1)) return true;
      slots[p] = null;
    }
    return false;
  };
  if (!place(0)) return fail({ code: 'unsupportedStageChain' });
  return ok(slots as SlotSource[]);
}

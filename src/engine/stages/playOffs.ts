import type { IdSource } from '../ids';
import type { Match, PlaceRange, PlayOff, SlotSource, Stage } from '../types';
import { loserOf, newBracketMatch, placeRange, sharedPlaceRanges, winnerOf } from './bracket';

/**
 * Place play-offs (#0012): optional mini-brackets that split a shared place range into single
 * places. Their matches are created the first time the operator switches the play-off on and live
 * in the stage as section `playOff`, tagged with the range they split.
 */

/** Ranges that start below this are not offered: 3–4 is what the 3rd-place match is for. */
export const PLAY_OFF_FIRST_PLACE = 5;

export const sameRange = (a: PlaceRange, b: PlaceRange) => a.from === b.from && a.to === b.to;

/** The stage's play-off matches for `range`, in stage order. */
export function playOffMatches(stage: Stage, range: PlaceRange): Match[] {
  return stage.matches.filter((m) => m.playOff && sameRange(m.playOff, range));
}

/** The shared ranges of a bracket stage that can have a play-off, best first. */
export function playOffRanges(stage: Stage): PlaceRange[] {
  if (stage.type === 'groups') return [];
  const main: Stage = { ...stage, matches: stage.matches.filter((m) => !m.playOff) };
  return sharedPlaceRanges(main)
    .filter((s) => s.take === 'loser' && s.range.from >= PLAY_OFF_FIRST_PLACE && isPowerOfTwo(s.matches.length))
    .map((s) => s.range);
}

/** The play-off the operator switched on at least once for `range`. */
export function findPlayOff(stage: Stage, range: PlaceRange): PlayOff | undefined {
  return stage.type === 'groups' ? undefined : stage.playOffs.find((p) => sameRange(p.range, range));
}

/** Whether a match is a play-off match whose play-off is switched off. */
export function isDisabledPlayOffMatch(stage: Stage, match: Match): boolean {
  return match.playOff !== undefined && findPlayOff(stage, match.playOff)?.enabled !== true;
}

/**
 * The matches of the play-off for `range`. The entries that fell into the range (the losers of
 * its source matches, in stage order) are paired by neighbours; the winners then play for the top
 * half of the range and the losers for the bottom half, down to single places. So 9–12 for 16
 * entries: the 1st LR2 loser v the 2nd, the 3rd v the 4th; the winners play for 9/10, the losers
 * for 11/12. Rounds are listed by depth, halves top to bottom.
 */
export function buildPlayOff(stage: Stage, range: PlaceRange, ids: IdSource): Match[] {
  const main: Stage = { ...stage, matches: stage.matches.filter((m) => !m.playOff) };
  const sources = sharedPlaceRanges(main).find((s) => s.take === 'loser' && sameRange(s.range, range))!;
  const slots: SlotSource[] = sources.matches.map((m) => ({ kind: 'matchResult', match: m.id, take: 'loser' }));
  return placeRounds(slots, range.from, ids).flatMap((matches, r) =>
    matches.map((match, k) => {
      match.round = r + 1;
      match.order = k + 1;
      match.playOff = { ...range };
      return match;
    }),
  );
}

/** Rounds of matches (round and order are set by the caller): pair neighbours, then place the winners above the losers. */
function placeRounds(slots: SlotSource[], from: number, ids: IdSource): Match[][] {
  if (slots.length === 2) {
    return [[newBracketMatch(ids, 'playOff', 1, 1, [slots[0], slots[1]], { winner: placeRange(from), loser: placeRange(from + 1) })]];
  }
  const first = Array.from({ length: slots.length / 2 }, (_, k) =>
    newBracketMatch(ids, 'playOff', 1, k + 1, [slots[2 * k], slots[2 * k + 1]]),
  );
  const top = placeRounds(first.map(winnerOf), from, ids);
  const bottom = placeRounds(first.map(loserOf), from + slots.length / 2, ids);
  return [first, ...top.map((round, i) => [...round, ...bottom[i]])];
}

const isPowerOfTwo = (n: number) => n >= 2 && (n & (n - 1)) === 0;

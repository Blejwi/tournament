import type { IdSource } from '../ids';
import type { Match, PlaceRange, PlayOff, SlotSource, Stage } from '../types';
import { newBracketMatch, placeRange, sharedPlaceRanges, type SharedPlaceRange } from './bracket';

/**
 * Place play-offs (#0012, #0024): optional mini-brackets that split a shared place range. Each
 * play-off is one round: its winners share the top half of the range and its losers the bottom
 * half, and each half is a shared range that can have a play-off of its own, down to single
 * places. Their matches are created the first time the operator switches the play-off on and live
 * in the stage as section `playOff`, tagged with the range they split.
 */

/** Ranges that start below this are not offered: 3–4 is what the 3rd-place match is for. */
export const PLAY_OFF_FIRST_PLACE = 5;

export const sameRange = (a: PlaceRange, b: PlaceRange) => a.from === b.from && a.to === b.to;

/** Whether `inner` lies within `outer` (a range is within itself). */
export const withinRange = (inner: PlaceRange, outer: PlaceRange) => inner.from >= outer.from && inner.to <= outer.to;

/** The play-off the operator switched on at least once for `range`. */
export function findPlayOff(stage: Stage, range: PlaceRange): PlayOff | undefined {
  return stage.type === 'groups' ? undefined : stage.playOffs.find((p) => sameRange(p.range, range));
}

/** The play-off whose matches made `range` one of their halves; undefined for a range of the main draw. */
export function parentPlayOff(stage: Stage, range: PlaceRange): PlaceRange | undefined {
  const match = stage.matches.find(
    (m) => m.playOff && [m.places?.winner, m.places?.loser].some((p) => p && sameRange(p, range)),
  );
  return match?.playOff;
}

/** Whether the play-off for `range` counts: it is switched on, and so is every play-off above it. */
export function isPlayOffOn(stage: Stage, range: PlaceRange): boolean {
  if (!findPlayOff(stage, range)?.enabled) return false;
  const parent = parentPlayOff(stage, range);
  return !parent || isPlayOffOn(stage, parent);
}

/** Whether a match is a play-off match whose play-off (or one above it) is switched off. */
export function isDisabledPlayOffMatch(stage: Stage, match: Match): boolean {
  return match.playOff !== undefined && !isPlayOffOn(stage, match.playOff);
}

/**
 * The shared ranges a play-off can split, best first (a range before its halves): the loser
 * ranges of the main draw, and the halves made by play-offs that are on.
 */
function splittableRanges(stage: Stage): SharedPlaceRange[] {
  const counted: Stage = { ...stage, matches: stage.matches.filter((m) => !isDisabledPlayOffMatch(stage, m)) };
  return sharedPlaceRanges(counted).filter(
    (s) =>
      (s.take === 'loser' || s.matches.every((m) => m.playOff)) &&
      s.range.from >= PLAY_OFF_FIRST_PLACE &&
      isPowerOfTwo(s.matches.length),
  );
}

/** The shared ranges of a bracket stage that can have a play-off right now, best first. */
export function playOffRanges(stage: Stage): PlaceRange[] {
  if (stage.type === 'groups') return [];
  return splittableRanges(stage).map((s) => s.range);
}

/**
 * The matches of the play-off for `range`: one round. The entries that fell into the range (the
 * losers, or winners, of its source matches, in stage order) are paired by neighbours; the winners
 * then share the top half of the range and the losers the bottom half. So 9–12 for 16 entries: the
 * 1st LR2 loser v the 2nd, the 3rd v the 4th; the winners share 9–10, the losers 11–12. With two
 * entries it is one match for two single places.
 */
export function buildPlayOff(stage: Stage, range: PlaceRange, ids: IdSource): Match[] {
  const sources = splittableRanges(stage).find((s) => sameRange(s.range, range))!;
  const slots: SlotSource[] = sources.matches.map((m) => ({ kind: 'matchResult', match: m.id, take: sources.take }));
  const half = slots.length / 2;
  const places =
    slots.length === 2
      ? { winner: placeRange(range.from), loser: placeRange(range.from + 1) }
      : { winner: placeRange(range.from, range.from + half - 1), loser: placeRange(range.from + half, range.to) };
  return Array.from({ length: half }, (_, k) => {
    const match = newBracketMatch(ids, 'playOff', 1, k + 1, [slots[2 * k], slots[2 * k + 1]], places);
    match.playOff = { ...range };
    return match;
  });
}

const isPowerOfTwo = (n: number) => n >= 2 && (n & (n - 1)) === 0;

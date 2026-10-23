import type { IdSource } from '../ids';
import { shuffle, type Random } from '../random';
import { fail, ok, type Result } from '../result';
import type { BracketSection, Match, MatchPlaces, PlaceRange, SlotSource, Stage } from '../types';
import type { DrawEntrant } from './handler';

/**
 * Building blocks shared by the bracket stages (single elimination now; double elimination,
 * groups → bracket and place play-offs reuse them): sizes, seed positions, numbering and the
 * knockout tree whose slots point to "winner of match X" (ADR 0003).
 */

/** Bracket sizes allowed for a direct bracket (spec: 8, 16, 32 or 64). */
export const DIRECT_BRACKET_SIZES = [8, 16, 32, 64] as const;
export const MIN_DIRECT_BRACKET_ENTRIES = DIRECT_BRACKET_SIZES[0];
export const MAX_BRACKET_ENTRIES = DIRECT_BRACKET_SIZES[DIRECT_BRACKET_SIZES.length - 1];

/** The size of a direct bracket (8, 16, 32 or 64) for `count` entrants, or why there can't be one. */
export function directBracketSize(count: number): Result<number> {
  if (count < MIN_DIRECT_BRACKET_ENTRIES) return fail({ code: 'notEnoughEntries', needed: MIN_DIRECT_BRACKET_ENTRIES });
  if (count > MAX_BRACKET_ENTRIES) return fail({ code: 'tooManyEntries', max: MAX_BRACKET_ENTRIES });
  return ok(bracketSize(count));
}

/** The smallest power of two that holds `count` entries (at least 2). */
export function bracketSize(count: number): number {
  let size = 2;
  while (size < count) size *= 2;
  return size;
}

/**
 * The standard seed positions for a bracket of `size` (a power of two), top to bottom:
 * for 16, 1, 16, 9, 8, 5, 12, 13, 4, 3, 14, 11, 6, 7, 10, 15, 2. Each doubling replaces seed s at
 * index i by the pair (s, opponent) or (opponent, s), alternating, where opponent = 2·m + 1 − s.
 * So seeds 1 and 2 can only meet in the final, 1–4 in the semi-finals, and so on.
 */
export function seedPositions(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const m = order.length * 2;
    order = order.flatMap((seed, i) => (i % 2 === 0 ? [seed, m + 1 - seed] : [m + 1 - seed, seed]));
  }
  return order;
}

/**
 * Gives every entrant a number: seeded entrants first, in seed order (so the best seed is 1),
 * then the unseeded ones in random order. Numbers past the entrants are BYEs, so BYEs always take
 * the highest numbers. Returns the source for each number, index 0 = number 1.
 */
export function numberEntrants(entrants: DrawEntrant[], size: number, random: Random): SlotSource[] {
  const seeded = entrants.filter((e) => e.seed !== null).sort((a, b) => a.seed! - b.seed!);
  const unseeded = shuffle(
    entrants.filter((e) => e.seed === null),
    random,
  );
  const numbered: SlotSource[] = [...seeded, ...unseeded].map((e) => e.source);
  while (numbered.length < size) numbered.push({ kind: 'bye' });
  return numbered;
}

/** The first-round slots top to bottom: each number put on its seed position. */
export function placeBySeedPositions(numbered: SlotSource[]): SlotSource[] {
  return seedPositions(numbered.length).map((n) => numbered[n - 1]);
}

export interface KnockoutOptions {
  /** The first-round slots, top to bottom; a power of two of them. */
  positions: SlotSource[];
  section: BracketSection;
  ids: IdSource;
  /** The places decided by a match of `round` (1-based) out of `rounds`. */
  places?: (round: number, rounds: number) => MatchPlaces | undefined;
}

/**
 * A knockout tree: round 1 pairs neighbouring positions, and match k of each later round is
 * played by the winners of matches 2k−1 and 2k of the round before. Returned round by round.
 */
export function knockoutTree({ positions, section, ids, places }: KnockoutOptions): Match[][] {
  const rounds = Math.log2(positions.length);
  const tree: Match[][] = [];
  let slots = positions;
  for (let round = 1; round <= rounds; round++) {
    const matches: Match[] = [];
    for (let k = 0; k < slots.length / 2; k++) {
      matches.push(newBracketMatch(ids, section, round, k + 1, [slots[2 * k], slots[2 * k + 1]], places?.(round, rounds)));
    }
    tree.push(matches);
    slots = matches.map((m) => ({ kind: 'matchResult', match: m.id, take: 'winner' }));
  }
  return tree;
}

/**
 * The matches of one round of a bracket section, top to bottom: the stable address of a bracket
 * match is (section, round, order), e.g. "the k-th LR2 match" is `bracketRound(stage, 'losers', 2)[k - 1]`.
 */
export function bracketRound(stage: Stage, section: BracketSection, round: number): Match[] {
  return stage.matches
    .filter((m) => m.location.kind === 'bracket' && m.location.section === section && m.round === round)
    .sort((a, b) => a.order - b.order);
}

/** A place range shared by the losers (or winners) of several matches, e.g. 9–12 by the four LR2 losers. */
export interface SharedPlaceRange {
  range: PlaceRange;
  take: 'winner' | 'loser';
  /** The matches whose `take` side lands in the range, in stage order (round by round, top to bottom). */
  matches: Match[];
}

/**
 * The shared place ranges of a bracket stage, from its matches' `places` (the ranges place
 * play-offs can split), best range first. Single places (from === to) are left out.
 */
export function sharedPlaceRanges(stage: Stage): SharedPlaceRange[] {
  const ranges = new Map<string, SharedPlaceRange>();
  for (const match of stage.matches) {
    for (const take of ['winner', 'loser'] as const) {
      const range = match.places?.[take];
      if (!range || range.from === range.to) continue;
      const key = `${take}:${range.from}-${range.to}`;
      const shared = ranges.get(key) ?? { range: { ...range }, take, matches: [] };
      shared.matches.push(match);
      ranges.set(key, shared);
    }
  }
  return [...ranges.values()].sort((a, b) => a.range.from - b.range.from);
}

export function newBracketMatch(
  ids: IdSource,
  section: BracketSection,
  round: number,
  order: number,
  slots: [SlotSource, SlotSource],
  places?: MatchPlaces,
): Match {
  const match: Match = {
    id: ids.next('match'),
    location: { kind: 'bracket', section },
    round,
    order,
    slots,
    table: null,
    assignedAt: null,
    result: null,
    finishedAt: null,
  };
  if (places) match.places = places;
  return match;
}

import { derive, type Derived } from '../derive';
import { ADVANCERS_PER_GROUP, advancersOf } from '../stages';
import type { CompetitionId, Entry, GroupsStage, PlaceRange, Stage, TournamentState } from '../types';
import { findPlayOff, sameRange } from '../stages/playOffs';
import { entryView, type EntryView } from './competitions';

export interface FinalPlaceView {
  /** A single place (from === to) or a shared range such as 5–8. */
  place: PlaceRange;
  entry: EntryView;
}

/** A place or range that still has entries to come. */
export interface OpenPlaceView {
  place: PlaceRange;
  /** How many entries are still to land in it. */
  count: number;
}

export interface FinalPlacesView {
  /** The entries whose place is decided so far, by place; within a shared range, top to bottom of the draw. */
  rows: FinalPlaceView[];
  /** Places (or ranges) with entries still to come, by place; a partly filled range appears with what is missing. */
  open: OpenPlaceView[];
  /** Every entry has its place. */
  complete: boolean;
}

/** One place an entry will take: the range it lands in, and the entry once it is known. */
interface PlaceSlot {
  range: PlaceRange;
  entry: Entry | null;
}

/**
 * The final places of a competition: its last stage gives every entry a place or a shared range,
 * live while the stage is played. Each stage type turns its own state into `PlaceSlot`s (bracket
 * matches carry `places` metadata, groups rank by standings position); everything below that is
 * shared. A shared range only counts the entries that can land in it, so with BYEs 13 entries in 16
 * give the round-1 losers 9–13, not 9–16.
 */
export function getFinalPlaces(state: TournamentState, id: CompetitionId): FinalPlacesView | null {
  const competition = state.competitions.find((c) => c.id === id);
  if (!competition) return null;
  const stage = competition.stages.at(-1);
  if (!stage) return { rows: [], open: [], complete: false };

  const derived = derive(state);
  const slots = placeSlots(derived, stage);
  // Entries that did not advance from an earlier stage are placed below everyone who did.
  for (let i = competition.stages.length - 2; i >= 0; i--) slots.push(...nonAdvancerSlots(derived, competition.stages[i]));
  const key = (range: PlaceRange) => `${range.from}-${range.to}`;
  const size = new Map<string, number>(); // entries that will land in each range
  for (const slot of slots) size.set(key(slot.range), (size.get(key(slot.range)) ?? 0) + 1);
  const resolve = (range: PlaceRange): PlaceRange => ({ from: range.from, to: range.from + size.get(key(range))! - 1 });

  const rows = slots
    .filter((slot): slot is PlaceSlot & { entry: Entry } => slot.entry !== null)
    .map((slot) => ({ place: resolve(slot.range), entry: entryView(state, slot.entry) }))
    .sort((a, b) => a.place.from - b.place.from); // stable: draw order within a range

  const missing = new Map<string, OpenPlaceView>();
  for (const slot of slots) {
    if (slot.entry) continue;
    const open = missing.get(key(slot.range)) ?? { place: resolve(slot.range), count: 0 };
    open.count++;
    missing.set(key(slot.range), open);
  }
  const open = [...missing.values()].sort((a, b) => a.place.from - b.place.from);
  return { rows, open, complete: competition.entries.length > 0 && rows.length === competition.entries.length };
}

/**
 * The places of the entries that did not advance from a stage that feeds a later one: they rank
 * below all the advancers, sharing a range per group position (4 groups of 4 into 8: the 3rd
 * places share 9–12, the 4th places 13–16).
 */
function nonAdvancerSlots(derived: Derived, stage: Stage): PlaceSlot[] {
  const advancers = advancersOf(stage);
  if (!advancers || stage.type !== 'groups') return [];
  return groupPlaceSlots(derived, stage, ADVANCERS_PER_GROUP + 1, advancers.length + 1);
}

function placeSlots(derived: Derived, stage: Stage): PlaceSlot[] {
  return stage.type === 'groups' ? groupPlaceSlots(derived, stage) : bracketPlaceSlots(derived, stage);
}

/** One slot per side of every match that assigns a place, except the loser side of a BYE match. */
function bracketPlaceSlots(derived: Derived, stage: Exclude<Stage, GroupsStage>): PlaceSlot[] {
  const slots: PlaceSlot[] = [];
  const splitByPlayOff = (range: PlaceRange) => stage.playOffs.some((p) => p.enabled && sameRange(p.range, range));
  for (const match of stage.matches) {
    if (!match.places) continue;
    // A switched-on play-off decides the places of its range; a switched-off one leaves them shared.
    if (match.playOff && !findPlayOff(stage, match.playOff)?.enabled) continue;
    const view = derived.match(match.id)!;
    if (view.decidedByBye && view.winner === null) continue; // both sides empty: nobody lands here
    for (const take of ['winner', 'loser'] as const) {
      const range = match.places[take];
      if (!range) continue;
      if (!match.playOff && splitByPlayOff(range)) continue;
      if (view.decidedByBye && take === 'loser') continue;
      const side = view.winner === null ? null : take === 'winner' ? view.winner : 1 - view.winner;
      slots.push({ range, entry: side === null ? null : view.entries[side] });
    }
  }
  return slots;
}

/**
 * Entries finishing in the same group position share a range: with 4 groups the winners share
 * 1–4 and the runners-up 5–8; with one group every place is its own. A group's places are decided
 * once all its matches are played and no tie is left for the operator to settle.
 */
function groupPlaceSlots(derived: Derived, stage: GroupsStage, firstPosition = 1, firstPlace = 1): PlaceSlot[] {
  const standings = stage.groups.map((group) => derived.standings(stage, group));
  const positions = Math.max(0, ...stage.groups.map((g) => g.entries.length));
  const slots: PlaceSlot[] = [];
  let from = firstPlace;
  for (let position = firstPosition; position <= positions; position++) {
    const sharing = standings.filter((s) => s.rows.length >= position);
    const range = { from, to: from + sharing.length - 1 };
    for (const s of sharing) {
      const row = s.rows[position - 1];
      slots.push({ range, entry: s.complete && !row.tied ? row.entry : null });
    }
    from += sharing.length;
  }
  return slots;
}

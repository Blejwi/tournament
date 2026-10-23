import type { TFunction } from 'i18next';
import type { MatchLocationView, MatchView, PlaceRange, SlotView } from '@/engine';
import { entryName } from '@/ui/format';

/** Which name a bracket round gets, from how many matches it has. */
function roundKind(roundMatches: number): 'final' | 'semiFinal' | 'quarterFinal' | 'roundOf' {
  return roundMatches === 1 ? 'final' : roundMatches === 2 ? 'semiFinal' : roundMatches === 4 ? 'quarterFinal' : 'roundOf';
}

/** A match's full name: "Group A · Round 2", "Quarter-final 3", "3rd-place match". */
export function matchTitle(t: TFunction, match: Pick<MatchView, 'location' | 'round' | 'order'>): string {
  const { location } = match;
  if (location.kind === 'group') return t('match.where', { group: location.groupName, round: match.round });
  if (location.section === 'thirdPlace') return t('bracket.thirdPlace');
  return t(`bracket.${roundKind(location.roundMatches)}`, { order: match.order, size: location.roundMatches * 2 });
}

/** A match's short code, e.g. "QF3", "SF1", "F" (groups: "R2"). */
export function matchCode(t: TFunction, location: MatchLocationView, round: number, order: number): string {
  if (location.kind === 'group') return `R${round}`;
  if (location.section === 'thirdPlace') return t('bracket.short.thirdPlace');
  return t(`bracket.short.${roundKind(location.roundMatches)}`, { order, size: location.roundMatches * 2 });
}

/** A bracket column's heading: "Quarter-finals", "Round of 16". */
export function roundTitle(t: TFunction, roundMatches: number): string {
  return t(`bracket.rounds.${roundKind(roundMatches)}`, { size: roundMatches * 2 });
}

/** Who plays in a slot, or what it waits for: a name, "BYE", "W QF1", or "TBD". */
export function slotText(t: TFunction, slot: SlotView, short = true): { text: string; placeholder: boolean } {
  const name = entryName(slot.entry, short);
  if (name) return { text: name, placeholder: false };
  if (slot.bye) return { text: t('bracket.bye'), placeholder: true };
  if (slot.feeder) {
    const code = matchCode(t, slot.feeder.location, slot.feeder.round, slot.feeder.order);
    return { text: t(slot.feeder.take === 'winner' ? 'bracket.winnerOf' : 'bracket.loserOf', { match: code }), placeholder: true };
  }
  return { text: t('match.unknown'), placeholder: true };
}

/** "3" or "5–8". */
export function formatPlace(place: PlaceRange): string {
  return place.from === place.to ? String(place.from) : `${place.from}–${place.to}`;
}

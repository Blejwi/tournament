import type { TFunction } from 'i18next';
import type { MatchLocationView, MatchView, PlaceRange, SlotView } from '@/engine';
import { entryName } from '@/ui/format';

/** Which name a bracket round gets, from how many matches it has. */
function roundKind(roundMatches: number): 'final' | 'semiFinal' | 'quarterFinal' | 'roundOf' {
  return roundMatches === 1 ? 'final' : roundMatches === 2 ? 'semiFinal' : roundMatches === 4 ? 'quarterFinal' : 'roundOf';
}

type BracketLocation = Extract<MatchLocationView, { kind: 'bracket' }>;

/** "A", "B", ..., "Z", "AA", "AB", ... for 1, 2, ... */
function letters(n: number): string {
  let text = '';
  for (let k = n; k > 0; k = Math.floor((k - 1) / 26)) text = String.fromCharCode(65 + ((k - 1) % 26)) + text;
  return text;
}

/**
 * Double elimination codes as on the paper sheet: winners round 1 is M1, M2, ...; the later winners
 * matches are lettered A, B, C, ... round by round (for 16: A–D, E, F, G); the losers matches are
 * numbered L1, L2, ... round by round.
 */
function doubleEliminationNumber(location: BracketLocation, round: number, order: number): number {
  if (location.section === 'winners') {
    // Round r has half the matches of round r − 1; count the lettered matches before this round.
    const firstRound = location.roundMatches * 2 ** (round - 1);
    let before = 0;
    for (let r = 2; r < round; r++) before += firstRound / 2 ** (r - 1);
    return before + order;
  }
  // Losers rounds come in pairs of equal size after LR1: LR1 = LR2, then LR3 = LR4 = half, ...
  const size = (r: number) => (location.roundMatches * 2 ** Math.floor((round - 1) / 2)) / 2 ** Math.floor((r - 1) / 2);
  let before = 0;
  for (let r = 1; r < round; r++) before += size(r);
  return before + order;
}

/** A match's full name: "Group A · Round 2", "Quarter-final 3", "3rd-place match", "Winners bracket · C". */
export function matchTitle(t: TFunction, match: Pick<MatchView, 'location' | 'round' | 'order'>): string {
  const { location } = match;
  if (location.kind === 'group') return t('match.where', { group: location.groupName, round: match.round });
  if (location.section === 'thirdPlace') return t('bracket.thirdPlace');
  if (location.section === 'secondFinal') return t('bracket.secondFinal');
  if (location.section === 'playOff') {
    return t('bracket.playOffMatch', { range: formatPlace(location.playOff ?? { from: 0, to: 0 }), round: match.round, order: match.order });
  }
  const code = matchCode(t, location, match.round, match.order);
  if (location.section === 'winners') {
    return match.round === location.rounds ? t('bracket.wbFinal', { code }) : t('bracket.winnersMatch', { code });
  }
  if (location.section === 'losers') return t('bracket.losersMatch', { code, round: match.round });
  return t(`bracket.${roundKind(location.roundMatches)}`, { order: match.order, size: location.roundMatches * 2 });
}

/** A match's short code, e.g. "QF3", "SF1", "F", "M3", "C", "L5", "2F" (groups: "R2"). */
export function matchCode(t: TFunction, location: MatchLocationView, round: number, order: number): string {
  if (location.kind === 'group') return `R${round}`;
  switch (location.section) {
    case 'thirdPlace':
      return t('bracket.short.thirdPlace');
    case 'secondFinal':
      return t('bracket.short.secondFinal');
    case 'playOff':
      return t('bracket.short.playOff', { from: location.playOff?.from ?? 0, round, order });
    case 'winners':
      return round === 1 ? t('bracket.short.winnersFirst', { number: order }) : letters(doubleEliminationNumber(location, round, order));
    case 'losers':
      return t('bracket.short.losers', { number: doubleEliminationNumber(location, round, order) });
    case 'main':
      return t(`bracket.short.${roundKind(location.roundMatches)}`, { order, size: location.roundMatches * 2 });
  }
}

/** A double elimination column's heading: "Round 2", "WB final", "LR3". */
export function doubleEliminationRoundTitle(t: TFunction, section: 'winners' | 'losers', round: number, rounds: number): string {
  if (section === 'losers') return t('bracket.rounds.losers', { round });
  return round === rounds ? t('bracket.rounds.wbFinal') : t('bracket.rounds.winners', { round });
}

/** A bracket column's heading: "Quarter-finals", "Round of 16". */
export function roundTitle(t: TFunction, roundMatches: number): string {
  return t(`bracket.rounds.${roundKind(roundMatches)}`, { size: roundMatches * 2 });
}

/** Who plays in a slot, or what it waits for: a name, "BYE", "W QF1", or "TBD". */
export function slotText(t: TFunction, slot: SlotView): { text: string; placeholder: boolean } {
  const name = entryName(slot.entry);
  // An origin label ("1A") stays next to the name once the group has decided it.
  const origin = slot.origin ? `${slot.origin.place}${slot.origin.groupName}` : null;
  if (name) return { text: origin ? `${name} · ${origin}` : name, placeholder: false };
  if (slot.bye) return { text: t('bracket.bye'), placeholder: true };
  if (origin) return { text: origin, placeholder: true };
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

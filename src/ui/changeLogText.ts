import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import type { ChangeLogEntryView, LoggedDrawPlaceView, LoggedMatchView, MatchView, ResultView } from '@/engine';
import { formatGames, playerName } from '@/ui/format';
import { matchTitle } from '@/ui/matchLabels';

/** A logged match: "Open · Group A · Round 2 · J. Kowalski – A. Nowak". */
function loggedMatchText(t: TFunction, match: LoggedMatchView): string {
  const where =
    match.location && match.round !== null && match.order !== null
      ? matchTitle(t, { location: match.location, round: match.round, order: match.order })
      : t('changeLog.removedMatch');
  const side = (players: LoggedMatchView['players'][number]) =>
    players.length ? players.map((p) => playerName(p)).join(' / ') : t('match.unknown');
  return [match.competitionName, where, `${side(match.players[0])} – ${side(match.players[1])}`].filter(Boolean).join(' · ');
}

/** A draw position: "A2 J. Kowalski", or "7" in a bracket; nobody reads as a BYE or free place. */
function drawPlaceText(t: TFunction, place: LoggedDrawPlaceView): string {
  const where = place.group ? `${place.group}${place.position}` : String(place.position);
  const who = place.players.length ? place.players.map((p) => playerName(p)).join(' / ') : t('changeLog.nobody');
  return `${who} (${where})`;
}

/** "11-7 9-11 11-5" or, for a games-only result, "3:1". */
export function scoreText(result: ResultView): string {
  return result.games ? formatGames(result.games) : `${result.gamesWon[0]}:${result.gamesWon[1]}`;
}

/** One line of text per entry type. A new entry type adds its case here and its `changeLog.<type>` key. */
export function entryText(t: TFunction, entry: ChangeLogEntryView): string {
  switch (entry.type) {
    case 'matchAssigned':
    case 'matchUnassigned':
      return t(`changeLog.${entry.type}`, { match: loggedMatchText(t, entry.match), table: entry.table });
    case 'resultRecorded':
      return t('changeLog.resultRecorded', { match: loggedMatchText(t, entry.match), score: scoreText(entry.result) });
    case 'drawSlotsSwapped':
      return t('changeLog.drawSlotsSwapped', { competition: entry.competitionName, a: drawPlaceText(t, entry.a), b: drawPlaceText(t, entry.b) });
    case 'drawPlayerMoved':
      return t('changeLog.drawPlayerMoved', { competition: entry.competitionName, from: drawPlaceText(t, entry.from), to: drawPlaceText(t, entry.to) });
  }
}

/** The match an entry links to on the canvas, if it is still in the draw. */
export function linkedMatch(entry: ChangeLogEntryView): Pick<MatchView, 'id' | 'competition'> | null {
  return 'match' in entry && entry.match.location ? { id: entry.match.id, competition: entry.match.competition } : null;
}

/** Formats a timestamp as a wall-clock time ("14:05:31") in the UI language. */
export function useClockTime(): (at: number) => string {
  const { i18n } = useTranslation();
  const format = new Intl.DateTimeFormat(i18n.language, { timeStyle: 'medium' });
  return (at) => format.format(at);
}

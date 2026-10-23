import { useTranslation } from 'react-i18next';
import type { GroupView, MatchId } from '@/engine';
import { cn } from '@/lib/utils';
import { entryName } from '@/ui/format';
import { originLabel } from '@/ui/matchLabels';
import { MatchCard } from './MatchCard';

/** A group on the canvas: standings, then the group's matches in play order. */
export function GroupBox(props: {
  group: GroupView;
  selectedMatch: MatchId | null;
  onSelectMatch: (id: MatchId, el: HTMLElement) => void;
  /** Opens the group detail (standings, cross table, tiebreak). */
  onOpenDetail: () => void;
}) {
  const { t } = useTranslation();
  const { group } = props;
  const done = group.matches.filter((m) => m.result).length;
  const tieToSettle = group.ties.some((tie) => tie.resolution === null);

  return (
    <div className="w-[628px] rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <button
        type="button"
        className="mb-2 flex w-full items-center gap-2 rounded text-left hover:bg-slate-50"
        aria-label={t('groups.openDetail', { name: group.name })}
        title={t('groups.openDetail', { name: group.name })}
        onClick={props.onOpenDetail}
      >
        <span className="flex size-6 items-center justify-center rounded bg-indigo-600 font-bold text-white">{group.name}</span>
        <span className="font-semibold">{t('groups.group', { name: group.name })}</span>
        <span className="text-xs text-slate-500">{t('groups.played', { done, total: group.matches.length })}</span>
        {group.complete &&
          (tieToSettle ? (
            <span className="text-xs font-semibold text-amber-600">⚠ {t('groups.tieFlag')}</span>
          ) : (
            <span className="text-xs font-semibold text-emerald-600">✓ {t('groups.final')}</span>
          ))}
      </button>
      <table className="mb-2 w-full table-fixed text-xs">
        <thead>
          <tr className="text-[10px] text-slate-400 uppercase">
            <th className="w-8 text-left">{t('groups.place')}</th>
            <th className="text-left">{t('groups.player')}</th>
            <th className="w-12">{t('groups.wonLost')}</th>
            <th className="w-14">{t('groups.games')}</th>
            <th className="w-10">{t('groups.points')}</th>
          </tr>
        </thead>
        <tbody>
          {group.standings.map((row) => {
            const origin = group.entries[row.position - 1]?.origin;
            return (
            <tr key={row.position} className="border-t border-slate-100">
              <td
                className={cn(
                  'py-[3px] pl-1',
                  group.complete ? 'font-semibold' : 'text-slate-400',
                  group.complete && row.tied && 'text-amber-600',
                )}
              >
                {row.place}
              </td>
              <td className="py-[2px] break-words">
                {entryName(row.entry) ?? (origin ? originLabel(origin) : t('match.unknown'))}{' '}
                {row.entry && origin && <span className="text-[10px] font-semibold text-indigo-500">{originLabel(origin)}</span>}{' '}
                {row.entry?.players[0]?.club && <span className="text-[10px] text-slate-400">{row.entry.players[0].club}</span>}
              </td>
              <td className="text-center tabular-nums">
                {row.won}–{row.lost}
              </td>
              <td className="text-center tabular-nums">
                {row.gamesWon}:{row.gamesLost}
              </td>
              <td className="text-center font-semibold">{row.groupPoints}</td>
            </tr>
            );
          })}
        </tbody>
      </table>
      <div className="grid grid-cols-2 gap-2">
        {group.matches.map((match) => (
          <MatchCard
            key={match.id}
            match={match}
            selected={props.selectedMatch === match.id}
            onSelect={(el) => props.onSelectMatch(match.id, el)}
          />
        ))}
      </div>
    </div>
  );
}

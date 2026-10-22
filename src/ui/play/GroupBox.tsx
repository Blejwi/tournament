import { useTranslation } from 'react-i18next';
import type { GroupView, MatchId } from '@/engine';
import { cn } from '@/lib/utils';
import { entryName } from '@/ui/format';
import { MatchCard } from './MatchCard';

/** A group on the canvas: standings, then the group's matches in play order. */
export function GroupBox(props: { group: GroupView; selectedMatch: MatchId | null; onSelectMatch: (id: MatchId, el: HTMLElement) => void }) {
  const { t } = useTranslation();
  const { group } = props;
  const done = group.matches.filter((m) => m.result).length;

  return (
    <div className="w-[458px] rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex size-6 items-center justify-center rounded bg-indigo-600 font-bold text-white">{group.name}</span>
        <span className="font-semibold">{t('groups.group', { name: group.name })}</span>
        <span className="text-xs text-slate-500">{t('groups.played', { done, total: group.matches.length })}</span>
        {group.complete && <span className="text-xs font-semibold text-emerald-600">✓ {t('groups.final')}</span>}
      </div>
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
          {group.standings.map((row) => (
            <tr key={row.position} className="border-t border-slate-100">
              <td className={cn('py-[3px] pl-1', group.complete ? 'font-semibold' : 'text-slate-400')}>{row.place}</td>
              <td className="truncate">
                {entryName(row.entry) ?? t('match.unknown')}{' '}
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
          ))}
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

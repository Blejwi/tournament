import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { GroupView, MatchId } from '@/engine';
import { cn } from '@/lib/utils';
import { entryName } from '@/ui/format';
import { originLabel } from '@/ui/matchLabels';
import { useDisplayMode } from './displayMode';
import { MatchCard } from './MatchCard';
import { hasGames, specialKind } from './specialResults';

/** A group on the canvas: standings, then the group's matches in play order. */
export function GroupBox(props: {
  group: GroupView;
  selectedMatch: MatchId | null;
  /** Without `onSelectMatch` and `onOpenDetail` the box is read-only (the display screen). */
  onSelectMatch?: (id: MatchId, el: HTMLElement) => void;
  /** Opens the group detail (standings, cross table, tiebreak). */
  onOpenDetail?: () => void;
  /** On the display: show only these matches (the one in play and the next) instead of all of the group's. */
  shownMatches?: MatchId[];
}) {
  const { t } = useTranslation();
  const { group } = props;
  const names = useDisplayMode()?.names;
  const done = group.matches.filter((m) => m.result).length;
  const tieToSettle = group.ties.some((tie) => tie.resolution === null);

  return (
    <div className={cn('rounded-lg border border-slate-200 bg-white p-3 shadow-sm', names ? 'w-[388px]' : 'w-[474px]')}>
      <Header
        className="mb-2 flex w-full items-center gap-2 rounded text-left"
        onOpenDetail={props.onOpenDetail}
        label={t('groups.openDetail', { name: group.name })}
      >
        <span className="flex size-6 items-center justify-center rounded bg-indigo-600 font-bold text-white">{group.name}</span>
        <span className={cn('font-semibold', names && 'text-lg')}>{t('groups.group', { name: group.name })}</span>
        <span className="text-xs text-slate-500">{t('groups.played', { done, total: group.matches.length })}</span>
        {group.complete &&
          (tieToSettle ? (
            <span className="text-xs font-semibold text-amber-600">⚠ {t('groups.tieFlag')}</span>
          ) : (
            <span className="text-xs font-semibold text-emerald-600">✓ {t('groups.final')}</span>
          ))}
      </Header>
      <table className={cn('mb-2 w-full table-fixed', names ? 'text-sm' : 'text-xs')}>
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
                {entryName(row.entry, names) ?? (origin ? originLabel(origin) : t('match.unknown'))}{' '}
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
      {group.carriedOver.length > 0 && (
        <ul className="mb-2 grid gap-0.5 text-[11px] text-slate-500" aria-label={t('groups.carriedOverTitle')}>
          {group.carriedOver.map((carried, i) => (
            <li key={i} title={t('groups.carriedOverTitle')} className="flex items-center gap-1.5 italic">
              <span className="font-semibold not-italic">{t('groups.carriedOver')}</span>
              <span className={cn(carried.result.winner === 0 && 'font-semibold text-slate-700')}>{entryName(carried.entries[0], names)}</span>
              <span className="tabular-nums">{hasGames(carried) ? `${carried.result.gamesWon[0]}:${carried.result.gamesWon[1]}` : t(`match.specialBadge.${specialKind(carried.result)!}`)}</span>
              <span className={cn(carried.result.winner === 1 && 'font-semibold text-slate-700')}>{entryName(carried.entries[1], names)}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="grid grid-cols-2 gap-2">
        {(props.shownMatches ? group.matches.filter((m) => props.shownMatches!.includes(m.id)) : group.matches).map((match) => (
          <MatchCard
            key={match.id}
            match={match}
            selected={props.selectedMatch === match.id}
            onSelect={props.onSelectMatch && ((el) => props.onSelectMatch!(match.id, el))}
          />
        ))}
      </div>
    </div>
  );
}

/** The group's title row: a button that opens the detail, or plain text when the box is read-only. */
function Header(props: { className: string; onOpenDetail?: () => void; label: string; children: ReactNode }) {
  if (!props.onOpenDetail) return <div className={props.className}>{props.children}</div>;
  return (
    <button type="button" className={cn(props.className, 'hover:bg-slate-50')} aria-label={props.label} title={props.label} onClick={props.onOpenDetail}>
      {props.children}
    </button>
  );
}

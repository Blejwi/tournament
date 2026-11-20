import { useTranslation } from 'react-i18next';
import type { GroupView } from '@/engine';
import { cn } from '@/lib/utils';
import { entryName, entryNames as names } from '@/ui/format';
import { originLabel } from '@/ui/matchLabels';
import { hasGames, specialKind } from './specialResults';

const ratio = (won: number, lost: number) => (lost === 0 ? (won === 0 ? '–' : '∞') : (won / lost).toFixed(2));

export function Standings({ group }: { group: GroupView }) {
  const { t } = useTranslation();
  return (
    <section>
      <h3 className="mb-1 text-xs font-semibold text-slate-500 uppercase">{t('groupDetail.standings')}</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-right text-[11px] text-slate-400 uppercase">
            <th className="text-left">{t('groups.place')}</th>
            <th className="text-left">{t('groups.player')}</th>
            <th>{t('groups.wonLost')}</th>
            <th>{t('groups.games')}</th>
            <th />
            <th>{t('groupDetail.pointsRatio')}</th>
            <th />
            <th>{t('groups.points')}</th>
          </tr>
        </thead>
        <tbody>
          {group.standings.map((row) => (
            <tr key={row.position} className="border-t text-right tabular-nums">
              <td className={cn('py-1 text-left font-bold', row.tied && 'text-amber-600')}>{row.place}</td>
              <td className="text-left">
                {entryName(row.entry) ?? (group.entries[row.position - 1]?.origin ? originLabel(group.entries[row.position - 1].origin!) : t('match.unknown'))}{' '}
                {row.entry?.players[0]?.club && <span className="text-xs text-slate-400">{row.entry.players[0].club}</span>}
              </td>
              <td>
                {row.won}–{row.lost}
              </td>
              <td>
                {row.gamesWon}:{row.gamesLost}
              </td>
              <td className="text-slate-500">{ratio(row.gamesWon, row.gamesLost)}</td>
              <td>
                {row.pointsWon}:{row.pointsLost}
              </td>
              <td className="text-slate-500">{ratio(row.pointsWon, row.pointsLost)}</td>
              <td className="font-bold">{row.groupPoints}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/** `print`: no table numbers of matches in play, just the results (and a dash for matches not played). */
export function CrossTable({ group, print = false }: { group: GroupView; print?: boolean }) {
  const { t } = useTranslation();
  const ids = group.entries.map((slot) => slot.entry?.id ?? null);
  const cell = (row: string | null, column: string | null, i: number, j: number) => {
    if (i === j) return <td key={j} className="bg-slate-200" />;
    const match = group.matches.find((m) => {
      const pair = [m.slots[0].entry?.id, m.slots[1].entry?.id];
      return row && column && pair.includes(row) && pair.includes(column);
    });
    if (!match) {
      const carried = group.carriedOver.find((c) => row && column && c.entries.some((e) => e.id === row) && c.entries.some((e) => e.id === column));
      if (!carried) return <td key={j} />;
      const side = carried.entries[0].id === row ? 0 : 1;
      const [a, b] = side === 0 ? carried.result.gamesWon : [carried.result.gamesWon[1], carried.result.gamesWon[0]];
      return (
        <td
          key={j}
          title={t('groups.carriedOverTitle')}
          className={cn(
            'text-center font-semibold tabular-nums italic',
            carried.result.winner === side ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600',
          )}
        >
          <span className="mr-0.5 text-[10px] font-normal not-italic opacity-70">↩</span>
          {hasGames(carried) ? `${a}:${b}` : t(`match.specialBadge.${specialKind(carried.result)!}`)}
        </td>
      );
    }
    const side = match.slots[0].entry?.id === row ? 0 : 1;
    if (match.result) {
      const won = match.result.winner === side;
      const [a, b] = side === 0 ? match.result.gamesWon : [match.result.gamesWon[1], match.result.gamesWon[0]];
      return (
        <td
          key={j}
          className={cn('text-center font-semibold tabular-nums', won ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600')}
        >
          {hasGames(match) ? `${a}:${b}` : t(`match.specialBadge.${specialKind(match.result)!}`)}
        </td>
      );
    }
    if (match.table && !print)
      return (
        <td key={j} className="text-center text-xs text-sky-700">
          {t('match.table', { number: match.table.number })}
        </td>
      );
    return (
      <td key={j} className="text-center text-slate-300">
        –
      </td>
    );
  };
  return (
    <section>
      <h3 className="mb-1 text-xs font-semibold text-slate-500 uppercase">{t('groupDetail.crossTable')}</h3>
      <table className="border-collapse text-sm">
        <thead>
          <tr>
            <th />
            {ids.map((_, i) => (
              <th key={i} className="w-16 font-medium text-slate-500">
                {i + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {group.entries.map((slot, i) => (
            <tr key={i} className="border-t">
              <td className="py-1 pr-3">
                <span className="mr-1 text-slate-400">{i + 1}</span>
                {entryName(slot.entry) ?? (slot.origin ? originLabel(slot.origin) : t('match.unknown'))}
              </td>
              {ids.map((column, j) => cell(ids[i], column, i, j))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1 text-xs text-slate-400">
        {t('groupDetail.crossTableHint')}
        {group.carriedOver.length > 0 && ` ${t('groups.carriedOver')}: ${t('groups.carriedOverTitle').toLowerCase()}.`}
      </p>
    </section>
  );
}

export function Trace({ group }: { group: GroupView }) {
  const { t } = useTranslation();
  const steps = group.tiebreak.filter((step) => step.rule !== 'groupPoints');
  return (
    <section>
      <h3 className="mb-1 text-xs font-semibold text-slate-500 uppercase">{t('groupDetail.tiebreak')}</h3>
      {steps.length === 0 ? (
        <p className="text-sm text-slate-500">{t('groupDetail.noTies')}</p>
      ) : (
        <ul className="grid gap-1.5 text-sm">
          {steps.map((step) => (
            <li key={step.place} className="flex gap-3">
              <span className="w-10 shrink-0 font-semibold tabular-nums">
                {t('groupDetail.between', {
                  upper: step.place,
                  lower: step.place + 1,
                })}
              </span>
              <div>
                <div className={cn(step.rule === null && 'text-amber-700')}>
                  {t(`groupDetail.rule.${step.rule ?? 'none'}`, {
                    names: names(step.among),
                  })}
                </div>
                {step.rule !== null && step.rule !== 'decision' && step.rule !== 'lot' && (
                  <div className="text-xs text-slate-500">
                    {step.records
                      .map((r) =>
                        t('groupDetail.record', {
                          ...r,
                          name: entryName(r.entry),
                        }),
                      )
                      .join(' · ')}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

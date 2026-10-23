import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp } from 'lucide-react';
import type { EngineError, EntryView, GroupView, StageId, TieView } from '@/engine';
import { useApp } from '@/app/useApp';
import { errorMessage } from '@/i18n';
import { cn } from '@/lib/utils';
import { Button } from '@/ui/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/ui/components/ui/dialog';
import { entryName } from '@/ui/format';

const ratio = (won: number, lost: number) => (lost === 0 ? (won === 0 ? '–' : '∞') : (won / lost).toFixed(2));

/** A group in detail: full standings, the cross table and the tiebreak trace; settles unbreakable ties. */
export function GroupDetail(props: { stage: StageId; group: GroupView | null; onClose: () => void }) {
  const { t } = useTranslation();
  const { group } = props;
  return (
    <Dialog open={group !== null} onOpenChange={(open) => !open && props.onClose()}>
      {group && (
        <DialogContent closeLabel={t('common.close')} className="max-h-[85vh] overflow-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t('groupDetail.title', { name: group.name })}</DialogTitle>
            <DialogDescription>
              {t('groups.played', {
                done: group.matches.filter((m) => m.result).length,
                total: group.matches.length,
              })}
            </DialogDescription>
          </DialogHeader>
          <Standings group={group} />
          <CrossTable group={group} />
          <Trace group={group} />
          {group.ties
            .filter((tie) => tie.entries.length > 1)
            .map((tie) => (
              <TieResolver
                key={tie.entries
                  .map((e) => e.id)
                  .sort()
                  .join()}
                stage={props.stage}
                group={group}
                tie={tie}
              />
            ))}
        </DialogContent>
      )}
    </Dialog>
  );
}

function Standings({ group }: { group: GroupView }) {
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
                {entryName(row.entry, false) ?? t('match.unknown')}{' '}
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

function CrossTable({ group }: { group: GroupView }) {
  const { t } = useTranslation();
  const ids = group.entries.map((slot) => slot.entry?.id ?? null);
  const cell = (row: string | null, column: string | null, i: number, j: number) => {
    if (i === j) return <td key={j} className="bg-slate-200" />;
    const match = group.matches.find((m) => {
      const pair = [m.slots[0].entry?.id, m.slots[1].entry?.id];
      return row && column && pair.includes(row) && pair.includes(column);
    });
    if (!match) return <td key={j} />;
    const side = match.slots[0].entry?.id === row ? 0 : 1;
    if (match.result) {
      const won = match.result.winner === side;
      const [a, b] = side === 0 ? match.result.gamesWon : [match.result.gamesWon[1], match.result.gamesWon[0]];
      return (
        <td
          key={j}
          className={cn('text-center font-semibold tabular-nums', won ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600')}
        >
          {a}:{b}
        </td>
      );
    }
    if (match.table)
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
                {entryName(slot.entry) ?? t('match.unknown')}
              </td>
              {ids.map((column, j) => cell(ids[i], column, i, j))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1 text-xs text-slate-400">{t('groupDetail.crossTableHint')}</p>
    </section>
  );
}

const names = (entries: EntryView[]) => entries.map((e) => entryName(e)).join(', ');

function Trace({ group }: { group: GroupView }) {
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

/** Puts the tied entries in order (by hand, or by lot) and saves it with `resolveTie`. */
function TieResolver(props: { stage: StageId; group: GroupView; tie: TieView }) {
  const { t } = useTranslation();
  const dispatch = useApp((s) => s.dispatch);
  const [order, setOrder] = useState(props.tie.entries);
  const [editing, setEditing] = useState(props.tie.resolution === null);
  const [error, setError] = useState<EngineError | null>(null);
  const tieNames = names(props.tie.entries);

  // While matches are still to be played, ties come and go: settle them only once the group is complete.
  if (!props.group.complete) return null;

  const save = (entries: EntryView[], method: 'decision' | 'lot') => {
    const failure = dispatch({
      type: 'resolveTie',
      stage: props.stage,
      group: props.group.id,
      order: entries.map((e) => e.id),
      method,
    });
    setError(failure);
    if (!failure) {
      setOrder(entries);
      setEditing(false);
    }
  };
  const move = (i: number, by: -1 | 1) => {
    const next = [...order];
    [next[i], next[i + by]] = [next[i + by], next[i]];
    setOrder(next);
  };

  if (!editing && props.tie.resolution) {
    const how = t(props.tie.resolution === 'lot' ? 'groupDetail.settledLot' : 'groupDetail.settledDecision');
    return (
      <div className="flex items-center gap-3 rounded-md bg-slate-50 p-3 text-sm">
        <span>
          {tieNames}: {t('groupDetail.settled', { how })}
        </span>
        <Button variant="outline" size="sm" className="ml-auto" onClick={() => setEditing(true)}>
          {t('groupDetail.change')}
        </Button>
      </div>
    );
  }

  return (
    <section className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
      <h3 className="font-semibold text-amber-900">{t('groupDetail.tieHeading')}</h3>
      <p className="mb-2 text-amber-800">{t('groupDetail.tieIntro', { names: tieNames })}</p>
      <ol className="mb-3 grid gap-1">
        {order.map((entry, i) => (
          <li key={entry.id} className="flex items-center gap-2 rounded bg-white px-2 py-1">
            <span className="w-5 text-slate-400">{i + 1}.</span>
            <span className="flex-1">{entryName(entry, false)}</span>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              disabled={i === 0}
              aria-label={t('groupDetail.moveUp', { name: entryName(entry) })}
              title={t('groupDetail.moveUp', { name: entryName(entry) })}
              onClick={() => move(i, -1)}
            >
              <ArrowUp className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              disabled={i === order.length - 1}
              aria-label={t('groupDetail.moveDown', { name: entryName(entry) })}
              title={t('groupDetail.moveDown', { name: entryName(entry) })}
              onClick={() => move(i, 1)}
            >
              <ArrowDown className="size-4" />
            </Button>
          </li>
        ))}
      </ol>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => save(order, 'decision')}>
          {t('groupDetail.saveDecision')}
        </Button>
        <Button size="sm" variant="outline" onClick={() => save(drawLots(order), 'lot')}>
          {t('groupDetail.drawLots')}
        </Button>
      </div>
      {error && <p className="mt-2 text-red-600">{errorMessage(t, error)}</p>}
    </section>
  );
}

/** A random order (Fisher–Yates with crypto randomness); the engine itself never draws at random. */
function drawLots<T>(items: T[]): T[] {
  const result = [...items];
  const random = crypto.getRandomValues(new Uint32Array(result.length));
  for (let i = result.length - 1; i > 0; i--) {
    const j = random[i] % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

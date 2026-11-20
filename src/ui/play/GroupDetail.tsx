import { CrossTable, Standings, Trace } from './GroupTables';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp } from 'lucide-react';
import type { EngineError, EntryView, GroupView, StageId, TieView } from '@/engine';
import { useApp } from '@/app/useApp';
import { errorMessage } from '@/i18n';
import { Button } from '@/ui/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/ui/components/ui/dialog';
import { entryName, entryNames as names } from '@/ui/format';

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
            <span className="flex-1">{entryName(entry)}</span>
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

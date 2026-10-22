import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { Pause, X } from 'lucide-react';
import { gamesWon, getFreeTables, parseGames, validateResult, type EngineError, type MatchView } from '@/engine';
import { useApp, useQuery } from '@/app/useApp';
import { errorMessage } from '@/i18n';
import { cn } from '@/lib/utils';
import { Button } from '@/ui/components/ui/button';
import { entryName, formatClock, formatGames } from '@/ui/format';

/** Actions for one match, one click from the draw: call to a free table, enter the score. */
export function MatchPopover(props: { match: MatchView; style: CSSProperties; onClose: () => void }) {
  const { t } = useTranslation();
  const { match, onClose } = props;
  const dispatch = useApp((s) => s.dispatch);
  const freeTables = useQuery(getFreeTables) ?? [];
  const [error, setError] = useState<EngineError | null>(null);
  const live = match.status === 'in_progress' || match.status === 'overdue';
  const canScore = match.status === 'ready' || match.status === 'busy' || live;

  return (
    <div
      data-nopan
      role="dialog"
      aria-label={t('match.where', { group: match.location.groupName, round: match.round })}
      style={props.style}
      onPointerDown={(e) => e.stopPropagation()}
      className="absolute z-20 w-[340px] overflow-y-auto rounded-xl bg-white text-sm shadow-2xl ring-1 ring-slate-300"
    >
      <div className="flex items-center gap-2 rounded-t-xl border-b bg-slate-50 px-3 py-2">
        <span className="font-semibold">{t('match.where', { group: match.location.groupName, round: match.round })}</span>
        <span className="ml-auto rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 uppercase">
          {t(`match.status.${match.status}`)}
        </span>
        <button type="button" onClick={onClose} aria-label={t('common.close')} title={t('common.close')} className="rounded p-1 text-slate-500 hover:bg-black/10">
          <X className="size-4" />
        </button>
      </div>
      <div className="grid gap-3 p-3">
        <div className="grid gap-1.5">
          {([0, 1] as const).map((side) => {
            const entry = match.slots[side].entry;
            return (
              <div key={side} className={cn('flex items-center gap-2', match.result?.winner === side && 'font-semibold')}>
                <span className="w-4 text-[10px] text-slate-400">{side === 0 ? 'A' : 'B'}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate">{entryName(entry, false) ?? <i className="text-slate-400">{t('match.unknown')}</i>}</div>
                  {entry?.players[0]?.club && <div className="text-xs font-normal text-slate-400">{entry.players[0].club}</div>}
                </div>
                {match.result && <span className="text-lg tabular-nums">{match.result.gamesWon[side]}</span>}
              </div>
            );
          })}
        </div>

        {match.status === 'pending' && (
          <p className="rounded bg-slate-50 p-2 text-xs text-slate-500">{match.slots.every((s) => s.entry) ? t('match.pendingDraw') : t('match.pendingPlayers')}</p>
        )}
        {match.status === 'busy' && (
          <p className="flex items-center gap-1 rounded bg-amber-50 p-2 text-xs text-amber-800">
            <Pause className="size-3" aria-hidden />
            {t('match.busy')}
          </p>
        )}

        {match.status === 'ready' && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">{t('match.callHeading')}</p>
            {freeTables.length ? (
              <div className="mt-1 grid grid-cols-4 gap-1.5">
                {freeTables.map((table) => (
                  <button
                    key={table.id}
                    type="button"
                    title={table.name || undefined}
                    onClick={() => {
                      const failure = dispatch({ type: 'assignMatch', match: match.id, table: table.id, at: Date.now() });
                      setError(failure);
                    }}
                    className="rounded-md border border-emerald-300 bg-emerald-50 py-1 text-center font-bold text-emerald-800 hover:bg-emerald-100"
                  >
                    {table.number}
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-xs text-slate-500">{t('match.noFreeTable')}</p>
            )}
          </div>
        )}

        {live && (
          <div className="flex items-center gap-2">
            <span className="rounded bg-slate-900 px-2 py-0.5 font-bold text-white">{t('match.table', { number: match.table?.number })}</span>
            <span className="text-base font-bold text-sky-700 tabular-nums">{formatClock(match.elapsedMs ?? 0)}</span>
            <Button variant="ghost" size="sm" className="ml-auto text-red-600" onClick={() => setError(dispatch({ type: 'unassignMatch', match: match.id }))}>
              {t('match.takeOff')}
            </Button>
          </div>
        )}

        {canScore && <ScoreEntry key={match.id} match={match} autoFocus={live} onDone={onClose} />}

        {match.result?.games && (
          <p className="border-t pt-2 text-xs text-slate-500">
            {formatGames(match.result.games)}
            {match.table && ` · ${t('match.table', { number: match.table.number })}`}
            {match.assignedAt !== null &&
              match.finishedAt !== null &&
              ` · ${t('match.duration', { minutes: Math.round((match.finishedAt - match.assignedAt) / 60_000) })}`}
          </p>
        )}
        {error && (
          <p role="alert" className="text-destructive text-xs">
            {errorMessage(t, error)}
          </p>
        )}
      </div>
    </div>
  );
}

/** Typed game scores ("11-7 9-11 11-5"), validated live by the engine. Enter saves, Esc closes. */
function ScoreEntry(props: { match: MatchView; autoFocus: boolean; onDone: () => void }) {
  const { t } = useTranslation();
  const { match } = props;
  const dispatch = useApp((s) => s.dispatch);
  const [text, setText] = useState('');
  const [saveError, setSaveError] = useState<EngineError | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (props.autoFocus) input.current?.focus();
  }, [props.autoFocus]);

  const parsed = text.trim() ? parseGames(text) : null;
  const games = parsed?.ok ? parsed.value : null;
  const validation = useQuery((s) => (games ? validateResult(s, match.id, { kind: 'games', games }) : null), [match.id, text]);
  const error = saveError ?? (parsed && !parsed.ok ? parsed.error : validation);
  const valid = games !== null && !error;

  function save() {
    if (!games || !valid) return;
    const failure = dispatch({ type: 'recordResult', match: match.id, result: { kind: 'games', games }, at: Date.now() });
    if (failure) setSaveError(failure);
    else props.onDone();
  }

  let preview: string | null = null;
  if (valid) {
    const [a, b] = gamesWon(games);
    preview = t('match.scorePreview', { games: `${a}:${b}`, name: entryName(match.slots[a > b ? 0 : 1].entry) });
  }

  return (
    <div>
      <label htmlFor={`score-${match.id}`} className="text-xs font-semibold text-slate-500 uppercase">
        {t('match.scoreHeading')}
      </label>
      <div className="mt-1 flex gap-1">
        <input
          id={`score-${match.id}`}
          ref={input}
          value={text}
          autoComplete="off"
          spellCheck={false}
          placeholder={t('match.scorePlaceholder')}
          aria-invalid={(text.trim() !== '' && !valid) || undefined}
          aria-describedby={`score-help-${match.id}`}
          onChange={(e) => {
            setText(e.target.value);
            setSaveError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              save();
            } else if (e.key === 'Escape') {
              e.stopPropagation();
              props.onDone();
            }
          }}
          className={cn(
            'min-w-0 flex-1 rounded border px-2 py-1.5 font-mono text-sm outline-none focus:ring-2 focus:ring-slate-300',
            !text.trim() ? 'border-slate-300' : valid ? 'border-emerald-500 bg-emerald-50' : 'border-red-400 bg-red-50',
          )}
        />
        <Button size="sm" disabled={!valid} onClick={save}>
          {t('match.saveScore')} ⏎
        </Button>
      </div>
      <p id={`score-help-${match.id}`} className={cn('mt-1 min-h-4 text-xs', error ? 'text-red-600' : valid ? 'font-medium text-emerald-700' : 'text-slate-400')}>
        {text.trim() && error ? errorMessage(t, error) : (preview ?? t('match.scoreHint', { name: entryName(match.slots[0].entry) }))}
      </p>
    </div>
  );
}

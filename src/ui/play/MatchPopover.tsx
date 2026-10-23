import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { Pause, X } from 'lucide-react';
import {
  gamesWon,
  getCompetitions,
  getCorrectionPreview,
  getFreeTables,
  parseResult,
  validateResult,
  type EngineError,
  type MatchResult,
  type MatchView,
} from '@/engine';
import { useApp, useQuery } from '@/app/useApp';
import { errorMessage } from '@/i18n';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/ui/components/ui/alert-dialog';
import { Button } from '@/ui/components/ui/button';
import { entryName, formatClock, formatGames } from '@/ui/format';
import { formatPlace, matchTitle, slotText } from '@/ui/matchLabels';
import { busyLines } from './busy';
import { overdueText } from './overdueStyle';
import { ResultBadge } from './ResultBadge';
import { hasGames } from './specialResults';
import { SpecialResultEntry } from './SpecialResultEntry';

/** Actions for one match, one click from the draw: call to a free table, enter the score. */
export function MatchPopover(props: { match: MatchView; style: CSSProperties; onClose: () => void }) {
  const { t } = useTranslation();
  const { match, onClose } = props;
  const dispatch = useApp((s) => s.dispatch);
  const freeTables = useQuery(getFreeTables) ?? [];
  const competitions = useQuery(getCompetitions) ?? [];
  const [error, setError] = useState<EngineError | null>(null);
  const [correcting, setCorrecting] = useState(false);
  const live = match.status === 'in_progress' || match.status === 'overdue';
  const canScore = match.status === 'ready' || match.status === 'busy' || live;

  return (
    <div
      data-nopan
      role="dialog"
      aria-label={matchTitle(t, match)}
      style={props.style}
      onPointerDown={(e) => e.stopPropagation()}
      className="absolute z-20 w-[340px] overflow-y-auto rounded-xl bg-white text-sm shadow-2xl ring-1 ring-slate-300"
    >
      <div className="flex items-center gap-2 rounded-t-xl border-b bg-slate-50 px-3 py-2">
        <span className="font-semibold">{matchTitle(t, match)}</span>
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
                  <div className="break-words">{entry ? entryName(entry) : <i className="text-slate-400">{slotText(t, match.slots[side]).text}</i>}</div>
                  {entry?.players[0]?.club && <div className="text-xs font-normal text-slate-400">{entry.players[0].club}</div>}
                </div>
                <ResultBadge match={match} side={side} />
                {hasGames(match) && <span className="text-lg tabular-nums">{match.result!.gamesWon[side]}</span>}
              </div>
            );
          })}
        </div>

        {match.places && (match.places.winner || match.places.loser) && (
          <p className="text-xs text-slate-500">
            {[
              match.places.winner && t('bracket.winnerPlace', { place: formatPlace(match.places.winner) }),
              match.places.loser && t('bracket.loserPlace', { place: formatPlace(match.places.loser) }),
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}
        {match.decidedByBye && (
          <p className="rounded bg-slate-50 p-2 text-xs text-slate-500">
            {t('bracket.decidedByBye', { name: entryName(match.slots[0].entry ?? match.slots[1].entry) ?? t('bracket.bye') })}
          </p>
        )}
        {match.status === 'pending' && (
          <p className="rounded bg-slate-50 p-2 text-xs text-slate-500">{match.slots.every((s) => s.entry) ? t('match.pendingDraw') : t('match.pendingPlayers')}</p>
        )}
        {match.status === 'busy' && (
          <div className="grid gap-0.5 rounded bg-amber-50 p-2 text-xs text-amber-800">
            {(match.busyWith.length ? busyLines(t, match, competitions) : [t('match.busy')]).map((line) => (
              <p key={line} className="flex items-center gap-1">
                <Pause className="size-3 shrink-0" aria-hidden />
                {line}
              </p>
            ))}
          </div>
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
            <span className={cn('text-base font-bold tabular-nums', overdueText(match))}>{formatClock(match.elapsedMs ?? 0)}</span>
            <span className="text-xs text-slate-400">{t('tablesPanel.expected', { minutes: Math.round(match.expectedMs / 60_000) })}</span>
            <Button variant="ghost" size="sm" className="ml-auto text-red-600" onClick={() => setError(dispatch({ type: 'unassignMatch', match: match.id, at: Date.now() }))}>
              {t('match.takeOff')}
            </Button>
          </div>
        )}
        {live && <StartTimeEditor key={match.assignedAt} match={match} onError={setError} />}
        {match.overdue && match.elapsedMs !== null && (
          <p className={cn('rounded p-2 text-xs', match.overdue === 'red' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800')}>
            {t('match.overdueNote', { percent: Math.round((match.elapsedMs / match.expectedMs) * 100) })}
          </p>
        )}

        {canScore && <ScoreEntry key={match.id} match={match} autoFocus={live} onDone={onClose} />}
        {canScore && <SpecialResultEntry key={`special-${match.id}`} match={match} onDone={onClose} />}
        {match.result &&
          (correcting ? (
            <ScoreEntry key={`correct-${match.id}`} match={match} correcting autoFocus onDone={() => setCorrecting(false)} />
          ) : (
            <Button variant="outline" size="sm" className="justify-self-start" onClick={() => setCorrecting(true)}>
              {t('match.correct')}
            </Button>
          ))}

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

/** "Started [N] min ago": moves the match clock, e.g. when the players came to the table late. */
function StartTimeEditor(props: { match: MatchView; onError: (error: EngineError | null) => void }) {
  const { t } = useTranslation();
  const { match } = props;
  const dispatch = useApp((s) => s.dispatch);
  const [minutes, setMinutes] = useState(String(Math.round((match.elapsedMs ?? 0) / 60_000)));
  const value = Number(minutes);
  const valid = minutes.trim() !== '' && Number.isFinite(value) && value >= 0;

  function save() {
    if (!valid) return;
    props.onError(dispatch({ type: 'setMatchStart', match: match.id, at: Date.now() - Math.round(value * 60_000) }));
  }

  return (
    <div className="flex items-center gap-1.5 text-xs text-slate-500">
      <span>{t('match.startedPrefix')}</span>
      <input
        type="number"
        min={0}
        value={minutes}
        aria-label={t('match.startedLabel')}
        onChange={(e) => setMinutes(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            save();
          }
        }}
        className="w-14 rounded border border-slate-300 px-1 py-0.5 text-sm tabular-nums"
      />
      <span>{t('match.startedSuffix')}</span>
      <Button variant="outline" size="sm" className="h-6 px-2 text-xs" disabled={!valid} onClick={save}>
        {t('match.setStart')}
      </Button>
    </div>
  );
}

/**
 * Typed game scores ("11-7 9-11 11-5"), validated live by the engine. Enter saves, Esc closes.
 * `correcting` changes the recorded result instead: if later matches already used a player the
 * correction replaces, saving first asks to reset them, listing them.
 */
function ScoreEntry(props: { match: MatchView; autoFocus: boolean; correcting?: boolean; onDone: () => void }) {
  const { t } = useTranslation();
  const { match, correcting = false } = props;
  const dispatch = useApp((s) => s.dispatch);
  const [text, setText] = useState('');
  const [saveError, setSaveError] = useState<EngineError | null>(null);
  const [confirming, setConfirming] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (props.autoFocus) input.current?.focus();
  }, [props.autoFocus]);

  const parsed = text.trim() ? parseResult(text) : null;
  const result = parsed?.ok ? parsed.value : null;
  const recording = useQuery((s) => (result && !correcting ? validateResult(s, match.id, result) : null), [match.id, text, correcting]);
  const correction = useQuery((s) => (result && correcting ? getCorrectionPreview(s, match.id, result, Date.now()) : null), [match.id, text, correcting]);
  const validation = correcting ? (correction?.error ?? null) : recording;
  const error = saveError ?? (parsed && !parsed.ok ? parsed.error : validation);
  const valid = result !== null && !error;
  const resets = correction?.resets ?? [];

  function commit(chosen: MatchResult, force: boolean) {
    const failure = correcting
      ? dispatch({ type: 'correctResult', match: match.id, result: chosen, force, at: Date.now() })
      : dispatch({ type: 'recordResult', match: match.id, result: chosen, at: Date.now() });
    if (failure) setSaveError(failure);
    else props.onDone();
  }

  function save() {
    if (!result || !valid) return;
    if (correcting && resets.length) setConfirming(true);
    else commit(result, false);
  }

  let preview: string | null = null;
  if (valid && (result.kind === 'games' || result.kind === 'gamesOnly')) {
    const [a, b] = result.kind === 'games' ? gamesWon(result.games) : result.games;
    preview = t('match.scorePreview', { games: `${a}:${b}`, name: entryName(match.slots[a > b ? 0 : 1].entry) });
    if (correcting) preview += ` · ${resets.length ? t('match.correctionResets', { count: resets.length }) : t('match.correctionKeepsTiming')}`;
  }

  const id = `${correcting ? 'correct' : 'score'}-${match.id}`;
  return (
    <div>
      <label htmlFor={id} className="text-xs font-semibold text-slate-500 uppercase">
        {t(correcting ? 'match.correctHeading' : 'match.scoreHeading')}
      </label>
      <div className="mt-1 flex gap-1">
        <input
          id={id}
          ref={input}
          value={text}
          autoComplete="off"
          spellCheck={false}
          placeholder={t('match.scorePlaceholder')}
          aria-invalid={(text.trim() !== '' && !valid) || undefined}
          aria-describedby={`${id}-help`}
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
          {t(correcting ? 'match.saveCorrection' : 'match.saveScore')} ⏎
        </Button>
      </div>
      <p id={`${id}-help`} className={cn('mt-1 min-h-4 text-xs', error ? 'text-red-600' : valid ? 'font-medium text-emerald-700' : 'text-slate-400')}>
        {text.trim() && error
          ? errorMessage(t, error)
          : (preview ?? t(match.gamesOnlyAllowed ? 'match.scoreHintQuick' : 'match.scoreHint', { name: entryName(match.slots[0].entry) }))}
      </p>
      {correcting && result && <ResetDialog open={confirming} onOpenChange={setConfirming} resets={resets} onConfirm={() => commit(result, true)} />}
    </div>
  );
}

/** Confirms a forced correction, listing the matches it resets. */
function ResetDialog(props: { open: boolean; onOpenChange: (open: boolean) => void; resets: MatchView[]; onConfirm: () => void }) {
  const { t } = useTranslation();
  return (
    <AlertDialog open={props.open} onOpenChange={props.onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('match.resetTitle')}</AlertDialogTitle>
          <AlertDialogDescription>{t('match.resetDescription', { count: props.resets.length })}</AlertDialogDescription>
        </AlertDialogHeader>
        <ul className="grid gap-1 text-sm">
          {props.resets.map((m) => (
            <li key={m.id} className="flex items-center gap-2 rounded border px-2 py-1">
              <span className="font-medium">{matchTitle(t, m)}</span>
              <span className="min-w-0 flex-1 truncate text-slate-600">
                {slotText(t, m.slots[0]).text} – {slotText(t, m.slots[1]).text}
                {m.result && ` · ${m.result.gamesWon.join(':')}`}
              </span>
              <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 uppercase">{t(`match.status.${m.status}`)}</span>
            </li>
          ))}
        </ul>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={props.onConfirm}>{t('match.resetConfirm')}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

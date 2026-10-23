import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { parseGames, validateResult, type EngineError, type MatchResult, type MatchView, type SpecialResultKind } from '@/engine';
import { useApp, useQuery } from '@/app/useApp';
import { errorMessage } from '@/i18n';
import { cn } from '@/lib/utils';
import { Button } from '@/ui/components/ui/button';
import { entryName } from '@/ui/format';

const KINDS: SpecialResultKind[] = ['walkover', 'retirement', 'disqualification'];

/** Records a walkover, retirement or disqualification: pick the kind and the winner (a retirement may keep the games played). */
export function SpecialResultEntry(props: { match: MatchView; onDone: () => void }) {
  const { t } = useTranslation();
  const { match } = props;
  const dispatch = useApp((s) => s.dispatch);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<SpecialResultKind>('walkover');
  const [winner, setWinner] = useState<0 | 1 | null>(null);
  const [gamesText, setGamesText] = useState('');
  const [saveError, setSaveError] = useState<EngineError | null>(null);

  const parsedGames = kind === 'retirement' && gamesText.trim() ? parseGames(gamesText) : null;
  const result: MatchResult | null =
    winner === null || (parsedGames && !parsedGames.ok)
      ? null
      : kind === 'retirement'
        ? { kind, winner, games: parsedGames?.ok ? parsedGames.value : [] }
        : { kind, winner };
  const validation = useQuery((s) => (result ? validateResult(s, match.id, result) : null), [match.id, kind, winner, gamesText]);
  const error = saveError ?? (parsedGames && !parsedGames.ok ? parsedGames.error : validation);
  const valid = result !== null && !error;

  function save() {
    if (!result || !valid) return;
    const failure = dispatch({ type: 'recordResult', match: match.id, result, at: Date.now() });
    if (failure) setSaveError(failure);
    else props.onDone();
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-left text-xs font-semibold text-slate-500 uppercase hover:text-slate-800">
        {t('match.specialHeading')} …
      </button>
    );
  }

  const choice = (active: boolean) =>
    cn('rounded border px-2 py-1 text-xs font-medium', active ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-300 bg-white hover:bg-slate-50');

  return (
    <div className="grid gap-2 border-t pt-2">
      <p className="text-xs font-semibold text-slate-500 uppercase">{t('match.specialHeading')}</p>
      <div role="group" aria-label={t('match.specialKind')} className="flex flex-wrap gap-1">
        {KINDS.map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={kind === k}
            className={choice(kind === k)}
            onClick={() => {
              setKind(k);
              setSaveError(null);
            }}
          >
            {t(`match.special.${k}`)}
          </button>
        ))}
      </div>
      <div role="group" aria-label={t('match.specialWinner')} className="grid gap-1">
        <span className="text-xs text-slate-500">{t('match.specialWinner')}</span>
        {([0, 1] as const).map((side) => (
          <button
            key={side}
            type="button"
            aria-pressed={winner === side}
            className={cn(choice(winner === side), 'truncate text-left')}
            onClick={() => {
              setWinner(side);
              setSaveError(null);
            }}
          >
            {entryName(match.slots[side].entry) ?? (side === 0 ? 'A' : 'B')}
          </button>
        ))}
      </div>
      {kind === 'retirement' && (
        <div>
          <label htmlFor={`special-games-${match.id}`} className="text-xs text-slate-500">
            {t('match.specialGames')}
          </label>
          <input
            id={`special-games-${match.id}`}
            value={gamesText}
            autoComplete="off"
            spellCheck={false}
            placeholder={t('match.scorePlaceholder')}
            aria-describedby={`special-games-help-${match.id}`}
            onChange={(e) => {
              setGamesText(e.target.value);
              setSaveError(null);
            }}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 font-mono text-sm outline-none focus:ring-2 focus:ring-slate-300"
          />
          <p id={`special-games-help-${match.id}`} className="mt-1 text-xs text-slate-400">
            {t('match.specialGamesHint')}
          </p>
        </div>
      )}
      {error && (
        <p role="alert" className="text-xs text-red-600">
          {errorMessage(t, error)}
        </p>
      )}
      <Button size="sm" disabled={!valid} onClick={save}>
        {t('match.specialRecord', { kind: t(`match.special.${kind}`).toLowerCase() })}
      </Button>
    </div>
  );
}

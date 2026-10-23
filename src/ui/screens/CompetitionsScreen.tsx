import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { getCompetition, getCompetitions, getExpectedDurations, type DrawState, type EngineError, type GamesToWin, type TournamentState } from '@/engine';
import { useApp, useQuery } from '@/app/useApp';
import { errorMessage } from '@/i18n';
import { Button } from '@/ui/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/components/ui/table';
import { FormError, FormField } from '@/ui/components/FormField';
import { GamesToWinSelect } from '@/ui/components/GamesToWinSelect';
import { errorField } from '@/ui/formErrors';

/** The draw state of a competition's first stage, for the list. */
function drawStateOf(state: TournamentState, id: string): DrawState | 'none' {
  return getCompetition(state, id)?.stages[0]?.drawState ?? 'none';
}

export function CompetitionsScreen() {
  const { t } = useTranslation();
  const competitions = useQuery((s) => getCompetitions(s).map((c) => ({ ...c, drawState: drawStateOf(s, c.id) }))) ?? [];

  return (
    <section className="grid gap-4">
      <h2 className="sr-only">{t('competitions.heading')}</h2>
      <AddCompetitionForm />
      {competitions.length === 0 ? (
        <p className="text-muted-foreground">{t('competitions.empty')}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('competitions.name')}</TableHead>
              <TableHead className="w-32 text-right">{t('competitions.gamesToWin')}</TableHead>
              <TableHead className="w-28 text-right">{t('competitions.entries')}</TableHead>
              <TableHead className="w-40">{t('competitions.status')}</TableHead>
              <TableHead className="w-24 text-right">{t('common.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {competitions.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">
                  <Link to={c.id} className="hover:underline">
                    {c.name}
                  </Link>
                </TableCell>
                <TableCell className="text-right tabular-nums">{c.gamesToWin}</TableCell>
                <TableCell className="text-right tabular-nums">{c.entryCount}</TableCell>
                <TableCell>{t(`competitions.drawState.${c.drawState}`)}</TableCell>
                <TableCell className="text-right">
                  <Button asChild variant="outline" size="sm">
                    <Link to={c.id}>{t('competitions.setUp')}</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <ExpectedDurationsForm />
    </section>
  );
}

const GAMES_TO_WIN: GamesToWin[] = [2, 3, 4];

/** Expected match duration per games-to-win value: a match on its table longer than this is overdue. */
function ExpectedDurationsForm() {
  const { t } = useTranslation();
  const dispatch = useApp((s) => s.dispatch);
  const durations = useQuery(getExpectedDurations);
  const [drafts, setDrafts] = useState<Partial<Record<GamesToWin, string>>>({});
  const [error, setError] = useState<EngineError | null>(null);
  if (!durations) return null;

  function save(gamesToWin: GamesToWin) {
    const draft = drafts[gamesToWin];
    if (draft === undefined) return;
    const failure = dispatch({ type: 'setExpectedDuration', gamesToWin, minutes: draft.trim() === '' ? Number.NaN : Number(draft) });
    setError(failure);
    if (!failure) setDrafts((current) => ({ ...current, [gamesToWin]: undefined }));
  }

  return (
    <div className="grid gap-2 border-t pt-4">
      <h3 className="font-semibold">{t('durations.heading')}</h3>
      <p className="text-muted-foreground text-sm">{t('durations.hint')}</p>
      <div className="flex flex-wrap items-end gap-3">
        {GAMES_TO_WIN.map((n) => (
          <FormField
            key={n}
            className="w-44"
            type="number"
            min={1}
            step={1}
            label={t('durations.label', { count: n })}
            value={drafts[n] ?? String(durations[n])}
            onChange={(e) => setDrafts({ ...drafts, [n]: e.target.value })}
            onBlur={() => save(n)}
            onKeyDown={(e) => e.key === 'Enter' && save(n)}
            invalid={drafts[n] !== undefined && error !== null}
          />
        ))}
      </div>
      <FormError message={error && errorMessage(t, error)} />
    </div>
  );
}

function AddCompetitionForm() {
  const { t } = useTranslation();
  const dispatch = useApp((s) => s.dispatch);
  const [name, setName] = useState('');
  const [gamesToWin, setGamesToWin] = useState<GamesToWin>(3);
  const [error, setError] = useState<EngineError | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const failure = dispatch({ type: 'addCompetition', name, gamesToWin });
    setError(failure);
    if (!failure) setName('');
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-2">
      <div className="flex flex-wrap items-end gap-3">
        <FormField
          className="min-w-48 flex-1"
          label={t('competitions.name')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          invalid={errorField(error) === 'name'}
        />
        <GamesToWinSelect value={gamesToWin} onChange={setGamesToWin} />
        <Button type="submit">{t('competitions.add')}</Button>
      </div>
      <FormError message={error && errorMessage(t, error)} />
    </form>
  );
}

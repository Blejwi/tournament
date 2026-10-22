import { useId, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { getTournament, importTournament, type EngineError, type TournamentView } from '@/engine';
import { useApp } from '@/app/useApp';
import { errorMessage } from '@/i18n';
import { Button } from '@/ui/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/components/ui/card';
import { Input } from '@/ui/components/ui/input';
import { Label } from '@/ui/components/ui/label';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { FormError } from '@/ui/components/FormField';
import { formatDate } from '@/ui/format';

interface ChosenFile {
  text: string;
  tournament: TournamentView;
}

/** Restores a tournament from a backup file, as a new tournament or replacing an existing one. */
export function ImportTournamentCard() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const fileId = useId();
  const targetId = useId();
  const tournaments = useApp((s) => s.tournaments);
  const importIntoStore = useApp((s) => s.importTournament);
  const [chosen, setChosen] = useState<ChosenFile | null>(null);
  const [error, setError] = useState<EngineError | null>(null);
  const [replaceId, setReplaceId] = useState('');

  async function choose(event: ChangeEvent<HTMLInputElement>) {
    setChosen(null);
    setError(null);
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text().catch(() => '');
    // Validate up front, so the operator sees what the file holds before choosing what to do with it.
    const preview = importTournament({ id: 'preview', file: text });
    if (!preview.ok) return setError(preview.error);
    const tournament = getTournament(preview.value);
    setChosen({ text, tournament });
    const sameName = tournaments.find((row) => row.name === tournament.name);
    setReplaceId(sameName?.id ?? tournaments[0]?.id ?? '');
  }

  function run(target: Parameters<typeof importIntoStore>[1]) {
    if (!chosen) return;
    const result = importIntoStore(chosen.text, target);
    if ('error' in result) return setError(result.error);
    navigate(`/tournaments/${result.id}`);
  }

  const replaced = tournaments.find((row) => row.id === replaceId);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('importFile.heading')}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-muted-foreground text-sm">{t('importFile.intro')}</p>
        <div className="grid gap-1.5">
          <Label htmlFor={fileId}>{t('importFile.file')}</Label>
          <Input id={fileId} type="file" accept=".json,application/json" onChange={choose} />
        </div>
        <FormError message={error && errorMessage(t, error)} />
        {chosen && (
          <>
            <p className="text-sm">
              {t('importFile.found', {
                name: chosen.tournament.name,
                date: formatDate(chosen.tournament.date, i18n.language),
              })}
            </p>
            <div className="flex flex-wrap items-end gap-4">
              <Button onClick={() => run({ mode: 'new' })}>{t('importFile.asNew')}</Button>
              {tournaments.length > 0 && (
                <div className="flex flex-wrap items-end gap-2">
                  <div className="grid gap-1.5">
                    <Label htmlFor={targetId}>{t('importFile.replaceTarget')}</Label>
                    <select
                      id={targetId}
                      value={replaceId}
                      onChange={(e) => setReplaceId(e.target.value)}
                      className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                    >
                      {tournaments.map((row) => (
                        <option key={row.id} value={row.id}>
                          {row.name} ({formatDate(row.date, i18n.language)})
                        </option>
                      ))}
                    </select>
                  </div>
                  <ConfirmDialog
                    trigger={
                      <Button variant="outline" disabled={!replaced}>
                        {t('importFile.replace')}
                      </Button>
                    }
                    title={t('importFile.replaceTitle', { name: replaced?.name ?? '' })}
                    description={t('importFile.replaceBody', { name: replaced?.name ?? '' })}
                    confirmLabel={t('importFile.replace')}
                    onConfirm={() => run({ mode: 'replace', id: replaceId })}
                  />
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

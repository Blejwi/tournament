import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react';
import type { EngineError } from '@/engine';
import { useApp } from '@/app/useApp';
import { errorMessage } from '@/i18n';
import { Button } from '@/ui/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/components/ui/card';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { FormError, FormField } from '@/ui/components/FormField';
import { errorField } from '@/ui/formErrors';
import { formatDate, todayIso } from '@/ui/format';

export function TournamentListScreen() {
  const { t, i18n } = useTranslation();
  const tournaments = useApp((s) => s.tournaments);
  const deleteTournament = useApp((s) => s.deleteTournament);
  const sorted = [...tournaments].sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name));

  return (
    <div className="mx-auto grid max-w-4xl gap-6 p-4 md:p-8">
      <h1 className="text-2xl font-semibold">{t('tournaments.heading')}</h1>
      <NewTournamentForm />
      {sorted.length === 0 ? (
        <p className="text-muted-foreground">{t('tournaments.empty')}</p>
      ) : (
        <ul className="grid gap-2">
          {sorted.map((tournament) => (
            <li key={tournament.id} className="flex items-center gap-4 rounded-lg border p-4">
              <div className="min-w-0 flex-1">
                <Link to={`/tournaments/${tournament.id}`} className="font-medium hover:underline">
                  {tournament.name}
                </Link>
                <div className="text-muted-foreground text-sm">
                  {formatDate(tournament.date, i18n.language)}
                  {tournament.venue && ` · ${tournament.venue}`}
                </div>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link to={`/tournaments/${tournament.id}`}>{t('tournaments.open')}</Link>
              </Button>
              <ConfirmDialog
                trigger={
                  <Button variant="ghost" size="icon" aria-label={t('common.delete')} title={t('common.delete')}>
                    <Trash2 />
                  </Button>
                }
                title={t('tournaments.deleteTitle')}
                description={t('tournaments.deleteBody', { name: tournament.name })}
                confirmLabel={t('common.delete')}
                onConfirm={() => deleteTournament(tournament.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NewTournamentForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const createTournament = useApp((s) => s.createTournament);
  const [name, setName] = useState('');
  const [date, setDate] = useState(todayIso);
  const [venue, setVenue] = useState('');
  const [error, setError] = useState<EngineError | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const result = createTournament({ name, date, venue });
    if ('error' in result) return setError(result.error);
    navigate(`/tournaments/${result.id}`);
  }

  const invalid = errorField(error);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('tournaments.new')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} noValidate className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-[2fr_1fr_2fr]">
            <FormField label={t('tournaments.name')} value={name} onChange={(e) => setName(e.target.value)} invalid={invalid === 'name'} />
            <FormField label={t('tournaments.date')} type="date" value={date} onChange={(e) => setDate(e.target.value)} invalid={invalid === 'date'} />
            <FormField label={t('tournaments.venue')} optional value={venue} onChange={(e) => setVenue(e.target.value)} />
          </div>
          <FormError message={error && errorMessage(t, error)} />
          <div>
            <Button type="submit">{t('tournaments.create')}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

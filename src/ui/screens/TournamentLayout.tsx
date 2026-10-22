import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { getTournament } from '@/engine';
import { useApp, useQuery } from '@/app/useApp';
import { cn } from '@/lib/utils';
import { BackupReminder, DownloadBackupButton } from '@/ui/components/Backup';
import { formatDate } from '@/ui/format';

/** Opens the tournament named in the URL and frames its screens (tables, players, ...). */
export function TournamentLayout() {
  const { tournamentId = '' } = useParams();
  const { t, i18n } = useTranslation();
  const openTournament = useApp((s) => s.openTournament);
  const [found, setFound] = useState(true);
  const tournament = useQuery(getTournament);

  useEffect(() => {
    setFound(openTournament(tournamentId));
  }, [openTournament, tournamentId]);

  if (!found) {
    return (
      <div className="mx-auto grid max-w-4xl gap-4 p-4 md:p-8">
        <p>{t('tournaments.notFound')}</p>
        <BackLink />
      </div>
    );
  }
  if (!tournament || tournament.id !== tournamentId) return null;

  const tabs = [
    { to: 'tables', label: t('nav.tables') },
    { to: 'players', label: t('nav.players') },
  ];

  return (
    <div className="mx-auto grid max-w-5xl gap-6 p-4 md:p-8">
      <div className="grid gap-2">
        <BackLink />
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="grid gap-2">
            <h1 className="text-2xl font-semibold">{tournament.name}</h1>
            <p className="text-muted-foreground text-sm">
              {formatDate(tournament.date, i18n.language)}
              {tournament.venue && ` · ${tournament.venue}`}
            </p>
          </div>
          <DownloadBackupButton />
        </div>
      </div>
      <BackupReminder />
      <nav className="flex gap-1 border-b">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              cn(
                '-mb-px border-b-2 px-4 py-2 text-sm font-medium',
                isActive ? 'border-primary text-foreground' : 'text-muted-foreground hover:text-foreground border-transparent',
              )
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}

function BackLink() {
  const { t } = useTranslation();
  return (
    <Link to="/" className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm">
      <ArrowLeft className="size-4" aria-hidden />
      {t('tournaments.backToList')}
    </Link>
  );
}

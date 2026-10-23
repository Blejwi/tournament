import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useMatches, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { getTournament } from '@/engine';
import { useApp, useQuery } from '@/app/useApp';
import { cn } from '@/lib/utils';
import { BackupReminder, DownloadBackupButton } from '@/ui/components/Backup';
import { formatDate } from '@/ui/format';

/** Route `handle` of a tournament screen. `fullBleed` screens (the canvas) fill the window below a compact header. */
export interface TournamentRouteHandle {
  fullBleed?: boolean;
}

/** Opens the tournament named in the URL and frames its screens (play, competitions, tables). */
export function TournamentLayout() {
  const { tournamentId = '' } = useParams();
  const { t, i18n } = useTranslation();
  const openTournament = useApp((s) => s.openTournament);
  const [found, setFound] = useState(true);
  const tournament = useQuery(getTournament);
  const fullBleed = useMatches().some((m) => (m.handle as TournamentRouteHandle | undefined)?.fullBleed);

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

  const nav = <TournamentNav />;
  const dateLine = (
    <>
      {formatDate(tournament.date, i18n.language)}
      {tournament.venue && ` · ${tournament.venue}`}
    </>
  );

  if (fullBleed) {
    return (
      <div className="flex h-[calc(100dvh-3.5rem)] flex-col">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b bg-white px-4 pt-1">
          <BackLink />
          <div className="leading-tight">
            <h1 className="font-semibold">{tournament.name}</h1>
            <p className="text-muted-foreground text-xs">{dateLine}</p>
          </div>
          {nav}
          <div className="ml-auto py-1">
            <DownloadBackupButton />
          </div>
        </div>
        <BackupReminder />
        <Outlet />
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-6 p-4 md:p-8">
      <div className="grid gap-2">
        <BackLink />
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="grid gap-2">
            <h1 className="text-2xl font-semibold">{tournament.name}</h1>
            <p className="text-muted-foreground text-sm">{dateLine}</p>
          </div>
          <DownloadBackupButton />
        </div>
      </div>
      <BackupReminder />
      <div className="border-b">{nav}</div>
      <Outlet />
    </div>
  );
}

function TournamentNav() {
  const { t } = useTranslation();
  const tabs = [
    { to: 'play', label: t('nav.play') },
    { to: 'competitions', label: t('nav.competitions') },
    { to: 'tables', label: t('nav.tables') },
  ];
  return (
    <nav className="flex gap-1">
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

import { Link, Outlet } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Trophy } from 'lucide-react';
import { LanguageSwitch } from '@/ui/components/LanguageSwitch';

/** Page frame: header with the app title and the language switch. */
export function AppShell() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-14 items-center justify-between border-b px-4">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <Trophy className="size-5" aria-hidden />
          {t('app.title')}
        </Link>
        <LanguageSwitch />
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}

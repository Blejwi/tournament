import { useTranslation } from 'react-i18next';
import { Download, X } from 'lucide-react';
import { getBackupReminder, getTournament } from '@/engine';
import { useApp, useQuery } from '@/app/useApp';
import { Button } from '@/ui/components/ui/button';
import { backupFileName, downloadTextFile } from '@/ui/download';
import { useNow } from '@/ui/useNow';

/** Downloads the open tournament as a backup file. */
function useDownloadBackup() {
  const exportCurrent = useApp((s) => s.exportCurrent);
  const tournament = useQuery(getTournament);
  return () => downloadTextFile(backupFileName(tournament?.name ?? ''), exportCurrent());
}

export function DownloadBackupButton() {
  const { t } = useTranslation();
  const download = useDownloadBackup();
  return (
    <Button variant="outline" size="sm" onClick={download}>
      <Download />
      {t('backup.download')}
    </Button>
  );
}

/** Non-blocking reminder to download a backup, shown only while the tournament is live. */
export function BackupReminder() {
  const { t } = useTranslation();
  const now = useNow();
  const backup = useApp((s) => s.backup);
  const postpone = useApp((s) => s.postponeBackup);
  const download = useDownloadBackup();
  const reminder = useQuery((state) => getBackupReminder(state, { now, ...backup }), [now, backup]);
  if (!reminder?.due) return null;

  return (
    <div role="status" className="bg-muted flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
      <div className="min-w-0 flex-1">
        <p className="font-medium">{t('backup.reminderTitle')}</p>
        <p className="text-muted-foreground">{t('backup.reminderBody')}</p>
      </div>
      <Button size="sm" onClick={download}>
        <Download />
        {t('backup.download')}
      </Button>
      <Button variant="ghost" size="sm" onClick={postpone}>
        <X />
        {t('backup.later')}
      </Button>
    </div>
  );
}

/// <reference types="vite-plugin-pwa/react" />
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/ui/components/ui/button';

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Registers the service worker and tells the operator when the app works offline or a new version
 * is deployed. The new version only activates when the operator accepts it, so a page never reloads
 * mid-entry; tournaments live in localStorage and survive the reload.
 */
export function UpdatePrompt() {
  const { t } = useTranslation();
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Tournaments run all day: look for a newly deployed version every hour while online.
      if (!registration) return;
      setInterval(() => {
        if (navigator.onLine) void registration.update();
      }, UPDATE_CHECK_INTERVAL_MS);
    },
  });

  if (!offlineReady && !needRefresh) return null;

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  return (
    <div
      role="status"
      className="fixed right-4 bottom-4 z-50 flex max-w-sm flex-col gap-3 rounded-lg border bg-background p-4 text-sm shadow-lg"
    >
      <p>{needRefresh ? t('pwa.updateAvailable') : t('pwa.offlineReady')}</p>
      <div className="flex justify-end gap-2">
        {needRefresh ? (
          <>
            <Button variant="outline" size="sm" onClick={close}>
              {t('pwa.later')}
            </Button>
            <Button size="sm" onClick={() => void updateServiceWorker(true)}>
              {t('pwa.reload')}
            </Button>
          </>
        ) : (
          <Button variant="outline" size="sm" onClick={close}>
            {t('common.close')}
          </Button>
        )}
      </div>
    </div>
  );
}

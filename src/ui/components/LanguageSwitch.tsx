import { useTranslation } from 'react-i18next';
import { LANGUAGES, setLanguage } from '@/i18n';
import { cn } from '@/lib/utils';

/** EN / PL toggle shown in the header. */
export function LanguageSwitch() {
  const { t, i18n } = useTranslation();
  return (
    <div role="group" aria-label={t('app.language')} className="flex rounded-md border p-0.5 text-xs">
      {LANGUAGES.map((language) => {
        const selected = i18n.resolvedLanguage === language;
        return (
          <button
            key={language}
            type="button"
            title={t(`languages.${language}`)}
            aria-pressed={selected}
            onClick={() => setLanguage(language)}
            className={cn(
              'rounded px-2 py-1 font-medium uppercase',
              selected ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {language}
          </button>
        );
      })}
    </div>
  );
}

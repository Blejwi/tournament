import { useId, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/ui/components/ui/input';
import { Label } from '@/ui/components/ui/label';
import { cn } from '@/lib/utils';

/** A labelled input. `invalid` marks it as the field an engine error refers to. */
export function FormField({
  label,
  optional,
  invalid,
  className,
  ...inputProps
}: { label: string; optional?: boolean; invalid?: boolean } & ComponentProps<'input'>) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <div className={cn('grid gap-1.5', className)}>
      <Label htmlFor={id}>
        {label}
        {optional && <span className="text-muted-foreground font-normal">({t('common.optional')})</span>}
      </Label>
      <Input id={id} aria-invalid={invalid || undefined} {...inputProps} />
    </div>
  );
}

/** Shows a translated engine error under a form. */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-destructive text-sm">
      {message}
    </p>
  );
}

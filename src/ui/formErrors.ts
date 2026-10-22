import type { EngineError } from '@/engine';

/** Which form field an engine error is about, so the form can highlight it. */
export function errorField(error: EngineError | null): string | null {
  if (!error) return null;
  switch (error.code) {
    case 'required':
    case 'invalidDate':
      return error.field;
    case 'invalidTableNumber':
    case 'tableNumberTaken':
      return 'number';
    case 'invalidRating':
      return 'rating';
    case 'invalidBirthYear':
      return 'birthYear';
    default:
      return null;
  }
}

/** Parses an optional number input: empty → null. */
export function optionalNumber(value: string): number | null {
  return value.trim() === '' ? null : Number(value);
}

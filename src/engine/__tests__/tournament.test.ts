import { describe, expect, it } from 'vitest';
import { createTournament, getTournament } from '@/engine';
import { errorOf, unwrap } from './helpers';

describe('creating a tournament', () => {
  it('stores its name, date and venue', () => {
    const state = unwrap(
      createTournament({ id: 'spring', name: 'Spring Open', date: '2026-05-01', venue: 'City Hall' }),
    );

    expect(getTournament(state)).toEqual({
      id: 'spring',
      name: 'Spring Open',
      date: '2026-05-01',
      venue: 'City Hall',
    });
  });

  it('needs a name', () => {
    const result = createTournament({ id: 'x', name: '   ', date: '2026-05-01', venue: '' });
    expect(errorOf(result)).toEqual({ code: 'required', field: 'name' });
  });

  it('needs a real calendar date', () => {
    for (const date of ['', '1.5.2026', '2026-02-30']) {
      const result = createTournament({ id: 'x', name: 'Open', date, venue: '' });
      expect(errorOf(result)).toEqual({ code: 'invalidDate', field: 'date' });
    }
  });

  it('allows an empty venue and trims the text fields', () => {
    const state = unwrap(createTournament({ id: 'x', name: '  Open ', date: '2026-05-01', venue: '  ' }));
    expect(getTournament(state)).toMatchObject({ name: 'Open', venue: '' });
  });
});

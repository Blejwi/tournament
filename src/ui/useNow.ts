import { useEffect, useState } from 'react';
import type { Timestamp } from '@/engine';

/** The current time in epoch milliseconds (the engine's `Timestamp`), refreshed every `everyMs`. Time-dependent queries take it as `now`. */
export function useNow(everyMs = 1_000): Timestamp {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(timer);
  }, [everyMs]);
  return now;
}

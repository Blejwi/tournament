import { useEffect, useState } from 'react';

/** The current time as an ISO timestamp, refreshed every `everyMs`. Time-dependent queries take it as `now`. */
export function useNow(everyMs = 30_000): string {
  const [now, setNow] = useState(() => new Date().toISOString());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date().toISOString()), everyMs);
    return () => clearInterval(timer);
  }, [everyMs]);
  return now;
}

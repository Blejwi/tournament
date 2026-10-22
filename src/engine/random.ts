/**
 * Seeded randomness. The engine never calls Math.random: draws take a `randomSeed`,
 * so the same seed always gives the same draw (ADR 0004).
 */
export interface Random {
  /** A float in [0, 1). */
  next(): number;
}

/** mulberry32: small, fast and good enough for shuffling a draw. */
export function seededRandom(seed: number): Random {
  let a = seed >>> 0;
  return {
    next() {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

/** A shuffled copy (Fisher–Yates). */
export function shuffle<T>(items: readonly T[], random: Random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random.next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

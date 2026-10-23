/** "A", "B", ..., "Z", "AA", "AB", ... for 1, 2, ... (group names, double elimination match codes). */
export function letterName(n: number): string {
  let text = '';
  for (let k = n; k > 0; k = Math.floor((k - 1) / 26)) text = String.fromCharCode(65 + ((k - 1) % 26)) + text;
  return text;
}
